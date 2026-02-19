import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Replace Node.js-only modules with browser-compatible stubs.
// @openagency/core's config.ts uses node:fs/path/os; engines import
// from the core barrel which transitively pulls in config.
function browserStubs(): Plugin {
  return {
    name: 'browser-stubs',
    enforce: 'pre',
    resolveId(source) {
      if (source === 'node:fs' || source === 'node:path' || source === 'node:os') {
        return `\0browser-stub:${source}`;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith('\0browser-stub:')) return null;
      if (id.includes('node:fs')) {
        return [
          'export function readFileSync() { return "{}"; }',
          'export function existsSync() { return false; }',
          'export function mkdirSync() {}',
          'export function writeFileSync() {}',
          'export function chmodSync() {}',
        ].join('\n');
      }
      if (id.includes('node:path')) {
        return 'export function join(...a) { return a.join("/"); }';
      }
      if (id.includes('node:os')) {
        return 'export function homedir() { return "/tmp"; }';
      }
      return 'export default {};';
    },
  };
}

export default defineConfig({
  plugins: [browserStubs(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          pdf: ['jspdf'],
        },
      },
    },
  },
});
