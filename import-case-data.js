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

// 生成SQL插入语句
function generateSQLInsertStatements(cases) {
    const statements = [];
    
    for (const caseData of cases) {
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
        
        statements.push(sql);
    }
    
    return statements;
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
        
        // 生成SQL语句
        const sqlStatements = generateSQLInsertStatements(cases);
        
        // 将SQL语句写入文件
        const sqlFilePath = path.join(__dirname, 'import-cases.sql');
        fs.writeFileSync(sqlFilePath, sqlStatements.join('\n\n'));
        
        console.log(`SQL文件已生成: ${sqlFilePath}`);
        console.log(`包含 ${sqlStatements.length} 条INSERT语句`);
        
        // 显示前5个案件作为示例
        console.log('\n前5个案件示例:');
        cases.slice(0, 5).forEach((caseData, index) => {
            console.log(`${index + 1}. ${caseData.case_title} (${caseData.case_id})`);
        });
        
    } catch (error) {
        console.error('处理过程中发生错误:', error);
    }
}

// 运行主函数
main();