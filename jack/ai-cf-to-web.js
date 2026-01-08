const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
console.log('正在加载环境变量...');
const result = dotenv.config({ 
  path: path.resolve(__dirname, '../.env'),
  debug: true
});

if (result.error) {
  console.error('❌ 加载.env文件失败:', result.error.message);
  process.exit(1);
}

// 从环境变量获取Cloudflare配置
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

// 检查必要的环境变量
if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID) {
    console.error('❌ 缺少必要的Cloudflare环境变量');
    process.exit(1);
}

// 命令行输出日志
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// 从输入信息中提取案件ID（支持多种格式）
function extractCaseIdFromInput(input) {
    log('🔍 从输入信息中提取案件ID...');
    
    // 查找案件ID行（新格式："案件ID:"）
    const caseIdMatch = input.match(/案件ID:\s+([^\n]+)/i);
    if (caseIdMatch) {
        const caseId = caseIdMatch[1].trim().toLowerCase();
        log(`🆔 提取到案件ID: ${caseId}`);
        return caseId;
    }
    
    // 查找旧格式："案件 case ID是"
    const oldCaseIdMatch = input.match(/案件 case ID是\s+([^\n]+)/i);
    if (oldCaseIdMatch) {
        const caseId = oldCaseIdMatch[1].trim().toLowerCase();
        log(`🆔 提取到案件ID（旧格式）: ${caseId}`);
        return caseId;
    }
    
    // 如果没有找到明确的案件ID，从URL中提取
    const urlMatch = input.match(/案件URL:\s+([^\n]+)/i);
    if (urlMatch) {
        const url = urlMatch[1].trim();
        const urlParts = url.split('/');
        const caseId = urlParts[urlParts.length - 1].trim().toLowerCase();
        log(`🔗 从URL中提取到案件ID: ${caseId}`);
        return caseId;
    }
    
    // 没有找到案件ID
    log('❌ 未找到案件ID');
    return null;
}

// 清理输入信息，只保留案件相关内容
function cleanInputInfo(input) {
    log('🧹 清理输入信息，只保留案件相关内容...');
    
    // 提取图片部分
    const imagesMatch = input.match(/\[images\]([\s\S]*?)\[text\]/i);
    const images = imagesMatch ? imagesMatch[0] : '';
    
    // 提取文本部分，然后清理文本中的无关内容
    const textMatch = input.match(/\[text\]([\s\S]*)/i);
    let text = textMatch ? textMatch[1] : '';
    
    // 移除网站导航和捐赠相关内容
    text = text.replace(/Case Searches.*?MENU/gsi, '');
    text = text.replace(/The Charley Project.*?Donations/gsi, '');
    text = text.replace(/Donations are accepted.*?Read more here\./gsi, '');
    text = text.replace(/Switch to Light Theme|Switch to Dark Theme|Skip to content|Generic selectors|Exact matches only|Search in title|Search in content|Post Type Selectors|Advanced Search/gsi, '');
    
    // 保留案件信息部分（更通用的正则表达式，匹配从案例标题到调查机构的内容）
    const caseInfoMatch = text.match(/([A-Z][a-z\s\.]*?[A-Z][a-z\s\.]*?Missing Since.*?Investigating Agency.*?)/is);
    const caseInfo = caseInfoMatch ? caseInfoMatch[1] : text;
    
    // 重新组合清理后的信息
    return input.replace(/\[images\]([\s\S]*)/i, `[images]${images}[text]\n${caseInfo}`);
}

// 清理JSON字符串中的控制字符
function cleanJsonString(str) {
    // 移除所有控制字符，只保留可打印字符
    return str.replace(/[\x00-\x1F\x7F]/g, '');
}

// 延迟函数，用于实现冷却计时器
const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// 带自动重试和指数退避的API调用函数
async function callApiWithRetry(url, options, maxRetries = 5, initialDelay = 1000) {
    let retries = 0;
    let currentDelay = initialDelay;

    while (retries < maxRetries) {
        try {
            log(`📡 API请求 - 尝试 ${retries + 1}/${maxRetries}: ${url}`);
            const response = await fetch(url, {
                ...options,
                timeout: 60000 // 60秒超时
            });

            if (response.ok) {
                log(`✅ API请求成功 - 尝试 ${retries + 1}/${maxRetries}`);
                return await response.json();
            } else if (response.status === 429) {
                // 429 Too Many Requests - 触发指数退避
                log(`⚠️  API请求过多 (429) - 将在 ${currentDelay / 1000} 秒后重试`);
                await delay(currentDelay);
                retries++;
                currentDelay *= 2; // 指数退避
            } else {
                // 其他错误
                const errorText = await response.text();
                log(`❌ API请求失败 - 状态: ${response.status}, 响应: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
            }
        } catch (error) {
            if (retries >= maxRetries - 1) {
                // 最后一次重试失败
                log(`💥 所有API请求重试失败 - 错误: ${error.message}`);
                throw error;
            }
            
            // 网络错误或其他错误，也触发退避
            log(`⚠️  API请求错误 (${error.message}) - 将在 ${currentDelay / 1000} 秒后重试`);
            await delay(currentDelay);
            retries++;
            currentDelay *= 2;
        }
    }

    throw new Error(`API请求失败，已达到最大重试次数 (${maxRetries})`);
}

// 提取纯HTML代码
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
    
    // 如果没有找到任何HTML标记，返回原始文本
    return text;
}

// 创建三级文件夹结构（州/县/城市）
function createFolderStructure(state, county, city) {
    try {
        // 创建州级文件夹
        const stateFolder = path.join(__dirname, 'cases', state);
        if (!fs.existsSync(stateFolder)) {
            fs.mkdirSync(stateFolder, { recursive: true });
        }
        
        // 创建县级文件夹
        const countyFolder = path.join(stateFolder, county);
        if (!fs.existsSync(countyFolder)) {
            fs.mkdirSync(countyFolder, { recursive: true });
        }
        
        // 创建城市级文件夹
        const cityFolder = path.join(countyFolder, city);
        if (!fs.existsSync(cityFolder)) {
            fs.mkdirSync(cityFolder, { recursive: true });
        }
        
        return cityFolder;
    } catch (error) {
        log(`❌ 创建文件夹结构失败: ${error.message}`);
        return null;
    }
}

// 保存网页文件
function saveWebpageFile(content, folderPath, filename) {
    try {
        const filePath = path.join(folderPath, filename);
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
    } catch (error) {
        log(`❌ 保存网页文件失败: ${error.message}`);
        return null;
    }
}

// 调用Cloudflare AI接口生成网页内容
async function generateWebpageWithAI(input, caseId, locationInfo) {
    log(`🤖 调用Cloudflare AI接口生成网页内容: ${caseId}`);
    
    try {
        // Cloudflare AI API 端点
        const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-3b-instruct`;
        
        // 清理输入信息，只保留案件相关内容
        const cleanedInput = cleanInputInfo(input);
        
        // 构建详细的提示词，只要求AI生成网页内容
        const prompt = `请根据以下失踪人员信息生成网页内容：

## 任务：生成网页内容
生成一个完整的 HTML 网页代码，要求：
1. 生成完整的、可运行的 HTML 文件代码
2. 包含完整的 HTML 结构（html, head, body）
3. 包含响应式 CSS 样式
4. 设计要专业、简洁，适合失踪人员信息展示
5. 包含必要的元数据和 SEO 优化
6. 支持移动端查看
7. 使用中文内容
9. **必须完整包含所有提供的图片和案件信息**
10. **只保留案件信息，绝对不要包含任何采集网站的导航、捐赠、联系信息等无关内容**
11. **必须添加一个AI专业案件分析栏目**，包含以下6个标准模块：
    - 案件画像概览
    - 时空矛盾点分析
    - 潜在风险因素评分
    - 调查突破口建议
    - 类似案件关联
    - 法律与免责声明
12. **在网页顶部突出显示以下四个关键信息**，使用醒目的样式（如加粗、背景色或边框）：
    - 案件ID: ${caseId}
    - 州: ${locationInfo.state}
    - 县: ${locationInfo.county}
    - 城市: ${locationInfo.city}
13. 包含 面包屑导航 首页 》 ${locationInfo.state} 〉${locationInfo.county} 》 ${locationInfo.city}

## 输入信息：
${cleanedInput}

## 输出格式要求：
请按照以下格式返回结果，不要添加任何额外内容：
{
  "html": "<完整的HTML代码>"
}`;

        const data = await callApiWithRetry(
            aiEndpoint,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`
                },
                body: JSON.stringify({
                    prompt: prompt
                })
            }
        );

        if (!data.success) {
            throw new Error(`Cloudflare API错误: ${JSON.stringify(data.errors)}`);
        }
        
        // 提取AI返回的内容
        const aiResponse = data.result.response;
        if (!aiResponse) {
            throw new Error('无效的 API 响应格式');
        }
        
        // 清理控制字符
        const cleanedResponse = cleanJsonString(aiResponse);
        
        // 解析AI返回的JSON内容
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(cleanedResponse);
        } catch (parseError) {
            // 如果解析失败，尝试提取JSON部分
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                // 清理提取出的JSON部分
                const cleanedJson = cleanJsonString(jsonMatch[0]);
                parsedResponse = JSON.parse(cleanedJson);
            } else {
                throw new Error('无法解析AI返回的JSON格式');
            }
        }
        
        // 验证必要字段
        if (!parsedResponse.html) {
            throw new Error('AI返回的内容中缺少html字段');
        }
        
        // 提取HTML内容
        let htmlContent = parsedResponse.html;
        // 清理HTML代码，提取纯HTML部分
        htmlContent = extractHtmlCode(htmlContent);
        
        // 文件名只能是案件ID
        const filename = `${caseId}.html`;
        
        return {
            success: true,
            content: htmlContent,
            filename: filename
        };
    } catch (error) {
        log(`❌ AI接口调用失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 主函数
async function main() {
    try {
        // 从标准输入读取数据
        const input = fs.readFileSync(0, 'utf-8');
        
        // 解析命令行参数获取地理位置信息
        const locationArg = process.argv[2];
        let locationInfo;
        
        if (locationArg) {
            // 从命令行参数获取地理位置信息
            try {
                locationInfo = JSON.parse(locationArg);
            } catch (parseError) {
                log('❌ 无效的地理位置信息格式');
                console.log(JSON.stringify({ success: false, error: 'Invalid location info format' }));
                process.exit(1);
            }
        } else {
            // 如果没有提供地理位置信息，返回错误
            log('❌ 请提供地理位置信息');
            console.log(JSON.stringify({ success: false, error: 'Location info is required' }));
            process.exit(1);
        }
        
        // 验证地理位置信息
        if (!locationInfo.state || !locationInfo.county || !locationInfo.city) {
            log('❌ 地理位置信息不完整');
            console.log(JSON.stringify({ success: false, error: 'Location info is incomplete' }));
            process.exit(1);
        }
        
        // 从输入信息中提取案件ID
        const caseId = extractCaseIdFromInput(input);
        if (!caseId) {
            log('❌ 无法提取案件ID');
            console.log(JSON.stringify({ success: false, error: 'Failed to extract case ID' }));
            process.exit(1);
        }
        
        // 调用AI生成网页
        log('🚀 开始生成网页...');
        const result = await generateWebpageWithAI(input, caseId, locationInfo);
        
        if (!result.success) {
            log(`❌ 生成失败: ${result.error}`);
            console.log(JSON.stringify({ success: false, error: result.error }));
            process.exit(1);
        }
        
        // 使用提供的地理位置信息
        const { state, county, city } = locationInfo;
        
        // 创建三级文件夹结构（州/县/城市）
        log('📁 创建保存目录...');
        const folderPath = createFolderStructure(state, county, city);
        
        // 保存网页文件（文件名只能是案件ID，直接放在城市目录下）
        log('💾 保存网页文件...');
        const filePath = saveWebpageFile(result.content, folderPath, result.filename);
        
        if (filePath) {
            log('🎉 网页生成完成！');
            const outputResult = {
                success: true,
                caseId: caseId,
                location: {
                    state: state,
                    county: county,
                    city: city
                },
                filePath: filePath,
                filename: result.filename
            };
            console.log(JSON.stringify(outputResult));
            process.exit(0);
        } else {
            log('❌ 网页保存失败');
            console.log(JSON.stringify({ 
                success: false, 
                error: 'Failed to save webpage'
            }));
            process.exit(1);
        }
    } catch (error) {
        log(`💥 程序执行出错: ${error.message}`);
        console.log(JSON.stringify({ success: false, error: error.message }));
        process.exit(1);
    }
}

// 执行主函数
main().catch(error => {
    log(`💥 程序执行出错: ${error.message}`);
    console.log(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
});

// 导出generateWebpageWithAI函数
module.exports = {
    generateWebpageWithAI
};