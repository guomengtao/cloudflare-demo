const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🚀 Backblaze B2 存储桶创建和测试指南');
console.log('='.repeat(50));

// 存储桶配置
const bucketConfig = {
    name: 'gudq-missing-assets',
    type: 'All Public',
    description: '失踪人口网站图片存储'
};

console.log('\n📋 存储桶配置信息:');
console.log('   名称:', bucketConfig.name);
console.log('   类型:', bucketConfig.type);
console.log('   描述:', bucketConfig.description);

console.log('\n🔧 当前环境配置:');
console.log('   Key ID:', process.env.B2_ACCESS_KEY_ID);
console.log('   Secret Key:', process.env.B2_SECRET_ACCESS_KEY ? '***' + process.env.B2_SECRET_ACCESS_KEY.slice(-4) : '未设置');
console.log('   端点:', process.env.B2_ENDPOINT);
console.log('   区域:', process.env.B2_REGION);

async function testConnection() {
    console.log('\n🔍 测试连接配置...');
    
    try {
        const s3 = new AWS.S3({
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
            endpoint: process.env.B2_ENDPOINT,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
            region: process.env.B2_REGION
        });
        
        // 测试列出存储桶
        console.log('📋 测试存储桶列表...');
        const buckets = await s3.listBuckets().promise();
        
        console.log('✅ 连接成功！');
        console.log('📦 可访问的存储桶:');
        buckets.Buckets.forEach(bucket => {
            console.log(`   - ${bucket.Name} (创建于: ${bucket.CreationDate})`);
        });
        
        // 检查目标存储桶是否存在
        const targetBucket = buckets.Buckets.find(b => b.Name === bucketConfig.name);
        
        if (targetBucket) {
            console.log(`\n🎉 存储桶 "${bucketConfig.name}" 已存在！`);
            console.log('💡 现在可以开始上传图片了！');
            
            // 测试上传功能
            console.log('\n🚀 测试上传功能...');
            const testKey = `test-upload-${Date.now()}.txt`;
            
            await s3.putObject({
                Bucket: bucketConfig.name,
                Key: testKey,
                Body: '测试上传文件',
                ContentType: 'text/plain'
            }).promise();
            
            console.log('✅ 上传测试成功！');
            
            // 清理测试文件
            await s3.deleteObject({
                Bucket: bucketConfig.name,
                Key: testKey
            }).promise();
            
            console.log('✅ 删除测试成功！');
            
        } else {
            console.log(`\n❌ 存储桶 "${bucketConfig.name}" 不存在`);
            console.log('💡 请按照以下步骤创建存储桶:');
            
            console.log('\n📝 创建存储桶步骤:');
            console.log('   1. 登录 Backblaze 控制台: https://secure.backblaze.com');
            console.log('   2. 点击 "Create a Bucket"');
            console.log('   3. 输入存储桶名称: gudq-missing-assets');
            console.log('   4. 选择 "All Public"（推荐）或 "Private"');
            console.log('   5. 点击 "Create a Bucket"');
            console.log('   6. 返回此脚本重新测试');
        }
        
    } catch (error) {
        console.log('❌ 连接测试失败:', error.message);
        
        if (error.code === 'SignatureDoesNotMatch') {
            console.log('🔧 签名不匹配，可能的原因:');
            console.log('   1. 应用密钥权限不足');
            console.log('   2. 密钥格式错误');
            console.log('   3. 端点地址不正确');
        }
        
        console.log('\n💡 故障排除步骤:');
        console.log('   1. 检查应用密钥权限');
        console.log('   2. 验证存储桶名称');
        console.log('   3. 检查网络连接');
    }
}

console.log('\n🎯 下一步操作:');
console.log('   1. 确保存储桶 "gudq-missing-assets" 已创建');
console.log('   2. 运行此脚本测试连接');
console.log('   3. 成功后开始上传失踪人口图片');

// 运行测试
testConnection().catch(console.error);