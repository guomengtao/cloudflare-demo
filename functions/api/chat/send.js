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
      let insertResult = null;
      try {
        // Ensure table exists
        await env.DB.exec(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL
          )
        `);
        
        // Insert message - handle D1 database response properly
        insertResult = await env.DB.prepare(
          'INSERT INTO chat_messages (id, username, text, timestamp) VALUES (?, ?, ?, ?)'
        ).bind(message.id, message.username, message.text, message.timestamp).run();
        
        // Verify the insert was successful
        // D1 returns { success: true, meta: {...} } structure
        const success = insertResult?.success !== false;
        
        if (success) {
          console.log('Message saved to database:', message.id, insertResult);
        } else {
          console.error('Failed to insert message:', JSON.stringify(insertResult, null, 2));
          // Return error response if insert failed
          return new Response(JSON.stringify({ 
            error: 'Failed to save message to database',
            details: insertResult,
            message: message 
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      } catch (error) {
        console.error('Database error:', error);
        const errorDetails = {
          message: error.message,
          name: error.name,
          stack: error.stack,
          messageData: message,
          envKeys: Object.keys(env || {}),
          insertResultType: typeof insertResult,
          insertResultKeys: insertResult ? Object.keys(insertResult) : null,
          insertResultValue: insertResult
        };
        console.error('Database error details:', errorDetails);
        
        // Return detailed error for debugging
        return new Response(JSON.stringify({ 
          error: 'Database error: ' + error.message,
          errorDetails: errorDetails,
          message: message 
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } else {
      console.warn('Database (env.DB) is not available. Available env keys:', Object.keys(env || {}));
      // Return error if database is not configured
      return new Response(JSON.stringify({ 
        error: 'Database not configured. Please bind D1 database to Pages project.',
        message: message 
      }), {
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
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

