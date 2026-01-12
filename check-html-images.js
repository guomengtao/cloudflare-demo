#!/usr/bin/env node

function hasRealImages(htmlContent) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    console.log('🔍 开始图片检测...');
    console.log('─'.repeat(80));
    
    // 方法1: 直接搜索图片URL
    const urlPattern = /https?:\/\/[^\s"']*\.(jpg|jpeg|png|gif|webp)(?:\?[^\s"']*)?/gi;
    const urlMatches = htmlContent.match(urlPattern) || [];
    
    console.log(`📊 直接URL搜索找到 ${urlMatches.length} 个图片URL`);
    
    // 方法2: 从img标签中提取
    const imgTagPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const imgMatches = [];
    let match;
    while ((match = imgTagPattern.exec(htmlContent)) !== null) {
        imgMatches.push(match[1]);
    }
    
    console.log(`📷 从img标签提取到 ${imgMatches.length} 个图片URL`);
    
    // 方法3: 检查CSS背景图片
    const backgroundPattern = /background(?:-image)?\s*:\s*url\(['"]?([^)'"]+)['"]?\)/gi;
    const backgroundMatches = htmlContent.match(backgroundPattern) || [];
    
    console.log(`🎨 找到 ${backgroundMatches.length} 个CSS背景图片`);
    
    // 合并所有图片URL并去重
    const allImageUrls = [...new Set([...urlMatches, ...imgMatches])];
    
    console.log(`📈 去重后总图片URL数量: ${allImageUrls.length}`);
    
    // 过滤占位符图片
    const realImages = allImageUrls.filter(url => {
        const lowerUrl = url.toLowerCase();
        
        // 排除占位符图片
        if (lowerUrl.includes('via.placeholder.com') || 
            lowerUrl.includes('placeholder') ||
            lowerUrl.includes('blank') ||
            lowerUrl.includes('default') ||
            lowerUrl.includes('data:image')) {
            return false;
        }
        
        // 检查是否为有效的图片URL
        return imageExtensions.some(ext => lowerUrl.includes('.' + ext));
    });
    
    console.log('─'.repeat(80));
    console.log(`📊 最终检测结果:`);
    console.log(`   总图片URL数量: ${allImageUrls.length}`);
    console.log(`   真实图片数量: ${realImages.length}`);
    console.log(`   占位符图片数量: ${allImageUrls.length - realImages.length}`);
    
    if (realImages.length > 0) {
        console.log(`\n📷 检测到的真实图片URL:`);
        realImages.forEach((url, index) => {
            console.log(`   ${index + 1}. ${url}`);
        });
    } else {
        console.log(`\n❌ 未检测到真实图片`);
        
        // 显示前5个被过滤的URL（如果有）
        const filteredUrls = allImageUrls.filter(url => !realImages.includes(url));
        if (filteredUrls.length > 0) {
            console.log(`\n🚫 被过滤的URL（前5个）:`);
            filteredUrls.slice(0, 5).forEach((url, index) => {
                console.log(`   ${index + 1}. ${url}`);
            });
        }
    }
    
    return realImages.length > 0;
}

// 命令行参数处理
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('使用方法:');
    console.log('  1. 直接提供HTML内容:');
    console.log('     node check-html-images.js "<html>...</html>"');
    console.log('  2. 从文件读取HTML:');
    console.log('     node check-html-images.js --file path/to/file.html');
    console.log('');
    console.log('示例:');
    console.log('  node check-html-images.js "<img src=\"https://example.com/photo.jpg\">"');
    process.exit(1);
}

let htmlContent = args[0];

// 检查是否从文件读取
if (htmlContent === '--file' && args.length > 1) {
    const fs = require('fs');
    const filePath = args[1];
    
    try {
        htmlContent = fs.readFileSync(filePath, 'utf8');
        console.log(`📁 从文件读取: ${filePath}`);
    } catch (error) {
        console.error(`❌ 无法读取文件: ${filePath}`, error.message);
        process.exit(1);
    }
}

console.log(`📄 HTML内容长度: ${htmlContent.length} 字符`);
console.log('');

// 检测图片
const hasImages = hasRealImages(htmlContent);

console.log('─'.repeat(80));
console.log(`✅ 检测完成: ${hasImages ? '有真实图片' : '无真实图片'}`);