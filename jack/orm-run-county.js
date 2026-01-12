const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch'); // 确保已执行 npm install node-fetch@2
const aiModule = require('../ai-cf-to-county'); 

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
 * 从HTML内容中提取美国州和城市信息
 */
function extractStateAndCity(htmlContent) {
    // 首先尝试从 <strong>Missing From</strong> 格式中提取
    const missingFromPattern = /<strong>Missing From<\/strong>\s*([^,]+),\s*([^<]+)\s*<\/li>/i;
    const missingFromMatch = htmlContent.match(missingFromPattern);
    
    if (missingFromMatch) {
        // 提取城市和州
        const city = missingFromMatch[1].trim();
        const state = missingFromMatch[2].trim();
        
        if (city && state) {
            return {
                state: state,
                city: city
            };
        }
    }
    
    // 如果没有匹配到 Missing From 格式，使用原来的方法
    const statePattern = /[A-Z]{2}|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming/i;
    const cityPattern = /[A-Z][a-z]+(?: [A-Z][a-z]+)*/g;
    
    // 从HTML内容中提取文本
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 查找州
    const stateMatch = textContent.match(statePattern);
    const state = stateMatch ? stateMatch[0] : null;
    
    // 查找城市
    const cityMatches = textContent.match(cityPattern);
    let city = null;
    if (cityMatches) {
        // 过滤可能的州名，选择第一个非州名的城市
        city = cityMatches.find(c => !statePattern.test(c)) || cityMatches[0];
    }
    
    return {
        state: state ? state.trim() : null,
        city: city ? city.trim() : null
    };
}

/**
 * 核心逻辑：单次任务处理
 */
async function processNextCase(currentIndex) {
    console.log(`\n[任务 ${currentIndex}/1] 🚀 正在检索新案件...`);

    try {
        // --- 1. 获取待处理数据 ---        
        const selectQuery = `
            SELECT mpc.id, mpc.case_id, mpc.case_url, mpc.case_title, mpc.case_html,
                   mpi.missing_state, mpi.missing_city, mpi.missing_county
            FROM missing_persons_cases mpc
            LEFT JOIN missing_persons_info mpi ON mpc.case_id = mpi.case_id
            WHERE mpc.info_status = 0 
            AND mpc.html_status = 200
            AND (mpi.missing_county IS NULL OR mpi.missing_county = '')
            LIMIT 1
        `;
        console.log('📊 正在执行SQL查询获取待处理案件...');
        const selectResult = await queryD1(selectQuery);
        
        const targetCase = selectResult?.results?.[0];
        if (!targetCase) {
            console.log('📭 队列为空：没有需要处理的任务。');
            return 'empty'; 
        }

        console.log('✅ 获取到待处理案件:');
        console.log(`   🔹 案件ID: ${targetCase.case_id}`);
        console.log(`   🔹 案件标题: ${targetCase.case_title || '无标题'}`);

        // --- 2. 锁定状态 ---
        console.log('🔒 正在锁定案件状态...');
        await queryD1(`UPDATE missing_persons_cases SET info_status = 22 WHERE id = ?`, [targetCase.id]);
        console.log('✅ 案件状态锁定成功');

        // --- 3. 提取州和城市信息 ---
        console.log('🔍 正在提取州和城市信息...');
        const locationInfo = extractStateAndCity(targetCase.case_html || targetCase.case_title);
        
        if (!locationInfo.state || !locationInfo.city) {
            console.error('❌ 无法提取州或城市信息');
            console.error(`   - 州: ${locationInfo.state || '未提取'}`);
            console.error(`   - 城市: ${locationInfo.city || '未提取'}`);
            await queryD1(`UPDATE missing_persons_cases SET info_status = NULL WHERE id = ?`, [targetCase.id]);
            return 'error';
        }
        
        console.log('✅ 州和城市信息提取成功:');
        console.log(`   🔹 州: ${locationInfo.state}`);
        console.log(`   🔹 城市: ${locationInfo.city}`);

        // --- 4. AI 分析获取县信息 ---
        console.log('🧠 AI 正在分析州和城市对应的县...');
        const aiResult = await aiModule.getCountyByStateAndCity(locationInfo.state, locationInfo.city);

        if (!aiResult.success) {
            console.error('❌ AI 获取县信息失败');
            console.error(`   - 错误: ${aiResult.error}`);
            await queryD1(`UPDATE missing_persons_cases SET info_status = NULL WHERE id = ?`, [targetCase.id]);
            return 'error';
        }

        const countyInfo = aiResult.data;
        console.log('✅ AI 分析成功:');
        console.log(`   🔹 州: ${countyInfo.state}`);
        console.log(`   🔹 城市: ${countyInfo.city}`);
        console.log(`   🔹 县: ${countyInfo.county}`);

        // --- 5. 验证数据格式 ---        
        // 确保州、城市、县都是英文，允许常见标点符号
        const isEnglish = (text) => /^[A-Za-z\s\-\.'\-\/]+$/.test(text);
        
        if (!isEnglish(countyInfo.state)) {
            throw new Error(`州名包含非英文字符: ${countyInfo.state}`);
        }
        if (!isEnglish(countyInfo.city)) {
            throw new Error(`城市名包含非英文字符: ${countyInfo.city}`);
        }
        if (!isEnglish(countyInfo.county)) {
            throw new Error(`县名包含非英文字符: ${countyInfo.county}`);
        }
        
        // --- 6. 写入数据库 ---        
        console.log('💾 正在写入数据库...');
        
        // 更新主表
        await queryD1(
            `UPDATE missing_persons_cases SET analysis_result = ?, info_status = 1 WHERE id = ?`, 
            [JSON.stringify(countyInfo), targetCase.id]
        );
        console.log(`✅ 已更新表: missing_persons_cases, ID: ${targetCase.id}`);
        
        // 写入或更新详情表
        const upsertSQL = `
            INSERT INTO missing_persons_info (
                case_id, missing_state, missing_city, missing_county,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(case_id) DO UPDATE SET 
                missing_state = EXCLUDED.missing_state,
                missing_city = EXCLUDED.missing_city,
                missing_county = EXCLUDED.missing_county,
                updated_at = datetime('now')
            RETURNING id
        `;
        
        const upsertResult = await queryD1(upsertSQL, [
            targetCase.case_id,
            countyInfo.state,
            countyInfo.city,
            countyInfo.county
        ]);
        
        const missingPersonsInfoId = upsertResult.results[0]?.id || 'Unknown';
        console.log(`✅ 已更新表: missing_persons_info, 案件ID: ${targetCase.case_id}, ID: ${missingPersonsInfoId}`);

        // --- 6. 验证写入结果 ---
        console.log('🔍 正在验证数据库写入结果...');
        const verifyResult = await queryD1(
            `SELECT id, missing_state, missing_city, missing_county FROM missing_persons_info WHERE case_id = ?`, 
            [targetCase.case_id]
        );
        
        if (verifyResult.results.length > 0) {
            const writtenData = verifyResult.results[0];
            console.log('📊 写入结果验证:');
            console.log(`   ✅ 州: ${writtenData.missing_state}`);
            console.log(`   ✅ 城市: ${writtenData.missing_city}`);
            console.log(`   ✅ 县: ${writtenData.missing_county}`);
            console.log(`   ✅ ID: ${writtenData.id}`);
        }

        console.log(`🎉 任务完成！案件ID: ${targetCase.case_id}`);
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
    const TOTAL_RUNS = 9999;
    
    for (let i = 1; i <= TOTAL_RUNS; i++) {
        const result = await processNextCase(i);
        
        if (result === 'empty') {
            console.log('🏁 数据库已无可处理数据，提前退出。');
            break;
        }

        if (i < TOTAL_RUNS) {
            // 生成 6 到 12 秒之间的随机秒数
            const waitSeconds = Math.floor(Math.random() * (12 - 6 + 1)) + 1;
            console.log(`⏳ 等待 ${waitSeconds} 秒后执行下一个任务...`);
            
            // 简单的倒计时视觉效果
            for (let s = waitSeconds; s > 0; s--) {
                process.stdout.write(`倒计时: ${s} \r`);
                await sleep(1000);
            }
        }
    }
    console.log(`\n✅ ${TOTAL_RUNS} 次循环任务处理完毕。`);
    
    // 统计处理结果
    const totalCases = await queryD1(`SELECT COUNT(*) as count FROM missing_persons_cases`);
    const processedCases = await queryD1(`SELECT COUNT(*) as count FROM missing_persons_cases WHERE info_status = 1`);
    const failedCases = await queryD1(`SELECT COUNT(*) as count FROM missing_persons_cases WHERE info_status IS NULL`);
    const pendingCases = totalCases.results[0].count - processedCases.results[0].count - failedCases.results[0].count;
    
    // 统计县为空和不为空的数量
    const countyNull = await queryD1(`
        SELECT COUNT(*) as count 
        FROM missing_persons_cases mpc
        LEFT JOIN missing_persons_info mpi ON mpc.case_id = mpi.case_id
        WHERE mpi.missing_county IS NULL OR mpi.missing_county = ''
    `);
    
    const countyNotNull = await queryD1(`
        SELECT COUNT(*) as count 
        FROM missing_persons_cases mpc
        JOIN missing_persons_info mpi ON mpc.case_id = mpi.case_id
        WHERE mpi.missing_county IS NOT NULL AND mpi.missing_county != ''
    `);
    
    console.log(`
📊 处理完成统计:`);
    console.log(`   📈 总案件数: ${totalCases.results[0].count}`);
    console.log(`   ✅ 成功处理: ${processedCases.results[0].count} (${Math.round(processedCases.results[0].count / totalCases.results[0].count * 100)}%)`);
    console.log(`   ❌ 处理失败: ${failedCases.results[0].count} (${Math.round(failedCases.results[0].count / totalCases.results[0].count * 100)}%)`);
    console.log(`   ⏳ 待处理: ${pendingCases} (${Math.round(pendingCases / totalCases.results[0].count * 100)}%)`);
    console.log(`   🔍 县信息统计:`);
    console.log(`   - 县为空: ${countyNull.results[0].count}`);
    console.log(`   - 县不为空: ${countyNotNull.results[0].count}`);
    console.log(`   - 完成率: ${Math.round(countyNotNull.results[0].count / (countyNull.results[0].count + countyNotNull.results[0].count) * 100)}%`);
    
    // 详细展示成功和失败案件列表
    if (processedCases.results[0].count > 0) {
        console.log(`\n📋 成功处理案件列表:`);
        const successList = await queryD1(`SELECT case_id, case_title FROM missing_persons_cases WHERE info_status = 1 ORDER BY id DESC LIMIT 10`);
        successList.results.forEach((caseItem, index) => {
            console.log(`   ${index + 1}. ${caseItem.case_id} - ${caseItem.case_title}`);
        });
        if (processedCases.results[0].count > 10) {
            console.log(`   ... 还有 ${processedCases.results[0].count - 10} 个成功案件`);
        }
    }
    
    if (failedCases.results[0].count > 0) {
        console.log(`\n📋 处理失败案件列表:`);
        const failedList = await queryD1(`SELECT case_id, case_title FROM missing_persons_cases WHERE info_status IS NULL ORDER BY id DESC LIMIT 10`);
        failedList.results.forEach((caseItem, index) => {
            console.log(`   ${index + 1}. ${caseItem.case_id} - ${caseItem.case_title}`);
        });
        if (failedCases.results[0].count > 10) {
            console.log(`   ... 还有 ${failedCases.results[0].count - 10} 个失败案件`);
        }
    }
}

// 启动
startBatchProcess();