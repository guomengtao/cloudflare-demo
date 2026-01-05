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
  if (!hasDB) {
    console.warn('Database not configured. Using demo mode.');
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
        analysis_date: new Date().toISOString()
      }
    ]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const result = await env.DB.prepare('SELECT * FROM hypertension_records ORDER BY analysis_date DESC').all();
    console.log('Records fetched successfully, count:', result.results ? result.results.length : 0);
    return new Response(JSON.stringify(result.results || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching records:', error);
    // 检查是否是表不存在错误
    if (error.message && error.message.includes('no such table')) {
      return new Response(JSON.stringify({ 
        error: '数据库表未创建，请执行初始化命令：npx wrangler d1 execute cloudflare-demo-db --file=schema.sql' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch records: ' + error.message }), {
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
    
    console.log('Record saved successfully, ID:', result.meta.last_row_id);
    
    return new Response(JSON.stringify({ 
      id: result.meta.last_row_id,
      message: 'Analysis record saved successfully'
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error saving record:', error);
    // 检查是否是表不存在错误
    if (error.message && error.message.includes('no such table')) {
      return new Response(JSON.stringify({ 
        error: '数据库表未创建，请执行初始化命令：npx wrangler d1 execute cloudflare-demo-db --file=schema.sql' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to save record: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}