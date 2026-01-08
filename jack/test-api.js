// 测试 API 调用
require('dotenv').config({ path: '../.env' });

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

// 使用正确的 Cloudflare Workers AI API 端点
const model = '@cf/meta/llama-3.3-70b-instruct';
const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

console.log('🧪 测试 Cloudflare API 调用');
console.log('📊 API Token:', CLOUDFLARE_API_TOKEN ? '已设置' : '未设置');

if (!CLOUDFLARE_API_TOKEN) {
    console.log('❌ CLOUDFLARE_API_TOKEN 未设置');
    process.exit(1);
}

// 测试提取地理位置信息的提示词
const testPrompt = `请提取以下信息并以JSON格式返回：
- missing_county: 县/郡
- missing_state: 州/省  
- missing_city: 城市
- caseid: 案件ID（从文件名提取：test123）

案件内容：（这是一个测试案例）
失踪人员：John Doe，最后出现在洛杉矶市中心，加利福尼亚州，洛杉矶县。

请确保返回纯JSON格式，不要包含任何额外说明。`;

console.log('📤 发送测试请求...');

fetch(apiUrl, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        messages: [
            {
                role: 'user',
                content: testPrompt
            }
        ],
        stream: false
    })
})
.then(response => {
    console.log('📊 HTTP 状态:', response.status, response.statusText);
    return response.json();
})
.then(data => {
    console.log('📊 响应数据:', JSON.stringify(data, null, 2));
    
    if (data.success && data.result?.response) {
        console.log('✅ API 调用成功');
        console.log('📊 AI 响应:', data.result.response);
        
        // 尝试解析 JSON
        try {
            const parsed = JSON.parse(data.result.response);
            console.log('✅ JSON 解析成功:', parsed);
        } catch (error) {
            console.log('⚠️  JSON 解析失败:', error.message);
        }
    } else {
        console.log('❌ API 调用失败:', data.errors);
    }
})
.catch(error => {
    console.log('❌ 请求失败:', error.message);
});