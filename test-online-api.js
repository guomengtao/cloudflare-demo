// 测试线上API接口的独立脚本
const axios = require('axios');

// 测试不同的线上API端点
const testEndpoints = [
    {
        name: '线上Cloudflare Pages API (/api/missing-persons/generate)',
        url: 'https://666.rinuo.com/api/missing-persons/generate',
        method: 'POST',
        data: {
            caseId: 'test-case-123',
            targetLanguage: 'zh-CN'
        }
    },
    {
        name: '线上Cloudflare Pages API (/api/missing-persons/analyze)',
        url: 'https://666.rinuo.com/api/missing-persons/analyze',
        method: 'POST',
        data: {
            caseId: 'test-case-123',
            content: '这是一个测试案件内容'
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
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (endpoint.data) config.data = endpoint.data;
        
        const response = await axios(config);
        
        console.log('✅ 接口调用成功!');
        console.log(`📊 状态码: ${response.status}`);
        
        if (response.data) {
            console.log('📄 响应数据:', JSON.stringify(response.data).substring(0, 300) + '...');
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
    console.log('🚀 开始线上API接口测试...');
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
        console.log('❌ 线上API接口不可用，请检查：');
        console.log('1. 域名 https://666.rinuo.com 是否可访问');
        console.log('2. Cloudflare Pages是否已正确部署');
        console.log('3. API路由配置是否正确');
    } else {
        console.log('✅ 线上API接口可用，可以继续使用');
    }
}

// 运行测试
runTests().catch(console.error);