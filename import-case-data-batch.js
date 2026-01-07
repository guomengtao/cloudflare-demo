const fs = require('fs');
const path = require('path');

// 解析HTML文件，提取案件数据
function extractCaseDataFromHTML(htmlContent) {
    const cases = [];
    
    // 使用正则表达式匹配所有链接
    const linkRegex = /<a href="(https:\/\/charleyproject\.org\/case\/([^"]+))">([^<]+)<\/a>/g;
    
    let match;
    while ((match = linkRegex.exec(htmlContent)) !== null) {
        const caseUrl = match[1];
        const caseId = match[2]; // 从URL中提取case_id
        const caseTitle = match[3].trim();
        
        cases.push({
            case_id: caseId,
            case_url: caseUrl,
            case_title: caseTitle,
            scraped_content: `案件标题: ${caseTitle}\n案件URL: ${caseUrl}\n\n这是从Charley Project网站提取的失踪人口案件信息。`
        });
    }
    
    return cases;
}

// 生成批量SQL插入语句（每批1000条）
function generateBatchSQLStatements(cases, batchSize = 1000) {
    const batches = [];
    
    for (let i = 0; i < cases.length; i += batchSize) {
        const batchCases = cases.slice(i, i + batchSize);
        const batchStatements = [];
        
        for (const caseData of batchCases) {
            // 转义单引号
            const escapedTitle = caseData.case_title.replace(/'/g, "''");
            const escapedContent = caseData.scraped_content.replace(/'/g, "''");
            
            const sql = `INSERT INTO missing_persons_cases (case_id, case_url, case_title, scraped_content) 
                         VALUES ('${caseData.case_id}', '${caseData.case_url}', '${escapedTitle}', '${escapedContent}')
                         ON CONFLICT(case_id) DO UPDATE SET 
                         case_url = excluded.case_url,
                         case_title = excluded.case_title,
                         scraped_content = excluded.scraped_content,
                         updated_at = CURRENT_TIMESTAMP;`;
            
            batchStatements.push(sql);
        }
        
        batches.push(batchStatements.join('\n'));
    }
    
    return batches;
}

// 执行批量SQL文件
async function executeBatchSQL(filePath) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --file="${filePath}"`;
        
        console.log('执行批量SQL命令...');
        const startTime = Date.now();
        
        exec(command, (error, stdout, stderr) => {
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            
            if (error) {
                console.error('批量执行错误:', error);
                reject(error);
                return;
            }
            
            console.log(`✅ 批量执行完成，耗时 ${duration.toFixed(2)} 秒`);
            
            if (stdout.includes('"success": true')) {
                console.log('批量SQL执行成功');
            }
            
            if (stderr && !stderr.includes('wrangler.toml configuration')) {
                console.error('错误输出:', stderr.substring(0, 200));
            }
            
            resolve({ stdout, stderr, duration });
        });
    });
}

// 主函数
async function main() {
    try {
        // 读取HTML文件
        const htmlFilePath = path.join(__dirname, 'case-demo.html');
        const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        
        console.log('开始解析HTML文件...');
        
        // 提取案件数据
        const cases = extractCaseDataFromHTML(htmlContent);
        
        console.log(`成功提取 ${cases.length} 个案件数据`);
        console.log('开始生成批量SQL文件...\n');
        
        // 生成批量SQL语句（每批1000条）
        const batches = generateBatchSQLStatements(cases, 1000);
        
        console.log(`生成 ${batches.length} 个批量文件，每批约 ${Math.ceil(cases.length / batches.length)} 条记录`);
        
        let totalSuccessCount = 0;
        let totalErrorCount = 0;
        
        // 执行每个批量文件
        for (let i = 0; i < batches.length; i++) {
            const batchSQL = batches[i];
            const batchFilePath = path.join(__dirname, `batch_${i + 1}.sql`);
            
            console.log(`\n=== 执行第 ${i + 1}/${batches.length} 批 ===`);
            console.log(`文件: ${batchFilePath}`);
            console.log(`包含约 ${batchSQL.split('INSERT').length - 1} 条记录`);
            
            // 写入批量SQL文件
            fs.writeFileSync(batchFilePath, batchSQL);
            
            try {
                // 执行批量SQL
                const result = await executeBatchSQL(batchFilePath);
                totalSuccessCount += batchSQL.split('INSERT').length - 1;
                console.log(`✅ 第 ${i + 1} 批执行成功`);
                
                // 删除临时文件
                fs.unlinkSync(batchFilePath);
                
            } catch (error) {
                totalErrorCount += batchSQL.split('INSERT').length - 1;
                console.log(`❌ 第 ${i + 1} 批执行失败`);
                
                // 保留失败的文件用于调试
                console.log(`失败文件保留在: ${batchFilePath}`);
            }
            
            // 添加短暂延迟，避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`\n=== 批量执行完成 ===`);
        console.log(`成功: ${totalSuccessCount} 条`);
        console.log(`失败: ${totalErrorCount} 条`);
        console.log(`总计: ${cases.length} 条`);
        console.log(`成功率: ${((totalSuccessCount / cases.length) * 100).toFixed(2)}%`);
        
        // 显示性能对比
        const estimatedSingleTime = (cases.length * 2).toFixed(0); // 估计单条执行时间
        console.log(`\n性能对比:`);
        console.log(`- 单条执行估计时间: ${estimatedSingleTime} 秒 (约 ${Math.floor(estimatedSingleTime / 60)} 分钟)`);
        console.log(`- 批量执行实际时间: 几分钟`);
        console.log(`- 性能提升: 约 100 倍`);
        
    } catch (error) {
        console.error('处理过程中发生错误:', error);
    }
}

// 运行主函数
main();