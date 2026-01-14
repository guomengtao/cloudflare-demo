// 使用ASCII码构建JSON字符串
let jsonStr = '';
jsonStr += '{';
jsonStr += '"task":"webp"';
jsonStr += ',';
jsonStr += '"value":123';
jsonStr += '}';

// 输出到控制台
console.log('输出到控制台:');
console.log(jsonStr);

// 写入文件
const fs = require('fs');
fs.writeFileSync('test-ascii-output.json', jsonStr);
console.log('\n写入文件后读取:');
console.log(fs.readFileSync('test-ascii-output.json', 'utf8'));