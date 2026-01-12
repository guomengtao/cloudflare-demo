const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch'); // 确保已执行 npm install node-fetch@2
const aiModule = require('./ai-cf-to-img'); 

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
    SELECT id, case_id, case_url, case_title, case_html, created_at, updated_at
    FROM missing_persons_cases 
    WHERE info_status = 0 
    AND html_status = 200
    LIMIT 1
`;
        const selectResult = await queryD1(selectQuery);
        const targetCase = selectResult?.results?.[0];

        if (!targetCase) {
            console.log('📭 队列为空：没有需要处理的任务。');
            return 'empty'; 
        }

        // --- 详细展示待处理案件信息 ---
        console.log('📋 待处理案件详细信息:');
        console.log(`   🔹 案件ID: ${targetCase.case_id}`);
        console.log(`   🔹 案件标题: ${targetCase.case_title || '无标题'}`);
        console.log(`   🔹 案件URL: ${targetCase.case_url || '无URL'}`);
        console.log(`   🔹 数据库ID: ${targetCase.id}`);
        console.log(`   🔹 创建时间: ${targetCase.created_at || '未知'}`);
        console.log(`   🔹 更新时间: ${targetCase.updated_at || '未知'}`);
        console.log(`   🔹 内容长度: ${targetCase.case_html ? targetCase.case_html.length : 0} 字符`);
        
        // 输出case_html字段信息
        console.log('\n📄 案件HTML完整内容 (case_html 字段):');
        console.log('─'.repeat(80));
        console.log('⚠️  注意：以下将显示完整的HTML内容，可能很长！');
        if (targetCase.case_html) {
            // 清理HTML内容，去掉多余的空格和换行
            const cleanedHtml = targetCase.case_html.replace(/\s+/g, ' ').trim();
            console.log(cleanedHtml); // 显示完整内容，不截断
            console.log('─'.repeat(80));
            console.log(`   完整内容长度: ${targetCase.case_html.length} 字符`);
            console.log(`   清理后内容长度: ${cleanedHtml.length} 字符`);
        } else {
            console.log('   ❌ 案件HTML内容为空');
            console.log('─'.repeat(80));
        }
        
        // 检查是否有图片
        const hasImages = aiModule.hasRealImages(targetCase.case_html);
        console.log(`   🔹 图片检测: ${hasImages ? '✅ 有真实图片' : '❌ 无真实图片'}`);

        // --- 2. 锁定状态 ---
        await queryD1(`UPDATE missing_persons_cases SET info_status = 22 WHERE id = ?`, [targetCase.id]);

        // --- 3. AI 分析 ---
        console.log(`🧠 AI 正在分析案件: ${targetCase.case_id}`);
        const contentToAnalyze = targetCase.case_html || targetCase.case_title;
        
        // 记录当前案件的关键信息，用于后续核实
        const currentCaseInfo = {
            case_id: targetCase.case_id,
            case_title: targetCase.case_title,
            db_id: targetCase.id
        };
        
        // 输出发送给AI处理的信息
        console.log('\n📤 发送给AI处理的内容预览:');
        console.log('─'.repeat(80));
        if (contentToAnalyze) {
            // 清理发送给AI的内容
            const cleanedAiContent = contentToAnalyze.replace(/\s+/g, ' ').trim();
            const aiPreviewContent = cleanedAiContent.length > 250 
                ? cleanedAiContent.substring(0, 250) + '...' 
                : cleanedAiContent;
            console.log(aiPreviewContent);
            console.log('─'.repeat(80));
            console.log(`   完整内容长度: ${contentToAnalyze.length} 字符`);
            console.log(`   清理后内容长度: ${cleanedAiContent.length} 字符`);
        } else {
            console.log('   ❌ 发送给AI的内容为空');
            console.log('─'.repeat(80));
        }
        const aiResult = await aiModule.extractCaseDetailsPure(contentToAnalyze, targetCase.case_id);

        if (aiResult.success) {
            const info = aiResult.data;
            
            // --- 重要：核实AI返回的信息是否与当前案件一致 ---
            console.log('🔍 正在核实AI返回的案件信息...');
            
            // 首先检查AI是否返回了case_id，如果返回了必须与当前案件一致
            if (info.case_id && info.case_id !== targetCase.case_id) {
                console.error('🚨 严重错误：AI返回的案件ID与当前处理案件不一致！');
                console.error(`   - 当前处理案件ID: ${targetCase.case_id}`);
                console.error(`   - AI返回的案件ID: ${info.case_id}`);
                console.error(`   - 已终止处理，防止信息混淆`);
                await queryD1(`UPDATE missing_persons_cases SET info_status = NULL WHERE id = ?`, [targetCase.id]);
                return 'error';
            }
            
            // 强制使用当前案件的case_id，确保数据关联正确
            info.case_id = targetCase.case_id;
            
            // 从 case_title 中提取 full_name（简单处理，实际可能需要更复杂的提取逻辑）
            let full_name = null;
            if (targetCase.case_title) {
                // 简单地将 case_title 作为 full_name，实际可能需要更复杂的提取逻辑
                full_name = targetCase.case_title;
            }
            info.full_name = full_name;
            
            // --- 新增：关键信息交叉验证 ---
            // 检查是否存在与示例数据完全匹配的异常字段（防止模型复读示例）
            const exampleDataRedFlags = [
                { field: 'missing_since', value: '1999-11-29' },
                { field: 'missing_city', value: 'McAllen' },
                { field: 'missing_state', value: 'Texas' },
                { field: 'missing_county', value: 'Hidalgo' }
            ];
            
            const redFlagMatches = exampleDataRedFlags.filter(flag => 
                info[flag.field] && info[flag.field] === flag.value
            );
            
            if (redFlagMatches.length >= 2) {
                console.error('🚨 检测到疑似示例数据复读！AI可能返回了错误信息');
                console.error(`   - 匹配的示例数据字段: ${redFlagMatches.map(f => f.field).join(', ')}`);
                console.error(`   - 当前案件: ${targetCase.case_id} (${targetCase.case_title})`);
                console.error(`   - 已终止处理，防止错误数据写入`);
                await queryD1(`UPDATE missing_persons_cases SET info_status = NULL WHERE id = ?`, [targetCase.id]);
                return 'error';
            }

            // --- 详细展示AI提取结果 ---
            console.log('📊 AI提取结果摘要:');
            console.log(`   ✅ 姓名: ${info.full_name || '未提取'}`);
            console.log(`   ✅ 出生日期: ${info.date_of_birth || '未提取'}`);
            console.log(`   ✅ 失踪日期: ${info.missing_since || '未提取'}`);
            console.log(`   ✅ 失踪年龄: ${info.age_at_missing || '未提取'}`);
            console.log(`   ✅ 失踪地点: ${info.missing_city || '未提取'}, ${info.missing_state || '未提取'}`);
            console.log(`   ✅ 县: ${info.missing_county || '未提取'}`);
            console.log(`   ✅ 性别: ${info.sex || '未提取'}`);
            console.log(`   ✅ 种族: ${info.race || '未提取'}`);
            console.log(`   ✅ 图片数量: ${info.images_json ? info.images_json.length : 0}`);
            console.log(`   ✅ 主图片URL: ${info.main_photo_url ? '✅ 已提取' : '❌ 未提取'}`);

            // --- 再次核实：姓名与案件标题的相关性检查 ---
            if (info.full_name && targetCase.case_title) {
                const lowerName = info.full_name.toLowerCase();
                const lowerTitle = targetCase.case_title.toLowerCase();
                
                // 检查姓名是否在案件标题中出现，或者案件标题是否在姓名中出现
                const nameInTitle = lowerTitle.includes(lowerName);
                const titleInName = lowerName.includes(lowerTitle);
                
                if (!nameInTitle && !titleInName) {
                    console.warn('⚠️ 警告：AI提取的姓名与案件标题可能不相关');
                    console.warn(`   - 案件标题: ${targetCase.case_title}`);
                    console.warn(`   - AI提取的姓名: ${info.full_name}`);
                    console.warn(`   - 继续处理，但建议人工检查`);
                } else {
                    console.log('✅ 姓名与案件标题验证通过');
                }
            }

            // --- 再次核实：数据库写入前确认案件ID ---
            console.log('🔍 数据库写入前再次确认案件ID...');
            if (info.case_id !== targetCase.case_id) {
                console.error('🚨 严重错误：准备写入的案件ID与当前处理案件不一致！');
                console.error(`   - 当前处理案件ID: ${targetCase.case_id}`);
                console.error(`   - 准备写入的案件ID: ${info.case_id}`);
                console.error(`   - 已终止处理，防止信息混淆`);
                await queryD1(`UPDATE missing_persons_cases SET info_status = NULL WHERE id = ?`, [targetCase.id]);
                return 'error';
            }

            // --- 4. 更新主表 JSON ---
            await queryD1(
                `UPDATE missing_persons_cases SET analysis_result = ?, info_status = 1 WHERE id = ?`, 
                [JSON.stringify(info), targetCase.id]
            );

            // --- 5. 写入详情表 (missing_persons_info) ---            
            const insertInfoSQL = `
                INSERT INTO missing_persons_info (
                    case_id, full_name, date_of_birth, missing_since, age_at_missing,
                    missing_city, missing_county, missing_state, location_details,
                    sex, race, height, weight, eye_color, hair_color, 
                    distinguishing_marks, vehicle_info, classification, 
                    investigating_agency, source_info, case_summary,
                    disappearance_details, total_updates_count, disappearance_details_word_count,
                    last_case_update_raw, last_verified_date, main_photo_url, images_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(case_id) DO UPDATE SET 
                    full_name = EXCLUDED.full_name,
                    date_of_birth = EXCLUDED.date_of_birth,
                    missing_since = EXCLUDED.missing_since,
                    age_at_missing = EXCLUDED.age_at_missing,
                    missing_city = EXCLUDED.missing_city,
                    missing_county = EXCLUDED.missing_county,
                    missing_state = EXCLUDED.missing_state,
                    location_details = EXCLUDED.location_details,
                    sex = EXCLUDED.sex,
                    race = EXCLUDED.race,
                    height = EXCLUDED.height,
                    weight = EXCLUDED.weight,
                    eye_color = EXCLUDED.eye_color,
                    hair_color = EXCLUDED.hair_color,
                    distinguishing_marks = EXCLUDED.distinguishing_marks,
                    vehicle_info = EXCLUDED.vehicle_info,
                    classification = EXCLUDED.classification,
                    investigating_agency = EXCLUDED.investigating_agency,
                    source_info = EXCLUDED.source_info,
                    case_summary = EXCLUDED.case_summary,
                    disappearance_details = EXCLUDED.disappearance_details,
                    total_updates_count = EXCLUDED.total_updates_count,
                    disappearance_details_word_count = EXCLUDED.disappearance_details_word_count,
                    last_case_update_raw = EXCLUDED.last_case_update_raw,
                    last_verified_date = EXCLUDED.last_verified_date,
                    main_photo_url = EXCLUDED.main_photo_url,
                    images_json = EXCLUDED.images_json,
                    updated_at = datetime('now'),
                    analyzed_at = datetime('now')
            `;

            const infoParams = [
                targetCase.case_id, info.full_name || null, info.date_of_birth || null, info.missing_since || null, info.age_at_missing || null,
                info.missing_city || null, info.missing_county || null, info.missing_state || null, info.location_details || null,
                info.sex || null, info.race || null, info.height || null, info.weight || null, info.eye_color || null, info.hair_color || null,
                info.distinguishing_marks || null, info.vehicle_info || null, info.classification || null,
                info.investigating_agency || null, info.source_info || null, info.case_summary || null,
                info.disappearance_details || null, info.total_updates_count || null, info.disappearance_details_word_count || null,
                info.last_case_update_raw || null, info.last_verified_date || null, info.main_photo_url || null, JSON.stringify(info.images_json || [])
            ];

            await queryD1(insertInfoSQL, infoParams);
            console.log(`✅ 数据库写入成功。案件ID: ${targetCase.case_id}`);

            // --- 6. 回查展示 ---
            const finalCheck = await queryD1(`SELECT * FROM missing_persons_info WHERE case_id = ?`, [targetCase.case_id]);
            if (finalCheck.results.length > 0) {
                console.log('📈 数据库写入验证:');
                const result = finalCheck.results[0];
                console.log(`   ✅ 案件ID: ${result.case_id}`);
                console.log(`   ✅ 姓名: ${result.full_name || '空'}`);
                console.log(`   ✅ 图片数量: ${result.images_json ? JSON.parse(result.images_json).length : 0}`);
                console.log(`   ✅ 创建时间: ${result.created_at}`);
                console.log(`   ✅ 更新时间: ${result.updated_at}`);
            }

        } else {
            console.error('❌ AI 处理失败，重置状态');
            console.error('🔍 失败详情:');
            console.error(`   - 错误类型: ${aiResult.error}`);
            console.error(`   - 案件ID: ${targetCase.case_id}`);
            console.error(`   - 数据库ID: ${targetCase.id}`);
            if (aiResult.raw_response) {
                console.error(`   - AI原始响应: ${aiResult.raw_response.substring(0, 200)}...`);
            }
            await queryD1(`UPDATE missing_persons_cases SET info_status = NULL WHERE id = ?`, [targetCase.id]);
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
    const TOTAL_RUNS = 1;
    
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
    
    console.log(`\n📊 处理完成统计:`);
    console.log(`   📈 总案件数: ${totalCases.results[0].count}`);
    console.log(`   ✅ 成功处理: ${processedCases.results[0].count} (${Math.round(processedCases.results[0].count / totalCases.results[0].count * 100)}%)`);
    console.log(`   ❌ 处理失败: ${failedCases.results[0].count} (${Math.round(failedCases.results[0].count / totalCases.results[0].count * 100)}%)`);
    console.log(`   ⏳ 待处理: ${pendingCases} (${Math.round(pendingCases / totalCases.results[0].count * 100)}%)`);
    
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