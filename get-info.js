const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// 初始化配置
const envPath = fs.existsSync(path.resolve(__dirname, '.env')) 
    ? path.resolve(__dirname, '.env') 
    : null;
if (envPath) {
    dotenv.config({ path: envPath });
}

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;

// 确保环境变量存在
if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID) {
    console.error('❌ 缺少必要的环境变量');
    process.exit(1);
}

// API 配置
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

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
 * 检测HTML中是否包含真实的图片
 * @param {string} htmlContent - 要检测的HTML内容
 * @param {boolean} returnUrls - 是否返回检测到的图片URL数组而不是布尔值
 * @returns {boolean|string[]} - 如果returnUrls为false返回布尔值，否则返回图片URL数组
 */
function hasRealImages(htmlContent, returnUrls = false) {
    if (!htmlContent) return returnUrls ? [] : false;
    
    // 支持多种图片格式
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const allImageUrls = [];
    
    // 提取 <img> 标签中的图片URL
    const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(htmlContent)) !== null) {
        if (imgMatch[1]) {
            allImageUrls.push(imgMatch[1]);
        }
    }
    
    if (allImageUrls.length === 0) {
        return returnUrls ? [] : false;
    }
    
    // 过滤真实的图片URL（排除占位符和无效URL）
    const realImages = allImageUrls.filter(url => {
        if (!url || url.trim() === '') return false;
        
        const trimmedUrl = url.trim();
        const lowerUrl = trimmedUrl.toLowerCase();
        
        // 排除占位符图片
        if (lowerUrl.includes('via.placeholder.com') || 
            lowerUrl.includes('placeholder') ||
            lowerUrl.includes('data:image') || // 排除base64图片
            lowerUrl.includes('blank') ||
            lowerUrl.includes('default')) {
            return false;
        }
        
        // 检查是否是有效的图片URL
        return imageExtensions.some(ext => lowerUrl.endsWith('.' + ext));
    });
    
    // 去重
    const uniqueImages = [...new Set(realImages)];
    
    return returnUrls ? uniqueImages : uniqueImages.length > 0;
}

/**
 * 从HTML中提取指定文本字段的工具函数
 * @param {string} html - HTML内容
 * @param {string} fieldName - 要提取的字段名称
 * @returns {string|null} - 提取的字段值，未找到则返回null
 */
function extractFieldFromHtml(html, fieldName) {
    if (!html || !fieldName) return null;
    
    // 构建正则表达式：匹配字段名后的内容
    const regex = new RegExp(`(${fieldName}[^<]*)<[^>]*>([^<]*)<\\/[^>]*>`, 'i');
    const match = html.match(regex);
    
    return match && match[2] ? match[2].trim() : null;
}

/**
 * 从HTML中提取日期字段并格式化为YYYY-MM-DD
 * @param {string} html - HTML内容
 * @param {string} fieldName - 要提取的日期字段名称
 * @returns {string|null} - 格式化后的日期，未找到则返回null
 */
function extractDateFromHtml(html, fieldName) {
    const dateStr = extractFieldFromHtml(html, fieldName);
    if (!dateStr) return null;
    
    // 简单的日期格式化处理，根据实际情况可能需要更复杂的逻辑
    try {
        // 尝试匹配各种日期格式
        const datePatterns = [
            /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
            /(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
            /(\d{4})\/(\d{2})\/(\d{2})/ // YYYY/MM/DD
        ];
        
        for (const pattern of datePatterns) {
            const match = dateStr.match(pattern);
            if (match) {
                if (match[1].length === 4) {
                    // YYYY-MM-DD 或 YYYY/MM/DD
                    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
                } else {
                    // MM/DD/YYYY 或 MM-DD-YYYY
                    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error(`日期格式化错误: ${error.message}`);
        return null;
    }
}

/**
 * 从HTML中提取年龄数字
 * @param {string} html - HTML内容
 * @returns {number|null} - 提取的年龄，未找到则返回null
 */
function extractAgeFromHtml(html) {
    const ageStr = extractFieldFromHtml(html, 'Age');
    if (!ageStr) return null;
    
    const ageMatch = ageStr.match(/(\\d+)/);
    return ageMatch ? parseInt(ageMatch[1]) : null;
}

/**
 * 从HTML中提取身高和体重信息
 * @param {string} html - HTML内容
 * @returns {Object} - 包含身高和体重的对象
 */
function extractHeightWeightFromHtml(html) {
    const hwStr = extractFieldFromHtml(html, 'Height and Weight');
    if (!hwStr) return { height: null, weight: null };
    
    // 简单提取，根据实际情况可能需要更复杂的逻辑
    const heightMatch = hwStr.match(/(\\d+'?\\d*\"?)/i);
    const weightMatch = hwStr.match(/(\\d+\s*lbs?)/i);
    
    return {
        height: heightMatch ? heightMatch[1].trim() : null,
        weight: weightMatch ? weightMatch[1].trim() : null
    };
}

/**
 * 从HTML中提取特征信息
 * @param {string} html - HTML内容
 * @returns {Object} - 包含眼颜色、头发颜色和其他特征的对象
 */
function extractCharacteristicsFromHtml(html) {
    const charStr = extractFieldFromHtml(html, 'Distinguishing Characteristics');
    if (!charStr) return { eye_color: null, hair_color: null, distinguishing_marks: null };
    
    // 简单提取，根据实际情况可能需要更复杂的逻辑
    const eyeColorMatch = charStr.match(/Eye Color:?\s*([^,]+)/i);
    const hairColorMatch = charStr.match(/Hair Color:?\s*([^,]+)/i);
    
    return {
        eye_color: eyeColorMatch ? eyeColorMatch[1].trim() : null,
        hair_color: hairColorMatch ? hairColorMatch[1].trim() : null,
        distinguishing_marks: charStr
    };
}

/**
 * 从HTML中提取地理信息
 * @param {string} html - HTML内容
 * @returns {Object} - 包含城市、州和国家的对象
 */
function extractLocationFromHtml(html) {
    const locationStr = extractFieldFromHtml(html, 'Missing From');
    if (!locationStr) return { missing_city: null, missing_state: null, missing_county: null };
    
    // 简单提取，根据实际情况可能需要更复杂的逻辑
    const parts = locationStr.split(',').map(part => part.trim());
    
    // 尝试提取城市和州
    let missing_city = null;
    let missing_state = null;
    let missing_county = null;
    
    if (parts.length >= 2) {
        missing_city = parts[0];
        missing_state = parts[1].split(' ')[0]; // 只取州的缩写
    }
    
    // 尝试从HTML中直接提取县信息
    const countyStr = extractFieldFromHtml(html, 'County') || extractFieldFromHtml(html, 'county');
    if (countyStr) {
        missing_county = countyStr;
    }
    
    return {
        missing_city,
        missing_state,
        missing_county
    };
}

/**
 * 计算文本的单词数
 * @param {string} text - 要计算的文本
 * @returns {number} - 单词数
 */
function calculateWordCount(text) {
    if (!text || typeof text !== 'string') return 0;
    // 移除多余空格并按空格分割单词
    return text.trim().split(/\s+/).length;
}

/**
 * 从数据库获取指定案件的信息
 * @param {string} caseId - 案件ID
 * @returns {Object} - 案件信息
 */
async function getCaseFromDatabase(caseId) {
    const selectQuery = `
        SELECT id, case_id, case_url, case_title, case_html, created_at, updated_at
        FROM missing_persons_cases 
        WHERE case_id = ?
    `;
    
    const selectResult = await queryD1(selectQuery, [caseId]);
    return selectResult?.results?.[0] || null;
}

/**
 * 写入案件信息到数据库
 * @param {Object} caseInfo - 案件信息
 * @param {Object} extractedData - 提取的数据
 * @returns {Object} - 写入结果
 */
async function writeCaseToDatabase(caseInfo, extractedData) {
    // 更新主表 JSON
    await queryD1(
        `UPDATE missing_persons_cases SET analysis_result = ?, info_status = 1 WHERE id = ?`, 
        [JSON.stringify(extractedData), caseInfo.id]
    );

    // 写入详情表 (missing_persons_info)
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
        caseInfo.case_id, extractedData.full_name || null, extractedData.date_of_birth || null, extractedData.missing_since || null, extractedData.age_at_missing || null,
        extractedData.missing_city || null, extractedData.missing_county || null, extractedData.missing_state || null, extractedData.location_details || null,
        extractedData.sex || null, extractedData.race || null, extractedData.height || null, extractedData.weight || null, extractedData.eye_color || null, extractedData.hair_color || null,
        extractedData.distinguishing_marks || null, extractedData.vehicle_info || null, extractedData.classification || null,
        extractedData.investigating_agency || null, extractedData.source_info || null, extractedData.case_summary || null,
        extractedData.disappearance_details || null, extractedData.total_updates_count || null, extractedData.disappearance_details_word_count || null,
        extractedData.last_case_update_raw || null, extractedData.last_verified_date || null, extractedData.main_photo_url || null, JSON.stringify(extractedData.images_json || [])
    ];

    await queryD1(insertInfoSQL, infoParams);
    
    // 返回写入信息
    return {
        success: true,
        case_id: caseInfo.case_id,
        db_id: caseInfo.id
    };
}

/**
 * 提取案件信息
 * @param {Object} caseInfo - 案件信息
 * @returns {Object} - 提取结果
 */
function extractCaseInfo(caseInfo) {
    if (!caseInfo || !caseInfo.case_html) {
        return { success: false, error: '缺少案件信息或HTML内容' };
    }
    
    const { case_html, case_id, case_title } = caseInfo;
    
    // 检测图片
    const realImages = hasRealImages(case_html, true);
    if (!realImages || realImages.length === 0) {
        return { success: false, error: '未检测到真实图片' };
    }
    
    // 提取各种字段
    const date_of_birth = extractDateFromHtml(case_html, 'Date of Birth');
    const missing_since = extractDateFromHtml(case_html, 'Missing Since');
    const age_at_missing = extractAgeFromHtml(case_html);
    const { height, weight } = extractHeightWeightFromHtml(case_html);
    const { eye_color, hair_color, distinguishing_marks } = extractCharacteristicsFromHtml(case_html);
    const { missing_city, missing_state, missing_county } = extractLocationFromHtml(case_html);
    const sex = extractFieldFromHtml(case_html, 'Sex');
    const race = extractFieldFromHtml(case_html, 'Race');
    const location_details = extractFieldFromHtml(case_html, 'Missing From');
    const classification = extractFieldFromHtml(case_html, 'Classification');
    const investigating_agency = extractFieldFromHtml(case_html, 'investigating_agency') || 
                                extractFieldFromHtml(case_html, 'Investigating Agency');
    const source_info = extractFieldFromHtml(case_html, 'Source Information');
    const disappearance_details = extractFieldFromHtml(case_html, 'Details of Disappearance');
    const last_verified_date = extractDateFromHtml(case_html, 'Last verified') || 
                              extractDateFromHtml(case_html, 'Last updated');
    const case_summary = extractFieldFromHtml(case_html, 'Summary');
    
    // 计算消失详情的单词数
    const disappearance_details_word_count = calculateWordCount(disappearance_details);
    
    // 提取主图片URL
    const main_photo_url = realImages[0];
    const images_json = realImages;
    
    // 构建提取的数据
    const extractedData = {
        case_id,
        full_name: case_title,
        date_of_birth,
        missing_since,
        age_at_missing,
        missing_city,
        missing_state,
        missing_county,
        location_details,
        sex,
        race,
        height,
        weight,
        eye_color,
        hair_color,
        distinguishing_marks,
        vehicle_info: null,
        classification,
        investigating_agency,
        source_info,
        case_summary,
        disappearance_details,
        disappearance_details_word_count,
        last_verified_date,
        main_photo_url,
        images_json: realImages
    };
    
    return {
        success: true,
        data: extractedData,
        extracted_fields: Object.keys(extractedData).filter(key => extractedData[key] !== null),
        missing_fields: Object.keys(extractedData).filter(key => extractedData[key] === null)
    };
}

/**
 * 主函数
 */
async function main() {
    // 获取命令行参数
    const caseId = process.argv[2];
    
    if (!caseId) {
        console.error('❌ 请指定案件ID');
        console.error('使用方式: node get-info.js 案件ID');
        process.exit(1);
    }
    
    console.log(`🚀 正在处理案件: ${caseId}`);
    
    try {
        // 从数据库获取案件信息
        const caseInfo = await getCaseFromDatabase(caseId);
        
        if (!caseInfo) {
            console.error(`❌ 未找到案件ID为 ${caseId} 的案件`);
            process.exit(1);
        }
        
        console.log('📋 案件基本信息:');
        console.log(`   🔹 案件ID: ${caseInfo.case_id}`);
        console.log(`   🔹 案件标题: ${caseInfo.case_title}`);
        console.log(`   🔹 数据库ID: ${caseInfo.id}`);
        console.log(`   🔹 创建时间: ${caseInfo.created_at}`);
        console.log(`   🔹 更新时间: ${caseInfo.updated_at}`);
        console.log(`   🔹 HTML内容长度: ${caseInfo.case_html.length} 字符`);
        
        // 提取案件信息
        const extractionResult = extractCaseInfo(caseInfo);
        
        if (!extractionResult.success) {
            console.error(`❌ 提取失败: ${extractionResult.error}`);
            process.exit(1);
        }
        
        const { data, extracted_fields, missing_fields } = extractionResult;
        
        // 输出提取结果
        console.log('\n📊 提取结果:');
        console.log('✅ 已提取字段:');
        extracted_fields.forEach(field => {
            if (field === 'images_json') {
                console.log(`   ${field}: [`);
                data[field].forEach((url, index) => {
                    console.log(`      "${url}"${index < data[field].length - 1 ? ',' : ''}`);
                });
                console.log(`   ]`);
            } else {
                console.log(`   ${field}: ${data[field]}`);
            }
        });
        
        if (missing_fields.length > 0) {
            console.log('❌ 未提取到的字段:');
            missing_fields.forEach(field => {
                console.log(`   ${field}`);
            });
        }
        
        // 写入数据库
        console.log('\n💾 正在写入数据库...');
        const writeResult = await writeCaseToDatabase(caseInfo, data);
        
        if (writeResult.success) {
            console.log('✅ 数据库写入成功!');
            console.log(`   🔹 案件ID: ${writeResult.case_id}`);
            console.log(`   🔹 数据库ID: ${writeResult.db_id}`);
        }
        
    } catch (error) {
        console.error('❌ 处理失败:', error.message);
        process.exit(1);
    }
}

// 执行主函数
if (require.main === module) {
    main();
}

// 导出模块（如果需要）
module.exports = {
    getCaseFromDatabase,
    extractCaseInfo,
    writeCaseToDatabase
};