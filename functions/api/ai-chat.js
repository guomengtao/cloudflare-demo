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
        
        const { message, model } = data;
        
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
        
        // 定义可用模型
        const availableModels = [
            '@cf/meta/llama-3.1-8b-instruct',
            '@cf/meta/llama-3.2-1b-instruct',
            '@cf/microsoft/phi-2',
            '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
            '@cf/google/gemma-7b-it',
            '@cf/qwen/qwen-7b-chat',
            '@cf/mistral/mistral-7b-instruct-v0.2',
            '@cf/01ai/yi-6b-chat'
        ];
        
        // 验证模型
        const selectedModel = model && availableModels.includes(model) ? model : '@cf/meta/llama-3.1-8b-instruct';
        
        // 使用 Cloudflare Workers AI
        console.log('Calling AI model with prompt:', message.substring(0, 50) + '...');
        console.log('Selected model:', selectedModel);
        
        const aiResponse = await env.AI.run(
            selectedModel,
            {
                prompt: `你是一个高效的助手，请用最简练的语言回答问题，除非我要求你详细说明。\n\n用户问题：${message}`,
                max_tokens: 256,
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
            model: selectedModel,
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
