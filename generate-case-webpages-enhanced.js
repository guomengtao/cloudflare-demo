const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 配置文件
const PROCESSED_CASES_FILE = 'processed-cases.txt';
const LOG_FILE = 'webpage-generation.log';
const CASE_DATA_FILE = 'case-urls-fixed.json';

// 获取已处理的案件ID列表
function getProcessedCaseIds() {
    try {
        if (fs.existsSync(PROCESSED_CASES_FILE)) {
            const content = fs.readFileSync(PROCESSED_CASES_FILE, 'utf8');
            return new Set(content.split('\n').filter(line => line.trim()));
        }
    } catch (error) {
        console.error('读取已处理案件文件失败:', error);
    }
    return new Set();
}

// 记录已处理的案件ID
function recordProcessedCaseId(caseId) {
    try {
        fs.appendFileSync(PROCESSED_CASES_FILE, caseId + '\n', 'utf8');
    } catch (error) {
        console.error('记录案件ID失败:', error);
    }
}

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

// 等待函数（带倒计时显示）
function wait(seconds) {
    return new Promise((resolve) => {
        log(`等待 ${seconds} 秒...`);
        let remaining = seconds;
        
        const interval = setInterval(() => {
            process.stdout.write(`\r⏰ 倒计时: ${remaining} 秒   `);
            remaining--;
            
            if (remaining < 0) {
                clearInterval(interval);
                process.stdout.write('\r✅ 等待完成!           \n');
                resolve();
            }
        }, 1000);
    });
}

// 随机等待5-15秒
async function randomWait() {
    const seconds = Math.floor(Math.random() * 11) + 5; // 5-15秒
    await wait(seconds);
}

// 从案件URL中提取案件信息
function extractCaseInfoFromUrl(url) {
    try {
        // 从URL中提取案件ID和州信息
        const urlParts = url.split('/');
        const caseId = urlParts[urlParts.length - 3] + '-' + urlParts[urlParts.length - 2];
        
        // 从URL中提取州代码（例如：USNY -> New York）
        const stateCode = urlParts[urlParts.length - 4];
        let state = 'Unknown';
        let city = 'Unknown';
        
        if (stateCode.startsWith('US')) {
            const stateAbbr = stateCode.substring(2);
            // 简单的州名映射（可以根据需要扩展）
            const stateMap = {
                'NY': 'New York',
                'VA': 'Virginia',
                'TX': 'Texas',
                'CA': 'California',
                'FL': 'Florida',
                'IL': 'Illinois',
                'PA': 'Pennsylvania',
                'OH': 'Ohio',
                'GA': 'Georgia',
                'NC': 'North Carolina',
                'MI': 'Michigan',
                'NJ': 'New Jersey',
                'WA': 'Washington',
                'AZ': 'Arizona',
                'MA': 'Massachusetts',
                'IN': 'Indiana',
                'TN': 'Tennessee',
                'MO': 'Missouri',
                'MD': 'Maryland',
                'WI': 'Wisconsin',
                'MN': 'Minnesota',
                'CO': 'Colorado',
                'AL': 'Alabama',
                'SC': 'South Carolina',
                'LA': 'Louisiana',
                'KY': 'Kentucky',
                'OR': 'Oregon',
                'OK': 'Oklahoma',
                'CT': 'Connecticut',
                'IA': 'Iowa',
                'UT': 'Utah',
                'AR': 'Arkansas',
                'NV': 'Nevada',
                'MS': 'Mississippi',
                'KS': 'Kansas',
                'NM': 'New Mexico',
                'NE': 'Nebraska',
                'WV': 'West Virginia',
                'ID': 'Idaho',
                'HI': 'Hawaii',
                'NH': 'New Hampshire',
                'ME': 'Maine',
                'MT': 'Montana',
                'RI': 'Rhode Island',
                'DE': 'Delaware',
                'SD': 'South Dakota',
                'ND': 'North Dakota',
                'AK': 'Alaska',
                'DC': 'District of Columbia',
                'VT': 'Vermont',
                'WY': 'Wyoming'
            };
            state = stateMap[stateAbbr] || stateAbbr;
        } else if (stateCode === 'NCMC') {
            state = 'National Center for Missing Children';
        }
        
        return {
            case_id: caseId,
            case_url: url,
            state: state,
            city: city,
            name: `Case ${caseId}`,
            age: 'Unknown',
            scraped_content: `案件信息来自: ${url}\n案件ID: ${caseId}\n州: ${state}\n城市: ${city}`
        };
    } catch (error) {
        log(`提取案件信息失败: ${error.message}`);
        return null;
    }
}

// 获取需要处理的案件（从真实数据文件读取）
async function getCasesToScrape() {
    try {
        if (!fs.existsSync(CASE_DATA_FILE)) {
            log(`❌ 案件数据文件不存在: ${CASE_DATA_FILE}`);
            return [];
        }
        
        const caseData = JSON.parse(fs.readFileSync(CASE_DATA_FILE, 'utf8'));
        const urls = caseData.urls || [];
        
        log(`📊 从数据文件读取到 ${urls.length} 个案件URL`);
        
        // 过滤掉西班牙语页面，只处理英语页面
        const englishUrls = urls.filter(url => !url.includes('/es/'));
        
        log(`🔤 过滤后剩余 ${englishUrls.length} 个英语案件`);
        
        // 转换为案件数据对象
        const cases = englishUrls.map(url => extractCaseInfoFromUrl(url)).filter(caseData => caseData !== null);
        
        return cases;
    } catch (error) {
        log(`获取案件列表失败: ${error.message}`);
        return [];
    }
}

// 调用AI接口生成网页内容（使用新的有效API接口）
async function generateWebpageWithAI(caseData) {
    try {
        log(`调用AI接口生成网页内容: ${caseData.case_id}`);
        
        // 使用新的有效API接口
        const aiEndpoint = 'https://old-haze-afbc.guomengtao.workers.dev/v1/models/gemini-2.5-flash:generateContent';
        
        // 限制案件内容长度，避免请求过大
        const contentPreview = caseData.scraped_content 
            ? caseData.scraped_content.substring(0, 2000) + (caseData.scraped_content.length > 2000 ? '...' : '')
            : '无详细信息';
        
        // 构建详细的提示词
        const prompt = `请根据以下失踪人员信息生成一个完整的 HTML 网页代码：

失踪人员信息：
- 案件ID: ${caseData.case_id}
- 姓名: ${caseData.name || '未知'}
- 年龄: ${caseData.age || '未知'}
- 失踪地点: ${caseData.city || '未知'}, ${caseData.state || '未知州'}
- 案件URL: ${caseData.case_url || '无'}
- 案件内容预览: ${contentPreview}

网页要求：
1. 生成完整的、可运行的 HTML 文件代码
2. 包含完整的 HTML 结构（html, head, body）
3. 包含响应式 CSS 样式（使用 Tailwind CSS）
4. 设计要专业、简洁，适合失踪人员信息展示
5. 包含必要的元数据和 SEO 优化
6. 支持移动端查看
7. 使用中文内容
8. 包含 AMBER 警报相关元素

请直接返回完整的 HTML 代码，不要额外的解释文字。`;

        const response = await fetch(`${aiEndpoint}?key=AIzaSyDmVIE4nAIv4-rhSg89zLTNVsNqOMzMcxY`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            }),
            timeout: 30000 // 30秒超时
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || data.error);
        }
        
        // 提取生成的HTML内容
        let htmlContent = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            htmlContent = data.candidates[0].content.parts[0].text;
            // 清理HTML代码，提取纯HTML部分
            htmlContent = extractHtmlCode(htmlContent);
        } else {
            throw new Error('无效的 API 响应格式');
        }
        
        // 直接返回生成的HTML内容
        return {
            success: true,
            content: htmlContent,
            filename: generateFilename(caseData)
        };
    } catch (error) {
        log(`AI接口调用失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 提取纯HTML代码（增强版）
function extractHtmlCode(text) {
    // 尝试提取 ```html 代码块
    const htmlBlockMatch = text.match(/```html\n([\s\S]*?)\n```/);
    if (htmlBlockMatch) {
        return htmlBlockMatch[1];
    }
    
    // 尝试提取 ``` 代码块
    const codeBlockMatch = text.match(/```\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1];
    }
    
    // 尝试提取 <!DOCTYPE html> 开头的HTML代码
    const htmlStartMatch = text.match(/<!DOCTYPE html>[\s\S]*/);
    if (htmlStartMatch) {
        return htmlStartMatch[0];
    }
    
    // 尝试提取 <html> 开头的HTML代码
    const htmlTagMatch = text.match(/<html[\s\S]*<\/html>/i);
    if (htmlTagMatch) {
        return htmlTagMatch[0];
    }
    
    // 如果没有代码块标记，返回原始文本
    return text;
}

// 生成文件名（使用小写case_id）
function generateFilename(caseData) {
    const state = (caseData.state || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const city = (caseData.city || 'unknown').toLowerCase().replace(/\s+/g, '-');
    return `${caseData.case_id}-${city}-${state}.html`; // 使用小写case_id-城市-州.html格式
}

// 创建文件夹结构（按州和城市，使用小写）
function createFolderStructure(state, city) {
    // 确保州和城市名是小写
    const stateLower = state.toLowerCase().replace(/\s+/g, '-');
    const cityLower = city.toLowerCase().replace(/\s+/g, '-');
    
    const baseDir = path.join(__dirname, 'cases');
    const stateDir = path.join(baseDir, stateLower);
    const cityDir = path.join(stateDir, cityLower);
    
    try {
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);
        if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir);
        if (!fs.existsSync(cityDir)) fs.mkdirSync(cityDir);
        
        log(`📁 创建文件夹: ${stateLower}/${cityLower}`);
        return cityDir;
    } catch (error) {
        log(`创建文件夹结构失败: ${error.message}`);
        return baseDir; // 如果失败，使用基础目录
    }
}

// 保存网页文件
function saveWebpageFile(content, folderPath, filename) {
    try {
        const filePath = path.join(folderPath, filename);
        fs.writeFileSync(filePath, content, 'utf8');
        log(`✅ 网页文件已保存: ${filePath}`);
        return filePath;
    } catch (error) {
        log(`❌ 保存网页文件失败: ${error.message}`);
        return null;
    }
}

// 处理单个案件
async function processSingleCase() {
    const processedCaseIds = getProcessedCaseIds();
    
    // 从数据文件获取案件信息
    const cases = await getCasesToScrape();
    
    if (!cases || cases.length === 0) {
        log('❌ 没有找到有内容的案件');
        return null; // 返回null表示没有案件需要处理
    }
    
    // 过滤掉已经处理过的案件
    const unprocessedCases = cases.filter(caseData => !processedCaseIds.has(caseData.case_id));
    
    if (unprocessedCases.length === 0) {
        log(`⏭️ 所有 ${cases.length} 个有内容的案件都已处理过`);
        return null; // 返回null表示没有未处理的案件
    }
    
    const caseData = unprocessedCases[0]; // 每次只处理一个案件
    
    log(`🔍 开始处理案件: ${caseData.case_id}`);
    log(`📍 地点: ${caseData.city}, ${caseData.state}`);
    log(`📄 内容长度: ${caseData.scraped_content?.length || 0} 字符`);
    log(`📊 待处理案件: ${unprocessedCases.length}/${cases.length}`);
    
    try {
        // 生成网页内容
        const result = await generateWebpageWithAI(caseData);
        
        if (!result.success) {
            log(`❌ 生成网页内容失败: ${result.error}`);
            return false;
        }
        
        // 创建文件夹结构
        const folderPath = createFolderStructure(caseData.state, caseData.city);
        
        // 保存网页文件
        const filePath = saveWebpageFile(result.content, folderPath, result.filename);
        
        if (filePath) {
            // 记录已处理的案件ID
            recordProcessedCaseId(caseData.case_id);
            log(`✅ 案件处理完成: ${caseData.case_id}`);
            log(`📁 文件保存位置: ${filePath}`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        log(`❌ 处理案件失败: ${error.message}`);
        return false;
    }
}

// 主处理函数 - 循环处理所有案件
async function processCasesForWebpage() {
    log('🚀 开始网页生成任务');
    
    let totalProcessed = 0;
    let hasMoreCases = true;
    
    while (hasMoreCases) {
        try {
            const result = await processSingleCase();
            
            if (result === true) {
                totalProcessed++;
                log(`✅ 已成功处理 ${totalProcessed} 个案件`);
                
                // 处理完一个案件后等待5-15秒
                await randomWait();
            } else if (result === null) {
                // 没有案件需要处理
                hasMoreCases = false;
                if (totalProcessed === 0) {
                    log('⚠️ 没有需要处理的案件或处理失败');
                } else {
                    log(`🎉 网页生成任务完成！总共处理了 ${totalProcessed} 个案件`);
                }
            } else {
                // 处理失败，继续下一个
                log('⚠️ 当前案件处理失败，继续下一个案件');
                await wait(3); // 失败后等待3秒
            }
            
        } catch (error) {
            log(`❌ 处理案件时发生错误: ${error.message}`);
            await wait(5); // 错误后等待5秒
        }
    }
    
    // 所有案件处理完成后，等待5分钟再重新开始
    if (totalProcessed > 0) {
        log('⏰ 所有案件处理完成，等待5分钟后重新查询...');
        await wait(300); // 等待5分钟
        log('🔄 重新开始查询新案件...');
        await processCasesForWebpage(); // 递归调用重新开始
    }
}

// 导出函数供监控脚本使用
module.exports = {
    processCasesForWebpage
};

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
    processCasesForWebpage().catch(error => {
        console.error('程序执行失败:', error);
        process.exit(1);
    });
}