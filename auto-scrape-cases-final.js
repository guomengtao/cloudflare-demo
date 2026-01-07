const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// 获取数据库中需要抓取的案件URL（每次获取15条记录进行批量处理）
async function getCasesToScrape() {
    return new Promise((resolve, reject) => {
        // 使用 LIMIT 15 确保每次获取15条记录进行批量处理
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="SELECT id, case_url, case_id, case_title FROM missing_persons_cases WHERE scraped_content IS NULL OR scraped_content = '' ORDER BY id LIMIT 15;"`;
        
        console.log('获取需要抓取的案件记录（批量15条）...');
        
        // 设置maxBuffer为10MB，避免缓冲区溢出
        const options = {
            maxBuffer: 10 * 1024 * 1024 // 10MB
        };
        
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.error('获取错误:', error);
                reject(error);
                return;
            }
            
            try {
                // 使用 --json 参数后，输出应该是纯净的JSON
                const result = JSON.parse(stdout);
                const cases = [];
                
                if (result[0] && result[0].results) {
                    cases.push(...result[0].results);
                }
                
                if (cases.length > 0) {
                    console.log(`✅ 找到 ${cases.length} 条需要抓取的案件记录`);
                } else {
                    console.log('✅ 所有案件都已抓取完成，无需继续抓取。');
                }
                resolve(cases);
            } catch (parseError) {
                console.error('解析响应错误:', parseError);
                console.log('尝试备用解析方法...');
                
                // 备用方法：如果 --json 参数无效，手动提取JSON
                try {
                    const jsonStart = stdout.indexOf('[');
                    const jsonEnd = stdout.lastIndexOf(']') + 1;
                    
                    if (jsonStart !== -1 && jsonEnd > jsonStart) {
                        const cleanJson = stdout.substring(jsonStart, jsonEnd);
                        const result = JSON.parse(cleanJson);
                        const cases = [];
                        
                        if (result[0] && result[0].results) {
                            cases.push(...result[0].results);
                        }
                        
                        if (cases.length > 0) {
                            console.log(`✅ 备用方法找到 ${cases.length} 条需要抓取的案件记录`);
                        } else {
                            console.log('✅ 备用方法：所有案件都已抓取完成');
                        }
                        resolve(cases);
                        return;
                    }
                } catch (backupError) {
                    console.error('备用方法也失败:', backupError);
                }
                
                // 如果所有方法都失败，显示原始输出用于调试
                console.log('原始输出内容:', stdout.substring(0, 500));
                resolve([]);
            }
        });
    });
}

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
// 后端API抓取函数
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
// 直接HTTP抓取的内容解析函数
function parseCaseContentDirect(html, caseUrl, caseId) {
    try {
        // 提取<title>标签内容
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1].trim() : '未知标题';
        
        // 提取<body>标签内的主要文本内容
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let bodyContent = bodyMatch ? bodyMatch[1] : html;
        
        // 移除脚本和样式标签
        bodyContent = bodyContent.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
        
        // 提取纯文本内容
        const textContent = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // 重点：提取所有图片URL
        const imageUrls = extractAllImageUrls(html, caseUrl);
        
        // 限制内容长度，避免数据库字段过长
        const maxLength = 8000;
        const truncatedContent = textContent.length > maxLength 
            ? textContent.substring(0, maxLength) + '...（内容已截断）' 
            : textContent;
        
// 构建包含图片URL的内容格式
        let content = `案件URL: ${caseUrl}
案件ID: ${caseId}
页面标题: ${pageTitle}

`;
        
        // 如果有图片URL，放在文件头部
        if (imageUrls.length > 0) {
            content += `[images] ${imageUrls.join(' ')} [text] `;
        }
        
        content += `真实抓取的网页内容:
${truncatedContent}

抓取方式: 直接HTTP抓取
抓取时间: ${new Date().toISOString()}`;
        
        return content;
        
    } catch (error) {
        console.error('直接解析错误:', error);
        return `案件URL: ${caseUrl}
案件ID: ${caseId}

错误信息: 直接解析失败 - ${error.message}

抓取时间: ${new Date().toISOString()}`;
    }
}

// 提取所有图片URL的辅助函数
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
        
        // 2. 提取延迟加载图片（data-src, data-original等）
        const lazyImgRegex = /<img[^>]+(?:data-src|data-original|data-lazy)=["']([^"']+)["'][^>]*>/gi;
        while ((match = lazyImgRegex.exec(html)) !== null) {
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
        
        // 4. 提取<picture>标签中的source srcset
        const srcsetRegex = /<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
        while ((match = srcsetRegex.exec(html)) !== null) {
            const srcset = match[1];
            // 解析srcset中的多个URL
            const urls = srcset.split(',').map(item => {
                const parts = item.trim().split(/\s+/);
                return parts[0];
            });
            urls.forEach(url => {
                const normalizedUrl = normalizeImageUrl(url, baseUrl);
                if (normalizedUrl && isCaseImage(normalizedUrl)) {
                    imageUrls.add(normalizedUrl);
                }
            });
        }
        
        // 5. 提取Charley Project特有的图片格式
        // 案件图片通常包含在特定的路径中
        const charleyImageRegex = /(?:case-images|photographs|images)\/[^"'\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi;
        while ((match = charleyImageRegex.exec(html)) !== null) {
            const url = normalizeImageUrl(match[0], baseUrl);
            if (url && isCaseImage(url)) {
                imageUrls.add(url);
            }
        }
        
        // 6. 提取<a>标签中的图片链接
        const linkImageRegex = /<a[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|gif|webp))["'][^>]*>/gi;
        while ((match = linkImageRegex.exec(html)) !== null) {
            const url = normalizeImageUrl(match[1], baseUrl);
            if (url && isCaseImage(url)) {
                imageUrls.add(url);
            }
        }
        
    } catch (error) {
        console.error('图片URL提取错误:', error);
    }
    
    return Array.from(imageUrls);
}

// 标准化图片URL（处理相对路径）
function normalizeImageUrl(url, baseUrl) {
    try {
        if (!url) return null;
        
        // 移除URL中的多余空格和引号
        url = url.trim().replace(/^['"]|['"]$/g, '');
        
        // 如果是完整URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // 如果是协议相对URL（//example.com/image.jpg）
        if (url.startsWith('//')) {
            return 'https:' + url;
        }
        
        // 如果根路径相对URL（/images/photo.jpg）
        if (url.startsWith('/')) {
            const base = new URL(baseUrl);
            return base.origin + url;
        }
        
        // 如果相对路径（images/photo.jpg）
        const base = new URL(baseUrl);
        return new URL(url, base.origin + base.pathname).href;
        
    } catch (error) {
        console.error('URL标准化错误:', error);
        return null;
    }
}

// 判断是否为案件相关图片（过滤掉图标、logo等无关图片）
function isCaseImage(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // 排除常见的无关图片
    const excludePatterns = [
        /favicon\.ico/i,
        /logo\.(png|jpg|jpeg|gif)/i,
        /icon\.(png|jpg|jpeg|gif)/i,
        /social\.(png|jpg|jpeg|gif)/i,
        /spinner\.(png|jpg|jpeg|gif)/i,
        /loading\.(png|jpg|jpeg|gif)/i,
        /pixel\.(png|jpg|jpeg|gif)/i,
        /tracking\.(png|jpg|jpeg|gif)/i,
        /ad\.(png|jpg|jpeg|gif)/i,
        /banner\.(png|jpg|jpeg|gif)/i,
        /button\.(png|jpg|jpeg|gif)/i,
        /arrow\.(png|jpg|jpeg|gif)/i,
        /bullet\.(png|jpg|jpeg|gif)/i,
        /bg\.(png|jpg|jpeg|gif)/i,
        /background\.(png|jpg|jpeg|gif)/i,
        /placeholder\.(png|jpg|jpeg|gif)/i,
        /default\.(png|jpg|jpeg|gif)/i,
        /blank\.(png|jpg|jpeg|gif)/i,
        /transparent\.(png|jpg|jpeg|gif)/i,
        /1x1\.(png|jpg|jpeg|gif)/i,
        /pixel\.(png|jpg|jpeg|gif)/i
    ];
    
    for (const pattern of excludePatterns) {
        if (pattern.test(lowerUrl)) {
            return false;
        }
    }
    
    // 包含案件相关关键词的图片
    const includePatterns = [
        /case[-_]?image/i,
        /photograph/i,
        /photo/i,
        /image/i,
        /picture/i,
        /portrait/i,
        /missing/i,
        /person/i,
        /victim/i,
        /suspect/i,
        /witness/i,
        /evidence/i,
        /crime/i,
        /investigation/i
    ];
    
    for (const pattern of includePatterns) {
        if (pattern.test(lowerUrl)) {
            return true;
        }
    }
    
    // 默认返回true，但优先检查文件大小和尺寸（这里简化处理）
    return true;
}

// 直接HTTP抓取的标题提取函数
function extractCaseTitleDirect(html, caseId) {
    try {
        // 提取<title>标签内容
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            const title = titleMatch[1].trim();
            // 清理标题，移除网站名称等无关信息
            return title.replace(/- Charley Project|失踪案件|Missing Case/gi, '').trim();
        }
        
        // 提取<h1>标签内容
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) {
            return h1Match[1].trim();
        }
        
        // 如果无法提取标题，使用案件ID生成标题
        return `${caseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 失踪案件`;
        
    } catch (error) {
        console.error('直接标题提取错误:', error);
        return `${caseId} 失踪案件`;
    }
}

// 批量更新数据库中的抓取内容（15个案件一批，使用Wrangler --file模式）
async function updateBatchScrapedContent(caseUpdates) {
    return new Promise((resolve, reject) => {
        try {
            if (caseUpdates.length === 0) {
                console.log('⚠️ 没有需要更新的案件');
                resolve(true);
                return;
            }
            
            console.log(`🔄 准备批量更新 ${caseUpdates.length} 个案件...`);
            
            // 1. 创建批量SQL文件内容
            let sqlContent = `-- 批量更新案件抓取内容（${caseUpdates.length} 个案件）\n`;
            
            caseUpdates.forEach((update, index) => {
                // 转义单引号（SQL文件内部需要）
                const escapedContent = update.content.replace(/'/g, "''");
                
                sqlContent += `\n-- 案件 ${index + 1}: ${update.caseId}\n`;
                sqlContent += `UPDATE missing_persons_cases \n`;
                sqlContent += `SET scraped_content = '${escapedContent}', \n`;
                sqlContent += `    updated_at = CURRENT_TIMESTAMP \n`;
                sqlContent += `WHERE case_id = '${update.caseId}';\n`;
                
                if (index < caseUpdates.length - 1) {
                    sqlContent += '\n';
                }
            });
            
            // 2. 生成临时SQL文件路径
            const tempSqlPath = path.join(__dirname, `batch_temp_${Date.now()}.sql`);
            
            // 3. 写入SQL文件
            fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
            console.log(`📄 已创建批量SQL文件: ${tempSqlPath} (${caseUpdates.length} 个案件)`);
            
            // 4. 使用Wrangler --file模式执行（工业级标准）
            const command = `npx wrangler d1 execute cloudflare-demo-db --remote --file="${tempSqlPath}"`;
            
            // 设置maxBuffer为10MB，避免缓冲区溢出
            const options = {
                maxBuffer: 10 * 1024 * 1024 // 10MB
            };
            
            console.log(`执行Wrangler --file批量命令（${caseUpdates.length} 个案件）...`);
            exec(command, options, (error, stdout, stderr) => {
                // 5. 无论成功与否，都清理临时文件
                try {
                    if (fs.existsSync(tempSqlPath)) {
                        fs.unlinkSync(tempSqlPath);
                        console.log('🗑️ 已清理批量SQL文件');
                    }
                } catch (cleanupError) {
                    console.warn('清理批量临时文件时警告:', cleanupError.message);
                }
                
                if (error) {
                    console.error('批量更新错误:', error);
                    reject(error);
                    return;
                }
                
                try {
                    // 6. 解析JSON响应检查成功状态
                    const result = JSON.parse(stdout);
                    if (result[0] && result[0].success === true) {
                        console.log(`✅ 批量数据库更新成功（${caseUpdates.length} 个案件）`);
                        resolve(true);
                    } else {
                        reject(new Error('批量更新失败，响应中没有成功标志'));
                    }
                } catch (parseError) {
                    console.error('批量更新响应解析错误:', parseError);
                    
                    // 备用检查：如果JSON解析失败，检查字符串内容
                    if (stdout.includes('"success": true')) {
                        console.log(`✅ 批量数据库更新成功（备用检查，${caseUpdates.length} 个案件）`);
                        resolve(true);
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

// 随机延迟函数（5-20秒）
function randomDelay() {
    const delay = Math.floor(Math.random() * 15000) + 5000; // 5-20秒
    console.log(`等待 ${delay/1000} 秒后继续...`);
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 主循环抓取函数（每次处理15个案件一批）
async function mainScrapeLoop() {
    try {
        console.log('=== 开始批量循环抓取案件内容（15个一批） ===\n');
        
        let totalProcessed = 0;
        let successCount = 0;
        let errorCount = 0;
        let batchNumber = 0;
        
        // 持续循环，直到没有更多需要抓取的记录
        while (true) {
            batchNumber++;
            
            // 1. 获取需要抓取的案件记录（每次获取15条）
            const cases = await getCasesToScrape();
            
            if (cases.length === 0) {
                console.log('✅ 所有案件都已抓取完成，无需继续抓取。');
                break;
            }
            
            console.log(`\n=== 处理第 ${batchNumber} 批案件（${cases.length} 个案件） ===`);
            
            const batchUpdates = [];
            const batchErrors = [];
            
            // 2. 并行抓取所有案件内容
            const scrapePromises = cases.map(async (caseData, index) => {
                try {
                    console.log(`\n--- 抓取第 ${totalProcessed + index + 1} 个案件 ---`);
                    console.log(`案件ID: ${caseData.case_id}`);
                    console.log(`案件URL: ${caseData.case_url}`);
                    console.log(`案件标题: ${caseData.case_title || '未设置'}`);
                    
                    // 随机延迟，避免请求过于频繁
                    const delay = Math.floor(Math.random() * 5000) + 2000; // 2-7秒
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    // 抓取网页内容
                    console.log('开始抓取网页内容...');
                    const scrapeResult = await scrapeWebsiteContent(caseData.case_url, caseData.case_id);
                    
                    if (scrapeResult.success) {
                        console.log(`✅ 抓取成功，字符数: ${scrapeResult.characterCount}`);
                        
                        // 添加到批量更新列表
                        batchUpdates.push({
                            caseId: caseData.case_id,
                            content: scrapeResult.content
                        });
                        
                        return { success: true, caseId: caseData.case_id };
                    } else {
                        console.log('❌ 抓取失败');
                        batchErrors.push({
                            caseId: caseData.case_id,
                            error: '抓取失败'
                        });
                        return { success: false, caseId: caseData.case_id, error: '抓取失败' };
                    }
                    
                } catch (error) {
                    console.log(`❌ 处理失败: ${error.message}`);
                    batchErrors.push({
                        caseId: caseData.case_id,
                        error: error.message
                    });
                    return { success: false, caseId: caseData.case_id, error: error.message };
                }
            });
            
            // 等待所有抓取任务完成
            const scrapeResults = await Promise.all(scrapePromises);
            
            // 3. 批量更新数据库（如果有成功抓取的内容）
            if (batchUpdates.length > 0) {
                try {
                    console.log(`\n🔄 准备批量更新 ${batchUpdates.length} 个案件到数据库...`);
                    await updateBatchScrapedContent(batchUpdates);
                    console.log('✅ 批量数据库更新成功');
                    
                    successCount += batchUpdates.length;
                } catch (updateError) {
                    console.error('❌ 批量数据库更新失败:', updateError.message);
                    errorCount += batchUpdates.length;
                }
            }
            
            // 4. 统计错误情况
            errorCount += batchErrors.length;
            totalProcessed += cases.length;
            
            // 5. 显示本批处理统计
            console.log(`\n📊 第 ${batchNumber} 批处理完成统计:`);
            console.log(`   ✅ 成功抓取: ${batchUpdates.length} 个案件`);
            console.log(`   ❌ 抓取失败: ${batchErrors.length} 个案件`);
            console.log(`   📈 累计成功: ${successCount} 个案件`);
            console.log(`   📉 累计失败: ${errorCount} 个案件`);
            console.log(`   📋 累计处理: ${totalProcessed} 个案件`);
            
            // 6. 如果本批有失败案件，显示详细信息
            if (batchErrors.length > 0) {
                console.log('\n❌ 本批失败案件详情:');
                batchErrors.forEach(error => {
                    console.log(`   - ${error.caseId}: ${error.error}`);
                });
            }
            
            // 7. 批次间延迟（5-15秒）
            if (cases.length === 15) { // 只有完整批次才延迟
                const batchDelay = Math.floor(Math.random() * 10000) + 5000; // 5-15秒
                console.log(`\n⏳ 等待 ${batchDelay/1000} 秒后处理下一批...`);
                await new Promise(resolve => setTimeout(resolve, batchDelay));
            }
        }
        
        // 最终统计
        console.log('\n🎉 批量抓取任务完成！');
        console.log(`📊 最终统计:`);
        console.log(`   ✅ 成功抓取: ${successCount} 个案件`);
        console.log(`   ❌ 抓取失败: ${errorCount} 个案件`);
        console.log(`   📋 总共处理: ${totalProcessed} 个案件`);
        
    } catch (error) {
        console.error('❌ 批量抓取循环发生严重错误:', error);
        throw error;
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
    
    fs.writeFileSync(path.join(__dirname, 'monitor-scrape-final.js'), monitorScript);
    console.log('✅ 监控脚本已创建: monitor-scrape-final.js');
}

// 主程序入口
async function main() {
    console.log('🚀 失踪人口案件抓取工具 - 单记录处理版本（使用axios）');
    console.log('==================================================\n');
    
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
    updateScrapedContent,
    mainScrapeLoop
};

// 备用：单条更新数据库中的抓取内容（保留作为备用）
async function updateScrapedContentSingle(caseId, scrapedContent) {
    return new Promise((resolve, reject) => {
        try {
            // 1. 转义单引号（SQL文件内部需要）
            const escapedContent = scrapedContent.replace(/'/g, "''");
            
            // 2. 创建SQL文件内容（人眼完全可读）
            const sqlContent = `-- 更新案件抓取内容
UPDATE missing_persons_cases 
SET scraped_content = '${escapedContent}', 
    updated_at = CURRENT_TIMESTAMP 
WHERE case_id = '${caseId}';`;
            
            // 3. 生成临时SQL文件路径
            const tempSqlPath = path.join(__dirname, `temp_${Date.now()}.sql`);
            
            // 4. 写入SQL文件
            fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
            console.log(`📄 已创建临时SQL文件: ${tempSqlPath}`);
            
            // 5. 使用Wrangler --file模式执行（工业级标准）
            const command = `npx wrangler d1 execute cloudflare-demo-db --remote --file="${tempSqlPath}"`;
            
            // 设置maxBuffer为10MB，避免缓冲区溢出
            const options = {
                maxBuffer: 10 * 1024 * 1024 // 10MB
            };
            
            console.log('执行Wrangler --file命令...');
            exec(command, options, (error, stdout, stderr) => {
                // 6. 无论成功与否，都清理临时文件
                try {
                    if (fs.existsSync(tempSqlPath)) {
                        fs.unlinkSync(tempSqlPath);
                        console.log('🗑️ 已清理临时SQL文件');
                    }
                } catch (cleanupError) {
                    console.warn('清理临时文件时警告:', cleanupError.message);
                }
                
                if (error) {
                    console.error('更新错误:', error);
                    reject(error);
                    return;
                }
                
                try {
                    // 7. 解析JSON响应检查成功状态
                    const result = JSON.parse(stdout);
                    if (result[0] && result[0].success === true) {
                        console.log('✅ 数据库更新成功（使用--file模式）');
                        resolve(true);
                    } else {
                        reject(new Error('更新失败，响应中没有成功标志'));
                    }
                } catch (parseError) {
                    console.error('更新响应解析错误:', parseError);
                    
                    // 备用检查：如果JSON解析失败，检查字符串内容
                    if (stdout.includes('"success": true')) {
                        console.log('✅ 数据库更新成功（备用检查）');
                        resolve(true);
                    } else {
                        reject(new Error('更新失败，无法确认操作结果'));
                    }
                }
            });
            
        } catch (fileError) {
            console.error('文件操作错误:', fileError);
            reject(fileError);
        }
    });
}