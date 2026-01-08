// 测试AI接口的独立脚本
const axios = require('axios');

// 测试不同的AI接口端点
const testEndpoints = [
    {
        name: '本地Cloudflare Pages Function (/gemini)',
        url: 'http://localhost:8787/gemini',
        method: 'POST',
        data: {
            contents: [{
                parts: [{ 
                    text: '请生成一个简单的测试HTML页面，包含标题"测试页面"和一段文字"这是一个测试页面"。' 
                }]
            }]
        }
    },
    {
        name: '直接Gemini API',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        method: 'POST',
        params: {
            key: process.env.GEMINI_API_KEY || 'YOUR_API_KEY'
        },
        data: {
            contents: [{
                parts: [{ 
                    text: '请生成一个简单的测试HTML页面，包含标题"测试页面"和一段文字"这是一个测试页面"。' 
                }]
            }]
        }
    }
];

async function testEndpoint(endpoint) {
    console.log(`\n🔍 测试: ${endpoint.name}`);
    console.log(`📡 端点: ${endpoint.url}`);
    
    try {
        const config = {
            method: endpoint.method,
            url: endpoint.url,
            timeout: 30000
        };
        
        if (endpoint.data) config.data = endpoint.data;
        if (endpoint.params) config.params = endpoint.params;
        
        const response = await axios(config);
        
        console.log('✅ 接口调用成功!');
        console.log(`📊 状态码: ${response.status}`);
        
        if (response.data) {
            if (response.data.candidates && response.data.candidates[0]) {
                const content = response.data.candidates[0].content.parts[0].text;
                console.log('📄 返回内容预览:', content.substring(0, 200) + '...');
            } else {
                console.log('📄 响应数据:', JSON.stringify(response.data).substring(0, 200) + '...');
            }
        }
        
        return true;
    } catch (error) {
        console.log('❌ 接口调用失败!');
        console.log(`💥 错误信息: ${error.message}`);
        
        if (error.response) {
            console.log(`📊 状态码: ${error.response.status}`);
            console.log(`📄 错误响应:`, error.response.data);
        }
        
        return false;
    }
}

async function runTests() {
    console.log('🚀 开始AI接口测试...');
    console.log('='.repeat(50));
    
    let successCount = 0;
    
    for (const endpoint of testEndpoints) {
        const success = await testEndpoint(endpoint);
        if (success) successCount++;
        
        // 等待2秒再测试下一个
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 测试结果: ${successCount}/${testEndpoints.length} 个接口可用`);
    
    if (successCount === 0) {
        console.log('❌ 所有AI接口都不可用，请检查：');
        console.log('1. Cloudflare Pages是否在本地运行（npx wrangler pages dev）');
        console.log('2. GEMINI_API_KEY环境变量是否设置');
        console.log('3. 网络连接是否正常');
    } else {
        console.log('✅ 有可用的AI接口，可以继续使用');
    }
}

// 运行测试
runTests().catch(console.error);