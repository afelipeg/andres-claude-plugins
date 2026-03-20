// ─── Auto-Saver ─────────────────────────────────────────────────────
// Subscribes to mesh.pipeline.completed and saves engine outputs to R2.
// CRITICAL: Uses setImmediate() to avoid blocking the pipeline semaphore.

import type { EventBus, EngineEvent } from '@openagency/types';
import type { KBFolderRepo, KBDocumentRepo } from './repos.js';
import { getOrCreateRunFolder } from './folder-manager.js';
import { upload, buildR2Key } from './r2-client.js';

export interface AutoSaverDeps {
  eventBus: EventBus;
  folderRepo: KBFolderRepo;
  documentRepo: KBDocumentRepo;
  /** Function to retrieve a MeshRun by id */
  getMeshRun: (runId: string) => MeshRunLike | undefined;
  /** Optional Redis client for LPUSH indexing queue */
  redis?: RedisLike | null;
  /** Logger */
  log?: LogLike;
}

/** Minimal MeshRun shape we need (avoid importing full agent package) */
export interface MeshRunLike {
  id: string;
  pipeline_id: string;
  status: string;
  context: {
    run_id: string;
    stage_results: Map<string, StageResultLike>;
  };
  usage?: {
    agent_client_id?: string;
  };
}

export interface StageResultLike {
  agent_id: string;
  status: string;
  /** OodaCycleResult — typed as unknown to avoid coupling to agent package */
  cycle_result?: unknown;
  skills_invoked: string[];
  output_summary?: Record<string, unknown>;
}

interface RedisLike {
  lpush(key: string, ...values: string[]): Promise<number>;
}

interface LogLike {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
}

const noopLog: LogLike = {
  info: () => {},
  warn: () => {},
};

/**
 * Subscribe to mesh.pipeline.completed and auto-save engine outputs to R2.
 * Returns the unsubscribe function.
 */
export function startAutoSaver(deps: AutoSaverDeps): () => void {
  const { eventBus, folderRepo, documentRepo, getMeshRun, redis, log = noopLog } = deps;

  return eventBus.subscribe('mesh.pipeline.completed', (event: EngineEvent<unknown>) => {
    const payload = event.payload as { run_id: string };
    const runId = payload.run_id;

    // CRITICAL: Use setImmediate to avoid blocking the pipeline semaphore
    setImmediate(() => {
      void saveRunOutputs(runId).catch((err: unknown) => {
        log.warn({ err, run_id: runId }, 'Auto-saver failed for run');
      });
    });
  });

  async function saveRunOutputs(runId: string): Promise<void> {
    const meshRun = getMeshRun(runId);
    if (!meshRun) {
      log.warn({ run_id: runId }, 'Auto-saver: MeshRun not found');
      return;
    }

    const clientId = meshRun.usage?.agent_client_id ?? 'unknown';
    // Use a default agency_id — in production this comes from the run context
    const agencyId = 'default';

    // Get or create the run folder under "Engine Outputs"
    let runFolder;
    try {
      runFolder = await getOrCreateRunFolder(folderRepo, agencyId, clientId, runId);
    } catch (err: unknown) {
      log.warn({ err, run_id: runId }, 'Auto-saver: Failed to create run folder');
      return;
    }

    const documentIds: string[] = [];

    // Upload each engine stage result as JSON
    for (const [stageId, result] of meshRun.context.stage_results.entries()) {
      if (result.status !== 'completed') continue;

      const engineName = result.agent_id;
      const filename = `${engineName}.json`;
      const r2Key = buildR2Key(agencyId, clientId, `engine-outputs/${runId}`, filename);

      // Extract data from cycle_result if present (OodaCycleResult shape)
      const cycleData = result.cycle_result && typeof result.cycle_result === 'object'
        ? (result.cycle_result as Record<string, unknown>)['data'] ?? null
        : null;

      const outputData = {
        stage_id: stageId,
        agent_id: result.agent_id,
        status: result.status,
        skills_invoked: result.skills_invoked,
        output_summary: result.output_summary ?? {},
        data: cycleData,
      };

      try {
        const body = JSON.stringify(outputData, null, 2);
        await upload(r2Key, body, 'application/json');

        const doc = await documentRepo.create({
          folder_id: runFolder.id,
          agency_id: agencyId,
          client_id: clientId,
          filename,
          mime_type: 'application/json',
          size_bytes: Buffer.byteLength(body),
          r2_key: r2Key,
          source_type: 'engine_output',
          run_id: runId,
          run_type: meshRun.pipeline_id,
          engine_name: engineName,
          skill_name: result.skills_invoked.join(', '),
          metadata: {
            stage_id: stageId,
            pipeline_id: meshRun.pipeline_id,
          },
        });

        documentIds.push(doc.id);

        log.info(
          { run_id: runId, engine: engineName, doc_id: doc.id, r2_key: r2Key },
          'Auto-saver: Uploaded engine output',
        );
      } catch (err: unknown) {
        log.warn(
          { err, run_id: runId, engine: engineName },
          'Auto-saver: Failed to upload engine output',
        );
      }
    }

    // Upload run manifest
    try {
      const manifest = {
        run_id: runId,
        pipeline_id: meshRun.pipeline_id,
        status: meshRun.status,
        client_id: clientId,
        agency_id: agencyId,
        stages: Array.from(meshRun.context.stage_results.entries()).map(([id, r]) => ({
          stage_id: id,
          agent_id: r.agent_id,
          status: r.status,
          skills_invoked: r.skills_invoked,
        })),
        document_ids: documentIds,
        created_at: new Date().toISOString(),
      };

      const manifestKey = buildR2Key(agencyId, clientId, `engine-outputs/${runId}`, 'manifest.json');
      const manifestBody = JSON.stringify(manifest, null, 2);
      await upload(manifestKey, manifestBody, 'application/json');

      await documentRepo.create({
        folder_id: runFolder.id,
        agency_id: agencyId,
        client_id: clientId,
        filename: 'manifest.json',
        mime_type: 'application/json',
        size_bytes: Buffer.byteLength(manifestBody),
        r2_key: manifestKey,
        source_type: 'manifest',
        run_id: runId,
        run_type: meshRun.pipeline_id,
        metadata: { document_count: documentIds.length },
      });

      log.info({ run_id: runId, docs_saved: documentIds.length }, 'Auto-saver: Run manifest saved');
    } catch (err: unknown) {
      log.warn({ err, run_id: runId }, 'Auto-saver: Failed to upload manifest');
    }

    // Enqueue documents for indexing via Redis LPUSH
    if (redis && documentIds.length > 0) {
      try {
        await redis.lpush('kb:index_queue', ...documentIds);
        log.info(
          { run_id: runId, count: documentIds.length },
          'Auto-saver: Enqueued documents for indexing',
        );
      } catch (err: unknown) {
        log.warn({ err, run_id: runId }, 'Auto-saver: Failed to enqueue indexing');
      }
    }
  }
}
