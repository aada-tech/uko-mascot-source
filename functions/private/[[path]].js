// Nothing under /private/ is ever served directly (the paid pack lives there).
export const onRequest = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
