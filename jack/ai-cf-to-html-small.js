const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 1. 环境初始化
const envPath = fs.existsSync(path.resolve(__dirname, '../.env')) ? path.resolve(__dirname, '../.env') : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });
const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID } = process.env;

// const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`;

// @cf/meta/llama-3.3-70b-instruct

const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.3-70b-instruct`;


/**
 * 核心生成函数
 */
async function generatePureHtml(scrapedContent, language = '简体中文') {
    const prompt = `
    你是一名资深的刑事调查专家和网页设计师。请根据提供的原始数据生成一个专业的失踪人员分析网页。
    
    【核心要求】：
    1. 语言：必须全程使用 ${language}。
    2. 样式：包含完整的 CSS，响应式布局。
    3. 布局要求：
       - 包含「醒目信息栏」：位于顶部，使用深色/红色背景，突出显示：案件ID、州、县、城市。
       - 包含面包屑导航：首页 》 州 》 县 》 城市。
    4. **图片处理 (至关重要)**：
       - 必须从输入信息中提取所有失踪人员相关的图片 URL。
       - **必须使用 <img> 标签重点展示这些图片**。
       - 图片样式必须醒目（如带阴影、居中、自适应宽度）。
       - 确保利用公共 CDN 或原始链接加载这些图片。
    5. AI深度分析模块：案件画像概览、时空矛盾点分析、潜在风险因素评分、调查突破口建议、类似案件关联、法律与免责声明。
    6. 禁止：禁止输出任何多余的解释文字，直接从 <!DOCTYPE html> 开始。
    
    【输入数据】：
    ${scrapedContent}
    `;

    try {
        const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'Output ONLY raw HTML code including all images found in data.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 3800 
            })
        });

        const result = await response.json();
        let htmlContent = result.result?.response?.trim();
        htmlContent = htmlContent.replace(/^```html\n?|```$/g, '');
        return { success: true, html: htmlContent };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * 主程序
 */
async function main() {
    const inputPathArg = process.argv[2];
    const outputPathArg = process.argv[3];
    const languageArg = process.argv[4] || '简体中文';

    if (!inputPathArg) {
        console.error('❌ 用法: node jack/ai-cf-to-html.js <输入txt> <输出html路径> [语言]');
        process.exit(1);
    }

    const inputPath = path.resolve(process.cwd(), inputPathArg);
    if (!fs.existsSync(inputPath)) {
        console.error(`❌ 找不到输入文件: ${inputPath}`);
        process.exit(1);
    }
    const fileContent = fs.readFileSync(inputPath, 'utf8');

    // 确定输出路径
    let outPath = outputPathArg ? path.resolve(process.cwd(), outputPathArg) : path.resolve(process.cwd(), `${path.basename(inputPath, '.txt')}.html`);

    // 递归创建目录
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    console.log(`🚀 正在生成网页...`);
    console.log(`📥 目标语言: ${languageArg}`);
    console.log(`🖼️  重点提取并展示图片资源...`);

    const result = await generatePureHtml(fileContent, languageArg);

    if (result.success && result.html.includes('<!DOCTYPE html>')) {
        fs.writeFileSync(outPath, result.html);
        console.log('\n-----------------------------------');
        console.log(`✅ 网页生成成功！`);
        console.log(`📂 保存路径: ${outPath}`);
        console.log('-----------------------------------');
    } else {
        console.error('❌ 生成失败，请检查输入数据或 API 额度');
    }
}

if (require.main === module) {
    main();
}

// 在 jack/ai-cf-to-html.js 末尾确保有这一行
module.exports = { generatePureHtml };