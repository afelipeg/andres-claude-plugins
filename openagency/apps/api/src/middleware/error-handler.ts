// ─── Global Error Handler ───────────────────────────────────────────

import type { Context } from 'hono';

export function errorHandler(err: Error, c: Context) {
  console.error(
    JSON.stringify({
      level: 'ERROR',
      msg: 'Unhandled error',
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    }),
  );

  return c.json(
    {
      error: 'internal_error',
      message: process.env['NODE_ENV'] === 'production'
        ? 'An internal error occurred'
        : err.message,
      status: 500,
    },
    500,
  );
}
