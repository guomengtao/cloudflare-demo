const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

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
        
        // 检查后端API是否可用
        const apiAvailable = await checkBackendAPI();
        
        if (apiAvailable) {
            console.log('✅ 后端API可用，使用API抓取...');
            
            // 调用后端API进行抓取
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
                
                // 检查后端API是否返回了图片URL
                let finalContent = result.content;
                if (!result.content.includes('[images]')) {
                    // 如果后端API没有返回图片URL，使用直接HTTP抓取补充图片信息
                    console.log('🔄 后端API未返回图片URL，尝试补充图片信息...');
                    const directResult = await scrapeWithDirectHTTP(caseUrl, caseId);
                    if (directResult.success) {
                        finalContent = directResult.content;
                    }
                }
                
                return {
                    success: true,
                    content: finalContent,
                    characterCount: finalContent.length,
                    caseId: caseId,
                    caseTitle: result.caseTitle || `${caseId} 失踪案件`
                };
            } else {
                throw new Error(result.error || 'API返回失败状态');
            }
        } else {
            throw new Error('后端API不可用');
        }
        
    } catch (error) {
        console.error('❌ 后端API抓取失败:', error.message);
        
        // 如果后端API不可用，使用备用的直接HTTP抓取（现在包含强大的图片URL提取）
        console.log('🔄 尝试使用直接HTTP抓取作为备选方案...');
        return await scrapeWithDirectHTTP(caseUrl, caseId);
    }
}

// 备用的直接HTTP抓取函数（使用axios）
async function scrapeWithDirectHTTP(caseUrl, caseId) {
    try {
        console.log('🌐 使用axios进行直接HTTP抓取...');
        
        const response = await axios.get(caseUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        });
        
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = response.data;
        
        // 解析HTML内容（现在包含图片URL提取）
        const scrapedContent = parseCaseContentDirect(html, caseUrl, caseId);
        const caseTitle = extractCaseTitleDirect(html, caseId);
        
        console.log(`✅ 直接HTTP抓取成功，字符数: ${scrapedContent.length}`);
        
        return {
            success: true,
            content: scrapedContent,
            characterCount: scrapedContent.length,
            caseId: caseId,
            caseTitle: caseTitle
        };
        
    } catch (error) {
        console.error('❌ 直接HTTP抓取也失败了:', error.message);
        
        // 如果所有方法都失败，返回错误信息
        console.log('❌ 所有抓取方法都失败了，跳过此案件');
        return {
            success: false,
            error: error.message,
            content: `案件URL: ${caseUrl}
案件ID: ${caseId}

错误信息: 所有抓取方法都失败了 - ${error.message}

抓取时间: ${new Date().toISOString()}`,
            characterCount: 0,
            caseId: caseId,
            caseTitle: `${caseId} 失踪案件`
        };
    }
}

// 解析HTML内容（现在包含图片URL提取）
function parseCaseContentDirect(html, caseUrl, caseId) {
    console.log('📝 解析HTML内容（包含图片URL提取）...');
    
    // 提取标题
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : `${caseId} 失踪案件`;
    
    // 提取所有图片URL
    const imageUrls = extractAllImageUrls(html, caseUrl);
    
    // 提取文本内容（去除HTML标签）
    const textContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // 移除style标签
        .replace(/<[^>]+>/g, ' ') // 移除所有HTML标签
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim();
    
    // 构建最终内容格式：[images] 图片URL列表 [text] 文本内容
    let finalContent = `案件URL: ${caseUrl}
案件ID: ${caseId}
案件标题: ${title}
抓取时间: ${new Date().toISOString()}

`;

    // 添加图片URL部分
    if (imageUrls.length > 0) {
        finalContent += `[images]
${imageUrls.join('\n')}

`;
    } else {
        finalContent += `[images]
未找到图片

`;
    }
    
    // 添加文本内容部分
finalContent += `[text]
${textContent.substring(0, 50000)}`; // 限制文本长度
    
    return finalContent;
}

// 提取所有图片URL（增强版，支持多种图片格式）
function extractAllImageUrls(html, baseUrl) {
    const imageUrls = new Set();
    
    try {
        // 1. 提取常规<img>标签的src属性
        const imgSrcRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = imgSrcRegex.exec(html)) !== null) {
            const url = normalizeImageUrl(match[1], baseUrl);
            if (url && isCaseImage(url)) {
                imageUrls.add(url);
            }
        }
        
        // 2. 提取延迟加载图片（data-src, data-lazy-src等）
        const lazySrcRegex = /<img[^>]+(?:data-src|data-lazy-src|data-original)=["']([^"']+)["'][^>]*>/gi;
        while ((match = lazySrcRegex.exec(html)) !== null) {
            const url = normalizeImageUrl(match[1], baseUrl);
            if (url && isCaseImage(url)) {
                imageUrls.add(url);
            }
        }
// 3. 提取CSS背景图片
const bgImageRegex = /background(?:-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/gi;
        while ((match = bgImageRegex.exec(html)) !== null) {
            const url = normalizeImageUrl(match[1], baseUrl);
            if (url && isCaseImage(url)) {
                imageUrls.add(url);
            }
        }
        
        // 4. 提取<picture>标签中的<source> srcset
        const srcsetRegex = /<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
        while ((match = srcsetRegex.exec(html)) !== null) {
            const srcset = match[1];
            // 解析srcset中的多个URL（格式：url1 1x, url2 2x）
            const urls = srcset.split(',').map(item => {
                const urlPart = item.trim().split(' ')[0];
                return normalizeImageUrl(urlPart, baseUrl);
            }).filter(url => url && isCaseImage(url));
            
            urls.forEach(url => imageUrls.add(url));
        }
        
        // 5. 提取<a>标签中的图片链接（如果链接指向图片文件）
        const linkRegex = /<a[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|gif|webp))["'][^>]*>/gi;
        while ((match = linkRegex.exec(html)) !== null) {
            const url = normalizeImageUrl(match[1], baseUrl);
            if (url && isCaseImage(url)) {
                imageUrls.add(url);
            }
        }
        
        // 6. 提取Charley Project特有格式的图片URL
        if (baseUrl.includes('charleyproject.org')) {
            const charleyRegex = /case\/([^\/]+)\/([^\/]+)\.(?:jpg|jpeg|png)/gi;
            while ((match = charleyRegex.exec(html)) !== null) {
                const url = `https://calm-snow-a647.guomengtao.workers.dev/case/${match[1]}/${match[2]}.jpg`;
                if (isCaseImage(url)) {
                    imageUrls.add(url);
                }
            }
        }
        
    } catch (error) {
        console.error('提取图片URL时出错:', error);
    }
    
    return Array.from(imageUrls);
}

// 标准化图片URL（处理相对路径和协议）
function normalizeImageUrl(url, baseUrl) {
    if (!url) return null;
    
    try {
        // 移除URL中的空格和引号
        url = url.trim().replace(/['"]/g, '');
        
        // 如果已经是完整URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        // 处理协议相对URL（//example.com/image.jpg）
        if (url.startsWith('//')) {
            const base = new URL(baseUrl);
            return base.protocol + url;
        }
// 处理相对路径
        if (url.startsWith('/')) {
            const base = new URL(baseUrl);
            return base.origin + url;
        }
        
        // 处理相对路径（没有斜杠开头）
        const base = new URL(baseUrl);
        return new URL(url, base.origin + base.pathname).href;
        
    } catch (error) {
        console.error('标准化图片URL出错:', error, 'URL:', url);
        return null;
    }
}

// 判断是否为案件相关图片（过滤掉无关图片）
function isCaseImage(url) {
    if (!url) return false;
    
    // 排除空白、透明、1x1像素等无用图片
    const excludedPatterns = [
        /blank\.(?:gif|png|jpg)/i,
        /spacer\.(?:gif|png|jpg)/i,
        /transparent\.(?:gif|png)/i,
        /1x1\.(?:gif|png)/i,
        /pixel\.(?:gif|png)/i,
        /loading\.(?:gif|png)/i,
        /placeholder\.(?:gif|png|jpg)/i,
        /\.svg$/i, // 排除SVG图标
        /data:image/i // 排除base64内联图片
    ];
    
    // 包含案件相关关键词的图片
    const includedPatterns = [
        /photographs/i,
        /case-images/i,
        /missing/i,
        /person/i,
        /photo/i,
        /image/i,
        /picture/i,
        /portrait/i,
        /face/i,
        /amber/i,
        /charleyproject/i,
        /missingkids/i,
        /ncmec/i
    ];
    
    // 检查是否在排除列表中
    for (const pattern of excludedPatterns) {
        if (pattern.test(url)) {
            return false;
        }
    }
    
    // 检查是否包含案件相关关键词
    for (const pattern of includedPatterns) {
        if (pattern.test(url)) {
            return true;
        }
    }
    
    // 默认返回true，但限制文件类型
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

// 从HTML中提取案件标题
function extractCaseTitleDirect(html, caseId) {
    try {
// 尝试提取<title>标签
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            const title = titleMatch[1].trim();
            // 清理标题中的无关内容
            return title.replace(/\s*-\s*(Charley Project|Missing Persons|NCMEC|AMBER Alert).*$/i, '')
                       .replace(/^\s+|\s+$/g, '')
                       || `${caseId} 失踪案件`;
        }
        
        // 备用：尝试提取<h1>标签
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) {
            return h1Match[1].trim() || `${caseId} 失踪案件`;
        }
        
        return `${caseId} 失踪案件`;
    } catch (error) {
        console.error('提取标题出错:', error);
        return `${caseId} 失踪案件`;
    }
}

// 批量更新数据库中的抓取内容（一次性更新多个案件）
async function updateBatchScrapedContent(caseUpdates) {
    return new Promise((resolve, reject) => {
        try {
            if (!caseUpdates || caseUpdates.length === 0) {
                console.log('⚠️ 没有案件需要更新');
                resolve(null);
                return;
            }
            
            console.log(`📊 准备批量更新 ${caseUpdates.length} 个案件的抓取内容...`);
            
            // 构建批量SQL更新语句
            let sqlContent = '-- 批量更新案件抓取内容\n';
            
            caseUpdates.forEach((update, index) => {
                const escapedContent = update.scrapedContent.replace(/'/g, "''");
sqlContent += `UPDATE missing_persons_cases \n`;
                sqlContent += `SET scraped_content = '${escapedContent}', \n`;
                sqlContent += `    updated_at = CURRENT_TIMESTAMP \n`;
                sqlContent += `WHERE case_id = '${update.caseId}';\n`;
                
                if (index < caseUpdates.length - 1) {
                    sqlContent += '\n';
                }
            });
            
            // 生成临时SQL文件路径
            const tempSqlPath = path.join(__dirname, `temp_batch_${Date.now()}.sql`);
            
            // 写入SQL文件
            fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
            console.log(`📄 已创建批量SQL文件: ${tempSqlPath} (${caseUpdates.length}个案件)`);
            
            // 使用Wrangler --file模式执行（工业级标准）
            const command = `npx wrangler d1 execute cloudflare-demo-db --remote --file="${tempSqlPath}"`;
            
            // 设置maxBuffer为10MB，避免缓冲区溢出
            const options = {
                maxBuffer: 10 * 1024 * 1024 // 10MB
            };
            
            console.log('执行Wrangler --file命令进行批量更新...');
            exec(command, options, (error, stdout, stderr) => {
                // 无论成功与否，都清理临时文件
                try {
                    if (fs.existsSync(tempSqlPath)) {
                        fs.unlinkSync(tempSqlPath);
                        console.log('🗑️ 已清理批量SQL文件');
                    }
                } catch (cleanupError) {
                    console.warn('清理批量文件时警告:', cleanupError.message);
                }
                
                if (error) {
                    console.error('批量更新错误:', error);
                    reject(error);
                    return;
                }
                
                try {
                    // 解析JSON响应检查成功状态
                    const result = JSON.parse(stdout);
                    if (result[0] && result[0].success === true) {
                        console.log(`✅ 批量数据库更新成功（${caseUpdates.length}个案件）`);
                        resolve(tempSqlPath); // 返回SQL文件路径
                    } else {
                        reject(new Error('批量更新失败，响应中没有成功标志'));
                    }
                } catch (parseError) {
                    console.error('批量更新响应解析错误:', parseError);
                    
                    // 备用检查：如果JSON解析失败，检查字符串内容
                    if (stdout.includes('"success": true')) {
                        console.log(`✅ 批量数据库更新成功（备用检查，${caseUpdates.length}个案件）`);
                        resolve(tempSqlPath); // 返回SQL文件路径
                    } else {
                        reject(new Error('批量更新失败，无法确认操作结果'));
                    }
                }
            });
            
        } catch (fileError) {
            console.error('批量文件操作错误:', fileError);
            reject(fileError);
        }
    });
}

// 随机延迟函数（5-15秒）
function randomDelay(min = 50000, max = 150000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 主循环抓取函数（逐个顺序抓取 + 批量写入）
async function mainScrapeLoop() {
    try {
        console.log('=== 开始逐个顺序抓取案件内容（累积15个后批量写入） ===\n');
        
        let totalProcessed = 0;
        let successCount = 0;
        let errorCount = 0;
        let batchNumber = 0;
        let accumulatedUpdates = []; // 累积的案件更新
        let processedCaseIds = new Set(); // 记录已处理的案件ID，避免重复
        
        // 持续循环，直到没有更多需要抓取的记录
        while (true) {
            batchNumber++;
            
            // 1. 获取需要抓取的案件记录（每次获取15条进行顺序处理）
            const cases = await getCasesToScrape();
            
            if (cases.length === 0) {
                // 处理剩余的案件（如果累积了但不足15个）
                if (accumulatedUpdates.length > 0) {
                    console.log(`\n🔄 处理剩余的 ${accumulatedUpdates.length} 个案件...`);
                    try {
                        const sqlFilePath = await updateBatchScrapedContent(accumulatedUpdates);
                        successCount += accumulatedUpdates.length;
                        console.log(`✅ 剩余案件批量更新成功（${accumulatedUpdates.length}个）`);
                        console.log(`📄 SQL文件路径: ${sqlFilePath}`);
                    } catch (updateError) {
                        console.error('❌ 剩余案件更新失败:', updateError.message);
                        errorCount += accumulatedUpdates.length;
                    }
                    accumulatedUpdates = [];
                }
                
                console.log('✅ 所有案件都已抓取完成，无需继续抓取。');
                break;
            }
            
            // 过滤掉已经处理过的案件
            const newCases = cases.filter(caseData => !processedCaseIds.has(caseData.case_id));
            
            if (newCases.length === 0) {
                console.log(`⚠️ 当前批次的 ${cases.length} 个案件都已处理过，跳过此批次...`);
                continue;
            }
            
            console.log(`📋 当前批次有 ${newCases.length} 个新案件需要处理`);
            
            // 2. 逐个顺序抓取案件内容
            for (let i = 0; i < newCases.length; i++) {
                const currentCaseData = newCases[i];
                const currentIndex = totalProcessed + i + 1;
                
                console.log(`\n--- 抓取第 ${currentIndex} 个案件 ---`);
                console.log(`案件ID: ${currentCaseData.case_id}`);
                console.log(`案件URL: ${currentCaseData.case_url}`);
                console.log(`案件标题: ${currentCaseData.case_title || '未设置'}`);
                
                try {
                    // 抓取网页内容
                    console.log('开始抓取网页内容...');
                    const scrapeResult = await scrapeWebsiteContent(currentCaseData.case_url, currentCaseData.case_id);
                    
                    if (scrapeResult.success) {
                        console.log(`✅ 抓取成功，字符数: ${scrapeResult.characterCount}`);
                        
                        // 添加到累积更新列表
                        accumulatedUpdates.push({
                            caseId: currentCaseData.case_id,
                            scrapedContent: scrapeResult.content
                        });
                        
                        // 标记为已处理
                        processedCaseIds.add(currentCaseData.case_id);
                        successCount++;
                        totalProcessed++;
                        
                        console.log(`📊 已累积 ${accumulatedUpdates.length} 个案件，目标15个后批量写入`);
                        
                        // 检查是否达到累积数量（15个）
                        if (accumulatedUpdates.length >= 15) {
                            console.log(`\n🔄 累积到15个案件，开始批量写入数据库...`);
                            try {
                                const sqlFilePath = await updateBatchScrapedContent(accumulatedUpdates);
                                console.log(`✅ 批量数据库更新成功（${accumulatedUpdates.length}个案件）`);
                                console.log(`📄 SQL文件路径: ${sqlFilePath}`);
                                accumulatedUpdates = []; // 清空累积列表
                            } catch (updateError) {
                                console.error('❌ 批量数据库更新失败:', updateError.message);
                                errorCount += accumulatedUpdates.length;
                                accumulatedUpdates = []; // 即使失败也清空，避免重复处理
                            }
                        }
                        
                    } else {
                        console.log('❌ 抓取失败');
                        errorCount++;
                        totalProcessed++;
                    }
                    
                } catch (error) {
                    console.log(`❌ 处理失败: ${error.message}`);
                    errorCount++;
                    totalProcessed++;
                }
                
                // 3. 每个案件之间的延迟（5-15秒，带倒计时显示）
                if (i < newCases.length - 1 || accumulatedUpdates.length < 15) {
                    const delay = Math.floor(Math.random() * 100000) + 50000; // 5-15秒
                    console.log(`\n⏳ 等待 ${delay/1000} 秒后处理下一个案件...`);
                    
                    // 倒计时显示
                    for (let remaining = delay; remaining > 0; remaining -= 1000) {
                        process.stdout.write(`\r⏰ 倒计时: ${Math.ceil(remaining/1000)}秒 `);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    process.stdout.write('\r✅ 等待完成，继续处理下一个案件\n');
                }
            }
            
            // 4. 显示当前统计（修复成功计数显示）
            console.log(`\n📊 当前处理统计:`);
            console.log(`   ✅ 成功抓取: ${successCount} 个案件`);
            console.log(`   ❌ 抓取失败: ${errorCount} 个案件`);
            console.log(`   📋 累计处理: ${totalProcessed} 个案件`);
            console.log(`   📦 累积待写入: ${accumulatedUpdates.length} 个案件`);
        }
        
        // 处理最后剩余的案件（如果累积了但不足15个）
        if (accumulatedUpdates.length > 0) {
            console.log(`\n🔄 处理最后剩余的 ${accumulatedUpdates.length} 个案件...`);
            try {
                const sqlFilePath = await updateBatchScrapedContent(accumulatedUpdates);
                console.log(`✅ 最后剩余案件批量更新成功（${accumulatedUpdates.length}个）`);
                console.log(`📄 SQL文件路径: ${sqlFilePath}`);
            } catch (updateError) {
                console.error('❌ 最后剩余案件更新失败:', updateError.message);
            }
        }
        
        // 最终统计
        console.log('\n🎉 顺序抓取 + 批量写入任务完成！');
        console.log(`📊 最终统计:`);
        console.log(`   ✅ 成功抓取: ${successCount} 个案件`);
        console.log(`   ❌ 抓取失败: ${errorCount} 个案件`);
        console.log(`   📋 总共处理: ${totalProcessed} 个案件`);
        
    } catch (error) {
        console.error('❌ 顺序抓取循环发生严重错误:', error);
        throw error;
    }
}

// 获取数据库中需要抓取的案件URL（每次获取15条记录进行顺序处理）
 

async function getCasesToScrape(retries = 3) {
    const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="SELECT id, case_url, case_id, case_title FROM missing_persons_cases WHERE length(ifnull(scraped_content, '')) = 0 ORDER BY id LIMIT 15;"`;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await new Promise((resolve, reject) => {
                exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
                    if (error) reject(error);
                    else resolve(JSON.parse(stdout)[0]?.results || []);
                });
            });
        } catch (err) {
            if (i === retries - 1) throw err;
            const wait = (i + 1) * 2000 + Math.random() * 1000;
            console.log(`⚠️ 获取任务清单繁忙 (尝试 ${i+1}/${retries})，${(wait/1000).toFixed(1)}s 后重试...`);
            await new Promise(r => setTimeout(r, wait));
        }
    }
}

// 创建监控脚本（使用--file模式）
function createMonitorScript() {
    const monitorScript = `
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 监控数据库状态（使用Wrangler --file模式）
async function monitorDatabase() {
    return new Promise((resolve) => {
        try {
            // 创建SQL文件内容
            const sqlContent = '-- 监控数据库状态\\nSELECT COUNT(*) as total, COUNT(CASE WHEN scraped_content IS NULL OR scraped_content = \\'\\' THEN 1 END) as pending FROM missing_persons_cases;';
            
            // 生成临时SQL文件路径
            const tempSqlPath = path.join(__dirname, \\'monitor_\\' + Date.now() + \\'.sql\\');
            
            // 写入SQL文件
            fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
            
            // 使用Wrangler --file模式执行
            const command = 'npx wrangler d1 execute cloudflare-demo-db --remote --json --file="' + tempSqlPath + '"';
            
            // 设置maxBuffer为10MB
            const options = {
                maxBuffer: 10 * 1024 * 1024
            };
            
            exec(command, options, (error, stdout) => {
                // 清理临时文件
                try {
                    if (fs.existsSync(tempSqlPath)) {
                        fs.unlinkSync(tempSqlPath);
                    }
                } catch (cleanupError) {
                    console.warn('清理监控文件时警告:', cleanupError.message);
                }
                
                if (error) {
                    console.error('监控错误:', error);
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        if (result[0] && result[0].results) {
                            const stats = result[0].results[0];
                            console.log('数据库状态监控:');
                            console.log('- 总案件数:', stats.total);
                            console.log('- 待抓取数:', stats.pending);
                            console.log('- 已完成数:', stats.total - stats.pending);
                            console.log('- 完成率:', ((stats.total - stats.pending) / stats.total * 100).toFixed(2) + '%');
                        }
                    } catch (e) {
                        console.log('监控数据解析失败');
                    }
                }
                resolve();
            });
        } catch (error) {
            console.error('监控文件操作错误:', error);
            resolve();
        }
    });
}

// 每5分钟监控一次
setInterval(monitorDatabase, 5 * 60 * 1000);
monitorDatabase();
`;
    
    fs.writeFileSync(path.join(__dirname, 'monitor-scrape-sequential.js'), monitorScript);
    console.log('✅ 监控脚本已创建: monitor-scrape-sequential.js');
}

// 主程序入口
async function main() {
    console.log('🚀 失踪人口案件抓取工具 - 逐个顺序抓取 + 批量写入版本');
    console.log('========================================================\n');
    console.log('📋 工作模式:');
    console.log('   • 逐个顺序抓取（每次1个案件）');
    console.log('   • 每个案件之间等待5-15秒');
    console.log('   • 累积15个案件后批量写入SQL');
    console.log('   • 减少SQL写入负担，提高效率\n');
    
    try {
        // 创建监控脚本
        createMonitorScript();
        
        // 开始主循环抓取
        await mainScrapeLoop();
        
        console.log('\n🎉 抓取任务完成！');
        
    } catch (error) {
        console.error('程序执行错误:', error);
    }
}

// 启动程序
if (require.main === module) {
    main();
}

module.exports = {
    getCasesToScrape,
    scrapeWebsiteContent,
    updateBatchScrapedContent,
    mainScrapeLoop
};