// 将JSON写入文件
const fs = require('fs');

// 测试内容
const testContent = '{"task":"webp","value":123}';

// 写入文件
fs.writeFileSync('test-output.json', testContent);
console.log('文件已写入，请检查test-output.json的内容');