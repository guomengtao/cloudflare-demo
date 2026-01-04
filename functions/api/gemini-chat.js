export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        // 添加请求日志
        console.log('=== Gemini Chat API Request Received ===');
        console.log('Request method:', request.method);
        console.log('Request URL:', new URL(request.url).pathname);
        
        // 解析前端传来的消息
        const { message } = await request.json();
        console.log('Request body:', { message: message.substring(0, 50) + '...' });
        
        // 验证输入
        if (!message || typeof message !== 'string') {
            console.log('Invalid message received:', message);
            return new Response(JSON.stringify({ 
                error: 'Invalid message',
                debug: { message, type: typeof message } 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 从环境变量获取 API Key
        const API_KEY = env.GEMINI_API_KEY;
        
        if (!API_KEY) {
            console.error('GEMINI_API_KEY environment variable not set');
            return new Response(JSON.stringify({ 
                error: 'API configuration error',
                debug: 'GEMINI_API_KEY not set'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

        // 构建发送给 Google 的数据结构
        const googlePayload = {
            contents: [{
                parts: [{ text: message }]
            }],
            generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
            }
        };

        // 发起中转请求
        console.log('Calling Gemini API...');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(googlePayload)
        });

        const data = await response.json();
        
        // 记录完整的Gemini响应
        console.log('Gemini response received:', JSON.stringify(data, null, 2));

        // 重点：清洗 Google 返回的复杂数据
        // Google 的结构是 data.candidates[0].content.parts[0].text
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const aiReply = data.candidates[0].content.parts[0].text;
            
            // 返回AI回复
            console.log('Successfully processed request, returning response');
            return new Response(JSON.stringify({ 
                response: aiReply,
                model: 'Gemini 1.5 Flash',
                debug: { 
                    status: 'success',
                    response_length: aiReply.length
                } 
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            console.error('Invalid Gemini response format:', data);
            throw new Error('Gemini 返回格式异常');
        }

    } catch (error) {
        console.error('=== Gemini Chat API Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return new Response(JSON.stringify({ 
            error: 'Internal server error',
            details: error.message,
            debug: {
                name: error.name,
                stack: error.stack.split('\n'),
                timestamp: new Date().toISOString()
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
