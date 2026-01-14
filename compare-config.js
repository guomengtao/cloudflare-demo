require('dotenv').config();

// 只使用环境变量配置
const envConfig = {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    bucketName: process.env.B2_BUCKET_NAME
};

// 验证配置完整性
if (!envConfig.accessKeyId || !envConfig.secretAccessKey || !envConfig.endpoint || !envConfig.region || !envConfig.bucketName) {
    console.error('❌ 环境变量配置不完整，请检查.env文件');
    process.exit(1);
}

console.log('🔍 配置比较:');
console.log('='.repeat(50));

console.log('\n🔑 Access Key ID:');
console.log('   直接配置:', directConfig.accessKeyId);
console.log('   环境变量:', envConfig.accessKeyId);
console.log('   匹配:', directConfig.accessKeyId === envConfig.accessKeyId);

console.log('\n🔑 Secret Access Key:');
console.log('   直接配置长度:', directConfig.secretAccessKey.length);
console.log('   环境变量长度:', envConfig.secretAccessKey ? envConfig.secretAccessKey.length : '未设置');
console.log('   最后4位匹配:', directConfig.secretAccessKey.slice(-4) === (envConfig.secretAccessKey ? envConfig.secretAccessKey.slice(-4) : ''));
console.log('   完整匹配:', directConfig.secretAccessKey === envConfig.secretAccessKey);

console.log('\n🌐 Endpoint:');
console.log('   直接配置:', directConfig.endpoint);
console.log('   环境变量:', envConfig.endpoint);
console.log('   匹配:', directConfig.endpoint === envConfig.endpoint);

console.log('\n🌍 Region:');
console.log('   直接配置:', directConfig.region);
console.log('   环境变量:', envConfig.region);
console.log('   匹配:', directConfig.region === envConfig.region);

console.log('\n📦 Bucket Name:');
console.log('   直接配置:', directConfig.bucketName);
console.log('   环境变量:', envConfig.bucketName);
console.log('   匹配:', directConfig.bucketName === envConfig.bucketName);

// 检查是否有空格或其他问题
console.log('\n🔍 环境变量质量检查:');
for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('B2_')) {
        console.log(`   ${key}: ${value}`);
        if (value && (value.startsWith(' ') || value.endsWith(' '))) {
            console.log(`      ⚠️  警告: 包含前后空格!`);
        }
    }
}