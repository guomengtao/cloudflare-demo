// Backblaze B2 图片管理系统测试脚本
// 用于验证系统是否能正常连接和上传图片

require('dotenv').config();
const B2ImageManager = require('./b2-image-manager');

async function testSystem() {
    console.log('🚀 开始测试 Backblaze B2 图片管理系统');
    console.log('='.repeat(50));

    try {
        // 初始化管理器
        const manager = new B2ImageManager();
        console.log('✅ 管理器初始化成功');
        
        // 查看当前配置
        console.log('\n📋 系统配置:');
        console.log('   存储桶:', manager.config.bucketName);
        console.log('   端点:', manager.config.endpoint);
        console.log('   区域:', manager.config.region);
        console.log('   Key ID:', manager.config.accessKeyId);
        console.log('   Secret Key:', manager.config.secretAccessKey ? '***已设置' : '未设置');

        // 测试列出存储桶内容
        console.log('\n🔍 测试列出存储桶内容...');
        const images = await manager.listImages();
        console.log('✅ 存储桶当前包含:', images.length, '个文件');
        
        // 显示已有的文件
        images.forEach((file, index) => {
            if (index < 5) { // 只显示前5个文件
                console.log(`     ${index + 1}. ${file.Key} (${(file.Size / 1024).toFixed(2)} KB)`);
            }
        });

        // 如果存在示例图片，测试上传
        if (require('fs').existsSync('./14043203.png')) {
            console.log('\n📤 测试上传示例图片...');
            
            const uploadResult = await manager.uploadSingleImage(
                './14043203.png',
                'test-case-001',
                'profile'
            );
            
            console.log('✅ 上传成功!');
            console.log('   存储路径:', uploadResult.storagePath);
            console.log('   CDN URL:', uploadResult.cdnUrl);
            console.log('   优化URL:', uploadResult.optimizedUrls);
        } else {
            console.log('\nℹ️  示例图片不存在，跳过上传测试');
            console.log('💡 请将测试图片命名为 14043203.png 放在当前目录测试上传功能');
        }

        console.log('\n🎉 测试完成！系统已经可以正常使用了！');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error('   错误详情:', error);
    }
}

// 运行测试
testSystem().catch(console.error);