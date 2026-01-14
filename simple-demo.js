// 简单的 Backblaze B2 上传演示
const AWS = require('aws-sdk');
const fs = require('fs');

// 配置 AWS SDK 使用 Backblaze B2
const s3 = new AWS.S3({
    endpoint: 'https://s3.us-east-005.backblazeb2.com',
    accessKeyId: 'c6790dd2f167',
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || '请设置环境变量',
    region: 'us-east-005',
    s3ForcePathStyle: true
});

// 创建测试图片
function createTestImage() {
    const testDir = './demo-images';
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir);
    }
    
    // 创建一个简单的PNG图片（使用base64编码）
    const pngHeader = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(pngHeader, 'base64');
    
    const imagePath = `${testDir}/test-profile.png`;
    fs.writeFileSync(imagePath, buffer);
    
    return imagePath;
}

async function uploadDemo() {
    console.log('🚀 Backblaze B2 上传演示开始\n');
    
    // 检查密钥
    if (!process.env.B2_SECRET_ACCESS_KEY) {
        console.log('❌ 请先设置环境变量:');
        console.log('   export B2_SECRET_ACCESS_KEY=你的Backblaze应用密钥\n');
        console.log('💡 获取密钥步骤:');
        console.log('   1. 登录 https://secure.backblaze.com');
        console.log('   2. 进入 Application Keys 页面');
        console.log('   3. 创建新的应用密钥');
        console.log('   4. 复制 applicationKey');
        console.log('   5. 运行: export B2_SECRET_ACCESS_KEY=你的密钥\n');
        return;
    }
    
    try {
        // 创建测试图片
        const imagePath = createTestImage();
        console.log('✅ 测试图片创建成功:', imagePath);
        
        // 读取图片文件
        const fileBuffer = fs.readFileSync(imagePath);
        
        // 生成唯一的文件名
        const timestamp = Date.now();
        const fileName = `demo/test-profile-${timestamp}.png`;
        
        console.log('📤 开始上传到 Backblaze B2...');
        
        // 上传参数
        const params = {
            Bucket: 'gudq-missing-assets',
            Key: fileName,
            Body: fileBuffer,
            ContentType: 'image/png',
            ACL: 'public-read',
            Metadata: {
                'demo-case': 'test-upload',
                'upload-time': new Date().toISOString()
            }
        };
        
        // 执行上传
        const result = await s3.upload(params).promise();
        
        console.log('🎉 上传成功!');
        console.log('\n📊 上传详情:');
        console.log('   文件位置:', result.Location);
        console.log('   ETag:', result.ETag);
        
        // 生成CDN URL
        const cdnUrl = `https://f005.backblazeb2.com/file/gudq-missing-assets/${fileName}`;
        console.log('   CDN访问URL:', cdnUrl);
        
        // 测试访问
        console.log('\n🔍 测试访问上传的图片...');
        try {
            const testResponse = await fetch(cdnUrl);
            console.log('   访问状态:', testResponse.status);
            console.log('   内容类型:', testResponse.headers.get('content-type'));
            
            if (testResponse.ok) {
                console.log('✅ 图片可正常访问!');
            }
        } catch (accessError) {
            console.log('⚠️  访问测试失败:', accessError.message);
        }
        
        console.log('\n💡 下一步操作:');
        console.log('   1. 在浏览器中打开URL验证图片');
        console.log('   2. 登录 Backblaze 控制台查看文件');
        console.log('   3. 准备真实图片进行批量上传');
        
        // 清理测试文件
        fs.unlinkSync(imagePath);
        fs.rmdirSync('./demo-images');
        
    } catch (error) {
        console.error('❌ 上传失败:', error.message);
        
        if (error.code === 'NoSuchBucket') {
            console.log('\n🔧 存储桶不存在，请检查:');
            console.log('   1. 存储桶名称: gudq-missing-assets');
            console.log('   2. 存储桶是否已创建');
            console.log('   3. 存储桶权限是否为公开');
        } else if (error.code === 'InvalidAccessKeyId') {
            console.log('\n🔧 应用密钥错误，请检查:');
            console.log('   1. accessKeyId 是否正确');
            console.log('   2. secretAccessKey 是否正确设置');
        } else if (error.code === 'CredentialsError') {
            console.log('\n🔧 认证错误，请检查环境变量设置');
        }
    }
}

// 运行演示
uploadDemo().catch(console.error);