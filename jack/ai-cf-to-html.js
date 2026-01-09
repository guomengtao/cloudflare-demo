 const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 1. 环境初始化
const envPath = fs.existsSync(path.resolve(__dirname, '../.env')) ? path.resolve(__dirname, '../.env') : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });
const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID } = process.env;

// 建议使用 3.1-70b，因为 3.3-70b 路由有时不稳定
// 默认模型设置  @cf/qwen/qwen2.5-coder-32b-instruct
const DEFAULT_AI_MODEL = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';

/**
 * 核心生成函数 - 极致视觉优化版
 */
async function generatePureHtml(scrapedContent, language = '简体中文', aiModel = DEFAULT_AI_MODEL) {
    const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${aiModel}`;
     const prompt = `
    你是一名顶级的前端设计师。请为美国失踪人员生成一个【高度专业、充满人文关怀且具有警示感】的 全中文的，面向华人的HTML 网页。
 
    技术要求 引入 <script src="https://cdn.tailwindcss.com"></script> 作为开发的主力，围绕tailwind 充分展示tailweind css的各种优势
    这份文字布局说明按照从上到下、从左到右的逻辑顺序排列，确保信息的优先级和关联性：

页面顶部为 核心展示区

左侧位置 放置 照片墙模块。最上方展示当前最接近失踪者样貌的大图。下方排列多张缩略图，包括不同时期的生活照、证件照以及身体局部特征照。点击缩略图可在大图区切换显示。

右侧位置 放置 基本信息模块。用大字号突出显示姓名和当前年龄。下方以列表形式罗列性别、籍贯、身高、体重、血型等数据。失踪日期和失踪地点需用加粗或色彩标注，方便快速锁定搜索范围。

页面中部为 深度内容区

左侧位置 放置 案件详情模块。按时间顺序详细描述失踪过程。包括失踪时的具体穿着打扮、携带物品、语言口音、行走姿态以及是否有特殊疾病。这部分采用清晰的段落分层，确保阅读者能迅速抓取关键线索。

右侧位置 放置 AI分析报告模块。这里展示技术处理后的结论。主要包括通过人脸识别模拟出的当前样貌预测图、基于地理位置数据生成的行动轨迹预测分析，以及在现有数据库中搜索到的相似度匹配列表。通过可视化的小图标或进度条展示匹配的可信度。

页面底部为 辅助与互动区

横向通栏 放置 动态线索与操作模块。左侧显示案件调查的最新进度时间轴。右侧设置醒目的线索举报按钮和一键生成寻人海报按钮。最下方保留负责该案件的民警联系方式和家属紧急联系电话。

你想让我针对其中某个模块，比如AI分析报告，细化一下具体的文案内容吗？
    - 有多个位置 位置连接到 首页 “。/”  
    - 突出的面包碎屑 导航  首页 “。/” 》 全部列表 “。/list” 〉 州名 》县名 》城市名
     
      失踪人照片全部显示出来，默认尺寸尽量小一点，都是头像图片。 多张图片要合理布局
     **AI 分析报告**： 出一份专业的报告：
     
    【内容要求】：
    - 必须提取输入数据中的真实细节填入。 把身高的单位转换为cm里面，体重的单位转为kg千克 ，鞋码等尺寸类型的数据，转换为华人比较容易立即的。
    - 图片 URL 必须经过 类似这样的 https://wsrv.nl/?url= 处理。

    ai分析报告栏目 为辅助功能，在网页最下方展示，上面的案件信息是重点。

1. 案件画像概览 (Case Persona)
这一部分是对失踪人员的数字化建模。
* 身份标签：提取姓名、年龄、失踪时长。
* 生理显著特征：重点提取如左臂玫瑰纹身、戴眼镜、行走步态等具有高辨识度的信息。
* 状态评估：AI 根据分类（如 Endangered Missing）评估失踪时的危险等级。

2. 时空矛盾点分析 (Spatiotemporal Analysis)
这是报告的核心逻辑点，分析失踪发生的背景。
* 消失环境：分析失踪地（如繁华街区 vs 荒野）与目击证言缺失之间的矛盾。
* 生活稳定性偏离：分析失踪者的社交、财务、心理状态是否支持其主动消失。
* 关键窗口期：指出从最后一次露面到发现失踪之间的黄金搜索时间段。

3. 潜在风险因素评分 (Risk Factors)
基于案情描述，对可能的原因进行概率排序（非定论，仅供参考）。
* 环境风险：如靠近水域、极端天气、施工地带。
* 医疗风险：如患有阿尔兹海默症、抑郁症或需要定期服药的疾病。
* 外部侵害：分析是否有第三方卷入的迹象。

4. 调查突破口建议 (Investigation Leads)
为民间寻找者或家属提供具体的行动方向。
* DNA/法医建议：如建议核对 NamUs 数据库中带有特定纹身的无名尸体。
* 数字足迹：建议检查特定年份的信用卡记录、社交媒体或寻呼机记录（针对旧案）。
* 物理搜索建议：针对特定地理特征（如临近河流）建议加强声呐扫描等。

5. 类似案件关联 (Pattern Recognition)
利用 AI 的大数据能力，搜索库中是否存在模式相似的案件。
* 地理关联：同一地区是否存在失踪手法相似的案例。
* 人口统计学关联：是否存在针对特定职业、年龄段人群的规律性事件。

6. 法律与免责声明 (Disclaimer)
这是加入网页最关键的部分。
* 声明：明确指出此报告由 AI 基于公开数据生成，仅供参考，不代表官方结论，也不应替代警方的专业调查。
* 引导：提供官方报案电话或调查机构的联系方式。 
    
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
    const aiModelArg = process.argv[5] || DEFAULT_AI_MODEL;

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
    const result = await generatePureHtml(fileContent, languageArg, aiModelArg);

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

module.exports = { generatePureHtml, DEFAULT_AI_MODEL };