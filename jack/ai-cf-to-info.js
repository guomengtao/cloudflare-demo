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

// 使用 Llama 3.2 3B 小模型
const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-3b-instruct`;

/**
 * 核心提取函数
 */
async function extractCaseDetailsPure(scrapedContent, caseId) {
    // 明确标签含义：msd (Date), msa (Age)
    const prompt = `Task: Extract person details into ONE SINGLE LINE using Tag:Value pairs separated by PIPE (|).
Input: "${scrapedContent}"

Tags to use:
fn: (full_name) | dob: (date_of_birth) | msd: (missing_since_date) | msa: (age_at_missing) | city: | county: | state: | country: | loc: (location_details) | sex: | race: | h: (height) | w: (weight) | eye: | hair: | marks: | v: (vehicle) | class: | agency:

Strict Rules:
1. ONLY return the single line of data. No conversational text.
2. For "county": DEDUCE it from City/State.
3. For "msa": This is the age when they went missing.
4. If a value is missing, leave it empty like "eye: |".
5. Use original units (e.g., 5'6", 110 lbs).

Example:
fn: John Doe | dob: 01/01/1980 | msd: 05/20/2023 | msa: 43 | city: Minneapolis | county: Hennepin County | h: 5'10" |`;

    try {
        const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are a precise data extractor that outputs only structured pipe-separated text.' }, 
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1000
            })
        });

        const result = await response.json();
        const aiText = result.result?.response?.trim().replace(/\n/g, ' ');
        console.log('📥 AI 原始响应:', aiText);

        // 提取函数：匹配 tag: 直到下一个 |
        const getVal = (tag) => {
            const reg = new RegExp(`${tag}:\\s*([^|]*)`, 'i');
            const match = aiText.match(reg);
            return match ? match[1].trim() : '';
        };

        return {
            success: true,
            case_id: caseId,
            data: {
                full_name: getVal('fn'),
                date_of_birth: getVal('dob'),
                missing_since: getVal('msd'),   // 对应 msd
                age_at_missing: getVal('msa'),  // 对应 msa
                missing_city: getVal('city'),
                missing_county: getVal('county'),
                missing_state: getVal('state'),
                missing_country: getVal('country') || 'United States',
                location_details: getVal('loc'),
                sex: getVal('sex'),
                race: getVal('race'),
                height: getVal('h'),
                weight: getVal('w'),
                eye_color: getVal('eye'),
                hair_color: getVal('hair'),
                distinguishing_marks: getVal('marks'),
                vehicle_info: getVal('v'),
                classification: getVal('class'),
                investigating_agency: getVal('agency')
            }
        };
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

 
// 在 ai-cf-to-info.js 文件末尾
module.exports = { 
    extractCaseDetailsPure, // 确保导出这个核心函数
    generateWebpageWithAI 
};