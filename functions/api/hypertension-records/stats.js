// 高血压分析记录统计信息 API
export async function onRequest(context) {
  const { request, env } = context;
  
  // CORS 配置
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // 检查数据库是否可用
  const hasDB = env.DB !== undefined;
  if (!hasDB) {
    return new Response(JSON.stringify({
      total_analyses: 0,
      today_analyses: 0,
      message: 'Database not configured, using demo data'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // 获取总分析次数
    const totalResult = await env.DB.prepare('SELECT COUNT(*) as count FROM hypertension_records').first();
    const totalAnalyses = totalResult ? totalResult.count : 0;
    
    // 获取今日分析次数
    const todayResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM hypertension_records WHERE DATE(analysis_date) = DATE("now")'
    ).first();
    const todayAnalyses = todayResult ? totalResult.count : 0;
    
    console.log('Stats fetched - Total:', totalAnalyses, 'Today:', todayAnalyses);
    
    return new Response(JSON.stringify({
      total_analyses: totalAnalyses,
      today_analyses: todayAnalyses
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    // 检查是否是表不存在错误
    if (error.message && error.message.includes('no such table')) {
      return new Response(JSON.stringify({ 
        total_analyses: 0,
        today_analyses: 0,
        error: '数据库表未创建，请执行初始化命令：npx wrangler d1 execute cloudflare-demo-db --file=schema.sql'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ 
      total_analyses: 0,
      today_analyses: 0,
      error: 'Failed to fetch stats: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}