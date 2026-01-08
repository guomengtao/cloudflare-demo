const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 导入AI调用模块
const aiService = require('./ai-cf-to-info');

// 常量定义
const PROCESSED_CASES_FILE = 'processed-cases-info.txt';
const LOG_FILE = 'location-info-generation.log';
const INFO_OUTPUT_FILE = 'location-info.json';
const BATCH_SIZE = 5; 

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

// 等待函数
function wait(seconds) {
    return new Promise((resolve) => {
        let remaining = seconds;
        const interval = setInterval(() => {
            process.stdout.write(`\r⏳ 下个案件倒计时: ${remaining}s   `);
            remaining--;
            if (remaining < 0) {
                clearInterval(interval);
                process.stdout.write('\r✅ 开始处理!           \n');
                resolve();
            }
        }, 1000);
    });
}

async function randomWait() {
    const seconds = Math.floor(Math.random() * 11) + 5; 
    await wait(seconds);
}

function getProcessedCaseIds() {
    if (!fs.existsSync(PROCESSED_CASES_FILE)) return new Set();
    const content = fs.readFileSync(PROCESSED_CASES_FILE, 'utf8');
    return new Set(content.split('\n').map(id => id.trim()).filter(id => id !== ''));
}

function recordProcessedCaseId(caseId) {
    fs.appendFileSync(PROCESSED_CASES_FILE, `${caseId}\n`, 'utf8');
}

function saveLocationInfo(caseId, locationInfo) {
    let allInfo = [];
    if (fs.existsSync(INFO_OUTPUT_FILE)) {
        try {
            const content = fs.readFileSync(INFO_OUTPUT_FILE, 'utf8');
            if (content.trim()) allInfo = JSON.parse(content);
        } catch (e) { allInfo = []; }
    }
    allInfo.push({
        caseId,
        location: locationInfo.location,
        case_details: locationInfo.case_details,
        timestamp: new Date().toISOString()
    });
    fs.writeFileSync(INFO_OUTPUT_FILE, JSON.stringify(allInfo, null, 2), 'utf8');
}

/**
 * 获取案件：已根据你的表结构修正字段名为 case_summary
 */
async function getCasesToScrape() {
    return new Promise((resolve) => {
        log('📡 正在从数据库捞取案件 (Batch)...');
        
        // 修正点：将 case_url 和 scraped_content 改为 case_id 和 case_summary
        const query = `SELECT case_id, case_summary FROM missing_persons_info WHERE case_summary IS NOT NULL AND case_summary != '' ORDER BY analyzed_at ASC LIMIT ${BATCH_SIZE};`;
        
        const tempSqlPath = path.join(__dirname, `query_${Date.now()}.sql`);
        fs.writeFileSync(tempSqlPath, query, 'utf8');
        
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --file="${tempSqlPath}"`;
        
        exec(command, { 
            timeout: 60000, 
            maxBuffer: 1024 * 1024 * 50,
            env: { ...process.env, WRANGLER_SEND_METRICS: "false" } 
        }, (error, stdout, stderr) => {
            if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);

            if (error && !stdout) {
                log(`❌ D1 执行失败: ${error.message}`);
                return resolve([]);
            }

            try {
                const firstBrace = stdout.indexOf('{');
                const firstBracket = stdout.indexOf('[');
                let start = -1;
                
                if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
                    start = firstBracket;
                } else {
                    start = firstBrace;
                }

                if (start === -1) {
                    log('⚠️ 未找到 JSON 数据');
                    return resolve([]);
                }

                const lastBrace = stdout.lastIndexOf('}');
                const lastBracket = stdout.lastIndexOf(']');
                const end = Math.max(lastBrace, lastBracket) + 1;

                const cleanJson = stdout.substring(start, end);
                const rawData = JSON.parse(cleanJson);

                if (rawData.error) {
                    log(`❌ 数据库错误: ${rawData.error.text || JSON.stringify(rawData.error)}`);
                    return resolve([]);
                }

                const results = Array.isArray(rawData) ? rawData[0]?.results : rawData.results;
                
                if (results && Array.isArray(results)) {
                    log(`✅ 成功获取 ${results.length} 条记录`);
                    resolve(results);
                } else {
                    resolve([]);
                }
            } catch (parseError) {
                log(`❌ 解析失败: ${parseError.message}`);
                resolve([]);
            }
        });
    });
}

/**
 * 处理案件：使用 case_summary 作为 AI 输入
 */
async function processCase(caseData) {
    log(`\n--- 🔍 正在处理: ${caseData.case_id} ---`);
    try {
        // 修正点：传递 case_summary 给 AI
        const result = await aiService.extractLocationInfo(caseData.case_summary, caseData.case_id);
        
        if (!result.success) {
            log(`❌ AI 提取失败: ${result.error}`);
            return false;
        }
        
        saveLocationInfo(caseData.case_id, result);
        recordProcessedCaseId(caseData.case_id);
        
        log(`✅ 处理成功! 📍 位置: ${result.location.state} / ${result.location.county} / ${result.location.city}`);
        return true;
    } catch (error) {
        log(`❌ 运行崩溃: ${error.message}`);
        return false;
    }
}

async function main() {
    log('🚀 地理位置提取程序已启动 (Batch Mode)');
    
    while (true) {
        const cases = await getCasesToScrape();
        
        if (!cases || cases.length === 0) {
            log('🏁 没有更多待处理案件，程序退出。');
            break;
        }
        
        const processedIds = getProcessedCaseIds();
        let currentBatchHandled = 0;
        
        for (const caseData of cases) {
            if (processedIds.has(caseData.case_id)) {
                continue;
            }
            
            const success = await processCase(caseData);
            if (success) currentBatchHandled++;
            await randomWait();
        }

        // 如果整批都没处理（全是重复的），跳出循环防止死循环
        if (currentBatchHandled === 0 && cases.length > 0) {
            log('⚠️ 本批次案件均已处理过，请检查数据库排序逻辑。');
            break;
        }
    }
}

if (require.main === module) {
    main().catch(err => {
        log(`💥 全局错误: ${err.message}`);
        process.exit(1);
    });
}