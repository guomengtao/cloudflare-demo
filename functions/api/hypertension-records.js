// 高血压分析记录 API
// 处理高血压分析记录的保存和查询

export async function onRequest(context) {
  const { request, env } = context;
  
  // CORS 配置
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // 检查数据库是否可用
  const hasDB = env.DB !== undefined;
  
  // 初始化高血压分析记录表
  if (hasDB) {
    try {
      await env.DB.exec(`
        CREATE TABLE IF NOT EXISTS hypertension_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_data TEXT NOT NULL,
          analysis_result TEXT NOT NULL,
          analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          analysis_count INTEGER DEFAULT 1
        )
      `);
    } catch (error) {
      console.error('Error creating hypertension_records table:', error);
    }
  }
  
  // 处理统计信息请求
  const url = new URL(request.url);
  if (url.pathname === '/api/hypertension-records/stats') {
    return handleStatsRequest(hasDB, env, corsHeaders);
  }
  
  if (request.method === 'GET') {
    return handleGetRecords(hasDB, env, corsHeaders);
  } else if (request.method === 'POST') {
    return handlePostRecord(request, hasDB, env, corsHeaders);
  }
  
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 处理获取记录请求
async function handleGetRecords(hasDB, env, corsHeaders) {
  if (!hasDB) {
    return new Response(JSON.stringify([
      { 
        id: 1, 
        patient_data: JSON.stringify({
          age: 45,
          gender: 'male',
          systolic: 140,
          diastolic: 90,
          medication: ['none'],
          smoking: 'no',
          swelling: 'no',
          otherConditions: ['none']
        }),
        analysis_result: JSON.stringify({
          bloodPressure: '140/90',
          bloodPressureLevel: '1级高血压',
          riskLevel: '中危',
          aiAnalysis: '这是演示数据，请设置数据库以使用真实数据。'
        }),
        analysis_date: new Date().toISOString(),
        analysis_count: 1
      }
    ]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const result = await env.DB.prepare('SELECT * FROM hypertension_records ORDER BY analysis_date DESC').all();
    return new Response(JSON.stringify(result.results || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 处理保存记录请求
async function handlePostRecord(request, hasDB, env, corsHeaders) {
  if (!hasDB) {
    return new Response(JSON.stringify({ 
      error: 'Database not configured. Please set up D1 database to save records.' 
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const data = await request.json();
    const { patient_data, analysis_result } = data;
    
    if (!patient_data || !analysis_result) {
      return new Response(JSON.stringify({ error: 'Patient data and analysis result are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const result = await env.DB.prepare(
      'INSERT INTO hypertension_records (patient_data, analysis_result) VALUES (?, ?)'
    ).bind(JSON.stringify(patient_data), JSON.stringify(analysis_result)).run();
    
    return new Response(JSON.stringify({ 
      id: result.meta.last_row_id,
      message: 'Analysis record saved successfully'
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 处理统计信息请求
async function handleStatsRequest(hasDB, env, corsHeaders) {
  if (!hasDB) {
    return new Response(JSON.stringify({
      total_analyses: 1,
      today_analyses: 1
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
    const todayAnalyses = todayResult ? todayResult.count : 0;
    
    return new Response(JSON.stringify({
      total_analyses: totalAnalyses,
      today_analyses: todayAnalyses
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      total_analyses: 0,
      today_analyses: 0,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}