export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        // 添加请求日志
        console.log('=== AI Chat API Request Received ===');
        console.log('Request method:', request.method);
        console.log('Request URL:', new URL(request.url).pathname);
        console.log('Request headers:', Object.fromEntries(request.headers));
        
        // 检查AI绑定是否存在
        console.log('AI binding exists:', !!env.AI);
        
        // 获取请求数据
        const data = await request.json();
        console.log('Request body:', data);
        
        const { message } = data;
        
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
        
        // 使用 Cloudflare Workers AI
        console.log('Calling AI model with prompt:', message.substring(0, 50) + '...');
        
        const aiResponse = await env.AI.run(
            '@cf/meta/llama-3-8b-instruct',
            {
                prompt: `You are a helpful AI assistant. Please respond to the user's message:\n\n${message}`,
                max_tokens: 500,
                temperature: 0.7
            }
        );
        
        // 记录完整的AI响应
        console.log('AI response received:', JSON.stringify(aiResponse, null, 2));
        
        // 验证响应格式
        if (!aiResponse.response) {
            console.error('Invalid AI response format:', aiResponse);
            return new Response(JSON.stringify({ 
                error: 'Invalid AI response format',
                details: aiResponse,
                debug: 'No response field in AI response'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const responseContent = aiResponse.response;
        
        // 返回AI回复
        console.log('Successfully processed request, returning response');
        return new Response(JSON.stringify({ 
            response: responseContent,
            debug: { 
                status: 'success',
                response_length: responseContent.length
            } 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('=== AI Chat API Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
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