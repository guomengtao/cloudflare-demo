// WebSocket handler for chat
export async function onRequest(context) {
  const { request, env } = context;
  
  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }
  
  // For now, return a simple response since Durable Objects setup is complex
  // This is a placeholder that will work with the fallback polling mode
  return new Response('WebSocket endpoint - use polling mode for now', { status: 200 });
}

