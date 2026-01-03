export async function onRequest(context) {
    // 使用正确的表名 chat_messages 和字段名
    const { results } = await context.env.DB.prepare(
        "SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 50"
    ).all();
    
    // 翻转数组，让最新的在下面
    return Response.json(results.reverse());
}
