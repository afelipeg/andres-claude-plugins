// ─── Request Logger Middleware ───────────────────────────────────────

import type { Context, Next } from 'hono';

export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const duration = Math.round(performance.now() - start);
    const status = c.res.status;
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';

    console.log(
      JSON.stringify({
        level,
        msg: `${method} ${path}`,
        status,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
    );
  };
}
