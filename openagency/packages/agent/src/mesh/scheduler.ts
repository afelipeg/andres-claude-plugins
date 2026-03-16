// ─── Pipeline Scheduler ─────────────────────────────────────────────
// Runs scheduled pipelines based on cron expressions.
// Uses setInterval (60s tick) + simple cron matcher.
// Persists schedules to PostgreSQL when DB is available.

import { ulid } from 'ulid';
import { createLogger } from '@openagency/core';
import {
  meshScheduleCreated,
  meshScheduleTriggered,
  meshScheduleDeleted,
} from '@openagency/events';
import type { EventBus } from '@openagency/types';
import type {
  PipelineSchedule,
  CreateScheduleInput,
} from '@openagency/types';
import type { MeshCoordinator } from './mesh-coordinator.js';

// ─── Cron Matching ─────────────────────────────────────────────────
// Supports standard 5-part cron: "min hour dom month dow"
// Each field: number, *, comma-list, or range (n-m)

function parseCronField(field: string, value: number): boolean {
  if (field === '*') return true;

  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      if (lo !== undefined && hi !== undefined && value >= lo && value <= hi) return true;
    } else {
      if (Number(part) === value) return true;
    }
  }
  return false;
}

/** Returns true if the given Date matches the cron expression. */
export function matchesCron(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minF, hourF, domF, monF, dowF] = parts as [string, string, string, string, string];

  return (
    parseCronField(minF, date.getMinutes()) &&
    parseCronField(hourF, date.getHours()) &&
    parseCronField(domF, date.getDate()) &&
    parseCronField(monF, date.getMonth() + 1) &&
    parseCronField(dowF, date.getDay())
  );
}

/** Compute next execution time after `from` for a cron expression (max 1 year look-ahead). */
export function nextCronDate(cron: string, from: Date = new Date()): Date | null {
  const candidate = new Date(from);
  // Start from next minute
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const limit = new Date(from);
  limit.setFullYear(limit.getFullYear() + 1);

  while (candidate < limit) {
    if (matchesCron(cron, candidate)) return new Date(candidate);
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return null;
}

// ─── DB Adapter interface ───────────────────────────────────────────
// Minimal interface so scheduler can persist without a hard dependency
// on the full DB stack. Implementations in app.ts via inline adapter.

export interface ScheduleRepository {
  create(schedule: PipelineSchedule): Promise<void>;
  findAll(): Promise<PipelineSchedule[]>;
  findById(id: string): Promise<PipelineSchedule | null>;
  updateLastRun(id: string, lastRunAt: string, nextRunAt: string | null): Promise<void>;
  delete(id: string): Promise<boolean>;
}

// ─── PipelineScheduler ─────────────────────────────────────────────

export class PipelineScheduler {
  private schedules = new Map<string, PipelineSchedule>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private log = createLogger('scheduler');

  constructor(
    private mesh: MeshCoordinator,
    private eventBus: EventBus,
    private repo?: ScheduleRepository,
    private contextBuilder?: (clientId: string) => Promise<Record<string, unknown>>,
  ) {}

  /** Load persisted schedules and start the 60-second tick. */
  async start(): Promise<void> {
    if (this.repo) {
      const persisted = await this.repo.findAll();
      for (const s of persisted) {
        this.schedules.set(s.id, s);
      }
      this.log.info({ count: persisted.length }, 'Loaded schedules from DB');
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);

    this.log.info('Scheduler started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.log.info('Scheduler stopped');
  }

  /** Create and persist a new schedule. */
  async createSchedule(input: CreateScheduleInput): Promise<PipelineSchedule> {
    const now = new Date().toISOString();
    const nextRun = nextCronDate(input.cron);

    const schedule: PipelineSchedule = {
      id: ulid(),
      client_id: input.client_id,
      pipeline_id: input.pipeline_id,
      cron: input.cron,
      auto_approve: input.auto_approve ?? false,
      notify_on_complete: input.notify_on_complete ?? true,
      enabled: input.enabled ?? true,
      created_at: now,
      next_run_at: nextRun?.toISOString(),
    };

    this.schedules.set(schedule.id, schedule);

    if (this.repo) {
      await this.repo.create(schedule);
    }

    await this.eventBus.publish(
      meshScheduleCreated({
        schedule_id: schedule.id,
        pipeline_id: schedule.pipeline_id,
        client_id: schedule.client_id,
        cron: schedule.cron,
        next_run_at: schedule.next_run_at,
      }),
    );

    this.log.info(
      { schedule_id: schedule.id, pipeline_id: schedule.pipeline_id, cron: schedule.cron, next_run_at: schedule.next_run_at },
      'Schedule created',
    );

    return schedule;
  }

  /** Delete a schedule by ID. Returns false if not found. */
  async deleteSchedule(id: string): Promise<boolean> {
    const schedule = this.schedules.get(id);
    if (!schedule) return false;

    this.schedules.delete(id);

    if (this.repo) {
      await this.repo.delete(id);
    }

    await this.eventBus.publish(
      meshScheduleDeleted({
        schedule_id: id,
        pipeline_id: schedule.pipeline_id,
      }),
    );

    this.log.info({ schedule_id: id }, 'Schedule deleted');
    return true;
  }

  getSchedule(id: string): PipelineSchedule | undefined {
    return this.schedules.get(id);
  }

  listSchedules(clientId?: string): PipelineSchedule[] {
    const all = Array.from(this.schedules.values());
    if (clientId) return all.filter((s) => s.client_id === clientId);
    return all;
  }

  /** Called every minute. Fires any schedules whose cron matches now. */
  private async tick(): Promise<void> {
    const now = new Date();
    // Round to minute boundary for clean matching
    now.setSeconds(0, 0);

    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) continue;
      if (!matchesCron(schedule.cron, now)) continue;

      this.log.info(
        { schedule_id: schedule.id, pipeline_id: schedule.pipeline_id },
        'Schedule triggered — executing pipeline',
      );

      void this.triggerSchedule(schedule, now);
    }
  }

  private async triggerSchedule(schedule: PipelineSchedule, now: Date): Promise<void> {
    try {
      // Build skillContext with previous run comparison for feedback loop
      const skillContext: Record<string, unknown> = {};
      if (this.contextBuilder) {
        const ctx = await this.contextBuilder(schedule.client_id);
        Object.assign(skillContext, ctx);
      }

      const run = await this.mesh.executePipeline(
        schedule.pipeline_id,
        undefined,
        schedule.client_id,
        skillContext,
      );

      const nextRun = nextCronDate(schedule.cron, now);
      const nextRunAt = nextRun?.toISOString() ?? undefined;
      const lastRunAt = now.toISOString();

      // Update in-memory
      schedule.last_run_at = lastRunAt;
      schedule.next_run_at = nextRunAt;

      if (this.repo) {
        await this.repo.updateLastRun(schedule.id, lastRunAt, nextRunAt ?? null);
      }

      await this.eventBus.publish(
        meshScheduleTriggered({
          schedule_id: schedule.id,
          pipeline_id: schedule.pipeline_id,
          client_id: schedule.client_id,
          run_id: run.id,
          triggered_at: lastRunAt,
        }),
      );

      this.log.info(
        { schedule_id: schedule.id, run_id: run.id, run_status: run.status, next_run_at: nextRunAt },
        'Scheduled pipeline completed',
      );
    } catch (err) {
      this.log.error(
        { schedule_id: schedule.id, err },
        'Scheduled pipeline execution failed',
      );
    }
  }
}
