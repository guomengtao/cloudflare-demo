const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🔍 测试 Backblaze B2 应用密钥权限');

// 检查环境变量
const requiredVars = ['B2_ACCESS_KEY_ID', 'B2_SECRET_ACCESS_KEY', 'B2_BUCKET_NAME', 'B2_ENDPOINT'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ 缺少环境变量:', missingVars.join(', '));
    process.exit(1);
}

console.log('✅ 环境变量检查通过');
console.log('🔑 Key ID:', process.env.B2_ACCESS_KEY_ID);
console.log('📦 Bucket:', process.env.B2_BUCKET_NAME);

// 配置 S3 客户端
const s3 = new AWS.S3({
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    endpoint: process.env.B2_ENDPOINT,
    s3ForcePathStyle: true,
    signatureVersion: 'v4'
});

async function testPermissions() {
    try {
        console.log('\n🔍 测试存储桶列表权限...');
        
        // 测试列出存储桶
        const buckets = await s3.listBuckets().promise();
        console.log('✅ 存储桶列表权限正常');
        console.log('📋 可访问的存储桶:', buckets.Buckets.map(b => b.Name).join(', '));
        
        // 测试特定存储桶访问
        console.log('\n🔍 测试存储桶访问权限...');
        const bucketParams = {
            Bucket: process.env.B2_BUCKET_NAME
        };
        
        const objects = await s3.listObjectsV2(bucketParams).promise();
        console.log('✅ 存储桶访问权限正常');
        console.log(`📁 存储桶中有 ${objects.KeyCount || 0} 个对象`);
        
        // 测试写入权限
        console.log('\n🔍 测试写入权限...');
        const testKey = `test-permission-${Date.now()}.txt`;
        const uploadParams = {
            Bucket: process.env.B2_BUCKET_NAME,
            Key: testKey,
            Body: '测试权限文件',
            ContentType: 'text/plain'
        };
        
        await s3.putObject(uploadParams).promise();
        console.log('✅ 写入权限正常');
        
        // 测试删除权限
        console.log('\n🔍 测试删除权限...');
        const deleteParams = {
            Bucket: process.env.B2_BUCKET_NAME,
            Key: testKey
        };
        
        await s3.deleteObject(deleteParams).promise();
        console.log('✅ 删除权限正常');
        
        console.log('\n🎉 所有权限测试通过！应用密钥配置正确。');
        console.log('💡 现在可以开始上传失踪人口图片了！');
        
    } catch (error) {
        console.error('\n❌ 权限测试失败:', error.message);
        
        if (error.code === 'AccessDenied') {
            console.log('🔧 权限不足，请检查应用密钥配置:');
            console.log('   1. 确保应用密钥有 "Allow List All Bucket Names" 权限');
            console.log('   2. 确保应用密钥有 "Allow Write" 权限');
            console.log('   3. 确保应用密钥有 "Allow Delete" 权限');
            console.log('   4. 确保应用密钥关联到正确的存储桶');
        } else if (error.code === 'SignatureDoesNotMatch') {
            console.log('🔧 签名不匹配，请检查:');
            console.log('   1. B2_ACCESS_KEY_ID 和 B2_SECRET_ACCESS_KEY 是否正确');
            console.log('   2. 密钥是否包含特殊字符需要正确转义');
        }
        
        process.exit(1);
    }
}

testPermissions();