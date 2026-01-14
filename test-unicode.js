// 测试SQL字符串中的Unicode字符
console.log('=== 测试SQL字符串中的Unicode字符 ===');

// 定义一个带逗号的SQL字符串
const sql1 = "SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1";

// 使用不同方式创建相同的字符串
const sql2 = "SELECT id,", "case_id,", "case_url", "FROM missing_persons_info LIMIT 1".join(' ');

// 直接使用Unicode字符创建逗号
const sql3 = "SELECT id\u002C case_id\u002C case_url FROM missing_persons_info LIMIT 1";

console.log('1. 使用普通逗号:', sql1);
console.log('2. 使用字符串拼接:', sql2);
console.log('3. 使用Unicode转义:', sql3);

// 检查每个字符的详细信息
console.log('\n4. SQL1字符详细信息:');
for (let i = 0; i < sql1.length; i++) {
  const char = sql1[i];
  const code = char.charCodeAt(0);
  const hex = code.toString(16).padStart(4, '0');
  const desc = char === ' ' ? '空格' : char === ',' ? '逗号' : '其他';
  console.log(`   位置 ${i}: '${char}' -> ASCII: ${code} -> Unicode: \\u${hex} -> 描述: ${desc}`);
}

// 检查是否存在不可打印字符
console.log('\n5. 不可打印字符检查:');
for (let i = 0; i < sql1.length; i++) {
  const char = sql1[i];
  const code = char.charCodeAt(0);
  if (code < 32 || (code >= 127 && code < 160)) {
    console.log(`   位置 ${i} 包含不可打印字符: ASCII ${code}, Unicode \\u${code.toString(16).padStart(4, '0')}`);
  }
}

// 尝试将字符串写入文件
const fs = require('fs');
fs.writeFileSync('test-sql.txt', sql1);
console.log('\n6. SQL字符串已写入test-sql.txt文件');