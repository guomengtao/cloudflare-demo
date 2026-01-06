export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 代理到 ChatGPT
    if (url.pathname === '/chatgpt') {
      return Response.redirect('https://chat.openai.com', 302);
    }
    
    // 代理到其他平台
    if (url.pathname === '/claude') {
      return Response.redirect('https://claude.ai', 302);
    }
    
    if (url.pathname === '/bard') {
      return Response.redirect('https://bard.google.com', 302);
    }
    
    // 返回导航页面
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AI Platform Proxy</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
          .btn { display: inline-block; margin: 10px; padding: 15px 30px; 
                 background: #007bff; color: white; text-decoration: none; 
                 border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>AI 平台代理服务</h1>
        <a href="/chatgpt" class="btn">访问 ChatGPT</a>
        <a href="/claude" class="btn">访问 Claude</a>
        <a href="/bard" class="btn">访问 Google Bard</a>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};