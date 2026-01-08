// 示例：如何从环境变量读取API密钥
require('dotenv').config(); // 加载.env文件

// 方法1：直接读取环境变量
console.log('=== 环境变量读取示例 ===');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '已设置' : '未设置');

// 方法2：安全地使用环境变量
function getGeminiApiKey() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY 环境变量未设置');
    }
    return apiKey;
}

// 方法3：带后备值的读取
function getApiKeyWithFallback() {
    return process.env.GEMINI_API_KEY || 'YOUR_API_KEY';
}

// 测试函数
try {
    const apiKey = getGeminiApiKey();
    console.log('✅ API密钥读取成功');
    console.log('密钥长度:', apiKey.length);
    console.log('密钥前10位:', apiKey.substring(0, 10) + '...');
} catch (error) {
    console.log('❌ 错误:', error.message);
}

// 演示如何在API调用中使用
async function testGeminiAPI() {
    const apiKey = getApiKeyWithFallback();
    
    if (apiKey === 'YOUR_API_KEY') {
        console.log('⚠️  请设置GEMINI_API_KEY环境变量');
        return;
    }
    
    console.log('🔧 准备调用Gemini API...');
    // 这里可以添加实际的API调用代码
}

testGeminiAPI();