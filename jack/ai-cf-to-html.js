 const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 1. 环境初始化
const envPath = fs.existsSync(path.resolve(__dirname, '../.env')) ? path.resolve(__dirname, '../.env') : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });
const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID } = process.env;

// 建议使用 3.1-70b，因为 3.3-70b 路由有时不稳定
const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-70b-instruct`;

/**
 * 核心生成函数 - 极致视觉优化版
 */
async function generatePureHtml(scrapedContent, language = '简体中文') {
     const prompt = `
    你是一名顶级的前端设计师。请为美国失踪人员生成一个【高度专业、充满人文关怀且具有警示感】的 HTML 网页。
    
    【技术规范】：
    1. 必须在 <head> 引入最新版 Tailwind 3.0 CDN：<script src="https://cdn.tailwindcss.com"></script>。
    2. 必须引入字体：<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">。
    
    3. 有多个位置 位置连接到 首页 “。/”  
    4. 突出的面包碎屑 导航  首页 “。/” 》 全部列表 “。/list” 〉 州 》县 〉城市
    【UI 设计蓝图】：
    1. **配色细节**：
       - 背景: bg-[#f8fafc] (极浅蓝灰)
       - 重点栏: bg-[#0f172a] (深蓝黑)
       - 强调色: text-red-600 和 text-blue-700
    2. **两栏布局 (Grid)**：
       - PC 端: 左侧列 (grid-cols-12 中的 span-4) 放置照片。照片下方放一个【特征速查卡片】。
       - 右侧列 (span-8) 放置主标题、详细时间轴、AI 分析报告。
    3. **视觉特效**：
       - 照片: 必须加 rounded-[2rem] (超大圆角) 和 shadow-2xl。
       - 卡片: 使用 bg-white/80 backdrop-blur-sm 效果，加上 border border-slate-200。
       - 间距: 使用 py-12 px-8 增加高级感。
    4. **AI 分析可视化**：
       - 风险等级: 不要只画条，要在条的上方写上“HIGH RISK”等字样，并配合闪烁动画效果 (animate-pulse)。
    
    【内容要求】：
    - 禁止使用 placeholder (如 Lorem ipsum)，必须提取输入数据中的真实细节填入。
    - 图片 URL 必须经过 https://wsrv.nl/?url= 处理。
    
    【原始数据】：
    ${scrapedContent}
    `;

    try {
        const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are an expert UI developer. Output ONLY a single, complete, data-filled HTML file using Tailwind CSS. NO explanation. NO markdown code blocks.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 4800 
            })
        });

        const result = await response.json();
        if (!result.success) return { success: false, error: 'API Error' };

        let html = result.result?.response?.trim() || "";
        
        // 彻底清理：只保留 <!DOCTYPE 开始到 </html> 结束的内容
        const htmlMatch = html.match(/<!DOCTYPE[\s\S]*<\/html>/i);
        if (htmlMatch) {
            html = htmlMatch[0];
        } else {
            // 如果没找到标签，清理掉可能存在的 markdown 标记
            html = html.replace(/^```html\n?|```$/g, '');
        }

        return { success: true, html: html };
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

    let outPath = outputPathArg ? path.resolve(process.cwd(), outputPathArg) : path.resolve(process.cwd(), `${path.basename(inputPath, '.txt')}.html`);

    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    console.log(`🚀 正在生成网页...`);
    const result = await generatePureHtml(fileContent, languageArg);

    if (result.success) {
        fs.writeFileSync(outPath, result.html);
        console.log(`\n✅ 网页生成成功！\n📂 保存路径: ${outPath}`);
    } else {
        console.error(`❌ 生成失败: ${result.error}`);
    }
}

// 启动逻辑
if (require.main === module) {
    main();
}

module.exports = { generatePureHtml };