const fs = require('fs');

// 从原始JSON文件读取数据
const rawData = fs.readFileSync('/Users/Banner/Documents/tom/ai-model-cf.html', 'utf8');
const data = JSON.parse(rawData);

// 提取所有模型名称
const modelNames = data.result.map(model => model.name).sort();

// 输出所有模型名称
console.log('85个AI模型名称列表：');
modelNames.forEach((model, index) => {
    console.log(`${index + 1}. ${model}`);
});

console.log(`\n总计：${modelNames.length}个模型`);