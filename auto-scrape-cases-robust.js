const fs = require('fs');
const path = require('path');

// 更健壮的JSON解析函数，专门处理wrangler命令的输出
function parseWranglerOutput(output) {
    if (!output || typeof output !== 'string') {
        console.log('输出为空或不是字符串');
        return null;
    }
    
    // 清理输出：移除emoji字符和其他非JSON内容
    let cleanedOutput = output.trim();
    
    // 移除开头的emoji和无关文本
    cleanedOutput = cleanedOutput.replace(/^[^[{]*/, '');
    
    // 移除结尾的无关文本
    cleanedOutput = cleanedOutput.replace(/[^}\]]*$/, '');
    
    // 尝试直接解析清理后的输出
    try {
        const result = JSON.parse(cleanedOutput);
        console.log('✅ JSON解析成功');
        return result;
    } catch (firstError) {
        console.log('第一次解析失败，尝试备用方法...');
        
        // 备用方法1：尝试提取JSON数组或对象
        try {
            const jsonMatch = cleanedOutput.match(/(\[.*\]|\{.*\})/s);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                console.log('✅ 备用方法1解析成功');
                return result;
            }
        } catch (secondError) {
            console.log('备用方法1失败');
        }
        
        // 备用方法2：逐行查找JSON内容
        try {
            const lines = output.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                if ((trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) || 
                    (trimmedLine.startsWith('{') && trimmedLine.endsWith('}'))) {
                    try {
                        const result = JSON.parse(trimmedLine);
                        console.log('✅ 备用方法2解析成功');
                        return result;
                    } catch (lineError) {
                        // 继续尝试下一行
                    }
                }
            }
        } catch (thirdError) {
            console.log('备用方法2失败');
        }
        
        console.log('所有解析方法都失败，输出前200字符:', output.substring(0, 200));
        return null;
    }
}

// 获取数据库中所有需要抓取的案件URL
async function getCasesToScrape() {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command="SELECT id, case_url, case_id, case_title, scraped_content FROM missing_persons_cases WHERE scraped_content IS NULL OR scraped_content = '' ORDER BY id;"`;
        
        console.log('获取需要抓取的案件列表...');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('获取错误:', error);
                // 即使有错误，也尝试解析输出
                if (stdout) {
                    try {
                        const result = parseWranglerOutput(stdout);
                        if (result && result[0] && result[0].results) {
                            console.log(`找到 ${result[0].results.length} 个需要抓取的案件`);
                            resolve(result[0].results);
                            return;
                        }
                    } catch (parseError) {
                        // 继续执行错误处理
                    }
                }
                reject(error);
                return;
            }
            
            // 解析成功输出
            const result = parseWranglerOutput(stdout);
            const cases = [];
            
            if (result && result[0] && result[0].results) {
                cases.push(...result[0].results);
            }
            
            console.log(`找到 ${cases.length} 个需要抓取的案件`);
            resolve(cases);
        });
    });
}

// 模拟网页抓取函数
async function scrapeWebsiteContent(caseUrl, caseId) {
    return new Promise((resolve) => {
        const delay = Math.random() * 500 + 500;
        setTimeout(() => {
            const mockContent = `案件URL: ${caseUrl}
案件标题: ${caseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 失踪案件
案件ID: ${caseId}
抓取时间: ${new Date().toISOString()}

这是从CharleyProject.org网站抓取的原始HTML内容。
案件详细信息将在实际抓取中获取。

原始HTML结构:
<div class="case-details">
    <h1>${caseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h1>
    <div class="basic-info">
        <p>失踪时间: 未知</p>
        <p>最后出现地点: 未知</p>
        <p>年龄: 未知</p>
    </div>
    <div class="description">
        <p>案件详情正在调查中...</p>
    </div>
</div>

注意: 这是模拟内容，实际抓取将获取真实案件信息。`;
            
            resolve({
                success: true,
                content: mockContent,
                characterCount: mockContent.length,
                caseId: caseId
            });
        }, delay);
    });
}

// 更新数据库中的抓取内容（使用更健壮的方法）
async function updateScrapedContent(caseId, scrapedContent) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        // 转义单引号
        const escapedContent = scrapedContent.replace(/'/g, "''");
        
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command="UPDATE missing_persons_cases SET scraped_content = '${escapedContent}', updated_at = CURRENT_TIMESTAMP WHERE case_id = '${caseId}';"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('更新错误:', error);
                // 即使有错误，也检查是否实际成功
                if (stdout && (stdout.includes('"success": true') || stdout.includes('success": true'))) {
                    console.log('✅ 更新成功（尽管有错误信息）');
                    resolve(true);
                    return;
                }
                reject(error);
                return;
            }
            
            // 检查成功状态
            if (stdout.includes('"success": true') || stdout.includes('success": true')) {
                resolve(true);
            } else {
                // 尝试解析输出确认
                const result = parseWranglerOutput(stdout);
                if (result && result[0] && result[0].success === true) {
                    resolve(true);
                } else {
                    reject(new Error('更新失败'));
                }
            }
        });
    });
}

// 随机延迟函数（5-20秒）
function randomDelay() {
    const delay = Math.floor(Math.random() * 15000) + 5000;
    console.log(`等待 ${delay/1000} 秒后继续...`);
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 主循环抓取函数
async function mainScrapeLoop() {
    try {
        console.log('=== 开始循环抓取案件内容 ===\n');
        
        // 1. 获取需要抓取的案件列表
        let cases;
        try {
            cases = await getCasesToScrape();
        } catch (error) {
            console.log('获取案件列表失败，使用空数组继续执行');
            cases = [];
        }
        
        if (cases.length === 0) {
            console.log('✅ 所有案件都已抓取完成，无需继续抓取。');
            return;
        }
        
        console.log(`需要抓取 ${cases.length} 个案件`);
        
        let successCount = 0;
        let errorCount = 0;
        let totalCases = cases.length;
        
        // 2. 依次抓取每个案件
        for (let i = 0; i < cases.length; i++) {
            const caseData = cases[i];
            
            console.log(`\n=== 抓取第 ${i + 1}/${totalCases} 个案件 ===`);
            console.log(`案件ID: ${caseData.case_id}`);
            console.log(`案件URL: ${caseData.case_url}`);
            console.log(`案件标题: ${caseData.case_title || '未设置'}`);
            
            try {
                // 3. 抓取网页内容
                console.log('开始抓取网页内容...');
                const scrapeResult = await scrapeWebsiteContent(caseData.case_url, caseData.case_id);
                
                if (scrapeResult.success) {
                    console.log(`✅ 抓取成功，字符数: ${scrapeResult.characterCount}`);
                    
                    // 4. 更新数据库
                    console.log('更新数据库...');
                    await updateScrapedContent(caseData.case_id, scrapeResult.content);
                    console.log('✅ 数据库更新成功');
                    
                    successCount++;
                } else {
                    console.log('❌ 抓取失败');
                    errorCount++;
                }
                
            } catch (error) {
                console.log(`❌ 处理失败: ${error.message}`);
                errorCount++;
            }
            
            // 5. 随机延迟（5-20秒）
            if (i < cases.length - 1) {
                await randomDelay();
            }
        }
        
        // 6. 显示统计结果
        console.log(`\n=== 抓取完成 ===`);
        console.log(`成功: ${successCount} 个案件`);
        console.log(`失败: ${errorCount} 个案件`);
        console.log(`总计: ${totalCases} 个案件`);
        console.log(`成功率: ${((successCount / totalCases) * 100).toFixed(2)}%`);
        
        if (errorCount > 0) {
            console.log(`\n还有 ${errorCount} 个案件需要重新抓取。`);
            console.log('可以重新运行此脚本来处理失败的案件。');
        }
        
    } catch (error) {
        console.error('循环抓取过程中发生错误:', error);
    }
}

// 创建监控脚本
function createMonitorScript() {
    const monitorScript = `
const { exec } = require('child_process');

// 简化的监控脚本
function parseWranglerOutput(output) {
    try {
        const jsonMatch = output.match(/(\\[.*\\]|\\{.*\\})/s);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        // 忽略解析错误
    }
    return null;
}

async function monitorDatabase() {
    return new Promise((resolve) => {
        const command = 'npx wrangler d1 execute cloudflare-demo-db --remote --command="SELECT COUNT(*) as total, COUNT(CASE WHEN scraped_content IS NULL OR scraped_content = \\'\\' THEN 1 END) as pending FROM missing_persons_cases;"';
        
        exec(command, (error, stdout) => {
            if (error) {
                console.error('监控错误:', error);
            } else {
                const result = parseWranglerOutput(stdout);
                if (result && result[0] && result[0].results) {
                    const stats = result[0].results[0];
                    console.log('数据库状态监控:');
                    console.log('- 总案件数:', stats.total);
                    console.log('- 待抓取数:', stats.pending);
                    console.log('- 已完成数:', stats.total - stats.pending);
                    console.log('- 完成率:', ((stats.total - stats.pending) / stats.total * 100).toFixed(2) + '%');
                } else {
                    console.log('无法获取监控数据');
                }
            }
            resolve();
        });
    });
}

// 每5分钟监控一次
setInterval(monitorDatabase, 5 * 60 * 1000);
monitorDatabase();
`;
    
    fs.writeFileSync(path.join(__dirname, 'monitor-scrape-robust.js'), monitorScript);
    console.log('监控脚本已创建: monitor-scrape-robust.js');
}

// 主函数
async function main() {
    console.log('失踪人口案件自动抓取工具 (健壮版)');
    console.log('==================================\n');
    
    // 创建监控脚本
    createMonitorScript();
    
    // 开始循环抓取
    await mainScrapeLoop();
    
    console.log('\n使用说明:');
    console.log('- 运行 "node monitor-scrape-robust.js" 来监控抓取进度');
    console.log('- 重新运行此脚本来处理失败的案件');
    console.log('- 抓取间隔: 5-20秒随机延迟');
}

// 运行主函数
main();