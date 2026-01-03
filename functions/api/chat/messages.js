// Get messages endpoint (for polling fallback)
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const since = url.searchParams.get('since');
  
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
        
        let result;
        if (since && since !== '0') {
          // Get messages after a specific timestamp
          result = await env.DB.prepare(
            'SELECT * FROM chat_messages WHERE timestamp > ? ORDER BY timestamp ASC LIMIT 50'
          ).bind(since).all();
        } else {
          // Get all recent messages (last 50)
          result = await env.DB.prepare(
            'SELECT * FROM chat_messages ORDER BY timestamp ASC LIMIT 50'
          ).all();
        }
        
        messages = result.results || [];
      } catch (error) {
        console.error('Database error:', error);
      }
    }
    
    // If no database or no messages, return welcome message only on first load
    if (messages.length === 0 && !since) {
      messages = [{
        id: '1',
        username: 'System',
        text: 'Welcome to the chat! Start a conversation by sending a message.',
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

