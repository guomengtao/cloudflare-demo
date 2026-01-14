// 调试SQL字符串问题
const sql = "SELECT id, case_id, case_url, images_json FROM missing_persons_info LIMIT 1";

// 直接输出
console.log('原始SQL:', sql);

// 测试是否有特殊字符
for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const code = char.charCodeAt(0);
    if (code !== 32 && code !== 44 && (code < 65 || code > 90) && (code < 97 || code > 122) && (code < 48 || code > 57)) {
        console.log(`特殊字符 at ${i}: ${char} (${code})`);
    }
}

// 测试查询D1的函数
const { execSync } = require('child_process');

function queryD1(sql) {
    const command = `npx wrangler d1 execute cloudflare-demo-db --command "${sql}" --json`;
    console.log('执行的命令:', command);
    return command;
}

// 测试函数
queryD1(sql);