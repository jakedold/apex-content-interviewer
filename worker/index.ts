const ROUTES: Readonly<Record<string, string>> = {
  '/api/validate': '/webhook/aac/interview/validate',
  '/api/start': '/webhook/aac/interview/start',
  '/api/complete': '/webhook/aac/interview/complete',
  '/api/review/validate': '/webhook/aac/review/validate',
  '/api/review/respond': '/webhook/aac/review/respond',
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const upstreamPath = ROUTES[url.pathname];

    if (!upstreamPath) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== 'POST') {
      return new Response(null, {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }

    try {
      const upstreamUrl = new URL(upstreamPath, env.N8N_BASE_URL);
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('cf-connecting-ip');
      headers.delete('cf-ray');
      headers.delete('x-forwarded-for');

      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: request.body,
        redirect: 'manual',
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'n8n_proxy_failed',
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return jsonError('The interview service is temporarily unavailable.', 502);
    }
  },
} satisfies ExportedHandler<Env>;
