export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 首页 - 显示导航页面
    if (path === '/' || path === '/index.html') {
      return new Response(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI 平台代理服务</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    text-align: center;
                }
                h1 { color: #333; margin-bottom: 30px; }
                .btn { 
                    display: block;
                    margin: 15px 0;
                    padding: 15px 30px;
                    background: #007bff;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 16px;
                    transition: background 0.3s;
                }
                .btn:hover { background: #0056b3; }
                .info { 
                    background: #f8f9fa; 
                    padding: 15px; 
                    border-radius: 8px;
                    margin-top: 30px;
                    text-align: left;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 AI 平台代理服务</h1>
                <p>通过 Cloudflare Worker 安全访问 AI 平台</p>
                
                <a href="/chatgpt" class="btn">💬 访问 ChatGPT</a>
                <a href="/claude" class="btn">🧠 访问 Claude</a>
                <a href="/bard" class="btn">🔍 访问 Google Bard</a>
                <a href="/bing" class="btn">🌐 访问 Bing Chat</a>
                
                <div class="info">
                    <strong>工作原理：</strong><br>
                    1. 点击上方按钮<br>
                    2. Worker 会将您重定向到官方平台<br>
                    3. 在新标签页中安全访问
                </div>
            </div>
        </body>
        </html>
      `, {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    // 代理到各个平台
    if (path === '/chatgpt') {
      return Response.redirect('https://chat.openai.com', 302);
    }
    
    if (path === '/claude') {
      return Response.redirect('https://claude.ai', 302);
    }
    
    if (path === '/bard') {
      return Response.redirect('https://bard.google.com', 302);
    }
    
    if (path === '/bing') {
      return Response.redirect('https://bing.com/chat', 302);
    }
    
    // 404 页面
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>页面未找到</title></head>
      <body>
        <h1>404 - 页面未找到</h1>
        <p>请返回 <a href="/">首页</a></p>
      </body>
      </html>
    `, {
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    });
  }
};