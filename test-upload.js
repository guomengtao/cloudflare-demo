// Backblaze B2 图片上传演示脚本
const B2ImageManager = require('./b2-image-manager.js');
const fs = require('fs');
const path = require('path');

// 创建测试图片目录
const testDir = './test-images';
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
}

// 创建一个简单的测试图片（SVG格式）
const testImageContent = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#4F46E5"/>
  <circle cx="100" cy="100" r="60" fill="#FFFFFF"/>
  <text x="100" y="110" font-family="Arial" font-size="24" fill="#4F46E5" text-anchor="middle">测试</text>
</svg>
`;

const testImagePath = path.join(testDir, 'test-profile.svg');
fs.writeFileSync(testImagePath, testImageContent);

async function demoUpload() {
    console.log('🚀 开始 Backblaze B2 图片上传演示\n');
    
    // 检查环境变量
    if (!process.env.B2_SECRET_ACCESS_KEY) {
        console.log('❌ 请先设置环境变量:');
        console.log('   export B2_SECRET_ACCESS_KEY=你的Backblaze应用密钥');
        console.log('\n💡 获取密钥步骤:');
        console.log('   1. 登录 Backblaze 控制台');
        console.log('   2. 进入 Application Keys 页面');
        console.log('   3. 创建新的应用密钥');
        console.log('   4. 复制 applicationKey 并设置环境变量\n');
        return;
    }

    try {
        // 初始化图片管理器
        const manager = new B2ImageManager({
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
        });

        console.log('✅ 图片管理器初始化成功');
        console.log('📦 存储桶: gudq-missing-assets');
        console.log('🌐 CDN域名: images.missingpersonsdb.com\n');

        // 准备测试图片数据
        const testImages = [
            {
                filePath: testImagePath,
                caseId: 'demo-test-case',
                imageType: 'profile'
            }
        ];

        console.log('📤 开始上传测试图片...');
        
        // 执行上传
        const results = await manager.uploadBatchImages(testImages);
        
        console.log('\n📊 上传结果:');
        console.log(`   成功: ${results.successCount} 张`);
        console.log(`   失败: ${results.failCount} 张`);
        
        if (results.successful.length > 0) {
            const uploadedImage = results.successful[0];
            console.log('\n🌐 生成的URL:');
            console.log(`   原始B2 URL: ${uploadedImage.b2Url}`);
            console.log(`   CDN URL: ${uploadedImage.cdnUrl}`);
            console.log(`   缩略图: ${uploadedImage.optimizedUrls.thumbnail}`);
            console.log(`   中等尺寸: ${uploadedImage.optimizedUrls.medium}`);
            
            console.log('\n📁 图片信息:');
            console.log(`   案件ID: ${uploadedImage.caseId}`);
            console.log(`   图片类型: ${uploadedImage.imageType}`);
            console.log(`   文件大小: ${(uploadedImage.size / 1024).toFixed(2)} KB`);
            console.log(`   存储路径: ${uploadedImage.storagePath}`);
        }

        // 生成图片映射文件
        const imageMap = manager.generateImageMapFile('./demo-image-map.json');
        console.log('\n🗺️ 图片映射文件已生成: demo-image-map.json');

        // 显示统计信息
        const stats = manager.getStatistics();
        console.log('\n📈 统计信息:');
        console.log(`   总上传数量: ${stats.totalUploaded}`);
        console.log(`   总文件大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   成功率: ${stats.successRate.toFixed(2)}%`);

        console.log('\n🎉 演示完成！');
        console.log('\n💡 下一步:');
        console.log('   1. 在浏览器中打开生成的CDN URL测试访问');
        console.log('   2. 查看生成的 demo-image-map.json 文件');
        console.log('   3. 准备真实图片进行批量上传');

    } catch (error) {
        console.error('❌ 上传过程中出现错误:', error.message);
        console.log('\n🔧 故障排除:');
        console.log('   1. 检查 Backblaze B2 存储桶是否存在');
        console.log('   2. 验证应用密钥权限');
        console.log('   3. 检查网络连接');
    }
}

// 运行演示
demoUpload().catch(console.error);