const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🔍 验证 Backblaze B2 存储桶配置');
console.log('='.repeat(50));

// 可能的存储桶名称变体
const possibleBucketNames = [
    'gudq-missing-assets',
    'gudq-missing-assets-b2',
    'missing-persons-assets',
    'missing-persons-images'
];

async function testBucketName(bucketName) {
    console.log(`\n🔍 测试存储桶: ${bucketName}`);
    
    try {
        const s3 = new AWS.S3({
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
            endpoint: process.env.B2_ENDPOINT,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
            region: process.env.B2_REGION
        });
        
        // 测试存储桶访问
        const result = await s3.headBucket({
            Bucket: bucketName
        }).promise();
        
        console.log(`✅ 存储桶 ${bucketName} 存在且可访问`);
        return { exists: true, bucketName: bucketName };
        
    } catch (error) {
        if (error.code === 'NoSuchBucket') {
            console.log(`❌ 存储桶 ${bucketName} 不存在`);
        } else if (error.code === 'AccessDenied') {
            console.log(`❌ 存储桶 ${bucketName} 存在但无访问权限`);
        } else {
            console.log(`❌ 存储桶 ${bucketName} 测试失败: ${error.message}`);
        }
        return { exists: false, bucketName: bucketName, error: error.message };
    }
}

async function main() {
    console.log('📋 测试可能的存储桶名称...\n');
    
    let existingBucket = null;
    
    for (const bucketName of possibleBucketNames) {
        const result = await testBucketName(bucketName);
        if (result.exists) {
            existingBucket = result.bucketName;
            break;
        }
    }
    
    if (existingBucket) {
        console.log('\n🎉 找到存在的存储桶:', existingBucket);
        
        // 更新 .env 文件
        const fs = require('fs');
        const envPath = '.env';
        
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(
            /B2_BUCKET_NAME=.*/,
            `B2_BUCKET_NAME=${existingBucket}`
        );
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env 文件已更新');
        
    } else {
        console.log('\n❌ 所有存储桶名称都不存在或无权限');
        console.log('💡 需要创建存储桶或检查权限');
        
        console.log('\n🔧 创建存储桶步骤:');
        console.log('   1. 登录 Backblaze 控制台');
        console.log('   2. 点击 "Create a Bucket"');
        console.log('   3. 输入存储桶名称: gudq-missing-assets');
        console.log('   4. 选择 "All Public" 或 "Private"');
        console.log('   5. 点击 "Create a Bucket"');
    }
}

main().catch(console.error);