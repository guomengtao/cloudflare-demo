// 检查环境变量设置
require('dotenv').config();

console.log('=== 环境变量检查 ===');
console.log('NODE_ENV:', process.env.NODE_ENV || '未设置');
console.log('GEMINI_API_KEY 是否设置:', process.env.GEMINI_API_KEY ? '✅ 已设置' : '❌ 未设置');

if (process.env.GEMINI_API_KEY) {
    console.log('密钥长度:', process.env.GEMINI_API_KEY.length);
    console.log('密钥格式验证:', /^AIza[0-9A-Za-z-_]{35}$/.test(process.env.GEMINI_API_KEY) ? '✅ 格式正确' : '❌ 格式错误');
} else {
    console.log('请检查 .env 文件是否包含 GEMINI_API_KEY');
}