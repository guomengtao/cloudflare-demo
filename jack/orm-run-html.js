const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const { generatePureHtml } = require('./ai-cf-to-html'); 

// 1. 初始化配置 (保持不变)
const envPath = fs.existsSync(path.resolve(__dirname, '../.env')) 
    ? path.resolve(__dirname, '../.env') 
    : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    if (!data.success) throw new Error(`D1 API 错误: ${JSON.stringify(data.errors)}`);
    return data.result[0];
}

function formatPathName(name) {
    if (!name) return 'unknown';
    return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, ''); // 增加正则过滤掉特殊字符
}

/**
 * 核心逻辑：生成 HTML 任务
 */
async function processHtmlTask(currentIndex) {
    console.log(`\n[任务 ${currentIndex}] 🔍 检索待生成网页的案件...`);

    try {
        // --- 【改动点 1】：SQL 查询字段修改 ---
        // 将 c.analysis_result 替换为 c.scraped_content
        const selectQuery = `
            SELECT c.id, c.case_id, c.scraped_content, i.missing_state, i.missing_county, i.missing_city 
            FROM missing_persons_cases c
            JOIN missing_persons_info i ON c.case_id = i.case_id
            WHERE c.html_status = 0 AND c.process_code = 1
            LIMIT 1
        `;
        const selectResult = await queryD1(selectQuery);
        const target = selectResult?.results?.[0];

        if (!target) {
            console.log('📭 没有符合条件的案件。');
            return 'empty';
        }

        // --- 2. 锁定状态 (保持不变) ---
        await queryD1(`UPDATE missing_persons_cases SET html_status = 2 WHERE id = ?`, [target.id]);

        // --- 3. 构造路径与合并数据 ---
        const statePath = formatPathName(target.missing_state);
        const countyPath = formatPathName(target.missing_county);
        const cityPath = formatPathName(target.missing_city);
        
        const relativeDir = path.join('case', statePath, countyPath, cityPath);
        const fullDir = path.resolve(process.cwd(), relativeDir);
        const finalPath = path.join(fullDir, `${target.case_id}.html`);

        // --- 【改动点 2】：合并数据逻辑修改 ---
        // 使用 target.scraped_content 传入 AI
        const combinedContent = `
【地理位置强化信息】
州(State): ${target.missing_state}
县(County): ${target.missing_county}
城市(City): ${target.missing_city}

【网页原始抓取内容】
${target.scraped_content}
        `;

        // --- 4. 调用 AI 生成网页 (保持不变) ---
        console.log(`🧠 AI 正在为 ${target.case_id} (${target.missing_city}) 生成网页...`);
        const lang = "简体中文";
        const aiResult = await generatePureHtml(combinedContent, lang);

        if (aiResult.success) {
            if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
            fs.writeFileSync(finalPath, aiResult.html);
            await queryD1(`UPDATE missing_persons_cases SET html_status = 1 WHERE id = ?`, [target.id]);
            console.log(`✅ 成功: ${finalPath}`);
        } else {
            console.error(`❌ AI 生成失败: ${aiResult.error}`);
            // 如果报错 7000 (URI错误)，建议将状态设为 3，防止重复死循环同一案件
            const nextStatus = aiResult.error.includes('7000') ? 3 : 0;
            await queryD1(`UPDATE missing_persons_cases SET html_status = ? WHERE id = ?`, [nextStatus, target.id]);
        }

        return 'success';

    } catch (error) {
        console.error('❌ 运行时错误:', error.message);
        return 'error';
    }
}

async function startBatch() {
    const LIMIT = 600;
    for (let i = 1; i <= LIMIT; i++) {
        const res = await processHtmlTask(i);
        if (res === 'empty') break;

        // 建议：由于 scraped_content 内容较多，AI 响应时间变长，建议等待时间稍微调大一点 (8-15秒)
        const wait = Math.floor(Math.random() * 7) + 8;
        console.log(`⏳ 等待 ${wait} 秒...`);
        await sleep(wait * 1000);
    }
    console.log('🏁 任务结束。');
}

startBatch();