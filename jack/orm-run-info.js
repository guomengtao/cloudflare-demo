const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch'); // 确保已执行 npm install node-fetch@2
const aiModule = require('./ai-cf-to-info'); 

// 1. 初始化配置
const envPath = fs.existsSync(path.resolve(__dirname, '../.env')) 
    ? path.resolve(__dirname, '../.env') 
    : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

/**
 * 封装延迟函数 (用于倒计时)
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 封装 D1 API 调用
 */
async function queryD1(sql, params = []) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params })
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(`D1 API 错误: ${JSON.stringify(data.errors)}`);
    }
    return data.result[0];
}

/**
 * 核心逻辑：单次任务处理
 */
async function processNextCase(currentIndex) {
    console.log(`\n[任务 ${currentIndex}/60] 🚀 正在检索新案件...`);

    try {
        // --- 1. 获取待处理数据 ---
        
        // const selectQuery = `SELECT id, case_id, case_url, case_title, scraped_content FROM missing_persons_cases WHERE process_code IS NULL LIMIT 1`;
        const selectQuery = `
    SELECT id, case_id, case_url, case_title, scraped_content 
    FROM missing_persons_cases 
    WHERE process_code IS NULL 
    AND scraped_content IS NOT NULL 
    AND scraped_content != ''
    LIMIT 1
`;
        const selectResult = await queryD1(selectQuery);
        const targetCase = selectResult?.results?.[0];

        if (!targetCase) {
            console.log('📭 队列为空：没有需要处理的任务。');
            return 'empty'; 
        }

        // --- 2. 锁定状态 ---
        await queryD1(`UPDATE missing_persons_cases SET process_code = 22 WHERE id = ?`, [targetCase.id]);

        // --- 3. AI 分析 ---
        console.log(`🧠 AI 正在分析案件: ${targetCase.case_id}`);
        const contentToAnalyze = targetCase.scraped_content || targetCase.case_title;
        const aiResult = await aiModule.extractCaseDetailsPure(contentToAnalyze, targetCase.case_id);

        if (aiResult.success) {
            const info = aiResult.data;

            // --- 4. 更新主表 JSON ---
            await queryD1(
                `UPDATE missing_persons_cases SET analysis_result = ?, process_code = 1 WHERE id = ?`, 
                [JSON.stringify(info), targetCase.id]
            );

            // --- 5. 写入详情表 (missing_persons_info) ---
            const insertInfoSQL = `
                INSERT INTO missing_persons_info (
                    case_id, full_name, date_of_birth, missing_since, age_at_missing,
                    missing_city, missing_county, missing_state, missing_country, location_details,
                    sex, race, height, weight, eye_color, hair_color, 
                    distinguishing_marks, vehicle_info, classification, 
                    investigating_agency, source_info, case_summary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(case_id) DO UPDATE SET analyzed_at = CURRENT_TIMESTAMP
            `;

            const infoParams = [
                targetCase.case_id, info.full_name || null, info.date_of_birth || null, info.missing_since || null, info.age_at_missing || null,
                info.missing_city || null, info.missing_county || null, info.missing_state || null, info.missing_country || 'USA', info.location_details || null,
                info.sex || null, info.race || null, info.height || null, info.weight || null, info.eye_color || null, info.hair_color || null,
                info.distinguishing_marks || null, info.vehicle_info || null, info.classification || null,
                info.investigating_agency || null, info.source_info || null, info.case_summary || null
            ];

            await queryD1(insertInfoSQL, infoParams);
            console.log(`✅ 写入成功。ID: ${targetCase.case_id}`);

            // --- 6. 回查展示 ---
            const finalCheck = await queryD1(`SELECT * FROM missing_persons_info WHERE case_id = ?`, [targetCase.case_id]);
            if (finalCheck.results.length > 0) console.table(finalCheck.results[0]);

        } else {
            console.error('❌ AI 失败，重置状态');
            await queryD1(`UPDATE missing_persons_cases SET process_code = NULL WHERE id = ?`, [targetCase.id]);
        }

        return 'success';

    } catch (error) {
        console.error('❌ 运行时错误:', error.message);
        return 'error';
    }
}

/**
 * 循环控制器：执行 60 次
 */
async function startBatchProcess() {
    const TOTAL_RUNS = 6000;
    
    for (let i = 1; i <= TOTAL_RUNS; i++) {
        const result = await processNextCase(i);
        
        if (result === 'empty') {
            console.log('🏁 数据库已无可处理数据，提前退出。');
            break;
        }

        if (i < TOTAL_RUNS) {
            // 生成 6 到 12 秒之间的随机秒数
            const waitSeconds = Math.floor(Math.random() * (12 - 6 + 1)) + 6;
            console.log(`⏳ 等待 ${waitSeconds} 秒后执行下一个任务...`);
            
            // 简单的倒计时视觉效果
            for (let s = waitSeconds; s > 0; s--) {
                process.stdout.write(`倒计时: ${s} \r`);
                await sleep(1000);
            }
        }
    }
    console.log('\n✅ 60 次循环任务处理完毕。');
}

// 启动
startBatchProcess();