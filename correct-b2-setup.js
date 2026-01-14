const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🔧 使用正确的 Backblaze B2 端点配置');
console.log('='.repeat(50));

// Backblaze B2 的正确端点格式
const correctEndpoints = [
    {
        name: '标准 S3 兼容端点',
        endpoint: 's3.us-east-005.backblazeb2.com',
        region: 'us-east-005'
    },
    {
        name: 'Backblaze 推荐端点',
        endpoint: 's3.us-east-005.backblazeb2.com',
        region: 'us-east-005'
    },
    {
        name: '直接 B2 端点',
        endpoint: 's3.us-east-005.backblazeb2.com',
        region: 'us-east-005'
    }
];

// 检查环境变量
console.log('\n📋 当前环境变量:');
console.log('   B2_ACCESS_KEY_ID:', process.env.B2_ACCESS_KEY_ID);
console.log('   B2_SECRET_ACCESS_KEY:', process.env.B2_SECRET_ACCESS_KEY ? '***' + process.env.B2_SECRET_ACCESS_KEY.slice(-4) : '未设置');
console.log('   B2_BUCKET_NAME:', process.env.B2_BUCKET_NAME);
console.log('   B2_ENDPOINT:', process.env.B2_ENDPOINT);
console.log('   B2_REGION:', process.env.B2_REGION);

async function testConnection(endpointConfig) {
    console.log(`\n🔍 测试配置: ${endpointConfig.name}`);
    console.log('   端点:', endpointConfig.endpoint);
    console.log('   区域:', endpointConfig.region);
    
    try {
        const s3 = new AWS.S3({
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
            endpoint: endpointConfig.endpoint,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
            region: endpointConfig.region
        });
        
        // 测试列出存储桶
        const buckets = await s3.listBuckets().promise();
        console.log('✅ 连接成功！');
        console.log('   📦 可访问存储桶:', buckets.Buckets.map(b => b.Name).join(', '));
        
        return { success: true, endpoint: endpointConfig };
        
    } catch (error) {
        console.log('❌ 连接失败:', error.message);
        console.log('   🔧 错误代码:', error.code);
        
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('\n🚀 开始测试不同端点配置...');
    
    let successfulConfig = null;
    
    for (const endpointConfig of correctEndpoints) {
        const result = await testConnection(endpointConfig);
        if (result.success) {
            successfulConfig = result.endpoint;
            break;
        }
    }
    
    if (successfulConfig) {
        console.log('\n🎉 找到有效的配置！');
        console.log('💡 端点:', successfulConfig.endpoint);
        console.log('💡 区域:', successfulConfig.region);
        
        // 更新 .env 文件
        console.log('\n📝 更新 .env 文件...');
        const fs = require('fs');
        const envPath = '.env';
        
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(
            /B2_ENDPOINT=.*/,
            `B2_ENDPOINT=${successfulConfig.endpoint}`
        );
        envContent = envContent.replace(
            /B2_REGION=.*/,
            `B2_REGION=${successfulConfig.region}`
        );
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env 文件已更新');
        
        console.log('\n💡 现在可以测试图片上传功能了！');
        
    } else {
        console.log('\n❌ 所有配置都失败了');
        console.log('💡 可能的原因:');
        console.log('   1. 网络连接问题');
        console.log('   2. DNS 解析问题');
        console.log('   3. 应用密钥权限问题');
        console.log('   4. 存储桶不存在或名称错误');
        
        console.log('\n🔧 建议的解决方案:');
        console.log('   1. 检查网络连接和 DNS 设置');
        console.log('   2. 验证 Backblaze B2 存储桶是否存在');
        console.log('   3. 重新创建应用密钥并确保权限正确');
        console.log('   4. 尝试使用不同的网络环境');
    }
}

main().catch(console.error);