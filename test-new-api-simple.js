async function testAPI() {
    const url = 'https://old-haze-afbc.guomengtao.workers.dev/v1/models/gemini-2.5-flash:generateContent?key=AIzaSyDmVIE4nAIv4-rhSg89zLTNVsNqOMzMcxY';
    
    const data = {
        contents: [{
            parts: [{
                text: "请生成一个简单的HTML页面，包含标题、段落和图片"
            }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        throw error;
    }
}

// 运行测试
testAPI()
    .then(result => {
        console.log('✅ API测试成功');
        console.log('响应状态:', result.error ? '有错误' : '正常');
        
        if (result.error) {
            console.log('❌ API返回错误:', result.error.message);
        } else if (result.candidates && result.candidates.length > 0) {
            console.log('🎉 AI响应成功!');
            console.log('生成的内容长度:', result.candidates[0].content.parts[0].text.length);
            console.log('模型版本:', result.modelVersion);
        }
        
        console.log('完整响应:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
        console.log('❌ API测试失败');
        console.log('错误详情:', error.message);
    });