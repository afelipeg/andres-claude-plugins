// ─── Delivery Skill Utilities ─────────────────────────────────────────
// Shared helpers for all Delivery Engine skills.
// Not exported from the engine — internal only.

import { ulid } from 'ulid';
import { callLLM, detectLLMConfig } from '@openagency/core';
import type { DeliveryFileOutput, DeliveryFileType } from '@openagency/types';
import {
  createFileStorage,
  buildStorageKey,
  buildTempPath,
} from '../tools/file-storage.js';

// ─── LLM ─────────────────────────────────────────────────────────────

/**
 * Call Claude with a system + user prompt. Returns the raw text response.
 * Uses detectLLMConfig() (Anthropic → DeepSeek fallback, per arch rules).
 * maxTokens is set to 4096 to allow for substantial delivery content.
 */
export async function callDeliveryLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const base = detectLLMConfig();
  if (!base) {
    throw new Error('No LLM configured. Set ANTHROPIC_API_KEY.');
  }
  const config = { ...base, maxTokens: 4096, temperature: 0.3 };
  const result = await callLLM(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);
  return result.content;
}

/**
 * Try to parse Claude's response as JSON.
 * Claude occasionally wraps JSON in a markdown code block — strip it first.
 */
export function parseJsonResponse<T>(raw: string): T {
  // Strip ```json ... ``` or ``` ... ``` fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  return JSON.parse(stripped) as T;
}

// ─── File persistence ─────────────────────────────────────────────────

export interface PersistResult {
  fileId: string;
  fileOutput: DeliveryFileOutput;
}

/**
 * Move a locally-generated temp file into the configured storage backend
 * (local dir or S3) and return a fully-resolved DeliveryFileOutput.
 * DB recording is left to the API/mesh layer that calls the engine.
 */
export async function persistGeneratedFile(params: {
  clientId: string;
  skillId: string;
  runId: string;
  fileType: DeliveryFileType;
  /** Absolute path of the temp file written by the generator. */
  localPath: string;
  sizeBytes: number;
}): Promise<PersistResult> {
  const { clientId, skillId, runId, fileType, localPath, sizeBytes } = params;
  const fileId = ulid();
  const storageKey = buildStorageKey(clientId, fileId, fileType, skillId);
  const storage = createFileStorage();
  await storage.save(localPath, storageKey);
  const downloadUrl = storage.getDownloadUrl(storageKey, fileId);

  return {
    fileId,
    fileOutput: {
      file_id: fileId,
      file_type: fileType,
      file_path: storageKey,
      size_bytes: sizeBytes,
      download_url: downloadUrl,
      metadata: { client_id: clientId, skill_id: skillId, run_id: runId },
    },
  };
}

/** Convenience: generate a unique temp path for a given fileType. */
export function tempPath(fileType: DeliveryFileType): string {
  return buildTempPath(ulid(), fileType);
}

// ─── Layer-1 data summarizer ──────────────────────────────────────────

/**
 * Produce a compact, token-efficient JSON summary of Layer-1 results
 * suitable for inclusion in Claude prompts.
 */
export function summarizeLayerOne(layerOne: unknown): string {
  try {
    // Trim deeply nested structures to top-level keys + a few values
    const obj = layerOne as Record<string, unknown>;
    const summary: Record<string, unknown> = {};
    for (const [engine, result] of Object.entries(obj)) {
      if (result == null || typeof result !== 'object') continue;
      // Take top-level numeric and string fields, skip arrays deeper than 2 items
      const top: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
        if (Array.isArray(v)) {
          top[k] = v.slice(0, 3); // limit array depth for token budget
        } else if (v !== null && typeof v === 'object') {
          top[k] = v; // include sub-objects as-is
        } else {
          top[k] = v;
        }
      }
      summary[engine] = top;
    }
    return JSON.stringify(summary, null, 2);
  } catch {
    return JSON.stringify(layerOne, null, 2);
  }
}
