// Hono Bridge — mounts the entire existing Hono API as a catch-all
// All /api/v1/* routes work instantly without rewriting 32 route files
// In dev without DATABASE_URL, returns a helpful error instead of crashing

let appPromise: Promise<{ fetch: (req: Request) => Response | Promise<Response> }> | null = null;
let bridgeError: string | null = null;

function getApp() {
  if (bridgeError) return null;
  if (!appPromise) {
    appPromise = (async () => {
      try {
        const { createApp } = await import('@openagency/api/app');
        return await createApp();
      } catch (err) {
        bridgeError = err instanceof Error ? err.message : String(err);
        throw err;
      }
    })();
  }
  return appPromise;
}

async function handler(request: Request) {
  // If bridge failed to initialize, return a useful error
  if (bridgeError) {
    return Response.json(
      { error: 'hono_bridge_unavailable', message: `Backend not available: ${bridgeError}. Run the API server separately or configure DATABASE_URL.` },
      { status: 503 },
    );
  }

  try {
    const app = await getApp();
    if (!app) {
      return Response.json({ error: 'bridge_not_ready' }, { status: 503 });
    }

    // Rewrite URL: Next.js serves at /api/v1/... but Hono expects /v1/...
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.replace(/^\/api/, '');
    }
    const rewrittenRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // @ts-expect-error duplex is needed for streaming bodies
      duplex: 'half',
    });
    return app.fetch(rewrittenRequest);
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: 'hono_bridge_error', message: String(err) },
      { status: 503 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

export const runtime = 'nodejs';
export const maxDuration = 300;
