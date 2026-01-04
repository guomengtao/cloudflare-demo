export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        // 获取请求数据
        const data = await request.json();
        const { message } = data;
        
        if (!message || typeof message !== 'string') {
            return new Response(JSON.stringify({ error: 'Invalid message' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 从Cloudflare环境变量中获取DeepSeek API密钥
        const deepseekApiKey = env.DEEPSEEK_API_KEY;
        
        if (!deepseekApiKey) {
            console.error('DeepSeek API key not found in environment variables');
            return new Response(JSON.stringify({ 
                error: 'DeepSeek API key not configured',
                details: 'Please set DEEPSEEK_API_KEY environment variable'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 调用DeepSeek API
        const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are a helpful AI assistant.' },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });
        
        if (!deepseekResponse.ok) {
            const errorData = await deepseekResponse.json().catch(() => ({}));
            console.error('DeepSeek API error:', {
                status: deepseekResponse.status,
                statusText: deepseekResponse.statusText,
                error: errorData
            });
            return new Response(JSON.stringify({ 
                error: 'DeepSeek API error',
                status: deepseekResponse.status,
                details: errorData
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const deepseekData = await deepseekResponse.json();
        if (!deepseekData.choices || !deepseekData.choices[0] || !deepseekData.choices[0].message) {
            console.error('Invalid DeepSeek API response:', deepseekData);
            return new Response(JSON.stringify({ 
                error: 'Invalid AI response format',
                details: deepseekData
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const responseContent = deepseekData.choices[0].message.content;
        
        // 返回AI回复
        return new Response(JSON.stringify({ response: responseContent }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Error in AI chat API:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return new Response(JSON.stringify({ 
            error: 'Internal server error',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}