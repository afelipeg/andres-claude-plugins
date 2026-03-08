// ─── Pipeline Schedule Types ────────────────────────────────────────

export interface PipelineSchedule {
  id: string;              // ULID
  client_id: string;
  pipeline_id: string;     // e.g. "full-optimization"
  cron: string;            // Standard 5-part cron: "0 6 * * 1" (Mon 6am)
  auto_approve: boolean;   // If true: skip HFL escalation when risk is low
  notify_on_complete: boolean;
  enabled: boolean;
  created_at: string;      // ISO 8601
  last_run_at?: string;
  next_run_at?: string;
}

export interface CreateScheduleInput {
  client_id: string;
  pipeline_id: string;
  cron: string;
  auto_approve?: boolean;
  notify_on_complete?: boolean;
  enabled?: boolean;
}

export interface ScheduleTriggeredPayload {
  schedule_id: string;
  pipeline_id: string;
  client_id: string;
  run_id: string;
  triggered_at: string;
}

export interface ScheduleCreatedPayload {
  schedule_id: string;
  pipeline_id: string;
  client_id: string;
  cron: string;
  next_run_at?: string;
}

export interface ScheduleDeletedPayload {
  schedule_id: string;
  pipeline_id: string;
}
