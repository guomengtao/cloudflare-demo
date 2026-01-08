const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// 配置：直接写死 ID，绕过所有 wrangler.toml 别名问题
// const DATABASE_ID = "1c5802dd-3bd6-4804-9209-8bc4c26cc40b";
const DATABASE_ID = "cloudflare-demo-db";
// 检查后端API是否可用
async function checkBackendAPI() {
    try {
        const response = await axios.get('http://localhost:8787/api/missing-persons/health', {
            timeout: 5000
        });
        return response.status === 200;
    } catch (error) {
        console.log('❌ 后端API不可用，将使用直接HTTP抓取');
        return false;
    }
}

// 真实的网页抓取函数（使用后端API）
async function scrapeWebsiteContent(caseUrl, caseId) {
    try {
        console.log('🔍 检查后端API可用性...');
        const apiAvailable = await checkBackendAPI();
        
        if (apiAvailable) {
            console.log('✅ 后端API可用，使用API抓取...');
            const apiUrl = 'http://localhost:3000/api/scrape';
            const response = await axios.post(apiUrl, {
                url: caseUrl,
                caseId: caseId
            }, {
                timeout: 45000
            });
            
            const result = response.data;
            if (result.success) {
                console.log(`✅ 后端API抓取成功，字符数: ${result.characterCount}`);
                let finalContent = result.content;
                if (!result.content.includes('[images]')) {
                    console.log('🔄 后端API未返回图片URL，尝试补充图片信息...');
                    const directResult = await scrapeWithDirectHTTP(caseUrl, caseId);
                    if (directResult.success) finalContent = directResult.content;
                }
                return { success: true, content: finalContent, characterCount: finalContent.length, caseId, caseTitle: result.caseTitle || `${caseId} 失踪案件` };
            } else {
                throw new Error(result.error || 'API返回失败状态');
            }
        } else {
            throw new Error('后端API不可用');
        }
    } catch (error) {
        console.error('❌ 后端API抓取失败:', error.message);
        console.log('🔄 尝试使用直接HTTP抓取作为备选方案...');
        return await scrapeWithDirectHTTP(caseUrl, caseId);
    }
}

async function scrapeWithDirectHTTP(caseUrl, caseId) {
    try {
        console.log('🌐 使用axios进行直接HTTP抓取...');
        const response = await axios.get(caseUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            }
        });
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
        const html = response.data;
        const scrapedContent = parseCaseContentDirect(html, caseUrl, caseId);
        const caseTitle = extractCaseTitleDirect(html, caseId);
        console.log(`✅ 直接HTTP抓取成功，字符数: ${scrapedContent.length}`);
        return { success: true, content: scrapedContent, characterCount: scrapedContent.length, caseId, caseTitle };
    } catch (error) {
        console.error('❌ 直接HTTP抓取也失败了:', error.message);
        return { success: false, error: error.message, content: `Error: ${error.message}`, characterCount: 0, caseId, caseTitle: `${caseId} 失踪案件` };
    }
}

function parseCaseContentDirect(html, caseUrl, caseId) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : `${caseId} 失踪案件`;
    const imageUrls = extractAllImageUrls(html, caseUrl);
    const textContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `案件URL: ${caseUrl}\n案件ID: ${caseId}\n案件标题: ${title}\n抓取时间: ${new Date().toISOString()}\n\n[images]\n${imageUrls.join('\n') || '未找到图片'}\n\n[text]\n${textContent.substring(0, 50000)}`;
}

function extractAllImageUrls(html, baseUrl) {
    const imageUrls = new Set();
    const imgSrcRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgSrcRegex.exec(html)) !== null) {
        const url = normalizeImageUrl(match[1], baseUrl);
        if (url && isCaseImage(url)) imageUrls.add(url);
    }
    return Array.from(imageUrls);
}

function normalizeImageUrl(url, baseUrl) {
    if (!url) return null;
    try {
        url = url.trim().replace(/['"]/g, '');
        if (url.startsWith('http')) return url;
        const base = new URL(baseUrl);
        if (url.startsWith('//')) return base.protocol + url;
        if (url.startsWith('/')) return base.origin + url;
        return new URL(url, base.origin + base.pathname).href;
    } catch (e) { return null; }
}

function isCaseImage(url) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) && !/blank|spacer|pixel/i.test(url);
}

function extractCaseTitleDirect(html, caseId) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : `${caseId} 失踪案件`;
}

// -------------------------------------------------------------------------
// 🚨 核心修改区域：增加了 stderr 捕获和详细日志
// -------------------------------------------------------------------------

// 批量更新数据库
 

async function updateBatchScrapedContent(caseUpdates) {
     return new Promise((resolve, reject) => {
        try {
            if (!caseUpdates || caseUpdates.length === 0) return resolve(null);
            console.log(`📊 准备批量更新 ${caseUpdates.length} 个案件...`);
            
            let sqlContent = '';
            caseUpdates.forEach(update => {
                const escapedContent = update.scrapedContent.replace(/'/g, "''");
                sqlContent += `UPDATE missing_persons_cases SET scraped_content = '${escapedContent}', updated_at = CURRENT_TIMESTAMP WHERE case_id = '${update.caseId}';\n`;
            });

            const tempSqlPath = path.join(__dirname, `temp_batch_${Date.now()}.sql`);
            fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
            
            const wranglerPath = './node_modules/.bin/wrangler';
            const command = `${wranglerPath} d1 execute ${DATABASE_ID} --remote --file="${tempSqlPath}"`;
            
            exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
                
                if (error) {
                    console.error('❌ 批量更新执行出错');
                    console.error('👇👇👇 [STDOUT] 👇👇👇');
                    console.error(stdout || '(空)');
                    console.error('👇👇👇 [STDERR] 👇👇👇');
                    console.error(stderr || '(空)');
                    reject(error);
                } else {
                    console.log(`✅ 批量更新成功`);
                    resolve(true);
                }
            });
        } catch (e) { reject(e); }
    });
}

// 获取案件列表
 async function getCasesToScrape(retries = 3) {
     
    // 尝试使用本地 node_modules 下的路径，这比 npx 更稳定
    const wranglerPath = './node_modules/.bin/wrangler';
    const command = `${wranglerPath} d1 execute ${DATABASE_ID} --remote --json --command="SELECT id, case_url, case_id, case_title FROM missing_persons_cases WHERE (scraped_content IS NULL OR length(scraped_content) = 0) ORDER BY id LIMIT 15;"`;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await new Promise((resolve, reject) => {
                exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`\n❌ 获取任务命令执行失败 (尝试 ${i+1}/${retries})`);
                        // 同时打印 stdout，因为报错信息可能躲在这里
                        console.error('👇👇👇 [STDOUT (标准输出 - 错误详情可能在此)] 👇👇👇');
                        console.error(stdout || '(空)');
                        console.error('👇👇👇 [STDERR (错误流)] 👇👇👇');
                        console.error(stderr || '(空)');
                        console.error('👆👆👆 -------------------- 👆👆👆');
                        reject(error);
                    } else {
                        try {
                            const parsed = JSON.parse(stdout);
                            resolve(parsed[0]?.results || []);
                        } catch (e) {
                            console.error("JSON 解析失败，STDOUT 原文:", stdout);
                            reject(new Error("JSON Parse Error"));
                        }
                    }
                });
            });
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`⚠️ 等待 2s 后重试...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

// 主单次循环
async function mainScrapeLoop() {
    try {
        console.log('=== 开始单次顺序抓取任务（一批次/15个案件） ===\n');
        let accumulatedUpdates = []; 
        const cases = await getCasesToScrape();
        
        if (cases.length === 0) {
            console.log('✅ 没有待抓取的案件。');
            return;
        }

        for (let i = 0; i < cases.length; i++) {
            const currentCaseData = cases[i];
            console.log(`\n--- 处理 (${i + 1}/${cases.length}): ${currentCaseData.case_id} ---`);
            const scrapeResult = await scrapeWebsiteContent(currentCaseData.case_url, currentCaseData.case_id);
            
            if (scrapeResult.success) {
                accumulatedUpdates.push({ caseId: currentCaseData.case_id, scrapedContent: scrapeResult.content });
            }
            
            if (i < cases.length - 1) {
                const delay = Math.floor(Math.random() * 5000) + 5000; 
                console.log(`⏳ 等待 ${delay/1000} 秒...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        
        if (accumulatedUpdates.length > 0) {
            await updateBatchScrapedContent(accumulatedUpdates);
        }
        console.log('\n🎉 任务结束！');
    } catch (error) {
        console.error('❌ 严重错误:', error);
        process.exit(1); 
    }
}

async function main() {
    console.log('🚀 顺序抓取 + 批量写入版本 (Debug Mode)');
    await mainScrapeLoop();
}

if (require.main === module) { main(); }