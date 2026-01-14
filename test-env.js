// 测试dotenv是否能正确读取.env文件
const dotenv = require('dotenv');
console.log('Before dotenv.config():', process.env.TASK_WEBP);
dotenv.config();
console.log('After dotenv.config():', process.env.TASK_WEBP);
console.log('Complete process.env:', JSON.stringify(process.env, null, 2));