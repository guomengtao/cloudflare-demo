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

// Cloudflare AI API 配置
const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
// const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-3b-instruct`;

// 清理JSON字符串
function cleanJsonString(str) {
    // 移除多余的空格和换行
    let cleaned = str.trim();
    
    // 尝试提取JSON部分（如果AI返回了额外文本）
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }
    
    // 修复常见的JSON格式问题
    cleaned = cleaned
        .replace(/,\s*}/g, '}') // 移除尾随逗号
        .replace(/,\s*]/g, ']') // 移除数组尾随逗号
        .replace(/'/g, '"')     // 单引号转双引号
        .replace(/(\w+):/g, '"$1":'); // 为键添加引号
    
    return cleaned;
}

// 安全的JSON解析函数
 function safeParseJSON(str) {
    if (!str) return null;
    
    try {
        // 1. 预处理：移除所有可能干扰的 Unicode 零宽字符
        let cleanStr = str.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        
        // 2. 定位：找到第一个 '{' 和最后一个 '}'
        const firstBrace = cleanStr.indexOf('{');
        const lastBrace = cleanStr.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error("未能找到 JSON 结构（缺乏 {}）");
        }
        
        // 3. 截取：只保留 {} 及其内部的内容
        // 这样即使 AI 在后面加了“解析结束”或者换行符，也会被无视
        const jsonString = cleanStr.substring(firstBrace, lastBrace + 1);
        
        // 4. 解析
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('❌ 解析逻辑触发异常:', error.message);
        // 如果解析失败，尝试最后一种方案：修复内部换行
        try {
            const recovery = str.substring(str.indexOf('{'), str.lastIndexOf('}') + 1)
                                .replace(/\n/g, "\\n")
                                .replace(/\r/g, "");
            return JSON.parse(recovery);
        } catch (e) {
            return null;
        }
    }
}

// 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 带重试机制的API调用
async function callApiWithRetry(prompt, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔧 第 ${attempt} 次尝试调用AI...`);
            
            const response = await fetch(aiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个专业的失踪人口案件信息提取专家。请从给定的网页内容中提取结构化信息，并以JSON格式返回。确保所有字段都正确填充，如果信息缺失请使用"未知"或空字符串。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 4000,
                    stream: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.result || !result.result.response) {
                throw new Error('AI返回结果格式不正确');
            }
            
            return result.result.response;
            
        } catch (error) {
            console.log(`❌ 第 ${attempt} 次尝试失败: ${error.message}`);
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // 等待一段时间后重试
            const waitTime = attempt * 2000; // 指数退避
            console.log(`⏱️  等待 ${waitTime/1000} 秒后重试...`);
            await delay(waitTime);
        }
    }
}

// 提取地理位置信息
async function extractLocationWithAI(locationText, caseId) {
    console.log(`🗺️  正在提取案件 ${caseId} 的地理位置信息`);
    
    const prompt = `请从以下文本中提取地理位置信息，返回JSON格式：

文本："${locationText}"

请提取以下信息：
- 城市 (city)
- 州/省 (state)
- 国家 (country)
- 详细位置描述 (details)

如果信息缺失，请使用"未知"。`;

    try {
        const aiResponse = await callApiWithRetry(prompt);
        const locationInfo = safeParseJSON(aiResponse);
        
        return {
            success: true,
            data: locationInfo
        };
    } catch (error) {
        console.log(`❌ 提取地理位置信息失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 提取案件详细信息
async function extractCaseDetailsWithAI(scrapedContent, caseId) {
    console.log(`🔍 正在提取案件 ${caseId} 的详细信息`);
    
    const prompt = `请从以下失踪人口案件网页内容中提取地理位置信息：

网页内容："${scrapedContent}"

请提取以下信息并以JSON格式返回：
- missing_county: 县/郡
- missing_state: 州/省  
- missing_city: 城市
- caseid: 案件ID（从文件名提取：${caseId}）

重要规则：
JSON 内部的所有双引号必须使用反斜杠转义（如 \" ），或者将身高中的双引号替换为单词 inches 。
更佳做法：所有的测量值（身高、体重）只保留数字和基本单引号，严禁在值内部使用双引号。例如：将 5'5" 改写为 5'5 inches 或 5 feet 5 inches 。

死命令：
禁止换行：所有字段的值必须在一行内完成，严禁在字符串值内部使用回车键。如果内容太长，请直接连着写。
禁止未转义引号：严禁在字段值内使用双引号。如果是身高，请使用 inches 代替 " ；如果是描述，请使用单引号 ' 。
压缩格式：请返回紧凑的一行 JSON 格式，不要为了美观进行缩进。

请确保：
1. 所有字段都使用英文键名
2. 如果信息缺失，请使用"未知"或空字符串
3. 返回纯JSON格式，不要包含额外文本
4. 确保JSON格式正确，可以正常解析`;

    try {
        console.log('📤 发送请求到AI服务...');
        const aiResponse = await callApiWithRetry(prompt);
        
        console.log('📥 AI响应内容:');
        console.log(aiResponse);
        
        // 尝试解析AI返回的JSON
        const caseDetails = safeParseJSON(aiResponse);
        
        // 验证必要字段
        const requiredFields = ['missing_county', 'missing_state', 'missing_city', 'caseid'];
        const missingFields = requiredFields.filter(field => !caseDetails[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`缺少必要字段: ${missingFields.join(', ')}`);
        }
        
        console.log('✅ 案件信息提取成功');
        return {
            success: true,
            case_details: caseDetails
        };
        
    } catch (error) {
        console.log(`❌ 提取案件信息失败: ${error.message}`);
        
        // 记录详细的错误信息
        console.log('📄 错误详情:');
        console.log(error.stack);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// 生成网页内容（主函数）
async function generateWebpageWithAI(inputPath) {
    try {
        console.log('🚀 开始处理案件信息...');
        
        // 读取输入文件
        if (!fs.existsSync(inputPath)) {
            throw new Error(`输入文件不存在: ${inputPath}`);
        }
        
        const fileContent = fs.readFileSync(inputPath, 'utf8');
        console.log(`📄 读取文件内容，长度: ${fileContent.length} 字符`);
        
        // 从文件路径提取案件ID
        const fileName = path.basename(inputPath, '.txt');
        const caseId = fileName.replace('temp_case_', '');
        
        console.log(`🔍 处理案件ID: ${caseId}`);
        
        // 提取案件详细信息
        const result = await extractCaseDetailsWithAI(fileContent, caseId);
        
        if (!result.success) {
            throw new Error(`AI提取失败: ${result.error}`);
        }
        
        // 返回结果
        return {
            success: true,
            case_details: result.case_details
        };
        
    } catch (error) {
        console.log(`❌ 处理失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 主函数入口
async function main() {
    try {
        // 检查命令行参数
        if (process.argv.length < 3) {
            console.log('❌ 用法: node ai-cf-to-info.js <input_file>');
            process.exit(1);
        }
        
        const inputPath = process.argv[2];
        
        // 处理案件
        const result = await generateWebpageWithAI(inputPath);
        
        // 输出结果
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.log(`❌ 程序执行失败: ${error.message}`);
        process.exit(1);
    }
}

// 如果是直接运行此文件，则执行主函数
if (require.main === module) {
    main();
}

module.exports = {
    generateWebpageWithAI,
    extractCaseDetailsWithAI,
    extractLocationWithAI
};