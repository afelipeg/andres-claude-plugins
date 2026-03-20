import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Replace Node.js-only modules with browser-compatible stubs.
// Intercepts ALL node:* imports so pino and other server-only deps don't
// crash the browser bundle (these are never called in-browser).
function browserStubs(): Plugin {
  return {
    name: 'browser-stubs',
    enforce: 'pre',
    resolveId(source) {
      if (source.startsWith('node:') || source === 'pino' || source === 'pino-pretty' || source === 'sonic-boom' || source === 'thread-stream') {
        return `\0browser-stub:${source}`;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith('\0browser-stub:')) return null;
      if (id.includes('node:fs')) {
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
      if (id.includes('node:stream')) {
        return [
          'export class Writable { write() {} end() {} on() { return this; } once() { return this; } emit() {} }',
          'export class Readable { pipe() {} on() { return this; } once() { return this; } emit() {} }',
          'export class Transform extends Writable {}',
          'export class PassThrough extends Transform {}',
          'export function pipeline(...args) { const cb = args[args.length-1]; if (typeof cb === "function") cb(null); }',
          'export default { Writable, Readable, Transform, PassThrough, pipeline };',
        ].join('\n');
      }
      if (id.includes('node:events')) {
        return [
          'export class EventEmitter { on() { return this; } once() { return this; } off() { return this; } emit() {} removeListener() { return this; } removeAllListeners() { return this; } }',
          'export default EventEmitter;',
        ].join('\n');
      }
      if (id.includes('node:util')) {
        return [
          'export function promisify(fn) { return (...args) => new Promise((res, rej) => fn(...args, (e, v) => e ? rej(e) : res(v))); }',
          'export function inherits(ctor, superCtor) { ctor.super_ = superCtor; Object.setPrototypeOf(ctor.prototype, superCtor.prototype); }',
          'export function format(...a) { return a.join(" "); }',
          'export function inspect(v) { return String(v); }',
          'export default { promisify, inherits, format, inspect };',
        ].join('\n');
      }
      if (id.includes('node:url')) {
        return [
          'export class URL { constructor(u) { const o = new globalThis.URL(u); Object.assign(this, o); } toString() { return this.href; } }',
          'export function pathToFileURL(p) { return new URL("file://" + p); }',
          'export function fileURLToPath(u) { return String(u).replace("file://", ""); }',
          'export default { URL, pathToFileURL, fileURLToPath };',
        ].join('\n');
      }
      if (id.includes('node:buffer')) {
        return [
          'export const Buffer = globalThis.Buffer ?? { from: (d) => new Uint8Array(typeof d === "string" ? new TextEncoder().encode(d) : d), alloc: (n) => new Uint8Array(n), isBuffer: (v) => v instanceof Uint8Array };',
          'export default { Buffer };',
        ].join('\n');
      }
      if (id.includes('node:http') || id.includes('node:https') || id.includes('node:net') || id.includes('node:tls') || id.includes('node:dns') || id.includes('node:assert') || id.includes('node:worker_threads') || id.includes('node:child_process') || id.includes('node:cluster')) {
        return 'export default {}; export const createServer = () => ({}); export const request = () => ({});';
      }
      if (id.includes('pino') || id.includes('sonic-boom') || id.includes('thread-stream')) {
        return [
          'const noop = () => {};',
          'const logger = { trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop, child: () => logger };',
          'export default function pino() { return logger; }',
          'export { logger };',
        ].join('\n');
      }
      // Generic fallback for any other node: module
      return 'export default {};\nexport const __stub = true;';
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
      // node:* modules are now handled by browserStubs() plugin above.
      external: [
        'pdfkit',
        'pptxgenjs',
        'exceljs',
        'docx',
        'ioredis',
        '@aws-sdk/client-s3',
        'fontkit',
        'restructure',
      ],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts', 'highcharts', 'highcharts-react-official'],
          pdf: ['jspdf'],
        },
      },
    },
  },
});
