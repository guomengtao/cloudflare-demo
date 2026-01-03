// Cloudflare D1 Database API
// Handles /api/db requests

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
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
  
  // Return info about the API
  return new Response(JSON.stringify({ 
    message: 'Database API is ready',
    endpoints: {
      'GET /api/db/items': 'Get all items',
      'POST /api/db/items': 'Add new item',
      'DELETE /api/db/items/:id': 'Delete item'
    },
    database_configured: hasDB
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
