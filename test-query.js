// 测试脚本中的SQL查询
const { execSync } = require('child_process');

// 测试查询1: 统计符合条件的案件总数
console.log('=== 测试查询1: 统计符合条件的案件总数 ===');
try {
    const sql1 = "SELECT COUNT(*) as total_cases FROM missing_persons_info WHERE image_webp_status = 0 AND html_status = 200";
    const command1 = `npx wrangler d1 execute cloudflare-demo-db --command "${sql1}" --json`;
    console.log('执行命令:', command1);
    const output1 = execSync(command1, { encoding: 'utf8' });
    const result1 = JSON.parse(output1)[0];
    console.log('结果:', JSON.stringify(result1, null, 2));
} catch (error) {
    console.error('错误:', error.message);
}

// 测试查询2: 获取符合条件的案件
console.log('\n=== 测试查询2: 获取符合条件的案件 ===');
try {
    const sql2 = "SELECT id, case_id, case_url, images_json, missing_state, missing_county, missing_city, image_count FROM missing_persons_info WHERE image_webp_status = 0 AND html_status = 200 ORDER BY id LIMIT 1";
    const command2 = `npx wrangler d1 execute cloudflare-demo-db --command "${sql2}" --json`;
    console.log('执行命令:', command2);
    const output2 = execSync(command2, { encoding: 'utf8' });
    const result2 = JSON.parse(output2)[0];
    console.log('结果:', JSON.stringify(result2, null, 2));
} catch (error) {
    console.error('错误:', error.message);
}