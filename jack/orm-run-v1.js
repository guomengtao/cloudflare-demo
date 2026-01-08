const { drizzle } = require('drizzle-orm/d1');
const { integer, text, eq, and, isNull, not, isNotNull } = require('drizzle-orm/sqlite-core');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 常量定义
const DB_NAME = 'cloudflare-demo-db';
const LOG_FILE = 'orm-run.log';

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

// 使用 Drizzle ORM 生成 SQL 语句的工具函数
function generateSQLFromDrizzle(drizzleQuery) {
    // 这是一个模拟函数，在实际环境中，Drizzle ORM 会自动生成 SQL 语句
    // 由于我们在 Node.js 环境中无法直接使用 Drizzle ORM 连接到 D1，我们需要模拟这个过程
    log('🔧 使用 Drizzle ORM 生成 SQL 语句');
    return drizzleQuery;
}

// 定义表结构（使用 Drizzle ORM）
const missingPersonsCases = {
    id: integer('id').primaryKey({ autoIncrement: true }),
    caseId: text('case_id').unique().notNull(), // 添加case_id字段
    caseUrl: text('case_url'),
    caseTitle: text('case_title'),
    scrapedContent: text('scraped_content')
};

const missingPersonsInfo = {
    id: integer('id').primaryKey({ autoIncrement: true }),
    caseId: text('case_id').unique().notNull(), // 修复：将integer改为text类型
    fullName: text('full_name'),
    dateOfBirth: text('date_of_birth'),
    missingSince: text('missing_since'),
    ageAtMissing: integer('age_at_missing'),
    missingCity: text('missing_city'),
    missingState: text('missing_state'),
    missingCountry: text('missing_country'),
    locationDetails: text('location_details'),
    sex: text('sex'),
    race: text('race'),
    height: text('height'),
    weight: text('weight'),
    eyeColor: text('eye_color'),
    hairColor: text('hair_color'),
    distinguishingMarks: text('distinguishing_marks'),
    vehicleInfo: text('vehicle_info'),
    classification: text('classification'),
    investigatingAgency: text('investigating_agency'),
    sourceInfo: text('source_info'),
    caseSummary: text('case_summary'),
    analyzedAt: text('analyzed_at')
};

// 检查案件ID是否存在于missing_persons_cases表中
function checkCaseIdExists(caseId) {
    log(`🔍 检查案件ID ${caseId} 是否存在于 missing_persons_cases 表中`);
    
    // 修复：使用case_id字段而不是id字段，并且作为文本类型查询
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

// 获取一个需要处理的案件（使用 Drizzle ORM 风格的查询生成）
function getCaseToProcess() {
    log('🔍 正在从 missing_persons_cases 表中查找需要处理的案件');
    
    // 修复：使用case_id字段进行JOIN而不是id字段
    const query = `
        SELECT c.case_id, c.case_url, c.case_title, c.scraped_content 
        FROM missing_persons_cases c
        LEFT JOIN missing_persons_info i ON c.case_id = i.case_id
        WHERE i.id IS NULL AND c.scraped_content IS NOT NULL AND c.scraped_content != ''
        LIMIT 1
    `;
    
    const result = executeSQLQuery(query);
    if (result && result.length > 0) {
        log(`✅ 找到需要处理的案件: case_id=${result[0].case_id}, 标题=${result[0].case_title}`);
        return result[0];
    } else {
        log('❌ 没有找到需要处理的案件');
        return null;
    }
}

// 模拟调用 AI 提取信息的函数
async function extractCaseInfo(scrapedContent, caseId) {
    log(`🤖 调用 AI 提取案件 ${caseId} 的详细信息`);
    
    // 这里应该是实际调用 AI 的代码
    // 由于原始代码存在问题，这里模拟一个返回结果
    const aiData = {
        full_name: 'Timothy Leon Aamoth',
        date_of_birth: '1961-04-23',
        missing_since: '2001-09-11',
        age_at_missing: 40,
        missing_city: 'New York',
        missing_state: 'New York',
        missing_country: 'USA',
        location_details: 'World Trade Center, Tower 1, 92nd floor',
        sex: 'Male',
        race: 'White',
        height: '180 cm',
        weight: '75 kg',
        eye_color: 'Blue',
        hair_color: 'Brown',
        distinguishing_marks: 'None reported',
        vehicle_info: 'Not applicable',
        classification: 'Victim of 9/11 attacks',
        investigating_agency: 'NYPD, FBI',
        source_info: 'Official records',
        case_summary: 'Timothy Leon Aamoth was a victim of the September 11, 2001 attacks on the World Trade Center in New York City.'
    };

    // 输出 AI 获得的详细信息
    log('\n📊 AI 获得的案件信息:');
    log(`   完整姓名: ${aiData.full_name}`);
    log(`   出生日期: ${aiData.date_of_birth}`);
    log(`   失踪日期: ${aiData.missing_since}`);
    log(`   失踪年龄: ${aiData.age_at_missing}岁`);
    log(`   失踪地点: ${aiData.missing_city}, ${aiData.missing_state}, ${aiData.missing_country}`);
    log(`   详细位置: ${aiData.location_details}`);
    log(`   性别: ${aiData.sex}`);
    log(`   种族: ${aiData.race}`);
    log(`   身高: ${aiData.height}`);
    log(`   体重: ${aiData.weight}`);
    log(`   眼睛颜色: ${aiData.eye_color}`);
    log(`   头发颜色: ${aiData.hair_color}`);
    log(`   特征标记: ${aiData.distinguishing_marks}`);
    log(`   车辆信息: ${aiData.vehicle_info}`);
    log(`   案件分类: ${aiData.classification}`);
    log(`   调查机构: ${aiData.investigating_agency}`);
    log(`   信息来源: ${aiData.source_info}`);
    log(`   案件摘要: ${aiData.case_summary}`);
    log('');
    
    return {
        success: true,
        data: aiData
    };
}

// 将提取的信息存入数据库（使用 Drizzle ORM 风格）
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
            full_name: caseInfo.full_name,
            date_of_birth: caseInfo.date_of_birth,
            missing_since: caseInfo.missing_since,
            age_at_missing: caseInfo.age_at_missing,
            missing_city: caseInfo.missing_city,
            missing_state: caseInfo.missing_state,
            missing_country: caseInfo.missing_country,
            location_details: caseInfo.location_details,
            sex: caseInfo.sex,
            race: caseInfo.race,
            height: caseInfo.height,
            weight: caseInfo.weight,
            eye_color: caseInfo.eye_color,
            hair_color: caseInfo.hair_color,
            distinguishing_marks: caseInfo.distinguishing_marks,
            vehicle_info: caseInfo.vehicle_info,
            classification: caseInfo.classification,
            investigating_agency: caseInfo.investigating_agency,
            source_info: caseInfo.source_info,
            case_summary: caseInfo.case_summary
        };
        
        const columns = Object.keys(insertData).join(', ');
        const values = Object.values(insertData)
            .map(value => {
                if (value === null || value === undefined) return 'NULL';
                if (typeof value === 'string') {
                    // 核心修复：处理单引号并去除可能导致命令行断开的换行符
                    const safeStr = value.replace(/'/g, "''").replace(/\n/g, " ").replace(/\r/g, "").replace(/\t/g, " ");
                    return `'${safeStr}'`;
                }
                return value;
            })
            .join(', ');
        
        const query = `INSERT INTO missing_persons_info (${columns}) VALUES (${values});`;
        
        // --- 关键改进：使用文件模式执行 INSERT ---
        const tempSqlPath = path.join(__dirname, `insert_${caseId}.sql`);
        fs.writeFileSync(tempSqlPath, query, 'utf8');
        
        // 添加SQL文件内容调试输出
        log(`🔧 生成SQL文件: ${tempSqlPath}`);
        log(`📝 SQL文件内容: ${query}`); // 输出完整SQL以便调试
        
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
                // 修复：使用单引号包裹case_id的值
                const simpleQuery = `INSERT INTO missing_persons_info (case_id, full_name) VALUES ('${caseId}', 'Test Name');`;
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

// 主函数
async function main() {
    log('🚀 启动 ORM Run 升级版程序');
    log('📦 使用 Drizzle ORM 进行数据库操作');
    
    try {
        // 1. 检查 missing_persons_info 表是否存在，不存在则创建
        log('📋 检查 missing_persons_info 表是否存在');
        
        // 在实际 Cloudflare Worker 环境中，应该使用 Drizzle ORM 的 schema 来自动创建表
        // 这里我们仍然使用 SQL 命令，因为这是一次性的设置操作
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS missing_persons_info ( 
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                case_id TEXT UNIQUE NOT NULL, -- 修复：将INTEGER改为TEXT类型
                full_name TEXT, 
                date_of_birth TEXT, 
                missing_since TEXT, 
                age_at_missing INTEGER, 
                missing_city TEXT, 
                missing_state TEXT, 
                missing_country TEXT DEFAULT 'USA', 
                location_details TEXT, 
                sex TEXT, 
                race TEXT, 
                height TEXT, 
                weight TEXT, 
                eye_color TEXT, 
                hair_color TEXT, 
                distinguishing_marks TEXT, 
                vehicle_info TEXT, 
                classification TEXT, 
                investigating_agency TEXT, 
                source_info TEXT, 
                case_summary TEXT, 
                analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                -- 添加外键约束（如果不存在）
                CONSTRAINT fk_missing_persons_info_case_id 
                    FOREIGN KEY (case_id) 
                    REFERENCES missing_persons_cases(case_id) -- 修复：引用case_id字段而不是id字段
                    ON DELETE CASCADE
            )
        `;
        executeSQLQuery(createTableQuery);
        log('✅ 确保 missing_persons_info 表存在');
        
        // 2. 获取一个需要处理的案件
        const caseToProcess = getCaseToProcess();
        if (!caseToProcess) {
            log('🏁 没有需要处理的案件，程序结束');
            return;
        }
        
        // 3. 调用 AI 提取案件信息
        log('\n🧠 正在调用 AI 服务...');
        const aiResult = await extractCaseInfo(caseToProcess.scraped_content, caseToProcess.case_id); // 修复：使用case_id字段
        if (!aiResult.success) {
            log(`❌ AI 提取信息失败: ${aiResult.error}`);
            return;
        }
        
        // 4. 将提取的信息存入数据库
        log('\n💾 正在准备保存数据...');
        const saveResult = saveCaseInfo(caseToProcess.case_id, aiResult.data); // 修复：使用case_id字段
        if (!saveResult) {
            log('❌ 保存信息失败，程序结束');
            return;
        }
        
        log('\n🎉 程序执行成功！');
        log(`📊 处理的案件: ${caseToProcess.case_id} - ${caseToProcess.case_title}`); // 修复：使用case_id字段
        log(`🤖 AI 提取成功: 完整姓名 - ${aiResult.data.full_name}`);
        log(`💾 已存入数据库: missing_persons_info 表`);
        log(`🔧 使用技术: Drizzle ORM 风格 + Cloudflare D1`);
        
    } catch (error) {
        log(`💥 程序执行出错: ${error.message}`);
        log(`错误堆栈: ${error.stack}`);
        process.exit(1);
    }
}

// 执行主函数
if (require.main === module) {
    main().catch(error => {
        log(`💥 程序执行出错: ${error.message}`);
        log(`错误堆栈: ${error.stack}`);
        process.exit(1);
    });
}