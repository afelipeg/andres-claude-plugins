// ─── MCP Process Manager ─────────────────────────────────────────────
// Spawns and manages Python MCP server processes for self-hosted MCPs.

import { spawn, type ChildProcess } from 'node:child_process';
import { createLogger } from '@openagency/core';

const log = createLogger('federation:mcp-process');

interface ManagedProcess {
  pid: number;
  port: number;
  process: ChildProcess;
  catalogId: string;
  connectionId: string;
}

const COMMANDS: Record<string, { bin: string; args: (port: number) => string[] }> = {
  google_ads_mcp: {
    bin: 'pipx',
    args: (port) => ['run', 'google-ads-mcp', '--transport', 'http', '--port', String(port)],
  },
  meta_ads_mcp: {
    bin: 'python3',
    args: (port) => ['-m', 'facebook_ads_mcp', '--port', String(port)],
  },
  tiktok_ads_mcp: {
    bin: 'python3',
    args: (port) => ['-m', 'adsmcp_tiktok', '--port', String(port)],
  },
  dv360_mcp: {
    bin: 'python3',
    args: (port) => ['-m', 'dv360_mcp.server', '--port', String(port)],
  },
};

export class McpProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private portBase = 9100;

  /** Spawn an MCP server process. Returns the MCP endpoint URL. */
  async spawnMcpServer(
    connectionId: string,
    catalogId: string,
    env: Record<string, string>,
  ): Promise<{ url: string; pid: number }> {
    const cmd = COMMANDS[catalogId];
    if (!cmd) {
      throw new Error(`No spawn command configured for catalog: ${catalogId}`);
    }

    const port = this.getNextPort();
    log.info({ connectionId, catalogId, port }, 'Spawning MCP server process');

    const proc = spawn(cmd.bin, cmd.args(port), {
      env: { ...process.env, ...env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    if (!proc.pid) {
      throw new Error(`Failed to spawn process for ${catalogId}`);
    }

    // Log stderr for debugging
    proc.stderr?.on('data', (data: Buffer) => {
      log.warn({ connectionId, catalogId }, `MCP stderr: ${data.toString().trim()}`);
    });

    proc.on('exit', (code) => {
      log.info({ connectionId, catalogId, code }, 'MCP process exited');
      this.processes.delete(connectionId);
    });

    this.processes.set(connectionId, {
      pid: proc.pid,
      port,
      process: proc,
      catalogId,
      connectionId,
    });

    // Wait for server to be ready
    const url = `http://localhost:${port}/mcp`;
    await this.waitForReady(url, 15_000);

    log.info({ connectionId, catalogId, port, pid: proc.pid }, 'MCP server process started');
    return { url, pid: proc.pid };
  }

  /** Kill a managed process */
  killProcess(connectionId: string): void {
    const managed = this.processes.get(connectionId);
    if (managed) {
      log.info({ connectionId, pid: managed.pid }, 'Killing MCP process');
      try {
        managed.process.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
      this.processes.delete(connectionId);
    }
  }

  /** Check if a process is still alive by PID */
  isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0); // Signal 0 = check existence without killing
      return true;
    } catch {
      return false;
    }
  }

  /** List all managed processes */
  listProcesses(): Array<{ connectionId: string; catalogId: string; pid: number; port: number }> {
    return Array.from(this.processes.values()).map((p) => ({
      connectionId: p.connectionId,
      catalogId: p.catalogId,
      pid: p.pid,
      port: p.port,
    }));
  }

  private getNextPort(): number {
    const usedPorts = new Set(Array.from(this.processes.values()).map((p) => p.port));
    for (let p = this.portBase; p < this.portBase + 100; p++) {
      if (!usedPorts.has(p)) return p;
    }
    throw new Error('No available ports for MCP process (9100-9199 exhausted)');
  }

  private async waitForReady(url: string, timeout: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'plinth-healthcheck', version: '1.0.0' } } }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`MCP server did not start within ${timeout}ms at ${url}`);
  }
}
