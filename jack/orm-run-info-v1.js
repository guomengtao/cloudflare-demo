const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch'); // 确保已执行 npm install node-fetch@2
const aiModule = require('./ai-cf-to-info'); 

// 1. 初始化配置 (兼容多种路径)
const envPath = fs.existsSync(path.resolve(__dirname, '../.env')) 
    ? path.resolve(__dirname, '../.env') 
    : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const { 
    CLOUDFLARE_API_KEY, 
    CLOUDFLARE_ACCOUNT_ID, 
    CLOUDFLARE_DATABASE_ID 
} = process.env;

const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

/**
 * 封装 D1 API 调用 (使用参数化查询解决转义问题)
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
 * 核心逻辑
 */
async function processNextCase() {
    console.log('--- 🚀 开始处理新任务 (API 模式) ---');

    // 检查环境变量
    if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_DATABASE_ID) {
        console.error('❌ 缺失环境变量，请检查 .env');
        return;
    }

    try {
        // --- 1. 获取 process_code IS NULL 的第一条 ---
        const selectQuery = `
            SELECT id, case_id, case_url, case_title, scraped_content, analysis_result 
            FROM missing_persons_cases 
            WHERE process_code IS NULL 
            LIMIT 1
        `;
        const selectResult = await queryD1(selectQuery);
        const targetCase = selectResult?.results?.[0];

        if (!targetCase) {
            console.log('📭 队列为空：没有需要处理的任务。');
            return null;
        }

        // --- 2. 锁定状态 (process_code = 22) ---
        const lockQuery = `
            UPDATE missing_persons_cases 
            SET process_code = 22, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        await queryD1(lockQuery, [targetCase.id]);

        console.log('✅ 任务锁定成功！当前案件详情如下：');
        console.log('--------------------------------------------------');
        console.table({
            '数据库ID': targetCase.id,
            '核心标识 (case_id)': targetCase.case_id,
            '案件标题': targetCase.case_title || '（无标题）',
            '状态更新': 'NULL -> 22'
        });
        console.log(`🔗 案件 URL: ${targetCase.case_url}`);

        // --- 3. 调用 AI 处理 ---
        console.log(`🧠 正在调用 Llama 3.2 3B 分析内容...`);
        const contentToAnalyze = targetCase.scraped_content || targetCase.case_title;
        const aiResult = await aiModule.extractCaseDetailsPure(contentToAnalyze, targetCase.case_id);

        if (aiResult.success) {
            console.log('\n✨ AI 处理结果 (JSON):');
            console.log(JSON.stringify(aiResult.data, null, 2));
            
            // --- 4. 存入结果 (process_code = 1) ---
            // 注意：API 模式下不需要手动 replace(/'/g, "''")，参数化查询会自动处理
            const jsonString = JSON.stringify(aiResult.data);
            const saveQuery = `
                UPDATE missing_persons_cases 
                SET analysis_result = ?, process_code = 1 
                WHERE id = ?
            `;
            await queryD1(saveQuery, [jsonString, targetCase.id]);
            
            console.log('\n💾 结果已成功存入数据库 (process_code: 1)');
        } else {
            console.error('\n❌ AI 提取失败:', aiResult.error);
            // 失败时可以考虑把 22 改回 NULL，方便下次重试
            await queryD1(`UPDATE missing_persons_cases SET process_code = NULL WHERE id = ?`, [targetCase.id]);
        }

        console.log('--------------------------------------------------\n');
        return targetCase;

    } catch (error) {
        console.error('❌ 处理失败:', error.message);
        return null;
    }
}

// 执行
processNextCase();