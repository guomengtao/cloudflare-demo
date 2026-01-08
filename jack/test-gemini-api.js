// 测试 Gemini API 作为替代方案
require('dotenv').config({ path: '../.env' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('🧪 测试 Gemini API');
console.log('📊 API Key:', GEMINI_API_KEY ? '已设置' : '未设置');

if (!GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY 未设置');
    process.exit(1);
}

const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${GEMINI_API_KEY}`;

const prompt = `请提取以下信息并以JSON格式返回：
- missing_county: 县/郡
- missing_state: 州/省  
- missing_city: 城市
- caseid: 案件ID（从文件名提取：test123）

案件内容：失踪人员：John Doe，最后出现在洛杉矶市中心，加利福尼亚州，洛杉矶县。

请确保返回纯JSON格式，不要包含任何额外说明。`;

console.log('\n📤 发送请求到 Gemini API...');

fetch(apiUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.3,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048
        }
    })
})
.then(response => {
    console.log('📊 HTTP 状态:', response.status, response.statusText);
    return response.json();
})
.then(data => {
    console.log('📊 响应数据:', JSON.stringify(data, null, 2));
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const responseText = data.candidates[0].content.parts[0].text;
        console.log('✅ Gemini API 调用成功');
        console.log('📊 AI 响应文本:', responseText);
        
        // 尝试提取 JSON 部分
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('✅ JSON 解析成功:', parsed);
            } catch (error) {
                console.log('⚠️  JSON 解析失败:', error.message);
            }
        }
    } else {
        console.log('❌ Gemini API 调用失败:', data.error);
    }
})
.catch(error => {
    console.log('❌ 请求失败:', error.message);
});