require('dotenv').config();
const AWS = require('aws-sdk');

console.log('🚀 直接测试 Backblaze B2 连接');
console.log('='.repeat(50));

// 从环境变量获取配置
const config = {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    endpoint: process.env.B2_ENDPOINT,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    region: process.env.B2_REGION,
    bucketName: process.env.B2_BUCKET_NAME
};

// 验证配置完整性
if (!config.accessKeyId || !config.secretAccessKey || !config.endpoint || !config.region || !config.bucketName) {
    console.error('❌ 配置不完整，请检查.env文件中的B2配置项');
    process.exit(1);
}

console.log('\n📋 配置信息:');
console.log('   Key ID:', config.accessKeyId);
console.log('   Secret Key:', config.secretAccessKey ? '***' + config.secretAccessKey.slice(-4) : '未设置');
console.log('   端点:', config.endpoint);
console.log('   区域:', config.region);
console.log('   存储桶:', config.bucketName);

// 创建 S3 客户端
const s3 = new AWS.S3({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    endpoint: config.endpoint,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    region: config.region
});

async function testConnection() {
    try {
        console.log('\n🔍 测试存储桶内容...');
        
        // 列出存储桶内容
        const data = await s3.listObjectsV2({
            Bucket: config.bucketName,
            MaxKeys: 10
        }).promise();
        
        console.log('✅ 连接成功！');
        console.log('   文件数量:', data.KeyCount || 0);
        
        if (data.Contents && data.Contents.length > 0) {
            console.log('   文件列表:');
            data.Contents.forEach(file => {
                console.log(`     - ${file.Key} (${(file.Size / 1024).toFixed(2)} KB)`);
            });
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ 连接失败:', error.message);
        console.error('   错误代码:', error.code);
        console.error('   状态码:', error.statusCode);
        
        if (error.code === 'SignatureDoesNotMatch') {
            console.log('\n💡 签名不匹配的可能原因:');
            console.log('   1. 应用密钥权限不足');
            console.log('   2. 存储桶名称错误');
            console.log('   3. 端点地址错误');
            console.log('   4. 密钥格式错误');
        }
        
        return false;
    }
}

async function testUpload() {
    try {
        console.log('\n🚀 测试上传功能...');
        
        const testKey = `direct-test-${Date.now()}.txt`;
        
        await s3.putObject({
            Bucket: config.bucketName,
            Key: testKey,
            Body: '直接测试文件',
            ContentType: 'text/plain'
        }).promise();
        
        console.log('✅ 上传成功！');
        
        // 清理测试文件
        await s3.deleteObject({
            Bucket: config.bucketName,
            Key: testKey
        }).promise();
        
        console.log('✅ 删除成功！');
        
        return true;
        
    } catch (error) {
        console.error('❌ 上传测试失败:', error.message);
        return false;
    }
}

// 运行测试
testConnection().then(success => {
    if (success) {
        console.log('\n🎉 连接测试通过！');
        return testUpload();
    }
}).then(uploadSuccess => {
    if (uploadSuccess) {
        console.log('\n🎆 所有测试都通过了！');
        console.log('💡 系统已经准备好上传图片了！');
    } else {
        console.log('\n🔧 上传测试失败，需要检查权限配置。');
    }
}).catch(console.error);