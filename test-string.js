// 测试字符串的二进制表示
const sqlWithCommas = "SELECT id, case_id, case_url FROM missing_persons_info LIMIT 1";
const sqlWithoutCommas = "SELECT id case_id case_url FROM missing_persons_info LIMIT 1";

console.log('=== 字符串分析 ===');
console.log('带逗号的SQL:', sqlWithCommas);
console.log('不带逗号的SQL:', sqlWithoutCommas);

console.log('\n=== 长度比较 ===');
console.log('带逗号的长度:', sqlWithCommas.length);
console.log('不带逗号的长度:', sqlWithoutCommas.length);

console.log('\n=== 字符逐字分析（带逗号） ===');
for (let i = 0; i < sqlWithCommas.length; i++) {
    const char = sqlWithCommas[i];
    const code = char.charCodeAt(0);
    console.log(`${i}: ${char} (${code})`);
}

console.log('\n=== 字符逐字分析（不带逗号） ===');
for (let i = 0; i < sqlWithoutCommas.length; i++) {
    const char = sqlWithoutCommas[i];
    const code = char.charCodeAt(0);
    console.log(`${i}: ${char} (${code})`);
}