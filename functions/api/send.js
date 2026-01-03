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