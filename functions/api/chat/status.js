// Check database status endpoint
export async function onRequestGet(context) {
  const { env } = context;
  
  const status = {
    database_available: env.DB !== undefined,
    database_type: typeof env.DB,
    env_keys: Object.keys(env || {}),
    timestamp: new Date().toISOString()
  };
  
  // Try to query database if available
  if (env.DB) {
    try {
      const result = await env.DB.prepare('SELECT COUNT(*) as count FROM chat_messages').first();
      status.message_count = result?.count || 0;
      status.database_working = true;
    } catch (error) {
      status.database_working = false;
      status.database_error = error.message;
    }
  }
  
  return new Response(JSON.stringify(status, null, 2), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

