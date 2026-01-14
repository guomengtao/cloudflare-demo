const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🔍 Backblaze B2 配置详细诊断');
console.log('='.repeat(50));

// 1. 检查环境变量
console.log('\n📋 1. 环境变量检查:');
const envVars = {
    'B2_ACCESS_KEY_ID': process.env.B2_ACCESS_KEY_ID,
    'B2_SECRET_ACCESS_KEY': process.env.B2_SECRET_ACCESS_KEY ? '***' + process.env.B2_SECRET_ACCESS_KEY.slice(-4) : '未设置',
    'B2_BUCKET_NAME': process.env.B2_BUCKET_NAME,
    'B2_ENDPOINT': process.env.B2_ENDPOINT,
    'B2_REGION': process.env.B2_REGION
};

Object.entries(envVars).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
});

// 2. 验证密钥格式
console.log('\n🔑 2. 密钥格式验证:');
const accessKeyId = process.env.B2_ACCESS_KEY_ID;
const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
    console.error('❌ 密钥未正确设置');
    process.exit(1);
}

console.log('✅ Key ID 格式正确 (长度:', accessKeyId.length, '字符)');
console.log('✅ Secret Key 格式正确 (长度:', secretAccessKey.length, '字符)');

// 3. 测试网络连接
console.log('\n🌐 3. 网络连接测试:');
const dns = require('dns');
const endpoint = process.env.B2_ENDPOINT.replace('s3.', '');

dns.lookup(endpoint, (err, address) => {
    if (err) {
        console.error('❌ DNS 解析失败:', err.message);
    } else {
        console.log('✅ DNS 解析成功:', endpoint, '→', address);
    }
});

// 4. 创建 S3 客户端并测试
console.log('\n🚀 4. S3 客户端测试:');

async function testS3Connection() {
    try {
        const s3 = new AWS.S3({
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            endpoint: process.env.B2_ENDPOINT,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
            // 添加更详细的调试信息
            logger: console,
            maxRetries: 3,
            httpOptions: {
                timeout: 10000,
                connectTimeout: 5000
            }
        });
        
        console.log('🔧 S3 客户端配置完成');
        
        // 测试 1: 列出存储桶
        console.log('\n📋 测试 1: 列出存储桶...');
        try {
            const buckets = await s3.listBuckets().promise();
            console.log('✅ 存储桶列表成功');
            console.log('   📦 可访问存储桶:', buckets.Buckets.map(b => b.Name).join(', '));
        } catch (error) {
            console.log('❌ 存储桶列表失败:', error.message);
            console.log('   🔧 错误代码:', error.code);
            console.log('   🔧 状态码:', error.statusCode);
        }
        
        // 测试 2: 检查特定存储桶
        console.log('\n📋 测试 2: 检查存储桶权限...');
        try {
            const bucketParams = {
                Bucket: process.env.B2_BUCKET_NAME
            };
            
            const bucketLocation = await s3.getBucketLocation(bucketParams).promise();
            console.log('✅ 存储桶访问成功');
            console.log('   📍 存储桶位置:', bucketLocation.LocationConstraint || '默认');
        } catch (error) {
            console.log('❌ 存储桶访问失败:', error.message);
            console.log('   🔧 错误代码:', error.code);
            
            if (error.code === 'NoSuchBucket') {
                console.log('   💡 存储桶不存在，请检查存储桶名称');
            } else if (error.code === 'AccessDenied') {
                console.log('   💡 权限不足，请检查应用密钥权限');
            }
        }
        
        // 测试 3: 简单上传测试
        console.log('\n📋 测试 3: 上传权限测试...');
        try {
            const testKey = `diagnostic-test-${Date.now()}.txt`;
            const uploadParams = {
                Bucket: process.env.B2_BUCKET_NAME,
                Key: testKey,
                Body: '诊断测试文件',
                ContentType: 'text/plain'
            };
            
            await s3.putObject(uploadParams).promise();
            console.log('✅ 上传权限正常');
            
            // 清理测试文件
            await s3.deleteObject({
                Bucket: process.env.B2_BUCKET_NAME,
                Key: testKey
            }).promise();
            console.log('✅ 删除权限正常');
            
        } catch (error) {
            console.log('❌ 上传测试失败:', error.message);
            console.log('   🔧 错误代码:', error.code);
        }
        
    } catch (error) {
        console.error('❌ S3 客户端创建失败:', error.message);
    }
}

// 5. 提供解决方案
console.log('\n💡 5. 可能的解决方案:');
console.log('   1. 🔑 检查应用密钥权限:');
console.log('      - 登录 Backblaze 控制台');
console.log('      - 检查应用密钥 "missing-persons-images" 的权限');
console.log('      - 确保勾选: Allow List All Bucket Names, Allow Write, Allow Delete');
console.log('      - 确保关联到存储桶: gudq-missing-assets');
console.log('');
console.log('   2. 🌐 检查网络配置:');
console.log('      - 确保可以访问 s3.us-east-005.backblazeb2.com');
console.log('      - 检查防火墙或代理设置');
console.log('');
console.log('   3. 🔧 重新创建应用密钥:');
console.log('      - 删除现有密钥');
console.log('      - 创建新的应用密钥');
console.log('      - 确保正确配置权限');

// 运行测试
testS3Connection().then(() => {
    console.log('\n🎯 诊断完成！请根据上述结果进行相应的调整。');
}).catch(console.error);