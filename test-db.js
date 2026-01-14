// 极简测试脚本
const { spawnSync } = require('child_process');

// 直接定义SQL查询
const sql = "SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1";

console.log('原始SQL查询:', sql);
console.log('SQL长度:', sql.length);

// 检查字符串中的逗号
for (let i = 0; i < sql.length; i++) {
    if (sql[i] === ',') {
        console.log(`逗号位置: ${i}`);
    }
}

// 执行查询
const args = [
    'wrangler', 'd1', 'execute', 'cloudflare-demo-db',
    '--command', sql,
    '--json'
];

console.log('\n执行命令:', `npx ${args.join(' ')}`);

const result = spawnSync('npx', args, { encoding: 'utf8' });

if (result.error) {
    console.error('执行错误:', result.error);
} else {
    console.log('标准输出:', result.stdout);
    console.log('标准错误:', result.stderr);
}