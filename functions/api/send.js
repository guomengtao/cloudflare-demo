export async function onRequestPost(context) {
    const { username, text } = await context.request.json();
    
    // 使用正确的表名 chat_messages 和字段名
    await context.env.DB.prepare(
        "INSERT INTO chat_messages (id, username, text, timestamp) VALUES (?, ?, ?, ?)"
    ).bind(
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        username || 'Anonymous',
        text,
        new Date().toISOString()
    ).run();
    
    return new Response("OK");
}