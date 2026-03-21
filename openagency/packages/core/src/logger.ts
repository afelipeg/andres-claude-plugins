// ─── Structured Logger Factory ──────────────────────────────────────
// Wraps pino for consistent structured logging across all packages.

import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(name: string): Logger {
  const level = process.env['LOG_LEVEL'] ?? 'info';
  const isDev = process.env['NODE_ENV'] !== 'production';
  const isMcpStdio = process.env['MCP_STDIO'] === '1';

  return pino({
    name,
    level,
    ...(isDev && !isMcpStdio
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  }, isMcpStdio ? pino.destination(2) : undefined);
}
