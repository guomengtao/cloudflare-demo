const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/**
 * 1. 环境配置与初始化
 */
console.log('正在加载环境变量...');
const envPath = fs.existsSync(path.resolve(__dirname, '../.env')) 
    ? path.resolve(__dirname, '../.env') 
    : path.resolve(__dirname, '.env');

dotenv.config({ path: envPath });

const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID) {
    console.error('❌ 缺少 Cloudflare 环境变量');
    if (require.main === module) process.exit(1);
}

// 切换为 3B 小模型：更轻量、速度更快
const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-3b-instruct`;

/**
 * 2. 工具函数
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function safeParseJSON(str) {
    if (!str) return null;
    try {
        let cleanStr = str.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = cleanStr.indexOf('{');
        const lastBrace = cleanStr.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) return null;
        const jsonString = cleanStr.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonString.replace(/[\u200B-\u200D\uFEFF]/g, ''));
    } catch (error) {
        return null;
    }
}

async function callApiWithRetry(prompt, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
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
                            content: '你是一个地理与案件专家。你必须只返回 JSON，禁止任何解释。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 1000
                })
            });
            const result = await response.json();
            return result.result?.response;
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await delay(attempt * 1000);
        }
    }
}

/**
 * 3. 核心提取逻辑
 */
async function extractCaseDetailsWithAI(scrapedContent, caseId) {
    console.log(`🔍 正在分析案件: ${caseId}`);
    
    // 强化 Prompt：禁止 Unknown，强制推理 County
    const prompt = `Task: Extract case info into JSON.
Input Text: "${scrapedContent}"

Required JSON Fields:
1. "case_id": Use exactly "${caseId}".
2. "missing_city": City name.
3. "missing_state": Full state name.
4. "missing_county": You MUST identify the County/Parish based on the city and state. 

CRITICAL RULES:
- NEVER use "Unknown", "N/A", or "None" for missing_county. 
- Use your internal knowledge to find the correct County for the given City and State.
- If multiple counties exist for a city, provide the primary one.
- Return ONLY raw JSON. No markdown. No conversational text.`;

    try {
        const aiResponse = await callApiWithRetry(prompt);
        const caseDetails = safeParseJSON(aiResponse);
        
        if (!caseDetails) return { success: false, error: "JSON 解析失败" };

        return { success: true, case_details: caseDetails };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function generateWebpageWithAI(inputPath) {
    try {
        if (!fs.existsSync(inputPath)) throw new Error(`文件不存在`);
        const fileContent = fs.readFileSync(inputPath, 'utf8');
        const fileName = path.basename(inputPath, '.txt');
        const caseId = fileName.replace('temp_case_', '');
        
        return await extractCaseDetailsWithAI(fileContent, caseId);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 4. 运行入口
 */
async function main() {
    const DEFAULT_INPUT = path.resolve(__dirname, 'test_case.txt'); 
    const inputPath = process.argv[2] 
                      ? path.resolve(process.cwd(), process.argv[2]) 
                      : DEFAULT_INPUT;

    console.log(`🚀 启动模型: Llama-3.2-3B | 目标: ${path.basename(inputPath)}`);

    const result = await generateWebpageWithAI(inputPath);
    console.log('\n--- 结构化结果 ---');
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main();
}

module.exports = { generateWebpageWithAI };