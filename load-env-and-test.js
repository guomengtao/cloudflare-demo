// 自动加载环境变量并测试 Backblaze B2 连接
require('dotenv').config();
const AWS = require('aws-sdk');

console.log('🔍 加载环境变量并测试 Backblaze B2 连接\n');

// 检查必要的环境变量
const requiredEnvVars = ['B2_ACCESS_KEY_ID', 'B2_SECRET_ACCESS_KEY', 'B2_BUCKET_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log('❌ 缺少必要的环境变量:');
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log('\n💡 请检查 .env 文件配置');
    process.exit(1);
}

console.log('✅ 环境变量检查通过');
console.log(`🔑 Key ID: ${process.env.B2_ACCESS_KEY_ID}`);
console.log(`📦 Bucket: ${process.env.B2_BUCKET_NAME}`);
console.log(`🌐 Endpoint: ${process.env.B2_ENDPOINT || 's3.us-east-005.backblazeb2.com'}\n`);

// 配置 S3 客户端
const s3 = new AWS.S3({
    endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    region: process.env.B2_REGION || 'us-east-005',
    s3ForcePathStyle: true
});

async function testConnection() {
    try {
        console.log('🔄 测试存储桶连接...');
        
        // 尝试列出存储桶内容
        const result = await s3.listObjectsV2({
            Bucket: process.env.B2_BUCKET_NAME,
            MaxKeys: 5
        }).promise();
        
        console.log('✅ 存储桶连接成功!');
        console.log(`📊 存储桶中有 ${result.KeyCount || 0} 个文件`);
        
        if (result.Contents && result.Contents.length > 0) {
            console.log('📁 文件列表:');
            result.Contents.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file.Key} (${(file.Size / 1024).toFixed(2)} KB)`);
            });
        } else {
            console.log('📁 存储桶为空，可以开始上传图片');
        }
        
        // 测试上传权限
        console.log('\n🔄 测试上传权限...');
        const testKey = `test-connection-${Date.now()}.txt`;
        
        await s3.putObject({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: testKey,
            Body: 'Backblaze B2 连接测试文件',
            ContentType: 'text/plain'
        }).promise();
        
        console.log('✅ 上传权限测试通过');
        
        // 清理测试文件
        await s3.deleteObject({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: testKey
        }).promise();
        
        console.log('✅ 测试文件清理完成');
        
        console.log('\n🎉 所有测试通过！可以开始上传图片了。');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        
        if (error.code === 'NoSuchBucket') {
            console.log('\n🔧 存储桶不存在，请检查:');
            console.log(`   1. 存储桶名称是否正确: ${process.env.B2_BUCKET_NAME}`);
            console.log('   2. 存储桶是否已创建');
        } else if (error.code === 'InvalidAccessKeyId') {
            console.log('\n🔧 密钥ID错误，请检查 B2_ACCESS_KEY_ID');
        } else if (error.code === 'SignatureDoesNotMatch') {
            console.log('\n🔧 签名不匹配，请检查 B2_SECRET_ACCESS_KEY');
            console.log('💡 请确保使用的是应用密钥，而不是主密钥');
        } else if (error.code === 'AccessDenied') {
            console.log('\n🔧 访问被拒绝，请检查密钥权限');
            console.log('💡 确保应用密钥具有读写权限');
        }
        
        console.log('\n📋 重新配置步骤:');
        console.log('   1. 在 Backblaze 控制台创建新的应用密钥');
        console.log('   2. 更新 .env 文件中的 B2_SECRET_ACCESS_KEY');
        console.log('   3. 重新运行此测试脚本');
    }
}

// 运行测试
testConnection().catch(console.error);