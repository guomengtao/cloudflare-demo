require('dotenv').config();

console.log('🔍 直接检查环境变量:');
console.log('='.repeat(50));

console.log('B2_ACCESS_KEY_ID:', process.env.B2_ACCESS_KEY_ID);
console.log('B2_SECRET_ACCESS_KEY:', process.env.B2_SECRET_ACCESS_KEY);
console.log('B2_SECRET_ACCESS_KEY 长度:', process.env.B2_SECRET_ACCESS_KEY ? process.env.B2_SECRET_ACCESS_KEY.length : '未设置');
console.log('B2_BUCKET_NAME:', process.env.B2_BUCKET_NAME);
console.log('B2_ENDPOINT:', process.env.B2_ENDPOINT);
console.log('B2_REGION:', process.env.B2_REGION);

console.log('\n🔧 检查完整配置:');
console.log('所有 B2 环境变量:');
for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('B2_')) {
        console.log(`${key}: ${value}`);
    }
}