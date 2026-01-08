const https = require('https');

async function testAPI() {
    const data = JSON.stringify({
        contents: [{
            parts: [{
                text: "请生成一个简单的HTML页面，包含标题、段落和图片"
            }]
        }]
    });

    const options = {
        hostname: 'old-haze-afbc.guomengtao.workers.dev',
        path: '/v1/models/gemini-2.5-flash:generateContent?key=AIzaSyDmVIE4nAIv4-rhSg89zLTNVsNqOMzMcxY',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

// 运行测试
testAPI()
    .then(result => {
        console.log('✅ API测试成功');
        console.log('响应:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
        console.log('❌ API测试失败');
        console.log('错误:', error.message);
    });