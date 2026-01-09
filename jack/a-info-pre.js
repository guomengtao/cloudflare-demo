const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const aiService = require('./ai-cf-to-info');

// 💡 仅用于展示，不再写入文件
const BATCH_SIZE = 5;

function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

async function getCasesToScrape() {
    return new Promise((resolve) => {
        log('📡 正在从数据库捞取案件 (仅展示模式)...');
        
        // 简化查询：确保能抓到数据
        const query = `SELECT case_id, case_summary FROM missing_persons_info WHERE case_summary IS NOT NULL AND case_summary != '' LIMIT ${BATCH_SIZE};`;
        const tempSqlPath = path.join(__dirname, `query_temp.sql`);
        fs.writeFileSync(tempSqlPath, query, 'utf8');

        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --file="${tempSqlPath}"`;

        exec(command, (error, stdout) => {
            if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
            
            // --- 🔍 强制调试输出 ---
            if (stdout) {
                console.log("\n--- 🛠️  D1 原始输出片段 ---");
                console.log(stdout.substring(0, 500)); 
                console.log("--------------------------\n");
            }

            if (error) {
                log(`❌ D1 执行失败: ${error.message}`);
                return resolve([]);
            }

            try {
                const start = stdout.indexOf('[');
                const end = stdout.lastIndexOf(']') + 1;
                if (start === -1) return resolve([]);

                const rawData = JSON.parse(stdout.substring(start, end));
                let allRows = [];
                
                // 适配 D1 嵌套结构 [ { results: [...] } ]
                if (Array.isArray(rawData)) {
                    rawData.forEach(block => {
                        if (block.results) allRows = allRows.concat(block.results);
                    });
                }

                // 过滤掉统计信息，只留有 ID 的行
                const validRows = allRows.filter(row => row.case_id || row.caseId);
                log(`✅ 成功捞取到 ${validRows.length} 条有效数据`);
                resolve(validRows);
            } catch (e) {
                log(`❌ 解析失败: ${e.message}`);
                resolve([]);
            }
        });
    });
}

async function displayAiAnalysis(caseData) {
    const cid = caseData.case_id || caseData.caseId || "未知ID";
    const summary = caseData.case_summary;

    console.log(`\n\n${'='.repeat(50)}`);
    console.log(`🔍 正在分析案件: ${cid}`);
    console.log(`${'='.repeat(50)}`);

    try {
        const result = await aiService.extractCaseDetailsPure(summary, cid);

        if (result.success) {
            console.log("✅ AI 提取结果如下:");
            console.table({
                "姓名": result.data.full_name,
                "失踪日期": result.data.missing_since,
                "城市": result.data.missing_city,
                "县/区": result.data.missing_county,
                "州": result.data.missing_state,
                "性别/族裔": `${result.data.sex} / ${result.data.race}`,
                "身体特征": `身高:${result.data.height} 体重:${result.data.weight}`
            });
            console.log("\n📝 案件摘要文本:", summary.substring(0, 100) + "...");
        } else {
            console.log("❌ AI 提取失败:", result.error);
        }
    } catch (error) {
        console.log("💥 运行崩溃:", error.message);
    }
}

async function main() {
    log('🚀 启动 AI 展示程序...');
    
    const cases = await getCasesToScrape();
    
    if (cases.length === 0) {
        log('🏁 未发现符合要求的案件数据（请检查 D1 输出或查询条件）。');
        return;
    }

    for (const c of cases) {
        await displayAiAnalysis(c);
        // 短暂延迟防止频繁调用
        await new Promise(r => setTimeout(r, 1000));
    }
    
    log('\n🏁 所有拉取的案件展示完毕。');
}

main();