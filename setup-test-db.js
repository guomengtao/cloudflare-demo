// 创建测试数据库表并插入测试数据
const { execSync } = require('child_process');
const fs = require('fs');

// 创建表
const createTableSql = `CREATE TABLE IF NOT EXISTS missing_persons_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT UNIQUE,
    case_url TEXT,
    images_json TEXT,
    missing_state TEXT,
    missing_county TEXT,
    missing_city TEXT,
    image_count INTEGER DEFAULT 0,
    image_webp_status INTEGER DEFAULT 0,
    html_status INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

// 插入测试数据
const insertTestDataSql = `INSERT INTO missing_persons_info (
    case_id, case_url, images_json, missing_state, missing_county, missing_city, image_count, image_webp_status, html_status
) VALUES (
    'test-case-1', 
    'https://example.com/cases/test-case-1', 
    '["https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Cat03.jpg/440px-Cat03.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Cat_poster_1.jpg/440px-Cat_poster_1.jpg"]', 
    'California', 
    'Los Angeles County', 
    'Los Angeles', 
    2, 
    0, 
    200
);`;

// 使用临时文件执行SQL
function executeSqlFile(sql, description) {
    try {
        const tempFileName = `temp_${Date.now()}.sql`;
        fs.writeFileSync(tempFileName, sql);
        
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --file="${tempFileName}"`;
        const output = execSync(command, { encoding: 'utf8' });
        
        fs.unlinkSync(tempFileName);
        
        // 解析输出，只取JSON部分
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        } else {
            console.error('无法解析命令输出:', output);
            process.exit(1);
        }
    } catch (error) {
        console.error(`${description}失败:`, error.message);
        if (error.stdout) console.error('标准输出:', error.stdout);
        if (error.stderr) console.error('标准错误:', error.stderr);
        process.exit(1);
    }
}

// 执行创建表命令
console.log('创建表...');
const createResult = executeSqlFile(createTableSql, '创建表');
console.log('表创建成功:', createResult[0]?.success || true);

// 执行插入测试数据命令
console.log('插入测试数据...');
const insertResult = executeSqlFile(insertTestDataSql, '插入测试数据');
console.log('测试数据插入成功:', insertResult[0]?.success || true);

// 验证数据
console.log('验证数据...');
const selectSql = `SELECT * FROM missing_persons_info`;
const selectResult = executeSqlFile(selectSql, '验证数据');
if (selectResult[0]?.success && selectResult[0]?.results && selectResult[0]?.results.length > 0) {
    console.log('数据验证成功，共', selectResult[0].results.length, '条记录');
    console.log('第一条记录:', JSON.stringify(selectResult[0].results[0], null, 2));
} else {
    console.error('数据验证失败');
}

console.log('✅ 测试数据库设置完成！');