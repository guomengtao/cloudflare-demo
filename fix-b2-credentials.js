const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🔧 修复 Backblaze B2 密钥特殊字符问题');

// 检查环境变量
const accessKeyId = process.env.B2_ACCESS_KEY_ID;
const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;

console.log('🔑 Key ID:', accessKeyId);
console.log('🔑 Secret Key:', secretAccessKey ? '***' + secretAccessKey.slice(-4) : '未设置');

// 检查密钥格式
if (!accessKeyId || !secretAccessKey) {
    console.error('❌ 密钥未正确设置');
    process.exit(1);
}

// 测试不同的配置方式
const configs = [
    {
        name: '标准配置',
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    },
    {
        name: 'URL编码配置',
        accessKeyId: encodeURIComponent(accessKeyId),
        secretAccessKey: encodeURIComponent(secretAccessKey)
    },
    {
        name: 'Base64编码配置',
        accessKeyId: Buffer.from(accessKeyId).toString('base64'),
        secretAccessKey: Buffer.from(secretAccessKey).toString('base64')
    }
];

async function testConfig(config) {
    console.log(`\n🔍 测试配置: ${config.name}`);
    
    try {
        const s3 = new AWS.S3({
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            endpoint: process.env.B2_ENDPOINT,
            s3ForcePathStyle: true,
            signatureVersion: 'v4'
        });
        
        // 简单测试：列出存储桶
        const result = await s3.listBuckets().promise();
        console.log(`✅ ${config.name} 测试成功！`);
        console.log('📋 可访问存储桶:', result.Buckets.map(b => b.Name).join(', '));
        return true;
    } catch (error) {
        console.log(`❌ ${config.name} 测试失败:`, error.message);
        return false;
    }
}

async function main() {
    console.log('\n🚀 开始测试不同配置...');
    
    for (const config of configs) {
        const success = await testConfig(config);
        if (success) {
            console.log('\n🎉 找到有效的配置！');
            console.log('💡 建议更新 .env 文件使用此配置');
            
            // 如果 URL 编码配置有效，更新环境变量
            if (config.name === 'URL编码配置') {
                console.log('\n📝 自动更新 .env 文件...');
                const fs = require('fs');
                const envPath = '.env';
                
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(
                    /B2_ACCESS_KEY_ID=.*/,
                    `B2_ACCESS_KEY_ID=${encodeURIComponent(accessKeyId)}`
                );
                envContent = envContent.replace(
                    /B2_SECRET_ACCESS_KEY=.*/,
                    `B2_SECRET_ACCESS_KEY=${encodeURIComponent(secretAccessKey)}`
                );
                
                fs.writeFileSync(envPath, envContent);
                console.log('✅ .env 文件已更新');
            }
            
            break;
        }
    }
    
    console.log('\n🔧 如果所有配置都失败，请检查:');
    console.log('   1. 应用密钥是否已正确创建');
    console.log('   2. 存储桶名称是否正确');
    console.log('   3. 端点地址是否正确');
    console.log('   4. 网络连接是否正常');
}

main().catch(console.error);