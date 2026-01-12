const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 1. 初始化配置
const envPath = fs.existsSync(path.resolve(__dirname, '../.env')) 
    ? path.resolve(__dirname, '../.env') 
    : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID } = process.env;

if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID) {
    console.error('❌ 缺少环境变量');
    if (require.main === module) process.exit(1);
}

// 延迟函数，用于控制AI请求频率
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 使用 Llama 3.2 3B 小模型
const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-3b-instruct`;

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
    
    // 简化检测逻辑：直接搜索图片URL
    const urlPattern = new RegExp(`https?:\/\/[^\s"']+\.(${imageExtensions.join('|')})[^\s"']*`, 'gi');
    const urlMatches = htmlContent.match(urlPattern) || [];
    
    // 同时检查 <img> 标签
    const imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const imgMatches = htmlContent.match(imgPattern) || [];
    
    // 合并所有图片URL
    const allImageUrls = [...urlMatches];
    
    // 提取 <img> 标签中的图片URL
    imgMatches.forEach(imgTag => {
        const srcMatch = imgTag.match(/src="([^"]+)"/i);
        if (srcMatch && srcMatch[1]) {
            allImageUrls.push(srcMatch[1]);
        }
    });
    
    if (allImageUrls.length === 0) {
        console.log('🔍 未找到任何图片URL');
        return returnUrls ? [] : false;
    }
    
    // 过滤真实的图片URL（排除占位符和无效URL）
    const realImages = allImageUrls.filter(url => {
        if (!url || url.trim() === '') return false;
        
        const lowerUrl = url.toLowerCase();
        
        // 排除占位符图片
        if (lowerUrl.includes('via.placeholder.com') || 
            lowerUrl.includes('placeholder') ||
            lowerUrl.includes('data:image') || // 排除base64图片
            lowerUrl.includes('blank') ||
            lowerUrl.includes('default')) {
            return false;
        }
        
        // 检查是否是有效的图片URL
        return imageExtensions.some(ext => lowerUrl.includes('.' + ext));
    });
    
    // 去重
    const uniqueImages = [...new Set(realImages)];
    
    console.log(`🔍 图片检测结果: 找到 ${uniqueImages.length} 个真实图片`);
    if (uniqueImages.length > 0) {
        console.log('📸 检测到的图片:');
        uniqueImages.forEach((url, index) => {
            console.log(`   ${index + 1}. ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
        });
    }
    
    return returnUrls ? uniqueImages : uniqueImages.length > 0;
}

/**
 * 清理HTML内容，移除噪声
 * @param {string} htmlContent - 原始HTML内容
 * @returns {string} - 清理后的HTML内容
 */
function cleanHtmlContent(htmlContent) {
    if (!htmlContent) return '';
    
    let cleaned = htmlContent;
    
    // 1. 移除常见的侧边栏和导航元素
    cleaned = cleaned.replace(/<aside[^>]*>.*?<\/aside>/gsi, '');
    cleaned = cleaned.replace(/<nav[^>]*>.*?<\/nav>/gsi, '');
    cleaned = cleaned.replace(/<footer[^>]*>.*?<\/footer>/gsi, '');
    cleaned = cleaned.replace(/<header[^>]*>.*?<\/header>/gsi, '');
    
    // 2. 移除侧边栏链接（如About Meaghan, Blog, Contact等）
    cleaned = cleaned.replace(/<a[^>]*>(About|Blog|Contact|Donate|Help|Privacy|Terms)[^<]*<\/a>/gsi, '');
    
    // 3. 移除脚本和样式
    cleaned = cleaned.replace(/<script[^>]*>.*?<\/script>/gsi, '');
    cleaned = cleaned.replace(/<style[^>]*>.*?<\/style>/gsi, '');
    cleaned = cleaned.replace(/<link[^>]*>/gsi, '');
    
    // 4. 移除注释
    cleaned = cleaned.replace(/<!--.*?-->/gs, '');
    
    // 5. 移除多余的空格和换行
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // 6. 确保关键内容保留
    // 保留id为photos的照片区域
    const photosMatch = cleaned.match(/<div[^>]*id=["']photos["'][^>]*>.*?<\/div>/si);
    if (photosMatch) {
        // 保留关键字段相关的内容
        const keyFields = ['Date of Birth', 'Missing Since', 'Age', 'Missing From', 
                          'Sex', 'Race', 'Height', 'Weight', 'Distinguishing Characteristics',
                          'Details of Disappearance', 'Classification', 'Source Information'];
        
        let keyContent = '';
        keyFields.forEach(field => {
            const fieldRegex = new RegExp(`(${field}[^<]*)<.*?>(.*?)<\/.*?>`, 'si');
            const match = cleaned.match(fieldRegex);
            if (match) {
                keyContent += `${match[0]} `;
            }
        });
        
        // 组合照片区域和关键内容
        if (keyContent) {
            cleaned = `<div>${keyContent} ${photosMatch[0]}</div>`;
        }
    }
    
    return cleaned;
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
    const regex = new RegExp(`(${fieldName}[^<]*)<[^>]*>([^<]*)<\/[^>]*>`, 'i');
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
    
    const ageMatch = ageStr.match(/(\d+)/);
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
    
    const heightMatch = hwStr.match(/Height:\s*([^,]+)/i);
    const weightMatch = hwStr.match(/Weight:\s*([^,]+)/i);
    
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
    const eyeColorMatch = charStr.match(/Eye Color:\s*([^,]+)/i);
    const hairColorMatch = charStr.match(/Hair Color:\s*([^,]+)/i);
    
    return {
        eye_color: eyeColorMatch ? eyeColorMatch[1].trim() : null,
        hair_color: hairColorMatch ? hairColorMatch[1].trim() : null,
        distinguishing_marks: charStr
    };
}

/**
 * 核心提取函数
 */
async function extractCaseDetailsPure(caseHtml, caseId) {
    // 首先检测是否有真实图片
    const realImages = hasRealImages(caseHtml, true); // 传入true以返回检测到的图片URL
    if (!realImages || realImages.length === 0) {
        console.log('❌ 源代码中没有检测到真实图片，跳过AI处理');
        return { success: false, error: '源代码中没有真实图片' };
    }
    
    // 清理HTML内容，减少噪声
    const cleanedHtml = cleanHtmlContent(caseHtml);
    console.log('📝 HTML内容已清理，清理后长度:', cleanedHtml.length, '字符');
    
    // 简化提示词，只提取州名、城市名和县名
    const prompt = `📝 字段提取规则 (1行1字段)



missing_city : 提取 Missing From  后逗号前的城市名。
missing_state : 提取 Missing From  后逗号后的州名。
missing_county:  AI 推理：根据 missing_city 和 missing_state 匹配所属的县（County） 禁止为null 判决书不到直接结束任务。

Input: "${cleanedHtml}"

⚠️ 重要格式要求：必须使用竖线分隔的键值对格式返回结果，不能使用其他格式！
每个键值对之间必须用竖线 | 分隔，键和值之间必须用冒号 : 分隔。
确保所有字段都存在，未找到的字段返回 null。

🚫 禁止格式：
- 不能使用JSON格式
- 不能使用空格分隔键值对
- 不能使用换行分隔键值对
- 不能使用其他分隔符

✅ 必须严格按照以下Schema格式返回所有字段：
date_of_birth:YYYY-MM-DD|missing_since:YYYY-MM-DD|age_at_missing:数字|missing_city:城市名|missing_state:州名|missing_county:县名|location_details:完整位置描述|sex:性别|race:种族|height:身高|weight:体重|eye_color:眼色|hair_color:发色|distinguishing_marks:特征描述|vehicle_info:车辆信息|null|classification:分类|investigating_agency:调查机构|source_info:来源信息|images_json:["URL1.jpg","URL2.jpg"]|disappearance_details:失踪详情|total_updates_count:数字|last_case_update_raw:更新描述|last_verified_date:YYYY-MM-DD

💡 关键提示：
1. 仅从Input中提取真实存在的信息，未找到的字段必须返回null
2. 绝对不要编造或使用示例数据
3. images_json必须是JSON格式的URL数组，仅包含真实图片，不能使用占位符
4. 所有日期字段必须转换为YYYY-MM-DD格式`;

    try {
        const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are a precise data extractor that outputs only valid JSON format data. Ensure all quotes are properly escaped and the JSON is complete and valid.' }, 
                    { role: 'user', content: prompt }
                ],
                max_tokens: 2000
            })
        });

        const result = await response.json();
        const aiText = result.result?.response?.trim().replace(/\n/g, ' ');
        console.log('📥 AI 原始响应:', aiText);
        
        // 延迟40-70秒，防止频繁请求
        const delaySeconds = Math.floor(Math.random() * (7 - 4 + 1)) + 20;
        console.log(`⏳ 等待 ${delaySeconds} 秒后继续下一个请求...`);
        await sleep(delaySeconds * 1000);

        // 解析 AI 返回的竖线分隔响应
        try {
            // 将文本转换为JSON对象，支持两种格式：竖线分隔和JSON格式
            function textToJson(inputText) {
                // 移除可能的Markdown代码块标记
                let cleanedText = inputText.replace(/```json/g, '').replace(/```/g, '').trim();
                
                // 尝试直接解析JSON格式
                try {
                    return JSON.parse(cleanedText);
                } catch (jsonError) {
                    console.log('⚠️ 直接JSON解析失败，尝试竖线分隔格式解析');
                }
                
                // 尝试解析为竖线分隔格式
                const result = {};
                
                // 分割键值对（支持竖线或空格分隔）
                const pairs = cleanedText.split(/[|\s]+/).filter(pair => pair.includes(':'));
                
                pairs.forEach(pair => {
                    // 找到第一个冒号作为键值分隔符
                    const colonIndex = pair.indexOf(':');
                    if (colonIndex !== -1) {
                        const key = pair.substring(0, colonIndex).trim();
                        let value = pair.substring(colonIndex + 1).trim();
                        
                        // 处理特殊值
                        if (value === 'null') {
                            result[key] = null;
                        } else if (value === 'true') {
                            result[key] = true;
                        } else if (value === 'false') {
                            result[key] = false;
                        } else if (/^\d+$/.test(value)) {
                            // 处理数字
                            result[key] = parseInt(value);
                        } else if (/^\[.*\]$/.test(value) || /^\{.*\}$/.test(value)) {
                            // 处理JSON数组或对象
                            try {
                                result[key] = JSON.parse(value);
                            } catch (e) {
                                console.error(`⚠️ 解析${key}的值失败: ${value}`);
                                result[key] = value;
                            }
                        } else {
                            // 处理普通字符串
                            result[key] = value;
                        }
                    }
                });
                
                return result;
            }
            
            // 转换为JSON对象
            const aiData = textToJson(aiText);
            
            // 检查 missing_county 是否存在
            if (!aiData.missing_county || aiData.missing_county === 'NULL' || aiData.missing_county === null) {
                return { success: false, error: 'missing_county 不能为空', raw_response: aiText };
            }
            
            // 计算disappearance_details的单词数
            const calculateWordCount = (text) => {
                if (!text || typeof text !== 'string') return 0;
                // 移除多余空格并按空格分割单词
                return text.trim().split(/\s+/).length;
            };

            // 从images_json中提取第一张图片作为main_photo_url
            let main_photo_url = null;
            let processedImages = [];
            try {
                let images = [];
                
                // 简化的JSON修复函数，专门处理URL数组
                function fixImagesJson(jsonString) {
                    if (!jsonString) return '[]';
                    
                    // 移除多余的空格
                    let fixed = jsonString.replace(/\s+/g, ' ').trim();
                    
                    // 1. 提取所有包含.jpg的URL（支持多种格式）
                    const urlPattern = /https?:\/\/[^\s"']+\.jpg[^\s"']*/g;
                    const urls = fixed.match(urlPattern) || [];
                    
                    // 2. 过滤掉占位符图片URL和移除wsrv.nl前缀
                    const filteredUrls = urls.filter(url => {
                        const lowerUrl = url.toLowerCase();
                        return !lowerUrl.includes('via.placeholder.com');
                    }).map(url => {
                        // 移除https://wsrv.nl/?url=前缀
                        if (url.includes('https://wsrv.nl/?url=')) {
                            return url.replace('https://wsrv.nl/?url=', '').split('&')[0]; // 移除参数
                        }
                        return url;
                    });
                    
                    // 3. 构建干净的URL数组
                    return JSON.stringify(filteredUrls);
                }
                
                // 检查images_json的类型
                if (typeof aiData.images_json === 'object' && aiData.images_json !== null) {
                    // 如果已经是对象，直接使用
                    images = Array.isArray(aiData.images_json) ? aiData.images_json : [];
                } else {
                    // 如果是字符串，先修复逗号问题再解析
                    let imagesJsonString = aiData.images_json || '[]';
                    if (typeof imagesJsonString === 'string') {
                        // 使用专门的修复函数
                        let fixedImagesJson = fixImagesJson(imagesJsonString);
                        
                        // 尝试解析修复后的JSON
                        try {
                            images = JSON.parse(fixedImagesJson);
                            // 确保解析结果是数组
                            if (!Array.isArray(images)) {
                                images = [];
                            }
                        } catch (parseError) {
                            console.error('⚠️ 修复后仍然无法解析images_json:', parseError.message);
                            console.error('原始images_json:', imagesJsonString);
                            console.error('修复后的images_json:', fixedImagesJson);
                            images = [];
                        }
                    }
                }
                
                if (Array.isArray(images)) {
                    // 如果是对象数组，提取URL
                    if (images.length > 0 && typeof images[0] === 'object') {
                        processedImages = images
                            .map(img => img.src || '')
                            .filter(src => {
                                if (!src || !src.endsWith('.jpg')) return false;
                                const lowerSrc = src.toLowerCase();
                                return !lowerSrc.includes('via.placeholder.com');
                            });
                    } else {
                        // 如果已经是URL数组，直接使用
                        processedImages = images
                            .filter(url => {
                                if (typeof url !== 'string' || !url.endsWith('.jpg')) return false;
                                const lowerUrl = url.toLowerCase();
                                return !lowerUrl.includes('via.placeholder.com');
                            });
                    }
                    
                    // 如果AI没有返回有效的图片URL，使用我们检测到的真实图片
                    if (processedImages.length === 0) {
                        console.log('⚠️ AI返回的图片URL都是占位符，使用我们预先检测到的真实图片');
                        processedImages = realImages;
                    }
                    
                    if (processedImages.length > 0) {
                        main_photo_url = processedImages[0];
                    }
                }
            } catch (e) {
                console.error('⚠️ 解析images_json失败:', e.message);
                // 如果JSON解析失败，尝试用正则表达式直接提取第一张图片的URL
                if (typeof aiData.images_json === 'string') {
                    const srcMatch = aiData.images_json.match(/"src"\s*:\s*"([^"]+)"/);
                    if (srcMatch) {
                        main_photo_url = srcMatch[1];
                        // 如果能提取到URL但JSON解析失败，创建一个包含该URL的简单数组
                        processedImages = [{ src: main_photo_url, publish_time: null, description: null }];
                    }
                }
            }
            
            // 检查AI是否成功提取到图片
            if (!main_photo_url || processedImages.length === 0) {
                console.log('❌ AI未能提取到任何图片，跳过数据库写入');
                return { success: false, error: 'AI未能提取到任何图片' };
            }

            // 使用Node.js函数从HTML中提取其他字段
            const dateOfBirth = extractDateFromHtml(caseHtml, 'Date of Birth');
            const missingSince = extractDateFromHtml(caseHtml, 'Missing Since');
            const ageAtMissing = extractAgeFromHtml(caseHtml);
            const { height, weight } = extractHeightWeightFromHtml(caseHtml);
            const { eye_color, hair_color, distinguishing_marks } = extractCharacteristicsFromHtml(caseHtml);
            const sex = extractFieldFromHtml(caseHtml, 'Sex');
            const race = extractFieldFromHtml(caseHtml, 'Race');
            const locationDetails = extractFieldFromHtml(caseHtml, 'Missing From');
            const classification = extractFieldFromHtml(caseHtml, 'Classification');
            const investigatingAgency = extractFieldFromHtml(caseHtml, 'investigating_agency') || 
                                        extractFieldFromHtml(caseHtml, 'Investigating Agency');
            const sourceInfo = extractFieldFromHtml(caseHtml, 'Source Information');
            const disappearanceDetails = extractFieldFromHtml(caseHtml, 'Details of Disappearance');
            const lastVerifiedDate = extractDateFromHtml(caseHtml, 'Last verified') || 
                                    extractDateFromHtml(caseHtml, 'Last updated');
            

            
            // 提取更新次数
            const totalUpdatesCount = () => {
                const updateStr = extractFieldFromHtml(caseHtml, 'updated');
                if (!updateStr) return null;
                const countMatch = updateStr.match(/\d+/);
                return countMatch ? parseInt(countMatch[0]) : null;
            };

            return {
                success: true,
                case_id: caseId,
                data: {
                    full_name: caseId.replace(/-/g, ' ').replace(/(\w)(\w*)/g, (g0,g1,g2) => g1.toUpperCase() + g2.toLowerCase()) || null,
                    date_of_birth: dateOfBirth,
                    missing_since: missingSince,
                    age_at_missing: ageAtMissing,
                    missing_city: aiData.missing_city || null,
                    missing_county: aiData.missing_county,
                    missing_state: aiData.missing_state || null,
                    location_details: locationDetails,
                    sex: sex,
                    race: race,
                    height: height,
                    weight: weight,
                    eye_color: eye_color,
                    hair_color: hair_color,
                    distinguishing_marks: distinguishing_marks,
                    vehicle_info: null, // 暂时不提取车辆信息，若需要可添加专门的提取函数
                    classification: classification,
                    investigating_agency: investigatingAgency,
                    source_info: sourceInfo,
                    main_photo_url: main_photo_url,
                    images_json: processedImages.length > 0 ? processedImages : [],
                    disappearance_details: disappearanceDetails,
                    total_updates_count: totalUpdatesCount(),
                    disappearance_details_word_count: calculateWordCount(disappearanceDetails),
                    last_case_update_raw: extractFieldFromHtml(caseHtml, 'last_case_update_raw') || null,
                    last_verified_date: lastVerifiedDate
                }
            };
        } catch (parseError) {
            console.error('❌ AI 响应解析失败:', parseError.message);
            console.error('🔍 原始响应:', aiText);
            return { success: false, error: 'AI 响应解析失败', raw_response: aiText };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 包装函数：处理输入文件并返回结果
 */
async function generateWebpageWithAI(inputPath) {
    try {
        if (!fs.existsSync(inputPath)) throw new Error(`文件不存在: ${inputPath}`);
        const fileContent = fs.readFileSync(inputPath, 'utf8');
        const fileName = path.basename(inputPath, '.txt');
        // 清理 caseId
        const caseId = fileName.replace('temp_case_', '').replace('.txt', '');
        
        return await extractCaseDetailsPure(fileContent, caseId);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 命令行直接执行逻辑
 */
async function main() {
    const DEFAULT_INPUT = path.resolve(__dirname, 'test_case.txt'); 
    const inputPath = process.argv[2] 
                      ? path.resolve(process.cwd(), process.argv[2]) 
                      : DEFAULT_INPUT;

    console.log(`🚀 正在使用 Llama-3.2-3B 分析: ${path.basename(inputPath)}`);

    const result = await generateWebpageWithAI(inputPath);
    if (result.success) {
        console.log('\n✅ 提取成功:');
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.error('\n❌ 提取失败:', result.error);
    }
}

if (require.main === module) {
    main();
}

 
// 在 ai-cf-to-img.js 文件末尾
module.exports = { 
    extractCaseDetailsPure, // 确保导出这个核心函数
    generateWebpageWithAI,
    hasRealImages // 导出图片检测函数
};