const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// 配置：统一使用数据库名称
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

// 真实的网页抓取函数
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
            }, { timeout: 45000 });
            
            const result = response.data;
            if (result.success) {
                console.log(`✅ 后端API抓取成功，字符数: ${result.characterCount}`);
                let finalContent = result.content;
                if (!result.content.includes('[images]')) {
                    const directResult = await scrapeWithDirectHTTP(caseUrl, caseId);
                    if (directResult.success) finalContent = directResult.content;
                }
                return { success: true, content: finalContent, caseId };
            } else {
                throw new Error(result.error || 'API返回失败状态');
            }
        } else {
            throw new Error('后端API不可用');
        }
    } catch (error) {
        console.error('❌ API抓取失败，降级到直接抓取:', error.message);
        return await scrapeWithDirectHTTP(caseUrl, caseId);
    }
}

async function scrapeWithDirectHTTP(caseUrl, caseId) {
    try {
        console.log('🌐 使用 axios 直接 HTTP 抓取...');
        const response = await axios.get(caseUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        });
        const html = response.data;
        const scrapedContent = parseCaseContentDirect(html, caseUrl, caseId);
        console.log(`✅ 直接抓取成功，字符数: ${scrapedContent.length}`);
        return { success: true, content: scrapedContent, caseId };
    } catch (error) {
        console.error('❌ 直接抓取也失败了:', error.message);
        return { success: false, caseId };
    }
}

function parseCaseContentDirect(html, caseUrl, caseId) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : `${caseId} 失踪案件`;
    const textContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `案件URL: ${caseUrl}\n案件ID: ${caseId}\n案件标题: ${title}\n抓取时间: ${new Date().toISOString()}\n\n[text]\n${textContent.substring(0, 40000)}`;
}

// -------------------------------------------------------------------------
// 🚀 核心改进：批量写入函数（带事务保护）
// -------------------------------------------------------------------------
async function updateBatchScrapedContent(caseUpdates) {
    return new Promise((resolve, reject) => {
        try {
            if (!caseUpdates || caseUpdates.length === 0) {
                console.log('⚠️ 没有成功的抓取结果，跳过数据库更新。');
                return resolve(null);
            }
            
            console.log(`📊 准备写入数据库，共 ${caseUpdates.length} 条数据...`);
            
            // 使用 BEGIN TRANSACTION 包装，确保批量执行的原子性和速度
            let sqlContent = 'BEGIN TRANSACTION;\n';
            caseUpdates.forEach(update => {
                // 深度转义单引号：SQL 中单引号需用两个单引号表示
                const escapedContent = update.scrapedContent.replace(/'/g, "''");
                sqlContent += `UPDATE missing_persons_cases SET scraped_content = '${escapedContent}', updated_at = CURRENT_TIMESTAMP WHERE case_id = '${update.caseId}';\n`;
            });
            sqlContent += 'COMMIT;';

            const tempSqlPath = path.join(__dirname, `temp_batch_${Date.now()}.sql`);
            fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
            
            const wranglerPath = './node_modules/.bin/wrangler';
            const command = `${wranglerPath} d1 execute ${DATABASE_ID} --remote --file="${tempSqlPath}"`;
            
            exec(command, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
                
                if (error) {
                    console.error('❌ D1 批量执行失败');
                    console.error('STDOUT:', stdout);
                    console.error('STDERR:', stderr);
                    reject(error);
                } else {
                    console.log(`✅ 数据库写入完成！反馈信息:`);
                    console.log(stdout.substring(stdout.length - 200)); // 只打印最后部分反馈
                    resolve(true);
                }
            });
        } catch (e) { reject(e); }
    });
}

// 获取待抓取列表
async function getCasesToScrape() {
    const wranglerPath = './node_modules/.bin/wrangler';
    const command = `${wranglerPath} d1 execute ${DATABASE_ID} --remote --json --command="SELECT case_url, case_id FROM missing_persons_cases WHERE (scraped_content IS NULL OR length(scraped_content) = 0) ORDER BY id LIMIT 15;"`;
    
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ 获取任务失败:", stderr);
                reject(error);
            } else {
                try {
                    const parsed = JSON.parse(stdout);
                    resolve(parsed[0]?.results || []);
                } catch (e) { resolve([]); }
            }
        });
    });
}

async function mainScrapeLoop() {
    try {
        console.log('=== 开始顺序抓取任务（15个/批） ===');
        const cases = await getCasesToScrape();
        
        if (cases.length === 0) {
            console.log('✅ 暂时没有待处理的案件。');
            return;
        }

        let accumulatedUpdates = []; 

        for (let i = 0; i < cases.length; i++) {
            const current = cases[i];
            console.log(`\n--- [${i + 1}/${cases.length}] 处理: ${current.case_id} ---`);
            
            const result = await scrapeWebsiteContent(current.case_url, current.case_id);
            
            if (result.success) {
                accumulatedUpdates.push({ caseId: current.case_id, scrapedContent: result.content });
            } else {
                console.log(`⚠️ 案件 ${current.case_id} 抓取失败，跳过。`);
            }
            
            // 每一个案件处理完后稍微停一下，保护对方服务器
            if (i < cases.length - 1) {
                const sleep = 3000 + Math.random() * 2000;
                await new Promise(r => setTimeout(r, sleep));
            }
        }
        
        // 关键：即使 accumulatedUpdates 只有 1 条，也会执行更新
        await updateBatchScrapedContent(accumulatedUpdates);
        
        console.log('\n🎉 本次批处理任务圆满结束！');
    } catch (error) {
        console.error('❌ 程序运行中断:', error);
        process.exit(1); 
    }
}

mainScrapeLoop();