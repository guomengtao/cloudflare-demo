// Get messages endpoint (for polling fallback)
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const since = url.searchParams.get('since') || '0';
  
  try {
    let messages = [];
    
    // If D1 is available, fetch from database
    if (env.DB) {
      try {
        await env.DB.exec(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL
          )
        `);
        
        const result = await env.DB.prepare(
          'SELECT * FROM chat_messages WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 50'
        ).bind(since).all();
        
        messages = (result.results || []).reverse();
      } catch (error) {
        console.error('Database error:', error);
      }
    }
    
    // If no database or no messages, return demo message
    if (messages.length === 0) {
      messages = [{
        id: '1',
        username: 'System',
        text: 'Welcome to the chat! Messages are stored temporarily. Set up D1 database for persistence.',
        timestamp: new Date().toISOString()
      }];
    }
    
    return new Response(JSON.stringify(messages), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

