// 测试SQL查询字符串是否正确
const { execSync } = require('child_process');

// 测试查询
const sql = "SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1";

// 直接输出SQL
console.log('原始SQL:', sql);

// 执行命令
const command = `npx wrangler d1 execute cloudflare-demo-db --command "${sql}" --json`;
console.log('执行的命令:', command);

// 尝试执行
/*
try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log('输出:', output);
} catch (error) {
    console.error('错误:', error.message);
}
*/