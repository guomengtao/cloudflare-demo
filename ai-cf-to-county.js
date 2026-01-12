const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// 加载环境变量
dotenv.config({
    path: fs.existsSync(path.resolve(__dirname, '.env')) 
        ? path.resolve(__dirname, '.env') 
        : path.resolve(__dirname, '../.env')
});

// AI API配置 - 使用与orm-run-img.js完全相同的Cloudflare AI接口
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const AI_API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-3b-instruct`;

/**
 * 检查内容中是否包含真实图片
 */
function hasRealImages(content) {
    if (!content) return false;
    
    // 检查是否包含真实图片的HTML标签
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    let hasValidImages = false;
    
    while ((match = imgRegex.exec(content)) !== null) {
        const src = match[1].toLowerCase();
        // 排除占位图片和没有真实URL的图片
        if (!src.includes('placeholder') && !src.includes('no-image') && src.startsWith('http')) {
            hasValidImages = true;
            break;
        }
    }
    
    return hasValidImages;
}

/**
 * 根据美国州和城市获取对应的县
 */
async function getCountyByStateAndCity(state, city) {
    if (!state || !city) {
        throw new Error('州和城市信息不能为空');
    }
    
    console.log(`🔍 AI正在根据州: ${state} 和城市: ${city} 查找对应的县...`);
    
    try {
        const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a geography expert specializing in US locations. Given a US state and city, return ONLY the corresponding county name in ENGLISH. Do not return any explanations or additional information. If the city is the same as the county, just return the city name. If you cannot determine the county, return "Unknown".'
                    },
                    {
                        role: 'user',
                        content: `State: ${state}, City: ${city}`
                    }
                ],
                temperature: 0.1,
                max_tokens: 20
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        const county = data.result.response.trim();
        
        console.log(`✅ AI返回的县: ${county}`);
        
        return {
            success: true,
            data: {
                state: state,
                city: city,
                county: county
            }
        };
        
    } catch (error) {
        console.error(`❌ AI获取县信息失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    hasRealImages,
    getCountyByStateAndCity
};