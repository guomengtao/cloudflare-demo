// 直接使用成功的配置测试系统
require('dotenv').config();
const AWS = require('aws-sdk');

// 直接使用成功的配置
const config = {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    endpoint: 'https://s3.us-east-005.backblazeb2.com',
    region: 'us-east-005',
    bucketName: 'gudq-missing-assets'
};

async function testDirect() {
    console.log('🚀 直接测试配置');
    
    const s3 = new AWS.S3({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        endpoint: config.endpoint,
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
        region: config.region
    });
    
    try {
        const data = await s3.listObjectsV2({Bucket: config.bucketName}).promise();
        console.log('✅ 连接成功！', data.KeyCount, '个文件');
        
        const testKey = 'test-config.txt';
        await s3.putObject({
            Bucket: config.bucketName,
            Key: testKey,
            Body: 'Config test',
            ContentType: 'text/plain'
        }).promise();
        
        console.log('✅ 上传成功');
        
        await s3.deleteObject({Bucket: config.bucketName, Key: testKey}).promise();
        console.log('✅ 删除成功');
        
    } catch (err) {
        console.error('❌ 失败:', err.message);
        console.error('   错误代码:', err.code);
        console.error('   状态码:', err.statusCode);
    }
}

testDirect();