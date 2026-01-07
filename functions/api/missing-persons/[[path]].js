export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }
    
    // 处理不同的API端点
    const pathParts = path.split('/').filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1];
    
    try {
        let result;
        
        switch (endpoint) {
            case 'scrape':
                if (request.method === 'POST') {
                    result = await handleScrape(request, env);
                } else {
                    return new Response('Method Not Allowed', { status: 405 });
                }
                break;
                
            case 'analyze':
                if (request.method === 'POST') {
                    result = await handleAnalyze(request, env);
                } else {
                    return new Response('Method Not Allowed', { status: 405 });
                }
                break;
                
            case 'generate':
                if (request.method === 'POST') {
                    result = await handleGenerate(request, env);
                } else {
                    return new Response('Method Not Allowed', { status: 405 });
                }
                break;
                
            case 'history':
                if (request.method === 'POST') {
                    result = await handleHistory(request, env);
                } else {
                    return new Response('Method Not Allowed', { status: 405 });
                }
                break;
                
            case 'cases':
                if (request.method === 'GET') {
                    result = await handleCases(request, env);
                } else {
                    return new Response('Method Not Allowed', { status: 405 });
                }
                break;
                
            default:
                return new Response('Not Found', { status: 404 });
        }
        
        // 添加CORS头
        result.headers.set('Access-Control-Allow-Origin', '*');
        result.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        result.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        return result;
        
    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// 网页抓取功能
async function handleScrape(request, env) {
    try {
        const { url } = await request.json();
        
        // 使用Cloudflare Workers的fetch抓取网页
        const response = await fetch(url);
        const html = await response.text();
        
        // 提取文本内容（简化版，实际需要更复杂的解析）
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        return new Response(JSON.stringify({ 
            success: true, 
            text: text.substring(0, 10000) // 限制长度
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// AI分析功能
async function handleAnalyze(request, env) {
    try {
        const { caseId, sourceText } = await request.json();
        
        // 使用Gemini API进行案件分析
        const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.GEMINI_API_KEY}`
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `请对以下失踪人口案件进行专业分析：

案件信息：
${sourceText}

请提供以下分析内容：
1. 案件基本情况总结
2. 失踪人员特征分析
3. 可能的原因推测
4. 调查建议
5. 公众协助建议

请用专业、客观的语言进行分析。`
                    }]
                }]
            })
        });
        
        if (!geminiResponse.ok) {
            throw new Error(`Gemini API error: ${geminiResponse.status}`);
        }
        
        const result = await geminiResponse.json();
        
        if (!result.candidates || !result.candidates[0]) {
            throw new Error('Invalid response from Gemini API');
        }
        
        const analysis = result.candidates[0].content.parts[0].text;
        
        // 保存分析结果到数据库
        await env.DB.prepare(`
            INSERT OR REPLACE INTO missing_persons_cases (case_id, url, source_text, ai_analysis, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(caseId, `https://charleyproject.org/case/${caseId}`, sourceText, analysis).run();
        
        return new Response(JSON.stringify({ 
            success: true, 
            analysis 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 网页生成功能
async function handleGenerate(request, env) {
    try {
        const { caseId, language } = await request.json();
        
        // 获取案件数据
        const caseData = await env.DB.prepare(`
            SELECT * FROM missing_persons_cases WHERE case_id = ?
        `).bind(caseId).first();
        
        if (!caseData) {
            throw new Error('案件不存在，请先进行案件分析');
        }
        
        // 使用Gemini API生成对应语言的网页
        const prompt = getGenerationPrompt(caseData, language);
        
        const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.GEMINI_API_KEY}`
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });
        
        if (!geminiResponse.ok) {
            throw new Error(`Gemini API error: ${geminiResponse.status}`);
        }
        
        const result = await geminiResponse.json();
        
        if (!result.candidates || !result.candidates[0]) {
            throw new Error('Invalid response from Gemini API');
        }
        
        const webpageCode = result.candidates[0].content.parts[0].text;
        
        // 保存生成的网页代码
        const columnName = `webpage_code_${language}`;
        await env.DB.prepare(`
            UPDATE missing_persons_cases 
            SET ${columnName} = ?, updated_at = datetime('now')
            WHERE case_id = ?
        `).bind(webpageCode, caseId).run();
        
        // 保存到历史记录
        await env.DB.prepare(`
            INSERT INTO generation_history (case_id, language_code, webpage_code, analysis_result)
            VALUES (?, ?, ?, ?)
        `).bind(caseId, language, webpageCode, caseData.ai_analysis).run();
        
        return new Response(JSON.stringify({ 
            success: true, 
            webpageCode 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 获取历史记录
async function handleHistory(request, env) {
    try {
        const { caseId } = await request.json();
        
        const history = await env.DB.prepare(`
            SELECT * FROM generation_history 
            WHERE case_id = ? 
            ORDER BY created_at DESC
            LIMIT 10
        `).bind(caseId).all();
        
        return new Response(JSON.stringify({ 
            success: true, 
            history: history.results 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 获取案件列表
async function handleCases(request, env) {
    try {
        const cases = await env.DB.prepare(`
            SELECT case_id, url, created_at FROM missing_persons_cases 
            ORDER BY created_at DESC
            LIMIT 50
        `).all();
        
        return new Response(JSON.stringify({ 
            success: true, 
            cases: cases.results 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 生成提示词模板
function getGenerationPrompt(caseData, language) {
    const prompts = {
        'zh': `请生成一个专业、简洁的失踪人口案件网页，使用地道的大陆简体中文。

案件信息：${caseData.sourceText}

AI分析：${caseData.ai_analysis}

要求：
1. 界面简洁明了，不要有过多装饰
2. 包含案件基本信息、AI分析结果
3. 提供联系方式区域
4. 响应式设计，适配移动端
5. 使用现代HTML5和CSS3

请只返回完整的HTML代码，不要有其他内容。`,
        
        'en': `Please generate a professional, concise missing persons case webpage using authentic American English.

Case Information: ${caseData.sourceText}

AI Analysis: ${caseData.ai_analysis}

Requirements:
1. Clean and clear interface without excessive decoration
2. Include basic case information and AI analysis results
3. Provide contact information section
4. Responsive design for mobile devices
5. Use modern HTML5 and CSS3

Return only the complete HTML code, no other content.`,
        
        'es': `Por favor, genera una página web profesional y concisa sobre un caso de persona desaparecida usando español auténtico.

Información del caso: ${caseData.sourceText}

Análisis de IA: ${caseData.ai_analysis}

Requisitos:
1. Interfaz limpia y clara sin decoración excesiva
2. Incluir información básica del caso y resultados del análisis de IA
3. Proporcionar sección de información de contacto
4. Diseño responsivo para dispositivos móviles
5. Usar HTML5 y CSS3 modernos

Devuelve solo el código HTML completo, sin otro contenido.`
    };
    
    return prompts[language] || prompts['en'];
}