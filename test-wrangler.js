// 直接测试wrangler命令行工具
console.log('=== 直接测试wrangler命令行工具 ===');

const { execSync } = require('child_process');

// 测试1: 使用简单的SELECT查询
console.log('\n1. 测试简单的SELECT查询:');
try {
  const cmd1 = "npx wrangler d1 execute cloudflare-demo-db --command 'SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1' --json";
  console.log('执行命令:', cmd1);
  const result1 = execSync(cmd1, { encoding: 'utf8' });
  console.log('结果:', result1);
} catch (error) {
  console.error('错误:', error.message);
}

// 测试2: 使用双引号包裹查询
console.log('\n2. 测试使用双引号包裹查询:');
try {
  const cmd2 = 'npx wrangler d1 execute cloudflare-demo-db --command "SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1" --json';
  console.log('执行命令:', cmd2);
  const result2 = execSync(cmd2, { encoding: 'utf8' });
  console.log('结果:', result2);
} catch (error) {
  console.error('错误:', error.message);
}

// 测试3: 使用--command-file参数
console.log('\n3. 测试使用--command-file参数:');
try {
  // 写入SQL文件
  const sqlContent = "SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1";
  require('fs').writeFileSync('test-query.sql', sqlContent);
  
  const cmd3 = "npx wrangler d1 execute cloudflare-demo-db --command-file test-query.sql --json";
  console.log('执行命令:', cmd3);
  const result3 = execSync(cmd3, { encoding: 'utf8' });
  console.log('结果:', result3);
} catch (error) {
  console.error('错误:', error.message);
}

// 测试4: 不使用--json参数
console.log('\n4. 测试不使用--json参数:');
try {
  const cmd4 = "npx wrangler d1 execute cloudflare-demo-db --command 'SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1'";
  console.log('执行命令:', cmd4);
  const result4 = execSync(cmd4, { encoding: 'utf8' });
  console.log('结果:', result4);
} catch (error) {
  console.error('错误:', error.message);
}