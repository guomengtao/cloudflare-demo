// 获取 Gemini 可用模型列表
require('dotenv').config({ path: '../.env' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('🧪 获取 Gemini 可用模型');

const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

fetch(apiUrl)
.then(response => {
    console.log('📊 HTTP 状态:', response.status, response.statusText);
    return response.json();
})
.then(data => {
    console.log('📊 可用模型:', JSON.stringify(data, null, 2));
})
.catch(error => {
    console.log('❌ 请求失败:', error.message);
});