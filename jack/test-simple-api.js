// 简化的 API 测试
require('dotenv').config({ path: '../.env' });

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

console.log('🧪 简化 API 测试');
console.log('📊 账户 ID:', CLOUDFLARE_ACCOUNT_ID);
console.log('📊 API Token:', CLOUDFLARE_API_TOKEN ? '已设置' : '未设置');

// 首先测试账户访问
const accountUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}`;

console.log('\n📤 测试账户访问...');

fetch(accountUrl, {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
    }
})
.then(response => {
    console.log('📊 账户访问状态:', response.status, response.statusText);
    return response.json();
})
.then(data => {
    console.log('📊 账户数据:', JSON.stringify(data, null, 2));
    
    // 如果账户访问成功，尝试 AI 模型
    if (data.success) {
        console.log('\n✅ 账户访问成功，测试 AI 模型...');
        
        const model = '@cf/meta/llama-3.3-70b-instruct';
        const aiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;
        
        return fetch(aiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: '请回答：北京是中国的首都吗？只需回答"是"或"否"。'
                    }
                ],
                stream: false
            })
        });
    }
})
.then(response => {
    if (response) {
        console.log('📊 AI 调用状态:', response.status, response.statusText);
        return response.json();
    }
})
.then(aiData => {
    if (aiData) {
        console.log('📊 AI 响应:', JSON.stringify(aiData, null, 2));
        
        if (aiData.success && aiData.result?.response) {
            console.log('✅ AI 调用成功');
            console.log('📊 AI 回答:', aiData.result.response);
        } else {
            console.log('❌ AI 调用失败:', aiData.errors);
        }
    }
})
.catch(error => {
    console.log('❌ 请求失败:', error.message);
});