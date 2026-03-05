// ─── Request Logger Middleware ───────────────────────────────────────

import type { Context, Next } from 'hono';
import { createLogger } from '@openagency/core';

const log = createLogger('api');

export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const duration = Math.round(performance.now() - start);
    const status = c.res.status;

    if (status >= 500) {
      log.error({ method, path, status, duration_ms: duration }, `${method} ${path}`);
    } else if (status >= 400) {
      log.warn({ method, path, status, duration_ms: duration }, `${method} ${path}`);
    } else {
      log.info({ method, path, status, duration_ms: duration }, `${method} ${path}`);
    }
  };
}
