import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('createLogger', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'warn');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a pino logger with the given name', async () => {
    const { createLogger } = await import('../src/logger.js');
    const logger = createLogger('test-module');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('respects LOG_LEVEL env', async () => {
    vi.stubEnv('LOG_LEVEL', 'error');
    // Re-import to get fresh module with new env
    const { createLogger } = await import('../src/logger.js');
    const logger = createLogger('test-level');
    expect(logger.level).toBe('error');
  });

  it('defaults to info level when LOG_LEVEL is not set', async () => {
    vi.stubEnv('LOG_LEVEL', '');
    delete process.env['LOG_LEVEL'];
    const { createLogger } = await import('../src/logger.js');
    const logger = createLogger('test-default');
    expect(logger.level).toBe('info');
  });
});
