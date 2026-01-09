const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const aiService = require('./ai-cf-to-info');

const PROCESSED_CASES_FILE = 'processed-cases-info.txt';
const INFO_OUTPUT_FILE = 'location-info.json';
const BATCH_SIZE = 5;

function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

async function getCasesToScrape() {
    return new Promise((resolve) => {
        log('📡 正在从数据库捞取案件...');
        // 关键：去掉 analyzed_at 排序，先确保能拿到数据
        const query = `SELECT case_id, case_summary FROM missing_persons_info WHERE case_summary IS NOT NULL AND case_summary != '' LIMIT ${BATCH_SIZE};`;
        const tempSqlPath = path.join(__dirname, `query_temp.sql`);
        fs.writeFileSync(tempSqlPath, query, 'utf8');

        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --file="${tempSqlPath}"`;

        exec(command, (error, stdout) => {
            if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
            if (error) return resolve([]);

            try {
                const start = stdout.indexOf('[');
                const end = stdout.lastIndexOf(']') + 1;
                const rawData = JSON.parse(stdout.substring(start, end));

                let allRows = [];
                if (Array.isArray(rawData)) {
                    rawData.forEach(block => {
                        if (block.results) allRows = allRows.concat(block.results);
                    });
                } else if (rawData.results) {
                    allRows = rawData.results;
                }

                // 只要字段名里包含 ID 且不是统计信息的，都留下
                const validRows = allRows.filter(row => {
                    const rowStr = JSON.stringify(row).toLowerCase();
                    return rowStr.includes("case_id") || rowStr.includes("caseid");
                });

                log(`✅ 成功获取 ${validRows.length} 条真实有效记录`);
                resolve(validRows);
            } catch (e) {
                log(`❌ 解析失败: ${e.message}`);
                resolve([]);
            }
        });
    });
}

async function processCase(caseData) {
    // 自动寻找 ID 字段
    const cid = caseData.case_id || caseData.caseId || caseData.CASE_ID || Object.values(caseData)[0];
    const summary = caseData.case_summary || caseData.CASE_SUMMARY || Object.values(caseData)[1];

    log(`\n--- 🔍 正在处理: ${cid} ---`);
    const result = await aiService.extractCaseDetailsPure(summary, cid);

    if (result.success) {
        const output = {
            caseId: cid,
            location: { state: result.data.missing_state, county: result.data.missing_county, city: result.data.missing_city },
            data: result.data,
            timestamp: new Date().toISOString()
        };

        let allData = [];
        if (fs.existsSync(INFO_OUTPUT_FILE)) {
            try { allData = JSON.parse(fs.readFileSync(INFO_OUTPUT_FILE, 'utf8')); } catch(e) {}
        }
        allData.push(output);
        fs.writeFileSync(INFO_OUTPUT_FILE, JSON.stringify(allData, null, 2));
        fs.appendFileSync(PROCESSED_CASES_FILE, `${cid}\n`);
        log(`✅ 提取完成: ${output.location.city}, ${output.location.state}`);
        return true;
    }
    return false;
}

async function main() {
    log('🚀 启动批量提取流水线...');
    while (true) {
        const cases = await getCasesToScrape();
        if (!cases.length) break;

        const processed = fs.existsSync(PROCESSED_CASES_FILE) ? fs.readFileSync(PROCESSED_CASES_FILE, 'utf8') : "";
        let count = 0;
        for (const c of cases) {
            const cid = c.case_id || c.caseId || c.CASE_ID || Object.values(c)[0];
            if (!cid || processed.includes(cid)) continue;
            if (await processCase(c)) count++;
            await new Promise(r => setTimeout(r, 2000));
        }
        if (count === 0) break;
    }
    log('🏁 任务结束。');
}

main();