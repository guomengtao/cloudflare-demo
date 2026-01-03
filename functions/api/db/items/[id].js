// Cloudflare D1 Database API - Delete item endpoint
// Handles /api/db/items/:id DELETE requests

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const id = params.id;
  
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Check if database is available
  const hasDB = env.DB !== undefined;
  
  if (!hasDB) {
    return new Response(JSON.stringify({ 
      error: 'Database not configured' 
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Delete item
  try {
    const result = await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Item not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ message: 'Item deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

