const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 导入AI调用模块
const aiService = require('./ai-to-web');

// 常量定义
const PROCESSED_CASES_FILE = 'processed-cases.txt';
const LOG_FILE = 'webpage-generation.log';

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

// 等待函数（带倒计时显示）
function wait(seconds) {
    return new Promise((resolve) => {
        log(`等待 ${seconds} 秒...`);
        let remaining = seconds;
        
        const interval = setInterval(() => {
            process.stdout.write(`\r⏰ 倒计时: ${remaining} 秒   `);
            remaining--;
            
            if (remaining < 0) {
                clearInterval(interval);
                process.stdout.write('\r✅ 等待完成!           \n');
                resolve();
            }
        }, 1000);
    });
}

// 随机等待5-15秒
async function randomWait() {
    const seconds = Math.floor(Math.random() * 11) + 5; // 5-15秒
    await wait(seconds);
}

// 获取已处理的案件ID列表
function getProcessedCaseIds() {
    const processedCaseIds = new Set();
    
    try {
        if (fs.existsSync(PROCESSED_CASES_FILE)) {
            const content = fs.readFileSync(PROCESSED_CASES_FILE, 'utf8');
            const caseIds = content.split('\n').filter(id => id.trim() !== '');
            caseIds.forEach(id => processedCaseIds.add(id));
        }
    } catch (error) {
        log(`读取已处理案件文件失败: ${error.message}`);
    }
    
    return processedCaseIds;
}

// 记录已处理的案件ID
function recordProcessedCaseId(caseId) {
    try {
        fs.appendFileSync(PROCESSED_CASES_FILE, `${caseId}\n`, 'utf8');
    } catch (error) {
        log(`记录已处理案件ID失败: ${error.message}`);
    }
}

// 从数据库获取待抓取的案件
async function getCasesToScrape() {
    return new Promise((resolve) => {
        log('查询数据库中有内容的案件...');
        
        const query = `
            SELECT case_id, case_url, scraped_content 
            FROM missing_persons_info 
            WHERE scraped_content IS NOT NULL AND scraped_content != '' 
            ORDER BY last_checked ASC
        `;
        
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="${query}"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                log(`查询数据库失败: ${error.message}`);
                resolve([]);
                return;
            }
            
            if (stderr) {
                log(`查询数据库时发生错误: ${stderr}`);
                resolve([]);
                return;
            }
            
            try {
                const result = JSON.parse(stdout);
                if (result.results && result.results.length > 0) {
                    const cases = result.results[0].results;
                    log(`✅ 找到 ${cases.length} 条有内容的案件记录`);
                    resolve(cases);
                } else {
                    log('⚠️ 没有找到有内容的案件记录');
                    resolve([]);
                }
            } catch (parseError) {
                log(`解析响应错误: ${parseError.message}`);
                resolve([]);
            }
        });
    });
}

// 创建文件夹结构（使用AI返回的location信息）
function createFolderStructure(state, county, city) {
    // 确保州、县、城市名是小写且单词间用中线连接
    const stateLower = state.toLowerCase().replace(/\s+/g, '-');
    const countyLower = county.toLowerCase().replace(/\s+/g, '-');
    const cityLower = city.toLowerCase().replace(/\s+/g, '-');
    
    const baseDir = path.join(__dirname, 'cases');
    const stateDir = path.join(baseDir, stateLower);
    const countyDir = path.join(stateDir, countyLower);
    const cityDir = path.join(countyDir, cityLower);
    
    try {
        // 创建目录结构，只到城市级别
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
        if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
        if (!fs.existsSync(countyDir)) fs.mkdirSync(countyDir, { recursive: true });
        if (!fs.existsSync(cityDir)) fs.mkdirSync(cityDir, { recursive: true });
        
        log(`📁 创建文件夹结构: ${stateLower}/${countyLower}/${cityLower}`);
        return cityDir;
    } catch (error) {
        log(`❌ 创建文件夹结构失败: ${error.message}`);
        return baseDir; // 如果失败，使用基础目录
    }
}

// 保存网页文件
function saveWebpageFile(content, folderPath, filename) {
    try {
        const filePath = path.join(folderPath, filename);
        fs.writeFileSync(filePath, content, 'utf8');
        log(`✅ 网页文件已保存: ${filePath}`);
        return filePath;
    } catch (error) {
        log(`❌ 保存网页文件失败: ${error.message}`);
        return null;
    }
}

// 处理单个案件
async function processSingleCase() {
    const processedCaseIds = getProcessedCaseIds();
    
    // 从数据库获取案件信息
    const cases = await getCasesToScrape();
    
    if (!cases || cases.length === 0) {
        log('❌ 没有找到有内容的案件');
        return null; // 返回null表示没有案件需要处理
    }
    
    // 过滤掉已经处理过的案件
    const unprocessedCases = cases.filter(caseData => !processedCaseIds.has(caseData.case_id));
    
    if (unprocessedCases.length === 0) {
        log(`⏭️ 所有 ${cases.length} 个有内容的案件都已处理过`);
        return null; // 返回null表示没有未处理的案件
    }
    
    const caseData = unprocessedCases[0]; // 每次只处理一个案件
    
    log(`🔍 开始处理案件: ${caseData.case_id}`);
    log(`📄 内容长度: ${caseData.scraped_content?.length || 0} 字符`);
    log(`📊 待处理案件: ${unprocessedCases.length}/${cases.length}`);
    log(`🔗 案件URL: ${caseData.case_url}`);
    
    try {
        // 调用AI生成网页内容 - 修改参数传递
        const result = await aiService.generateWebpageWithAI(caseData.scraped_content, caseData.case_id);
        
        if (!result.success) {
            log(`❌ 生成网页内容失败: ${result.error}`);
            return false;
        }
        
        // 创建文件夹结构 - 使用AI返回的location信息
        const location = result.location;
        const folderPath = createFolderStructure(location.state, location.county, location.city);
        
        // 保存网页文件
        const filePath = saveWebpageFile(result.content, folderPath, result.filename);
        
        if (filePath) {
            // 记录已处理的案件ID
            recordProcessedCaseId(caseData.case_id);
            log(`✅ 案件处理完成: ${caseData.case_id}`);
            log(`📁 文件保存位置: ${filePath}`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        log(`❌ 处理案件失败: ${error.message}`);
        return false;
    }
}

// 主函数
async function main() {
    while (true) {
        const result = await processSingleCase();
        
        if (result === null) {
            log('所有案件已处理完成，程序结束');
            break;
        }
        
        if (result) {
            log(`✅ 已成功处理 1 个案件`);
        } else {
            log(`⚠️ 当前案件处理失败，继续下一个案件`);
        }
        
        // 随机等待一段时间，避免请求过于频繁
        await randomWait();
    }
}

// 执行主函数
if (require.main === module) {
    main().catch(error => {
        log(`程序执行出错: ${error.message}`);
        process.exit(1);
    });
}