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

// 建议：生成网页内容 Llama 3.3 70B 或 Llama 3.1 8B 效果更好
// 这里沿用你的 endpoint，但建议生产环境考虑 8B 模型以获得更稳定的 HTML 输出
const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`;

/**
 * 核心生成函数：AI 生成 HTML 内容
 */
async function generateCaseHtml(scrapedContent, caseId) {
    // 假设从 caseId 或内容中简单提取位置，如果没有则让 AI 推断
    const prompt = `
Task: Generate a professional, high-quality Missing Person Case Webpage in Simplified Chinese (简体中文).

Input Data: "${scrapedContent}"

Webpage Requirements:
1. Complete Code: Output a full, standalone HTML5 file including <!DOCTYPE html>, <html>, <head>, and <body>.
2. Styling: Modern, responsive CSS (contained in <style>). Use a somber but professional color palette (e.g., Deep Blues, Reds for alerts).
3. Header Section: Highlight these 4 key fields at the very top with bold borders/background:
   - 案件ID: ${caseId}
   - 州, 县, 城市: (Deduce these from the input data accurately)
4. Breadcrumbs: Display Navigation: 首页 > [State] > [County] > [City].
5. Content Focus: Include ALL personal physical descriptions and case details from the input. 
6. Strict Exclusion: REMOVE any navigation, donate buttons, or contact info from the original source website. Only keep the case data.
7. AI Expert Analysis Section: Add a section titled "AI 专家案件深度分析" with these 6 modules:
   - 案件画像概览: (Expert summary of the person's profile)
   - 时空矛盾点分析: (Analyze timeline/location inconsistencies)
   - 潜在风险因素评分: (0-100 score with reasoning)
   - 调查突破口建议: (Specific actionable advice for investigators)
   - 类似案件关联: (General patterns similar to this case)
   - 法律与免责声明: (Standard legal disclaimer for AI generated content)

Output Format:
Your response must be a valid JSON object ONLY, with no extra text:
{
  "html": "<!DOCTYPE html>...</html>"
}
`;

    try {
        const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are a professional web developer and criminal investigator. You only output valid JSON.' }, 
                    { role: 'user', content: prompt }
                ],
                max_tokens: 3500 // 增加 token 以容纳完整的网页代码
            })
        });

        const result = await response.json();
        const aiText = result.result?.response?.trim();
        
        // 尝试解析 JSON
        let finalJson;
        try {
            // 兼容 AI 可能会带 Markdown 代码块的情况
            const cleanJson = aiText.replace(/```json|```/g, '');
            finalJson = JSON.parse(cleanJson);
        } catch (e) {
            console.error('❌ JSON 解析失败，AI 返回可能不是纯净格式');
            return { success: false, raw: aiText };
        }

        return {
            success: true,
            case_id: caseId,
            html: finalJson.html
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 命令行执行测试
 */
async function main() {
    const inputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : null;
    
    if (!inputPath) {
        console.log("用法: node generate-case-webpage.js <测试txt文件路径>");
        return;
    }

    const fileContent = fs.readFileSync(inputPath, 'utf8');
    const caseId = path.basename(inputPath, '.txt');

    console.log(`🎨 正在为案件 ${caseId} 生成 AI 网页...`);

    const result = await generateCaseHtml(fileContent, caseId);

    if (result.success) {
        const outputPath = path.resolve(__dirname, `output_${caseId}.html`);
        fs.writeFileSync(outputPath, result.html);
        console.log(`\n✅ 网页生成成功！`);
        console.log(`📂 已保存至: ${outputPath}`);
    } else {
        console.error('\n❌ 生成失败:', result.error || '内容解析错误');
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateCaseHtml };