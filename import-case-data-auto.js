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

// 生成单条SQL插入语句
function generateSingleSQLStatement(caseData) {
    // 转义单引号
    const escapedTitle = caseData.case_title.replace(/'/g, "''");
    const escapedContent = caseData.scraped_content.replace(/'/g, "''");
    
    return `INSERT INTO missing_persons_cases (case_id, case_url, case_title, scraped_content) 
            VALUES ('${caseData.case_id}', '${caseData.case_url}', '${escapedTitle}', '${escapedContent}')
            ON CONFLICT(case_id) DO UPDATE SET 
            case_url = excluded.case_url,
            case_title = excluded.case_title,
            scraped_content = excluded.scraped_content,
            updated_at = CURRENT_TIMESTAMP;`;
}

// 执行单条SQL语句
async function executeSingleSQL(sql) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --command="${sql.replace(/"/g, '\\"')}"`;
        
        console.log('执行SQL命令...');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('执行错误:', error);
                reject(error);
                return;
            }
            
            // 简化输出，只显示关键信息
            if (stdout.includes('"success": true')) {
                console.log('✅ SQL执行成功');
            } else {
                console.log('执行结果:', stdout.substring(0, 200));
            }
            
            if (stderr && !stderr.includes('wrangler.toml configuration')) {
                console.error('错误输出:', stderr.substring(0, 200));
            }
            
            resolve({ stdout, stderr });
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
        console.log('开始自动连续执行SQL插入语句...\n');
        console.log('跳过前3条已执行的记录，从第4条开始...\n');
        
        let successCount = 3; // 从第4条开始，前3条已成功
        let errorCount = 0;
        
        // 从第4条记录开始执行（索引3）
        for (let i = 3; i < cases.length; i++) {
            const caseData = cases[i];
            console.log(`\n=== 执行第 ${i + 1}/${cases.length} 条记录 ===`);
            console.log(`案件标题: ${caseData.case_title}`);
            console.log(`案件ID: ${caseData.case_id}`);
            console.log(`URL: ${caseData.case_url}`);
            
            // 生成SQL语句
            const sql = generateSingleSQLStatement(caseData);
            console.log('生成的SQL:');
            console.log(sql.substring(0, 150) + '...'); // 显示前150字符
            
            try {
                // 执行SQL
                await executeSingleSQL(sql);
                successCount++;
                console.log(`✅ 第 ${i + 1} 条记录执行成功`);
                
                // 添加短暂延迟，避免请求过快
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                errorCount++;
                console.log(`❌ 第 ${i + 1} 条记录执行失败`);
                
                // 错误时也添加延迟
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`\n=== 执行完成 ===`);
        console.log(`成功: ${successCount} 条`);
        console.log(`失败: ${errorCount} 条`);
        console.log(`总计: ${cases.length} 条`);
        
        // 显示统计信息
        console.log(`\n统计信息:`);
        console.log(`- 跳过前3条已执行记录`);
        console.log(`- 本次执行: ${cases.length - 3} 条`);
        console.log(`- 成功率: ${((successCount / cases.length) * 100).toFixed(2)}%`);
        
    } catch (error) {
        console.error('处理过程中发生错误:', error);
    }
}

// 运行主函数
main();