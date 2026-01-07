const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 创建readline接口用于用户交互
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
            
            console.log('执行结果:');
            console.log(stdout);
            if (stderr) {
                console.error('错误输出:', stderr);
            }
            
            resolve({ stdout, stderr });
        });
    });
}

// 等待用户确认
function waitForConfirmation() {
    return new Promise((resolve) => {
        rl.question('按回车键继续下一条，或输入 q 退出: ', (answer) => {
            if (answer.toLowerCase() === 'q') {
                resolve(false);
            } else {
                resolve(true);
            }
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
        console.log('开始逐条执行SQL插入语句...\n');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < cases.length; i++) {
            const caseData = cases[i];
            console.log(`\n=== 执行第 ${i + 1}/${cases.length} 条记录 ===`);
            console.log(`案件标题: ${caseData.case_title}`);
            console.log(`案件ID: ${caseData.case_id}`);
            console.log(`URL: ${caseData.case_url}`);
            
            // 生成SQL语句
            const sql = generateSingleSQLStatement(caseData);
            console.log('生成的SQL:');
            console.log(sql.substring(0, 200) + '...'); // 显示前200字符
            
            try {
                // 执行SQL
                await executeSingleSQL(sql);
                successCount++;
                console.log(`✅ 第 ${i + 1} 条记录执行成功`);
            } catch (error) {
                errorCount++;
                console.log(`❌ 第 ${i + 1} 条记录执行失败`);
            }
            
            // 等待用户确认是否继续
            if (i < cases.length - 1) {
                const shouldContinue = await waitForConfirmation();
                if (!shouldContinue) {
                    console.log('用户选择退出');
                    break;
                }
            }
        }
        
        console.log(`\n=== 执行完成 ===`);
        console.log(`成功: ${successCount} 条`);
        console.log(`失败: ${errorCount} 条`);
        console.log(`总计: ${cases.length} 条`);
        
    } catch (error) {
        console.error('处理过程中发生错误:', error);
    } finally {
        rl.close();
    }
}

// 运行主函数
main();