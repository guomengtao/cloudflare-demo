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
        // 修复路径匹配逻辑，使用更精确的匹配
        const pathSegments = pathname.split('/').filter(segment => segment);
        
        // 检查是否是 /api/missing-persons 下的请求
        if (pathSegments.length >= 3 && 
            pathSegments[0] === 'api' && 
            pathSegments[1] === 'missing-persons') {
            
            const endpoint = pathSegments[pathSegments.length - 1];
            
            if (endpoint === 'scrape' && request.method === 'POST') {
                return await handleScrape(request, env);
            } else if (endpoint === 'analyze' && request.method === 'POST') {
                return await handleAnalyze(request, env);
            } else if (endpoint === 'generate' && request.method === 'POST') {
                return await handleGenerate(request, env);
            } else if (endpoint === 'history' && request.method === 'GET') {
                return await handleHistory(request, env);
            } else if (endpoint === 'cases' && request.method === 'GET') {
                return await handleCases(request, env);
            } else if (endpoint === 'info' && request.method === 'GET') {
                return await handleInfo(request, env);
            } else {
                return new Response(JSON.stringify({ 
                    error: '接口不存在',
                    available_endpoints: ['/api/missing-persons/scrape', '/api/missing-persons/analyze', '/api/missing-persons/generate', '/api/missing-persons/history', '/api/missing-persons/cases']
                }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        } else {
            return new Response(JSON.stringify({ 
                error: '路径格式不正确',
                expected_path: '/api/missing-persons/{endpoint}'
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
        
        // 真实的网页抓取逻辑
        console.log(`🌐 开始抓取案件页面: ${caseUrl}`);
        
        try {
            // 使用fetch API进行网页抓取
            const response = await fetch(caseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // 解析HTML内容
            const scrapedContent = await parseCaseContent(html, caseUrl, caseId);
            
            // 从HTML中提取案件标题
            const caseTitle = extractCaseTitle(html, caseId);
            
            // 保存到数据库
            const result = await env.DB.prepare(
                'INSERT INTO missing_persons_cases (case_url, case_id, case_title, scraped_content) VALUES (?, ?, ?, ?)'
            ).bind(caseUrl, caseId, caseTitle, scrapedContent).run();
            
            console.log(`✅ 案件抓取成功: ${caseTitle}`);
            
            return new Response(JSON.stringify({
                success: true,
                content: scrapedContent,
                characterCount: scrapedContent.length,
                caseId: caseId,
                caseTitle: caseTitle,
                message: '网页内容抓取成功'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
            
        } catch (fetchError) {
            console.error('网页抓取失败:', fetchError);
            // 如果抓取失败，使用AI生成内容作为备选方案
            return await handleScrapeWithAI(caseUrl, caseId, env);
        }
        
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

// 解析案件内容的辅助函数
async function parseCaseContent(html, caseUrl, caseId) {
    try {
        // 这里可以使用更复杂的HTML解析逻辑
        // 目前先提取主要文本内容
        
        // 提取<title>标签内容
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1].trim() : '未知标题';
        
        // 提取<body>标签内的主要文本内容
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let bodyContent = bodyMatch ? bodyMatch[1] : html;
        
        // 移除脚本和样式标签
        bodyContent = bodyContent.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
        
        // 提取纯文本内容
        const textContent = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // 限制内容长度，避免数据库字段过长
        const maxLength = 10000;
        const truncatedContent = textContent.length > maxLength 
            ? textContent.substring(0, maxLength) + '...（内容已截断）' 
            : textContent;
        
        return `案件URL: ${caseUrl}
案件ID: ${caseId}
页面标题: ${pageTitle}

原始网页内容:
${truncatedContent}

抓取时间: ${new Date().toISOString()}`;
        
    } catch (error) {
        console.error('内容解析错误:', error);
        return `案件URL: ${caseUrl}
案件ID: ${caseId}

错误信息: 内容解析失败 - ${error.message}

抓取时间: ${new Date().toISOString()}`;
    }
}

// 从HTML中提取案件标题
function extractCaseTitle(html, caseId) {
    try {
        // 提取<title>标签内容
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            const title = titleMatch[1].trim();
            // 清理标题，移除网站名称等无关信息
            return title.replace(/- Charley Project|失踪案件|Missing Case/gi, '').trim();
        }
        
        // 提取<h1>标签内容
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) {
            return h1Match[1].trim();
        }
        
        // 如果无法提取标题，使用案件ID生成标题
        return `${caseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 失踪案件`;
        
    } catch (error) {
        console.error('标题提取错误:', error);
        return `${caseId} 失踪案件`;
    }
}

// 使用AI生成案件内容的备选方案
async function handleScrapeWithAI(caseUrl, caseId, env) {
    try {
        if (!env.AI) {
            throw new Error('Cloudflare Workers AI不可用');
        }
        
        console.log('🤖 使用AI生成案件内容...');
        
        const aiPrompt = `请根据以下失踪人口案件URL生成详细的案件描述：

案件URL: ${caseUrl}
案件ID: ${caseId}

请生成一个结构化的失踪人口案件描述，包含以下信息：
1. 案件基本信息（姓名、年龄、失踪时间、最后出现地点）
2. 物理特征描述
3. 案件背景和详情
4. 调查进展
5. 联系方式

请使用专业、客观的语言，基于典型的失踪人口案件格式进行描述。`;

        const aiResponse = await env.AI.run(
            '@cf/meta/llama-3.1-8b-instruct',
            {
                messages: [
                    { role: 'system', content: '你是一位专业的失踪人口案件记录员。请根据提供的案件信息生成详细、准确的案件描述。' },
                    { role: 'user', content: aiPrompt }
                ],
                max_tokens: 1024,
                temperature: 0.3
            }
        );
        
        const aiContent = aiResponse.response || JSON.stringify(aiResponse);
        const caseTitle = `${caseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 失踪案件`;
        
        // 保存到数据库
        const result = await env.DB.prepare(
            'INSERT INTO missing_persons_cases (case_url, case_id, case_title, scraped_content) VALUES (?, ?, ?, ?)'
        ).bind(caseUrl, caseId, caseTitle, aiContent).run();
        
        return new Response(JSON.stringify({
            success: true,
            content: aiContent,
            characterCount: aiContent.length,
            caseId: caseId,
            caseTitle: caseTitle,
            message: 'AI生成案件内容成功（网页抓取失败时的备选方案）'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
    } catch (aiError) {
        console.error('AI生成失败:', aiError);
        throw new Error(`网页抓取和AI生成的失败了: ${aiError.message}`);
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

// 处理失踪人口信息查询的新函数
async function handleInfo(request, env) {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 30;
        const sortBy = url.searchParams.get('sortBy') || 'analyzed_at';
        const sortOrder = url.searchParams.get('sortOrder') || 'DESC';
        const offset = (page - 1) * limit;
        
        // 验证排序字段和顺序
        const allowedFields = ['case_id', 'full_name', 'missing_since', 'missing_city', 'missing_county', 'missing_state', 'analyzed_at'];
        const safeSortBy = allowedFields.includes(sortBy) ? sortBy : 'analyzed_at';
        const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
        
        // 查询数据
        const result = await env.DB.prepare(
            `SELECT 
                mpi.case_id, mpi.full_name, mpi.missing_since, 
                mpi.missing_city, mpi.missing_county, mpi.missing_state 
            FROM missing_persons_info mpi
            JOIN missing_persons_cases mpc ON mpi.case_id = mpc.case_id
            WHERE mpc.html_status = 1
            ORDER BY ${safeSortBy} ${safeSortOrder} 
            LIMIT ? OFFSET ?`
        ).bind(limit, offset).all();
        
        // 查询总数
        const countResult = await env.DB.prepare(
            `SELECT COUNT(*) as total 
            FROM missing_persons_info mpi
            JOIN missing_persons_cases mpc ON mpi.case_id = mpc.case_id
            WHERE mpc.html_status = 1`
        ).all();
        
        return new Response(JSON.stringify({
            success: true,
            data: result.results || [],
            pagination: {
                page,
                limit,
                total: countResult.results[0].total,
                totalPages: Math.ceil(countResult.results[0].total / limit)
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('信息查询错误:', error);
        return new Response(JSON.stringify({ 
            error: '查询失败',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}