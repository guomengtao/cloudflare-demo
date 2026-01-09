const fs = require('fs');
const path = require('path');

// 读取HTML报告文件
const reportPath = path.join(__dirname, 'ai-models-report.html');
const htmlContent = fs.readFileSync(reportPath, 'utf8');

// 提取所有模型名称
const modelRegex = /@cf\/[\w-]+\/[\w.-]+/g;
const modelNames = htmlContent.match(modelRegex);

// 去重并排序
const uniqueModelNames = [...new Set(modelNames)].sort();

// 输出所有模型名称
console.log('85个AI模型名称列表：');
uniqueModelNames.forEach((model, index) => {
    console.log(`${index + 1}. ${model}`);
});

console.log(`\n总计：${uniqueModelNames.length}个模型`);