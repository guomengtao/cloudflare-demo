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
        
        // 使用 Cloudflare Workers AI
        // 选择合适的模型，这里使用 Meta 的 Llama-3-8B 指令模型
        const aiResponse = await env.AI.run(
            '@cf/meta/llama-3-8b-instruct',
            {
                prompt: `You are a helpful AI assistant. Please respond to the user's message:\n\n${message}`,
                max_tokens: 500,
                temperature: 0.7
            }
        );
        
        // 验证响应格式
        if (!aiResponse.response) {
            console.error('Invalid AI response format:', aiResponse);
            return new Response(JSON.stringify({ 
                error: 'Invalid AI response format',
                details: aiResponse
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const responseContent = aiResponse.response;
        
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
