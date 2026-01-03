export async function onRequest(context) {
    // 从 D1 数据库查询最近 50 条消息
    const { results } = await context.env.DB.prepare(
        "SELECT * FROM messages ORDER BY created_at DESC LIMIT 50"
    ).all();
    
    // 翻转数组，让最新的在下面
    return Response.json(results.reverse());
}
