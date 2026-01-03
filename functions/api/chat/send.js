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
    const message = {
      id: Date.now().toString(),
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
      }
    }
    
    return new Response(JSON.stringify({ success: true, message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

