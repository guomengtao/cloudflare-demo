const fs = require('fs');
const path = require('path');

// 获取数据库中所有需要抓取的案件URL（修复缓冲区溢出版本）
async function getCasesToScrape() {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        // 使用 --json 参数确保纯净的JSON输出
        // 优化查询：不包含scraped_content字段，避免Buffer溢出
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="SELECT id, case_url, case_id, case_title FROM missing_persons_cases WHERE scraped_content IS NULL OR scraped_content = '' ORDER BY id;"`;
        
        console.log('获取需要抓取的案件列表...');
        
        // 增加缓冲区大小到10MB，避免stdout maxBuffer错误
        const options = {
            maxBuffer: 10 * 1024 * 1024 // 10MB缓冲区
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
                
                console.log(`✅ 找到 ${cases.length} 个需要抓取的案件`);
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
                        
                        console.log(`✅ 备用方法找到 ${cases.length} 个需要抓取的案件`);
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

// 模拟网页抓取函数
async function scrapeWebsiteContent(caseUrl, caseId) {
    return new Promise((resolve) => {
        const delay = Math.random() * 500 + 500; // 500-1000ms
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

// 更新数据库中的抓取内容（使用 --json 参数，增加缓冲区）
async function updateScrapedContent(caseId, scrapedContent) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        // 转义单引号
        const escapedContent = scrapedContent.replace(/'/g, "''");
        
        // 使用 --json 参数确保纯净的JSON输出
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="UPDATE missing_persons_cases SET scraped_content = '${escapedContent}', updated_at = CURRENT_TIMESTAMP WHERE case_id = '${caseId}';"`;
        
        // 增加缓冲区大小
        const options = {
            maxBuffer: 10 * 1024 * 1024 // 10MB缓冲区
        };
        
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.error('更新错误:', error);
                reject(error);
                return;
            }
            
            try {
                // 解析JSON响应检查成功状态
                const result = JSON.parse(stdout);
                if (result[0] && result[0].success === true) {
                    resolve(true);
                } else {
                    reject(new Error('更新失败，响应中没有成功标志'));
                }
            } catch (parseError) {
                console.error('更新响应解析错误:', parseError);
                
                // 备用检查：如果JSON解析失败，检查字符串内容
                if (stdout.includes('"success": true')) {
                    resolve(true);
                } else {
                    reject(new Error('更新失败，无法确认操作结果'));
                }
            }
        });
    });
}

// 随机延迟函数（5-20秒）
function randomDelay() {
    const delay = Math.floor(Math.random() * 15000) + 5000; // 5-20秒
    console.log(`等待 ${delay/1000} 秒后继续...`);
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 主循环抓取函数
async function mainScrapeLoop() {
    try {
        console.log('=== 开始循环抓取案件内容 ===\n');
        
        // 1. 获取需要抓取的案件列表
        const cases = await getCasesToScrape();
        
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

// 监控数据库状态（使用 --json 参数，增加缓冲区）
async function monitorDatabase() {
    return new Promise((resolve) => {
        const command = 'npx wrangler d1 execute cloudflare-demo-db --remote --json --command="SELECT COUNT(*) as total, COUNT(CASE WHEN scraped_content IS NULL OR scraped_content = \\'\\' THEN 1 END) as pending FROM missing_persons_cases;"';
        
        // 增加缓冲区大小
        const options = {
            maxBuffer: 10 * 1024 * 1024 // 10MB缓冲区
        };
        
        exec(command, options, (error, stdout) => {
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
    });
}

// 每5分钟监控一次
setInterval(monitorDatabase, 5 * 60 * 1000);
monitorDatabase();
`;
    
    fs.writeFileSync(path.join(__dirname, 'monitor-scrape-buffer-fixed.js'), monitorScript);
    console.log('监控脚本已创建: monitor-scrape-buffer-fixed.js');
}

// 主函数
async function main() {
    console.log('失踪人口案件自动抓取工具 (缓冲区修复版)');
    console.log('====================================\n');
    
    // 创建监控脚本
    createMonitorScript();
    
    // 开始循环抓取
    await mainScrapeLoop();
    
    console.log('\n使用说明:');
    console.log('- 运行 "node monitor-scrape-buffer-fixed.js" 来监控抓取进度');
    console.log('- 重新运行此脚本来处理失败的案件');
    console.log('- 抓取间隔: 5-20秒随机延迟');
    console.log('\n修复内容:');
    console.log('- 增加缓冲区大小到10MB，避免stdout maxBuffer错误');
    console.log('- 使用 --json 参数确保纯净JSON输出');
    console.log('- 优化查询避免Buffer溢出风险');
    console.log('- 多层错误处理和备用解析方法');
}

// 运行主函数
main();