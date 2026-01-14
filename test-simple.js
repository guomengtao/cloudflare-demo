// 测试SQL字符串中的逗号是否会消失
console.log('=== 测试SQL字符串中的逗号 ===');

// 定义一个带逗号的SQL字符串
const sql = "SELECT id, case_id, case_url, images_json FROM missing_persons_info LIMIT 1";

// 直接打印
console.log('1. 直接打印:', sql);

// 转换为数组再合并
const sqlArray = [
  "SELECT id,",
  "case_id,",
  "case_url,",
  "images_json",
  "FROM missing_persons_info LIMIT 1"
];
const sqlFromArray = sqlArray.join(' ');
console.log('2. 数组合并:', sqlFromArray);

// 检查字符串长度
console.log('3. 字符串长度:', sql.length);

// 检查字符编码
console.log('4. 字符分析:');
for (let i = 0; i < sql.length; i++) {
  const char = sql[i];
  const code = char.charCodeAt(0);
  if (char === ' ' || char === ',') {
    console.log(`   位置 ${i}: '${char}' (ASCII: ${code})`);
  }
}

// 检查是否包含逗号
console.log('5. 是否包含逗号:', sql.includes(','));
console.log('6. 逗号数量:', (sql.match(/,/g) || []).length);