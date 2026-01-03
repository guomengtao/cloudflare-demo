// Send message endpoint (fallback for when WebSocket is not available)
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const { username, text, type } = data;
    
    if (!username || !text) {
      return new Response(JSON.stringify({ error: 'Username and text are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store message in D1 database if available, otherwise use in-memory storage
    // Generate unique ID with timestamp and random component
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username,
      text,
      type: type || 'message',
      timestamp: new Date().toISOString()
    };
    
    // If D1 is available, store the message
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
        
        await env.DB.prepare(
          'INSERT INTO chat_messages (id, username, text, timestamp) VALUES (?, ?, ?, ?)'
        ).bind(message.id, message.username, message.text, message.timestamp).run();
      } catch (error) {
        console.error('Database error:', error);
        // Continue even if database fails - message will still be returned
      }
    }
    
    return new Response(JSON.stringify({ success: true, message }), {
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

