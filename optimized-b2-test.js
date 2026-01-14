const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🚀 优化后的 Backblaze B2 连接测试');
console.log('='.repeat(50));

// 检查环境变量
console.log('\n📋 环境变量检查:');
console.log('   B2_ACCESS_KEY_ID:', process.env.B2_ACCESS_KEY_ID);
console.log('   B2_SECRET_ACCESS_KEY:', process.env.B2_SECRET_ACCESS_KEY ? '***' + process.env.B2_SECRET_ACCESS_KEY.slice(-4) : '未设置');
console.log('   B2_BUCKET_NAME:', process.env.B2_BUCKET_NAME);
console.log('   B2_ENDPOINT:', process.env.B2_ENDPOINT);
console.log('   B2_REGION:', process.env.B2_REGION);

// 优化配置的 S3 客户端
const s3 = new AWS.S3({
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    endpoint: `https://${process.env.B2_ENDPOINT}`, // 确保带上 https://
    s3ForcePathStyle: true, // B2 必须开启
    signatureVersion: 'v4',
    region: process.env.B2_REGION
});

async function quickCheck() {
    try {
        console.log('\n🔍 测试连接...');
        console.log('   端点:', `https://${process.env.B2_ENDPOINT}`);
        console.log('   存储桶:', process.env.B2_BUCKET_NAME);
        
        // 不要 listBuckets (有时权限不够)，直接列出你的目标桶文件
        const data = await s3.listObjectsV2({
            Bucket: process.env.B2_BUCKET_NAME,
            MaxKeys: 1
        }).promise();
        
        console.log('✅ 完美连接！桶内文件数量预览成功。');
        console.log('   文件数量:', data.KeyCount || 0);
        
        if (data.Contents && data.Contents.length > 0) {
            console.log('   第一个文件:', data.Contents[0].Key);
        }
        
        return true;
        
    } catch (err) {
        console.error('❌ 依然失败:', err.message);
        
        if (err.code === 'NoSuchBucket') {
            console.log('💡 存储桶不存在，需要创建存储桶');
        } else if (err.code === 'AccessDenied') {
            console.log('💡 权限不足，请检查应用密钥权限');
        } else if (err.code === 'SignatureDoesNotMatch') {
            console.log('💡 签名不匹配，请检查密钥格式');
        }
        
        return false;
    }
}

async function testUpload() {
    try {
        console.log('\n🚀 测试上传功能...');
        
        const testKey = `test-upload-${Date.now()}.txt`;
        
        await s3.putObject({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: testKey,
            Body: 'Backblaze B2 上传测试文件',
            ContentType: 'text/plain'
        }).promise();
        
        console.log('✅ 上传测试成功！');
        
        // 清理测试文件
        await s3.deleteObject({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: testKey
        }).promise();
        
        console.log('✅ 删除测试成功！');
        
        return true;
        
    } catch (error) {
        console.error('❌ 上传测试失败:', error.message);
        return false;
    }
}

async function main() {
    const connectionSuccess = await quickCheck();
    
    if (connectionSuccess) {
        console.log('\n🎉 连接测试通过！开始上传功能测试...');
        await testUpload();
        
        console.log('\n💡 现在可以开始上传失踪人口图片了！');
        console.log('   运行命令: node b2-image-manager.js');
        
    } else {
        console.log('\n🔧 需要解决的问题:');
        console.log('   1. 确保存储桶 "gudq-missing-assets" 已创建');
        console.log('   2. 检查应用密钥权限');
        console.log('   3. 验证网络连接');
        
        console.log('\n📝 创建存储桶步骤:');
        console.log('   1. 登录 Backblaze 控制台: https://secure.backblaze.com');
        console.log('   2. 点击 "Create a Bucket"');
        console.log('   3. 输入存储桶名称: gudq-missing-assets');
        console.log('   4. 选择 "All Public"（推荐）');
        console.log('   5. 点击 "Create a Bucket"');
    }
}

main().catch(console.error);