// Cloudflare D1 Database API - Items endpoint
// Handles /api/db/items requests

export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Check if database is available
  const hasDB = env.DB !== undefined;
  
  // Initialize table if database exists
  if (hasDB) {
    try {
      await env.DB.exec(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error('Error creating table:', error);
    }
  }
  
  if (request.method === 'GET') {
    // Get all items
    if (!hasDB) {
      return new Response(JSON.stringify([
        { id: 1, name: 'Demo Item', description: 'This is a demo item. Set up D1 database to use real data.', created_at: new Date().toISOString() }
      ]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      const result = await env.DB.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
      return new Response(JSON.stringify(result.results || []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } else if (request.method === 'POST') {
    // Add new item
    if (!hasDB) {
      return new Response(JSON.stringify({ 
        error: 'Database not configured. Please set up D1 database. See DATABASE_SETUP.md for instructions.' 
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      const data = await request.json();
      const { name, description } = data;
      
      if (!name || !description) {
        return new Response(JSON.stringify({ error: 'Name and description are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const result = await env.DB.prepare(
        'INSERT INTO items (name, description) VALUES (?, ?)'
      ).bind(name, description).run();
      
      return new Response(JSON.stringify({ 
        id: result.meta.last_row_id,
        name,
        description,
        message: 'Item added successfully'
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
  
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

