import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  ...(isProd ? { output: 'standalone' } : {}),
  transpilePackages: [
    '@openagency/core',
    '@openagency/types',
    '@openagency/auth',
    '@openagency/memory',
    '@openagency/engines',
    '@openagency/agent',
    '@openagency/connectors',
    '@openagency/events',
    '@openagency/hfl',
    '@openagency/kb',
    '@openagency/schemas',
  ],
  serverExternalPackages: ['postgres', 'pino', 'pino-pretty', 'googleapis', 'bcryptjs', 'ioredis'],
  // In dev, proxy /api/v1/* to production Railway API (avoids pino worker issues)
  ...(!isProd ? {
    rewrites: async () => [{
      source: '/api/v1/:path*',
      destination: 'https://polanyi-plinth-production.up.railway.app/v1/:path*',
    }],
  } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
