// 失踪人口网页生成工具 API
// 处理案件抓取、分析、多语言生成和历史记录查询

// 定义可用的AI模型
const availableModels = [
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/mistral/mistral-7b-instruct-v0.3',
    '@cf/google/gemma-7b-it',
    '@cf/qwen/qwen1.5-7b-chat',
    '@cf/microsoft/phi-3-mini-4k-instruct'
];

// CORS 配置
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions() {
    return new Response(null, {
        headers: corsHeaders,
    });
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 添加请求日志
    console.log('=== 失踪人口API请求 ===');
    console.log('请求路径:', pathname);
    console.log('请求方法:', request.method);
    
    // 处理OPTIONS请求
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }
    
    try {
        // 根据路径路由到不同的处理函数
        if (pathname.endsWith('/scrape') && request.method === 'POST') {
            return await handleScrape(request, env);
        } else if (pathname.endsWith('/analyze') && request.method === 'POST') {
            return await handleAnalyze(request, env);
        } else if (pathname.endsWith('/generate') && request.method === 'POST') {
            return await handleGenerate(request, env);
        } else if (pathname.endsWith('/history') && request.method === 'GET') {
            return await handleHistory(request, env);
        } else if (pathname.endsWith('/cases') && request.method === 'GET') {
            return await handleCases(request, env);
        } else {
            return new Response(JSON.stringify({ 
                error: '接口不存在',
                available_endpoints: ['/scrape', '/analyze', '/generate', '/history', '/cases']
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('API错误:', error);
        return new Response(JSON.stringify({ 
            error: '服务器内部错误',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// 处理网页抓取
async function handleScrape(request, env) {
    try {
        const { caseUrl } = await request.json();
        
        if (!caseUrl) {
            return new Response(JSON.stringify({ error: '案件URL不能为空' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // 从URL中提取案件ID
        const caseId = extractCaseIdFromUrl(caseUrl);
        
        // 检查是否已存在该案件
        const existingCase = await env.DB.prepare(
            'SELECT * FROM missing_persons_cases WHERE case_url = ? OR case_id = ?'
        ).bind(caseUrl, caseId).first();
        
        if (existingCase) {
            return new Response(JSON.stringify({
                success: true,
                content: existingCase.scraped_content,
                characterCount: existingCase.scraped_content.length,
                caseId: existingCase.case_id || caseId,
                message: '案件已存在，使用缓存内容'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // 模拟网页抓取（实际项目中应使用真实的抓取逻辑）
        const mockContent = `案件URL: ${caseUrl}
案件标题: Dorothy P. Goroshko 失踪案件
失踪时间: 1999年5月15日
最后出现地点: 纽约市
年龄: 45岁
身高: 165cm
体重: 60kg
头发颜色: 棕色
眼睛颜色: 蓝色
特征描述: 戴眼镜，左臂有玫瑰纹身

案件详情:
Dorothy P. Goroshko于1999年5月15日在纽约市失踪。她最后一次被看到是在她位于曼哈顿的公寓附近。家人报告说她当时情绪稳定，没有异常行为。警方调查显示她没有财务问题或人际关系冲突。案件至今未破。

如有任何信息，请联系纽约市警察局失踪人口部门。`;
        
        // 保存到数据库（包含case_id字段）
        const result = await env.DB.prepare(
            'INSERT INTO missing_persons_cases (case_url, case_id, case_title, scraped_content) VALUES (?, ?, ?, ?)'
        ).bind(caseUrl, caseId, 'Dorothy P. Goroshko 失踪案件', mockContent).run();
        
        return new Response(JSON.stringify({
            success: true,
            content: mockContent,
            characterCount: mockContent.length,
            caseId: caseId,
            message: '网页内容抓取成功'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('抓取错误:', error);
        return new Response(JSON.stringify({ 
            error: '抓取失败',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// 从URL中提取案件ID的辅助函数
function extractCaseIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const caseIndex = pathParts.indexOf('case');
        if (caseIndex !== -1 && caseIndex < pathParts.length - 1) {
            return pathParts[caseIndex + 1];
        }
    } catch (error) {
        console.error('URL解析错误:', error);
    }
    return '';
}

// 处理案件分析
async function handleAnalyze(request, env) {
    try {
        const { caseId, content } = await request.json();
        
        if (!caseId || !content) {
            return new Response(JSON.stringify({ error: '案件ID和内容不能为空' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // 检查env.AI是否可用
        if (!env.AI) {
            throw new Error('Cloudflare Workers AI不可用');
        }
        
        // 生成分析提示词
        const analysisPrompt = `请分析以下失踪人口案件信息，提取关键信息并生成结构化的分析报告：

案件内容：
${content}

请按照以下格式输出分析结果：
1. 基本信息（姓名、年龄、失踪时间、地点等）
2. 物理特征描述
3. 案件关键细节
4. 调查进展
5. 联系方式

请使用专业、客观的语言进行分析。`;
        
        // 调用AI进行分析
        const aiResponse = await env.AI.run(
            '@cf/meta/llama-3.1-8b-instruct',
            {
                messages: [
                    { role: 'system', content: '你是一位专业的失踪人口案件分析师。请准确提取案件信息并提供结构化分析。' },
                    { role: 'user', content: analysisPrompt }
                ],
                max_tokens: 1024,
                temperature: 0.1
            }
        );
        
        const analysisResult = aiResponse.response || JSON.stringify(aiResponse);
        
        // 更新数据库
        await env.DB.prepare(
            'UPDATE missing_persons_cases SET analysis_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(analysisResult, caseId).run();
        
        return new Response(JSON.stringify({
            success: true,
            analysis: analysisResult,
            message: '案件分析完成'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('分析错误:', error);
        return new Response(JSON.stringify({ 
            error: '分析失败',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// 处理多语言生成
async function handleGenerate(request, env) {
    try {
        const { caseId, targetLanguage } = await request.json();
        
        if (!caseId || !targetLanguage) {
            return new Response(JSON.stringify({ error: '案件ID和目标语言不能为空' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // 获取案件信息
        const caseInfo = await env.DB.prepare(
            'SELECT * FROM missing_persons_cases WHERE id = ?'
        ).bind(caseId).first();
        
        if (!caseInfo) {
            return new Response(JSON.stringify({ error: '案件不存在' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // 检查env.AI是否可用
        if (!env.AI) {
            throw new Error('Cloudflare Workers AI不可用');
        }
        
        // 根据目标语言生成提示词
        const languagePrompts = {
            'zh-CN': '请将以下失踪人口案件信息翻译成简体中文，并生成适合中文读者阅读的网页内容：',
            'en': 'Please translate the following missing persons case information into English and generate web content suitable for English readers:',
            'es': 'Por favor, traduzca la siguiente información del caso de personas desaparecidas al español y genere contenido web adecuado para lectores hispanohablantes:'
        };
        
        const prompt = languagePrompts[targetLanguage] || '请翻译以下内容：';
        
        const generatePrompt = `${prompt}

案件内容：
${caseInfo.scraped_content}

分析结果：
${caseInfo.analysis_result}

请生成完整的HTML网页内容，包含适当的标题、段落和联系方式。`;
        
        // 调用AI生成内容
        const aiResponse = await env.AI.run(
            '@cf/meta/llama-3.1-8b-instruct',
            {
                messages: [
                    { role: 'system', content: '你是一位专业的网页内容翻译和生成专家。请生成高质量的多语言网页内容。' },
                    { role: 'user', content: generatePrompt }
                ],
                max_tokens: 2048,
                temperature: 0.2
            }
        );
        
        const generatedContent = aiResponse.response || JSON.stringify(aiResponse);
        
        // 保存生成记录
        await env.DB.prepare(
            'INSERT INTO generation_history (case_id, target_language, generated_content) VALUES (?, ?, ?)'
        ).bind(caseId, targetLanguage, generatedContent).run();
        
        return new Response(JSON.stringify({
            success: true,
            content: generatedContent,
            language: targetLanguage,
            message: `${targetLanguage}版本网页生成成功`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('生成错误:', error);
        return new Response(JSON.stringify({ 
            error: '生成失败',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// 处理历史记录查询
async function handleHistory(request, env) {
    try {
        const histories = await env.DB.prepare(
            `SELECT gh.*, mpc.case_url, mpc.case_title 
             FROM generation_history gh 
             JOIN missing_persons_cases mpc ON gh.case_id = mpc.id 
             ORDER BY gh.created_at DESC 
             LIMIT 10`
        ).all();
        
        return new Response(JSON.stringify({
            success: true,
            histories: histories.results || []
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('历史记录查询错误:', error);
        return new Response(JSON.stringify({ 
            error: '查询失败',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// 处理案件列表查询
async function handleCases(request, env) {
    try {
        const cases = await env.DB.prepare(
            'SELECT * FROM missing_persons_cases ORDER BY created_at DESC LIMIT 10'
        ).all();
        
        return new Response(JSON.stringify({
            success: true,
            cases: cases.results || []
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('案件查询错误:', error);
        return new Response(JSON.stringify({ 
            error: '查询失败',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}