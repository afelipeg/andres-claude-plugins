// ─── Configuration Loader ───────────────────────────────────────────

import { readFileSync, existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { OpenAgencyConfig } from '@openagency/types';

const CONFIG_DIR = '.openagency';
const CONFIG_FILE = 'config.json';

function getConfigDir(): string {
  // Check CWD first, then home dir
  const cwdConfig = join(process.cwd(), CONFIG_DIR);
  if (existsSync(cwdConfig)) return cwdConfig;

  const homeConfig = join(homedir(), CONFIG_DIR);
  return homeConfig;
}

export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE);
}

export function loadConfig(): OpenAgencyConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as OpenAgencyConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: OpenAgencyConfig): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  // Strip any API keys before writing — keys belong in env vars, not config files
  const safeConfig = structuredClone(config);
  if (safeConfig.llm) {
    delete safeConfig.llm.apiKey;
  }

  const configPath = join(configDir, CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(safeConfig, null, 2), { mode: 0o600 });
}
