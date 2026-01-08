const { drizzle } = require('drizzle-orm/d1');
const { integer, text, eq, and, isNull, not, isNotNull } = require('drizzle-orm/sqlite-core');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 常量定义
const DB_NAME = 'cloudflare-demo-db';
const LOG_FILE = 'orm-run.log';
const BATCH_SIZE = 10; // 批量处理大小
const COOLDOWN_TIME = 1000; // 冷却时间（毫秒）
const RETRY_DELAY = 30000; // 重试延迟时间（毫秒）

// 记录日志
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    try {
        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (error) {
        console.error('记录日志失败:', error);
    }
}

// 执行 SQL 查询并返回结果（用于直接执行 SQL 命令）
function executeSQLQuery(query) {
    try {
        const command = `npx wrangler d1 execute ${DB_NAME} --remote --json --command="${query}"`;
        const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
        
        // 解析输出
        const start = output.indexOf('[');
        const end = output.lastIndexOf(']') + 1;
        
        if (start === -1 || end === 0) {
            log('❌ 无法在输出中找到有效的 JSON 数组');
            return null;
        }

        const cleanJson = output.substring(start, end);
        const result = JSON.parse(cleanJson);
        return result[0]?.results || [];
        
    } catch (error) {
        log(`❌ SQL 查询执行失败: ${error.message}`);
        if (error.stdout) log('标准输出:', error.stdout);
        if (error.stderr) log('标准错误:', error.stderr);
        return null;
    }
}

// 检查表是否存在
function tableExists(tableName) {
    const query = `PRAGMA table_info(${tableName})`;
    const result = executeSQLQuery(query);
    return result && result.length > 0;
}

// 检查案件ID是否存在
function checkCaseIdExists(caseId) {
    log(`🔍 检查案件ID ${caseId} 是否存在`);
    
    const query = `SELECT case_id FROM missing_persons_cases WHERE case_id = '${caseId}' LIMIT 1`;
    const result = executeSQLQuery(query);
    
    if (result && result.length > 0) {
        log(`✅ 案件ID ${caseId} 存在`);
        return true;
    } else {
        log(`❌ 案件ID ${caseId} 不存在`);
        return false;
    }
}

// 获取多个需要处理的案件（支持批量处理）
function getCasesToProcess(batchSize = BATCH_SIZE) {
    log(`🔍 正在从 missing_persons_cases 表中查找需要处理的案件，批量大小: ${batchSize}`);
    
    const query = `
        SELECT c.case_id, c.case_url, c.case_title, c.scraped_content 
        FROM missing_persons_cases c
        LEFT JOIN missing_persons_info i ON c.case_id = i.case_id
        WHERE i.id IS NULL AND c.scraped_content IS NOT NULL AND c.scraped_content != ''
        LIMIT ${batchSize}
    `;
    
    const result = executeSQLQuery(query);
    if (result && result.length > 0) {
        log(`✅ 找到 ${result.length} 个需要处理的案件`);
        result.forEach((caseItem, index) => {
            log(`   ${index + 1}. case_id=${caseItem.case_id}, 标题=${caseItem.case_title}`);
        });
        return result;
    } else {
        log('❌ 没有找到需要处理的案件');
        return null;
    }
}

// 安全解析JSON
function safeParseJSON(str) {
    try {
        // 清理JSON字符串
        const cleaned = cleanJsonString(str);
        return JSON.parse(cleaned);
    } catch (error) {
        log(`❌ JSON解析失败: ${error.message}`);
        return null;
    }
}

// 调用AI API（带重试机制）
async function callApiWithRetry(content) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + process.env.CLOUDFLARE_ACCOUNT_ID + '/ai/run/@cf/meta/llama-3.1-8b-instruct', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: content
                        }
                    ],
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.result && data.result.response) {
                return data.result.response;
            } else {
                throw new Error('AI响应格式不正确');
            }
        } catch (error) {
            retryCount++;
            log(`❌ AI调用失败 (尝试 ${retryCount}/${maxRetries}): ${error.message}`);
            if (retryCount < maxRetries) {
                log(`⏱️  等待 ${RETRY_DELAY / 1000} 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                throw new Error('AI调用重试次数已用完');
            }
        }
    }
}

// 安全解析JSON字符串
function safeParseJSON(str) {
    try {
        // 首先尝试直接解析
        return JSON.parse(str);
    } catch (error) {
        try {
            // 如果直接解析失败，尝试清理字符串
            const cleaned = cleanJsonString(str);
            return JSON.parse(cleaned);
        } catch (cleanError) {
            // 如果清理后仍然失败，尝试提取JSON部分
            const jsonMatch = str.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (extractError) {
                    throw new Error(`无法解析JSON数据: ${extractError.message}`);
                }
            }
            throw new Error(`无法从字符串中提取有效的JSON数据: ${str.substring(0, 100)}...`);
        }
    }
}

// 调用AI API并支持重试机制
async function callApiWithRetry(prompt, maxRetries = 3) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct`;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    
    if (!apiToken) {
        throw new Error('CLOUDFLARE_API_TOKEN 环境变量未设置');
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    stream: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(`API 调用失败: ${data.errors?.[0]?.message || '未知错误'}`);
            }
            
            if (!data.result?.response) {
                throw new Error('API 响应格式错误: 缺少 result.response');
            }
            
            return data.result.response;
            
        } catch (error) {
            log(`❌ 第 ${attempt} 次 API 调用失败: ${error.message}`);
            
            if (attempt === maxRetries) {
                throw new Error(`API 调用失败 (${maxRetries} 次尝试后): ${error.message}`);
            }
            
            // 等待一段时间后重试
            const waitTime = attempt * 2000; // 递增等待时间
            log(`⏰ 等待 ${waitTime}ms 后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// 调用 ai-cf-to-info.js 提取案件信息
 
async function extractCaseDetailsWithAI(scrapedContent, caseId) {
    try {
        console.log('📤 发送请求到AI服务...');
        
        // 构建AI提示词
        const prompt = `请提取以下信息并以JSON格式返回：
- missing_county: 县/郡
- missing_state: 州/省  
- missing_city: 城市
- caseid: 案件ID（从文件名提取：${caseId}）

重要规则：
- JSON内部的双引号必须用反斜杠转义，或者将身高中的双引号替换为"inches"
- 测量值（身高、体重）中严禁使用双引号，例如将5'5"改写为5'5 inches或5 feet 5 inches，只保留数字和基本单引号

死命令：
- 禁止换行：所有字段值必须在一行内完成，字符串值内部严禁使用回车键
- 禁止未转义引号：字段值内严禁使用双引号，身高用inches代替"，描述用单引号'
- 压缩格式：返回紧凑的一行JSON格式，不要缩进

请确保：
- 使用英文键名
- 返回纯JSON格式，不要包含任何额外说明
- 从以下案件内容中提取信息：\n\n${scrapedContent.substring(0, 3000)}`;
        
        const aiResponse = await callApiWithRetry(prompt);
        
        // 1. 此时 aiResponse 可能是: 'Here is the data: {"id":"1"} \n'
        const caseDetails = safeParseJSON(aiResponse);
        
        // 2. 必须立刻判断 caseDetails 是否解析成功
        if (!caseDetails || typeof caseDetails !== 'object') {
            throw new Error(`无法从 AI 响应中解析出有效的对象。原始内容: ${aiResponse.substring(0, 50)}...`);
        }

        // 3. 字段容错处理 (不论 AI 返回 county 还是 missing_county)
        const validatedData = {
            missing_county: caseDetails.missing_county || caseDetails.county || "未知",
            missing_state: caseDetails.missing_state || caseDetails.state || "未知",
            missing_city: caseDetails.missing_city || caseDetails.city || "未知",
            caseid: caseDetails.caseid || caseId
        };

        console.log('✅ 案件信息提取成功');
        
        // 4. 重要：这里返回的是【已经解析好的对象】，不是字符串！
        return {
            success: true,
            data: validatedData
        };
        
    } catch (error) {
        // 如果这里报错 position 120，说明 safeParseJSON 抛出了异常
        // 或者在解析成功后的某个地方又调用了 JSON.parse
        return { success: false, error: error.message };
    }
}
// 将提取的信息存入数据库
function saveCaseInfo(caseId, caseInfo) {
    log(`💾 正在将案件 ${caseId} 的信息存入 missing_persons_info 表`);
    
    try {
        // 检查案件ID是否存在
        if (!checkCaseIdExists(caseId)) {
            log(`❌ 外键约束失败：案件ID ${caseId} 在 missing_persons_cases 表中不存在`);
            return false;
        }
        
        const insertData = {
            case_id: caseId,
            missing_county: caseInfo.missing_county,
            missing_state: caseInfo.missing_state,
            missing_city: caseInfo.missing_city
        };
        
        // 构建 INSERT 语句
        const columns = Object.keys(insertData).map(key => key).join(', ');
        const values = Object.values(insertData).map(value => {
            if (value === null || value === undefined) {
                return 'NULL';
            }
            return `'${value.toString().replace(/'/g, "''")}'`;
        }).join(', ');
        
        const query = `INSERT INTO missing_persons_info (${columns}) VALUES (${values});`;
        
        // 使用文件模式执行 INSERT
        const tempSqlPath = path.join(__dirname, `insert_${caseId}.sql`);
        fs.writeFileSync(tempSqlPath, query, 'utf8');
        
        // 添加SQL文件内容调试输出
        log(`🔧 生成SQL文件: ${tempSqlPath}`);
        log(`📝 SQL文件内容: ${query}`);
        
        const command = `npx wrangler d1 execute ${DB_NAME} --remote --json --file="${tempSqlPath}"`;
        
        log('🔧 正在执行SQL文件...');
        
        try {
            const output = execSync(command, { encoding: 'utf8', timeout: 30000 });
            log(`✅ 命令执行成功，输出: ${output}`);
            
            if (fs.existsSync(tempSqlPath)) {
                fs.unlinkSync(tempSqlPath);
                log('🗑️  SQL文件已删除');
            }
            
            log(`✅ 案件 ${caseId} 的信息已成功存入数据库`);
            return true;
        } catch (execError) {
            log(`❌ 执行插入文件失败: ${execError.message}`);
            
            // 输出完整的错误信息
            if (execError.stdout) {
                log(`📄 标准输出:`);
                log(execError.stdout);
            }
            if (execError.stderr) {
                log(`📄 标准错误:`);
                log(execError.stderr);
            }
            
            // 尝试直接执行简单的INSERT语句以诊断问题
            log('🔧 尝试使用简化的INSERT语句进行诊断...');
            try {
                const simpleQuery = `INSERT INTO missing_persons_info (case_id, missing_county, missing_state, missing_city) VALUES ('${caseId}', 'Test County', 'Test State', 'Test City');`;
                const simpleOutput = execSync(`npx wrangler d1 execute ${DB_NAME} --remote --json --command="${simpleQuery}"`, { encoding: 'utf8' });
                log(`📄 简化查询输出: ${simpleOutput}`);
            } catch (simpleError) {
                log(`📄 简化查询错误: ${simpleError.message}`);
                if (simpleError.stdout) log(`📄 简化查询标准输出: ${simpleError.stdout}`);
                if (simpleError.stderr) log(`📄 简化查询标准错误: ${simpleError.stderr}`);
            }
            
            if (fs.existsSync(tempSqlPath)) {
                fs.unlinkSync(tempSqlPath);
                log('🗑️  SQL文件已删除');
            }
            
            return false;
        }
        
    } catch (error) {
        log(`❌ 构造保存信息失败: ${error.message}`);
        log(`错误堆栈: ${error.stack}`);
        return false;
    }
}

// 清理JSON字符串
function cleanJsonString(str) {
    // 移除多余的空格和换行
    let cleaned = str.trim();
    
    // 尝试提取JSON部分（如果AI返回了额外文本）
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }
    
    // 修复常见的JSON格式问题
    cleaned = cleaned
        .replace(/,\s*}/g, '}') // 移除尾随逗号
        .replace(/,\s*]/g, ']') // 移除数组尾随逗号
        .replace(/'/g, '"')     // 单引号转双引号
        .replace(/(\w+):/g, '"$1":') // 为键添加引号
        .replace(/(\"[^\"]+\")\s*\n\s*(\"[^\"]+\")/g, '$1,\n$2') // 添加缺失的逗号
        .replace(/\n\s*\n/g, '\n') // 移除多余的空行
        .replace(/\s+/g, ' ') // 标准化空格
        .replace(/\\"/g, '"') // 处理转义引号
        .replace(/\\n/g, ' ') // 处理转义换行符
        .replace(/\\t/g, ' ') // 处理转义制表符
        .replace(/\\r/g, ' ') // 处理转义回车符
        .replace(/\\u[0-9a-fA-F]{4}/g, '') // 移除Unicode转义序列
        .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
        .replace(/(\"[^\"]+\")\s*:\s*([^\"\{\}\[\],\s][^,\}\]]*)/g, '$1: "$2"') // 为未引号的值添加引号
        .replace(/(\"[^\"]+\")\s*:\s*([^\"\{\}\[\],\s]+)(?=\s*[,}\]]|$)/g, '$1: "$2"') // 为未引号的简单值添加引号
        .replace(/\"\"\"/g, '"') // 修复三重引号
        .replace(/\"\"/g, '"') // 修复双重引号
        .replace(/\s*:\s*/g, ': ') // 标准化冒号周围的空格
        .replace(/\s*,\s*/g, ', ') // 标准化逗号周围的空格
        .replace(/\s*\n\s*/g, '\n  ') // 标准化换行和缩进
        .replace(/\{\s*\n\s*/g, '{\n  ') // 标准化对象开始
        .replace(/\n\s*\}/g, '\n}') // 标准化对象结束
        .replace(/\[\s*\n\s*/g, '[\n  ') // 标准化数组开始
        .replace(/\n\s*\]/g, '\n]'); // 标准化数组结束
    
    return cleaned;
}

// 显示倒计时
function showCountdown(seconds) {
    return new Promise((resolve) => {
        let remaining = seconds;
        const interval = setInterval(() => {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`⏰ 下一批处理将在 ${remaining} 秒后开始...`);
            remaining--;
            
            if (remaining < 0) {
                clearInterval(interval);
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                resolve();
            }
        }, 1000);
    });
}

// 主函数
async function main() {
    log('🚀 启动 ORM Run 批量处理程序');
    log('📦 使用 Drizzle ORM 进行数据库操作');
    log(`📊 批量处理大小: ${BATCH_SIZE} 个案件`);
    log(`⏱️  批次间隔: ${COOLDOWN_TIME / 1000} 秒`);
    
    try {
        // 1. 检查 missing_persons_info 表是否存在，不存在则创建
        log('📋 检查 missing_persons_info 表是否存在');
        
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS missing_persons_info ( 
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                case_id TEXT UNIQUE NOT NULL, 
                missing_county TEXT, 
                missing_state TEXT, 
                missing_city TEXT, 
                analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                -- 添加外键约束
                CONSTRAINT fk_missing_persons_info_case_id 
                    FOREIGN KEY (case_id) 
                    REFERENCES missing_persons_cases(case_id) 
                    ON DELETE CASCADE
            )
        `;
        executeSQLQuery(createTableQuery);
        log('✅ 确保 missing_persons_info 表存在');
        
        let totalProcessed = 0;
        
        // 循环处理案件，直到没有需要处理的案件
        while (true) {
            // 2. 获取一批需要处理的案件
            const casesToProcess = getCasesToProcess();
            if (!casesToProcess || casesToProcess.length === 0) {
                log('🏁 没有需要处理的案件，程序结束');
                log(`📊 总共处理了 ${totalProcessed} 个案件`);
                return;
            }
            
            // 3. 循环处理每个案件
            for (const [index, caseToProcess] of casesToProcess.entries()) {
                log(`\n🔢 处理第 ${index + 1}/${casesToProcess.length} 个案件`);
                
                try {
                    // 调用 AI 提取案件信息
                    log('🧠 正在调用 AI 服务...');
                    const aiResult = await extractCaseDetailsWithAI(caseToProcess.scraped_content, caseToProcess.case_id);
                    if (!aiResult.success) {
                        log(`❌ AI 提取信息失败: ${aiResult.error}`);
                        continue;
                    }
                    
                    // 将提取的信息存入数据库
                    log('💾 正在准备保存数据...');
                    const saveResult = saveCaseInfo(caseToProcess.case_id, aiResult.data);
                    if (saveResult) {
                        log(`✅ 案件 ${caseToProcess.case_id} 处理完成`);
                        totalProcessed++;
                    } else {
                        log(`❌ 案件 ${caseToProcess.case_id} 保存失败`);
                    }
                    
                } catch (error) {
                    log(`❌ 处理案件 ${caseToProcess.case_id} 时发生错误: ${error.message}`);
                    log(`错误堆栈: ${error.stack}`);
                }
            }
            
            // 4. 冷却时间
            log(`\n⏱️  批次处理完成，等待 ${COOLDOWN_TIME / 1000} 秒`);
            await showCountdown(COOLDOWN_TIME / 1000);
        }
        
    } catch (error) {
        log(`❌ 程序运行发生错误: ${error.message}`);
        log(`错误堆栈: ${error.stack}`);
        process.exit(1);
    }
}

// 执行主函数
main().catch(error => {
    log(`❌ 主函数执行失败: ${error.message}`);
    process.exit(1);
});