#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// 1. 初始化配置
const envPath = fs.existsSync(path.resolve(__dirname, '.env')) 
    ? path.resolve(__dirname, '.env') 
    : path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

/**
 * 封装 D1 API 调用
 */
async function queryD1(sql, params = []) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params })
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(`D1 API 错误: ${JSON.stringify(data.errors)}`);
    }
    return data.result[0];
}

// 从ai-cf-to-img.js导入图片检测逻辑
function hasRealImages(htmlContent) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    // 方法1: 直接搜索图片URL
    const urlPattern = /https?:\/\/[^\s"']*\.(jpg|jpeg|png|gif|webp)(?:\?[^\s"']*)?/gi;
    const urlMatches = htmlContent.match(urlPattern) || [];
    
    // 方法2: 从img标签中提取
    const imgTagPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const imgMatches = [];
    let match;
    while ((match = imgTagPattern.exec(htmlContent)) !== null) {
        imgMatches.push(match[1]);
    }
    
    // 合并所有图片URL并去重
    const allImageUrls = [...new Set([...urlMatches, ...imgMatches])];
    
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
    
    console.log(`📊 图片检测结果:`);
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
    }
    
    return realImages.length > 0;
}

async function checkCaseImages(caseId) {
    try {
        // 检查环境变量
        if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID) {
            console.log('❌ 缺少必要的环境变量:');
            console.log('   - CLOUDFLARE_API_KEY:', CLOUDFLARE_API_KEY ? '✅ 已设置' : '❌ 未设置');
            console.log('   - CLOUDFLARE_ACCOUNT_ID:', CLOUDFLARE_ACCOUNT_ID ? '✅ 已设置' : '❌ 未设置');
            console.log('   - CLOUDFLARE_DATABASE_ID:', CLOUDFLARE_DATABASE_ID ? '✅ 已设置' : '❌ 未设置');
            console.log('💡 请确保 .env 文件存在并包含正确的配置');
            return;
        }
        
        // 查询案件HTML内容
        const selectQuery = `SELECT scraped_content FROM missing_persons_cases WHERE case_id = ?`;
        const selectResult = await queryD1(selectQuery, [caseId]);
        const targetCase = selectResult?.results?.[0];
        
        if (!targetCase) {
            console.log(`❌ 未找到案件: ${caseId}`);
            return;
        }
        
        const caseHtml = targetCase.scraped_content;
        
        console.log(`🔍 检测案件: ${caseId}`);
        console.log(`📄 HTML内容长度: ${caseHtml ? caseHtml.length : 0} 字符`);
        console.log('─'.repeat(80));
        
        if (!caseHtml) {
            console.log('❌ 案件HTML内容为空');
            return;
        }
        
        // 检测图片
        const hasImages = hasRealImages(caseHtml);
        
        console.log('─'.repeat(80));
        console.log(`✅ 检测完成: ${hasImages ? '有真实图片' : '无真实图片'}`);
        
    } catch (error) {
        console.error('❌ 检测失败:', error.message);
        if (error.message.includes('D1 API 错误')) {
            console.log('💡 提示: 请检查数据库连接配置是否正确');
        }
    }
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('使用方法: node check-case-images.js <案件ID>');
    console.log('示例: node check-case-images.js louise-alva-ayala');
    process.exit(1);
}

const caseId = args[0];
checkCaseImages(caseId);