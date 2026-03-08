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
      if (
        source === 'node:fs' ||
        source === 'node:path' ||
        source === 'node:os' ||
        source === 'node:crypto'
      ) {
        return `\0browser-stub:${source}`;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith('\0browser-stub:')) return null;
      if (id.includes('node:fs')) {
        // Delivery engine tools import fs — stub both named and default exports
        // so the browser build does not crash (these are never called in-browser).
        const namedExports = [
          'export function readFileSync() { return "{}"; }',
          'export function existsSync() { return false; }',
          'export function mkdirSync() {}',
          'export function writeFileSync() {}',
          'export function chmodSync() {}',
          'export function createWriteStream() { return { pipe() {}, on() {}, end() {} }; }',
          'export const promises = { stat: async () => ({ size: 0 }), copyFile: async () => {}, mkdir: async () => {}, readFile: async () => new Uint8Array(), unlink: async () => {} };',
        ].join('\n');
        const defaultExport =
          'export default { readFileSync: () => "{}", existsSync: () => false, mkdirSync: () => {}, writeFileSync: () => {}, chmodSync: () => {}, createWriteStream: () => ({ pipe() {}, on() {}, end() {} }), promises };';
        return `${namedExports}\n${defaultExport}`;
      }
      if (id.includes('node:path')) {
        return [
          'export function join(...a) { return a.join("/"); }',
          'export function dirname(p) { return p.split("/").slice(0, -1).join("/"); }',
          'export function basename(p) { return p.split("/").pop() ?? ""; }',
          'export function extname(p) { const b = p.split("/").pop() ?? ""; const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; }',
          'export function resolve(...a) { return a.join("/"); }',
          'export default { join: (...a) => a.join("/"), dirname: (p) => p.split("/").slice(0, -1).join("/"), basename: (p) => p.split("/").pop() ?? "", resolve: (...a) => a.join("/") };',
        ].join('\n');
      }
      if (id.includes('node:crypto')) {
        return [
          'export function createHash(algo) { return { update(d) { return this; }, digest() { return Array.from({length:64},() => Math.floor(Math.random()*16).toString(16)).join(""); } }; }',
          'export function randomBytes(n) { return new Uint8Array(n); }',
          'export default { createHash: (algo) => ({ update(d) { return this; }, digest() { return Array.from({length:64},() => Math.floor(Math.random()*16).toString(16)).join(""); } }), randomBytes: (n) => new Uint8Array(n) };',
        ].join('\n');
      }
      if (id.includes('node:os')) {
        return [
          'export function homedir() { return "/tmp"; }',
          'export function tmpdir() { return "/tmp"; }',
          'export default { homedir: () => "/tmp", tmpdir: () => "/tmp" };',
        ].join('\n');
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
      // Delivery engine packages are Node.js-only — exclude from browser bundle.
      external: [
        'pdfkit',
        'pptxgenjs',
        'exceljs',
        'docx',
        'ioredis',
        'ulid',
        '@aws-sdk/client-s3',
        'fontkit',
        'restructure',
        'node:net',
        'node:tls',
        'node:dns',
        'node:assert',
        'node:stream',
        'node:buffer',
        'node:events',
        'node:util',
        'node:url',
        'node:http',
        'node:https',
      ],
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
