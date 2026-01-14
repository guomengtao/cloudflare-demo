// 测试直接字符串连接
const taskName = 'webp';
const resultValue = '890';

// 直接构建JSON字符串
const jsonString = '{"task":"' + taskName + '","value":"' + resultValue + '"}';
console.log(jsonString);

// 测试JSON.parse
console.log('解析结果:', JSON.parse(jsonString));