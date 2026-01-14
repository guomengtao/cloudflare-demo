// 测试SQL查询字符串是否正确 - 使用不同的引号转义
const { execSync } = require('child_process');

// 定义查询
const query = "SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1";

// 方法1：使用反斜杠转义双引号
const command1 = `npx wrangler d1 execute cloudflare-demo-db --command \"${query}\" --json`;
console.log('方法1:', command1);

// 方法2：使用单引号包裹整个命令
const command2 = `npx wrangler d1 execute cloudflare-demo-db --command '${query}' --json`;
console.log('方法2:', command2);

// 方法3：使用模板字符串的替代方式
const command3 = "npx wrangler d1 execute cloudflare-demo-db --command \"" + query + "\" --json";
console.log('方法3:', command3);

// 尝试方法2（最安全）
try {
    console.log('\n尝试执行方法2...');
    const output = execSync(command2, { encoding: 'utf8', stdio: 'pipe' });
    console.log('输出:', output);
} catch (error) {
    console.error('错误:', error.message);
}