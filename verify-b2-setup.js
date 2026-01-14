// Backblaze B2 设置验证脚本
const AWS = require('aws-sdk');

console.log('🔍 Backblaze B2 设置验证\n');

// 检查环境变量
if (!process.env.B2_SECRET_ACCESS_KEY) {
    console.log('❌ 环境变量 B2_SECRET_ACCESS_KEY 未设置');
    console.log('\n💡 设置方法:');
    console.log('   export B2_SECRET_ACCESS_KEY=您的应用密钥');
    console.log('\n📋 获取密钥步骤:');
    console.log('   1. 访问 https://secure.backblaze.com');
    console.log('   2. 登录后进入 Application Keys');
    console.log('   3. 为存储桶 gudq-missing-assets 创建新密钥');
    console.log('   4. 复制 applicationKey 并设置环境变量');
    process.exit(1);
}

console.log('✅ 环境变量已设置');
console.log('🔑 Key ID: c6790dd2f167');
console.log('🌐 Endpoint: s3.us-east-005.backblazeb2.com');
console.log('📦 Bucket: gudq-missing-assets\n');

// 配置 S3 客户端
const s3 = new AWS.S3({
    endpoint: 'https://s3.us-east-005.backblazeb2.com',
    accessKeyId: 'c6790dd2f167',
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    region: 'us-east-005',
    s3ForcePathStyle: true
});

async function verifySetup() {
    try {
        console.log('🔄 测试存储桶连接...');
        
        // 尝试列出存储桶内容
        const result = await s3.listObjectsV2({
            Bucket: 'gudq-missing-assets',
            MaxKeys: 1
        }).promise();
        
        console.log('✅ 存储桶连接成功!');
        console.log(`📊 存储桶中有 ${result.KeyCount || 0} 个文件`);
        
        if (result.Contents && result.Contents.length > 0) {
            console.log('📁 示例文件:', result.Contents[0].Key);
        }
        
        console.log('\n🎉 验证通过！可以开始上传图片了。');
        
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        
        if (error.code === 'NoSuchBucket') {
            console.log('\n🔧 存储桶不存在，请检查:');
            console.log('   1. 存储桶名称是否正确: gudq-missing-assets');
            console.log('   2. 存储桶是否已创建');
        } else if (error.code === 'InvalidAccessKeyId') {
            console.log('\n🔧 密钥ID错误，请检查 accessKeyId');
        } else if (error.code === 'SignatureDoesNotMatch') {
            console.log('\n🔧 签名不匹配，请检查 secretAccessKey');
        } else if (error.code === 'AccessDenied') {
            console.log('\n🔧 访问被拒绝，请检查密钥权限');
        }
        
        console.log('\n💡 重新获取密钥步骤:');
        console.log('   1. 删除旧的应用密钥');
        console.log('   2. 创建新的应用密钥');
        console.log('   3. 重新设置环境变量');
    }
}

verifySetup().catch(console.error);