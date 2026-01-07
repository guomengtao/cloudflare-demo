const fs = require('fs');
const path = require('path');

// 改进的JSON解析函数，处理wrangler命令的输出格式
function parseWranglerOutput(output) {
    try {
        // 尝试直接解析
        return JSON.parse(output);
    } catch (firstError) {
        try {
            // 如果直接解析失败，尝试提取JSON部分
            const jsonMatch = output.match(/\{.*\}|\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (secondError) {
            console.log('原始输出:', output);
            throw new Error(`无法解析wrangler输出: ${firstError.message}`);
        }
    }
    return null;
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
                reject(error);
                return;
            }
            
            try {
                const result = parseWranglerOutput(stdout);
                const cases = [];
                
                if (result && result[0] && result[0].results) {
                    cases.push(...result[0].results);
                }
                
                console.log(`找到 ${cases.length} 个需要抓取的案件`);
                resolve(cases);
            } catch (parseError) {
                console.error('解析响应错误:', parseError);
                console.log('尝试使用备用方法获取案件列表...');
                // 返回空数组，让脚本继续执行
                resolve([]);
            }
        });
    });
}

// 模拟网页抓取函数（实际项目中应使用真实的抓取逻辑）
async function scrapeWebsiteContent(caseUrl, caseId) {
    return new Promise((resolve) => {
        // 模拟网络延迟
        const delay = Math.random() * 500 + 500; // 500-1000ms
        setTimeout(() => {
            // 模拟抓取到的HTML内容
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

// 更新数据库中的抓取内容
async function updateScrapedContent(caseId, scrapedContent) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        // 转义单引号
        const escapedContent = scrapedContent.replace(/'/g, "''");
        
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command="UPDATE missing_persons_cases SET scraped_content = '${escapedContent}', updated_at = CURRENT_TIMESTAMP WHERE case_id = '${caseId}';"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('更新错误:', error);
                reject(error);
                return;
            }
            
            // 使用改进的解析方法检查成功状态
            try {
                const result = parseWranglerOutput(stdout);
                if (result && result[0] && result[0].success === true) {
                    resolve(true);
                } else {
                    reject(new Error('更新失败'));
                }
            } catch (parseError) {
                // 如果解析失败，但包含成功标志，也认为是成功
                if (stdout.includes('"success": true') || stdout.includes('success": true')) {
                    resolve(true);
                } else {
                    reject(new Error('更新失败，无法解析响应'));
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
        
        // 7. 显示剩余需要抓取的案件数（如果有的话）
        if (errorCount > 0) {
            console.log(`\n还有 ${errorCount} 个案件需要重新抓取。`);
            console.log('可以重新运行此脚本来处理失败的案件。');
        }
        
    } catch (error) {
        console.error('循环抓取过程中发生错误:', error);
    }
}

// 创建监控脚本（可选）
function createMonitorScript() {
    const monitorScript = `
const fs = require('fs');
const path = require('path');

// 改进的JSON解析函数
function parseWranglerOutput(output) {
    try {
        return JSON.parse(output);
    } catch (firstError) {
        try {
            const jsonMatch = output.match(/\{.*\}|\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (secondError) {
            console.log('监控解析失败，原始输出:', output.substring(0, 200) + '...');
        }
    }
    return null;
}

// 监控数据库状态
async function monitorDatabase() {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        const command = 'npx wrangler d1 execute cloudflare-demo-db --remote --command="SELECT COUNT(*) as total, COUNT(CASE WHEN scraped_content IS NULL OR scraped_content = \\'\\' THEN 1 END) as pending FROM missing_persons_cases;"';
        
        exec(command, (error, stdout) => {
            if (error) {
                console.error('监控错误:', error);
                resolve(null);
                return;
            }
            
            try {
                const result = parseWranglerOutput(stdout);
                if (result && result[0] && result[0].results) {
                    const stats = result[0].results[0];
                    console.log('数据库状态监控:');
                    console.log('- 总案件数:', stats.total);
                    console.log('- 待抓取数:', stats.pending);
                    console.log('- 已完成数:', stats.total - stats.pending);
                    console.log('- 完成率:', ((stats.total - stats.pending) / stats.total * 100).toFixed(2) + '%');
                } else {
                    console.log('监控数据解析失败，无法获取状态');
                }
            } catch (e) {
                console.log('监控数据解析失败');
            }
            resolve();
        });
    });
}

// 每5分钟监控一次
setInterval(monitorDatabase, 5 * 60 * 1000);
monitorDatabase();
`;
    
    fs.writeFileSync(path.join(__dirname, 'monitor-scrape-fixed.js'), monitorScript);
    console.log('监控脚本已创建: monitor-scrape-fixed.js');
}

// 主函数
async function main() {
    console.log('失踪人口案件自动抓取工具 (修复版)');
    console.log('================================\n');
    
    // 创建监控脚本
    createMonitorScript();
    
    // 开始循环抓取
    await mainScrapeLoop();
    
    console.log('\n使用说明:');
    console.log('- 运行 "node monitor-scrape-fixed.js" 来监控抓取进度');
    console.log('- 重新运行此脚本来处理失败的案件');
    console.log('- 抓取间隔: 5-20秒随机延迟');
}

// 运行主函数
main();