// 文件内容: /Users/Banner/Documents/tom/functions/api/send.js

// 正确的 send.js 代码
// 使用 chat_messages 表和对应的字段名
// 保持与现有数据库结构一致
export async function onRequestPost(context) {
    const { username, text } = await context.request.json();
    
    // 使用正确的表名 chat_messages
    // 使用正确的字段名: id, username, text, timestamp
    await context.env.DB.prepare(
        "INSERT INTO chat_messages (id, username, text, timestamp) VALUES (?, ?, ?, ?)"
    ).bind(
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // 生成唯一ID
        username || 'Anonymous',
        text,
        new Date().toISOString()
    ).run();
    
    return new Response("OK");
}

// 文件内容: /Users/Banner/Documents/tom/functions/api/messages.js

// 正确的 messages.js 代码
export async function onRequest(context) {
    // 使用正确的表名 chat_messages
    // 使用正确的字段名 timestamp
    const { results } = await context.env.DB.prepare(
        "SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 50"
    ).all();
    
    // 翻转数组，让最新的在下面
    return Response.json(results.reverse());
}

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>极简聊天</title>
    <style>
        body { font-family: sans-serif; max-width: 500px; margin: 20px auto; }
        #chat { height: 300px; border: 1px solid #ccc; overflow-y: scroll; padding: 10px; margin-bottom: 10px; background: #f9f9f9; }
        .msg { margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .time { font-size: 0.8em; color: #888; }
    </style>
</head>
<body>
    <h2>简易聊天室</h2>
    <input type="text" id="user" placeholder="用户名" style="width: 20%">
    <input type="text" id="text" placeholder="输入消息..." style="width: 60%">
    <button onclick="send()">发送</button>
    <div id="chat">加载中...</div>

    <script>
        const chatDiv = document.getElementById('chat');
        
        // 加载消息（包含历史和新消息）
        async function load() {
            try {
                // 使用正确的API端点
                const res = await fetch('/api/messages');
                const msgs = await res.json();
                chatDiv.innerHTML = msgs.map(m => `
                    <div class="msg">
                        <span class="time">[${new Date(m.timestamp).toLocaleTimeString()}]</span>
                        <strong>${m.username}:</strong> ${m.text}
                    </div>
                `).join('');
                // 自动滚动到底部
                chatDiv.scrollTop = chatDiv.scrollHeight;
            } catch (e) { console.error("加载失败"); }
        }

        // 发送消息
        async function send() {
            const username = document.getElementById('user').value || '匿名者';
            const text = document.getElementById('text').value;
            if (!text) return;
            
            // 使用正确的API端点和参数名
            await fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, text }) // 使用正确的参数名
            });
            document.getElementById('text').value = '';
            load(); // 发送后立即刷新
        }

        setInterval(load, 2000); // 每2秒拉取一次，实现“伪实时”
        load(); // 初始加载
    </script>
</body>
</html>