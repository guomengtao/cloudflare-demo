// 详细检查环境变量
require('dotenv').config();

console.log('🔍 详细环境变量检查');

const requiredVars = [
    'B2_ACCESS_KEY_ID',
    'B2_SECRET_ACCESS_KEY',
    'B2_BUCKET_NAME',
    'B2_ENDPOINT',
    'B2_REGION'
];

requiredVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`${varName}:`);
    console.log(`   值: "${value}"`);
    console.log(`   类型: ${typeof value}`);
    console.log(`   长度: ${value ? value.length : 0}`);
    
    if (value && (value.startsWith(' ') || value.endsWith(' '))) {
        console.log(`   ⚠️  包含前后空格!`);
    }
    
    if (value && value.includes('\n') || value.includes('\r')) {
        console.log(`   ⚠️  包含换行符!`);
    }
    
    console.log('');
});

// 验证环境变量配置
console.log('📋 验证环境变量配置:');
const envConfig = {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    bucketName: process.env.B2_BUCKET_NAME
};

// 检查配置完整性
console.log('\n🔍 配置完整性检查:');
console.log('访问密钥ID:', envConfig.accessKeyId ? '✅ 已设置' : '❌ 未设置');
console.log('密钥:', envConfig.secretAccessKey ? '✅ 已设置' : '❌ 未设置');
console.log('端点:', envConfig.endpoint ? '✅ 已设置' : '❌ 未设置');
console.log('区域:', envConfig.region ? '✅ 已设置' : '❌ 未设置');
console.log('存储桶名称:', envConfig.bucketName ? '✅ 已设置' : '❌ 未设置');

// 检查配置格式
if (envConfig.accessKeyId) {
    console.log('访问密钥ID格式:', envConfig.accessKeyId.length >= 20 ? '✅ 格式正确' : '⚠️ 可能格式不正确');
}
if (envConfig.secretAccessKey) {
    console.log('密钥格式:', envConfig.secretAccessKey.length >= 30 ? '✅ 格式正确' : '⚠️ 可能格式不正确');
}