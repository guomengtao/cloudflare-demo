const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// 配置
const DATABASE_ID = "cloudflare-demo-db";
const BATCH_LIMIT = 60; // 提升单次采集数量

// 检查后端API是否可用
async function checkBackendAPI() {
    try {
        const response = await axios.get('http://localhost:8787/api/missing-persons/health', { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// 网页内容解析（含图片提取）
function parseCaseContentDirect(html, caseUrl, caseId) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : `${caseId} 失踪案件`;
    
    // --- 图片提取逻辑 ---
    const imageUrls = new Set();
    const imgSrcRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgSrcRegex.exec(html)) !== null) {
        let imgUrl = match[1].trim();
        // 过滤干扰项
        if (/paypal|patreon|logo|spinner|theme|button|icon|pixel/i.test(imgUrl)) continue;
        
        // 处理相对路径
        try {
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            else if (imgUrl.startsWith('/')) imgUrl = new URL(caseUrl).origin + imgUrl;
            else if (!imgUrl.startsWith('http')) imgUrl = new URL(imgUrl, caseUrl).href;
            
            if (/\.(jpg|jpeg|png|webp)$/i.test(imgUrl)) imageUrls.add(imgUrl);
        } catch (e) {}
    }
    
    // --- 文本清洗 ---
    const textContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return `案件URL: ${caseUrl}\n案件ID: ${caseId}\n案件标题: ${title}\n抓取时间: ${new Date().toISOString()}\n\n[images]\n${Array.from(imageUrls).join('\n') || '未找到图片'}\n\n[text]\n${textContent.substring(0, 40000)}`;
}

// 直接 HTTP 抓取
async function scrapeWithDirectHTTP(caseUrl, caseId) {
    try {
        console.log(`🌐 正在抓取: ${caseId}...`);
        const response = await axios.get(caseUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const content = parseCaseContentDirect(response.data, caseUrl, caseId);
        return { success: true, content, caseId };
    } catch (error) {
        console.error(`❌ ${caseId} 抓取失败:`, error.message);
        return { success: false, caseId };
    }
}

// 综合抓取入口
async function scrapeWebsiteContent(caseUrl, caseId) {
    const apiAvailable = await checkBackendAPI();
    if (apiAvailable) {
        // ... API 逻辑保持不变 ...
    }
    return await scrapeWithDirectHTTP(caseUrl, caseId);
}

// 批量更新到 D1
async function updateBatchScrapedContent(caseUpdates) {
    if (!caseUpdates.length) return;
    console.log(`📊 准备写入数据库: ${caseUpdates.length} 条...`);
    
    let sqlContent = ''; 
    caseUpdates.forEach(update => {
        const escapedContent = update.scrapedContent.replace(/'/g, "''");
        sqlContent += `UPDATE missing_persons_cases SET scraped_content = '${escapedContent}', updated_at = CURRENT_TIMESTAMP WHERE case_id = '${update.caseId}';\n`;
    });

    const tempSqlPath = path.join(__dirname, `temp_batch.sql`);
    fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
    
    const command = `./node_modules/.bin/wrangler d1 execute ${DATABASE_ID} --remote --file="${tempSqlPath}"`;
    
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 30 * 1024 * 1024 }, (error, stdout) => {
            if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
            if (error) reject(error);
            else {
                console.log(`✅ 写入成功！${stdout.includes("Rows affected") ? stdout.substring(stdout.indexOf("Rows affected")) : ""}`);
                resolve(true);
            }
        });
    });
}

// 获取待抓取列表
async function getCasesToScrape() {
    const command = `./node_modules/.bin/wrangler d1 execute ${DATABASE_ID} --remote --json --command="SELECT case_url, case_id FROM missing_persons_cases WHERE (scraped_content IS NULL OR length(scraped_content) = 0) ORDER BY id LIMIT ${BATCH_LIMIT};"`;
    return new Promise((resolve) => {
        exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
            if (error) resolve([]);
            else {
                try {
                    const parsed = JSON.parse(stdout);
                    resolve(parsed[0]?.results || []);
                } catch (e) { resolve([]); }
            }
        });
    });
}

// 主循环
async function main() {
    console.log(`🚀 启动冲刺模式 (单次批处理: ${BATCH_LIMIT})`);
    const cases = await getCasesToScrape();
    if (!cases.length) return console.log('✅ 无待处理任务');

    let accumulated = [];
    for (let i = 0; i < cases.length; i++) {
        const res = await scrapeWebsiteContent(cases[i].case_url, cases[i].case_id);
        if (res.success) accumulated.push({ caseId: res.caseId, scrapedContent: res.content });
        
        if (i < cases.length - 1) {
            const delay = 1000 + Math.random() * 2000; // 1-3秒随机延迟
            await new Promise(r => setTimeout(r, delay));
        }
    }
    
    await updateBatchScrapedContent(accumulated);
    console.log('🎉 任务圆满结束');
}

main();