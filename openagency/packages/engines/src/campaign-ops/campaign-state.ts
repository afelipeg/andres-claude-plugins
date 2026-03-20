// ─── Campaign State Machine ─────────────────────────────────────────
// Tracks campaign lifecycle, engine states, and task dependencies.
// Campaign lifecycle state machine with 23-task DAG

import type {
  CampaignCreateInput,
  CampaignState,
  CampaignTask,
  CampaignStatus,
  TaskStatus,
  TaskUpdateInput,
  NextAction,
} from '@openagency/types';

const VALID_TASK_STATUSES: TaskStatus[] = [
  'PENDING', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'SKIPPED',
];

const ENGINE_DEPENDENCIES: Record<string, string[]> = {
  orchestrator: [],
  intelligence: ['orchestrator'],
  architect: ['orchestrator', 'intelligence'],
  activation: ['architect'],
  value: ['orchestrator'],
  governance: ['orchestrator'],
};

interface SprintTemplate {
  name: string;
  duration_hours: number;
  tasks: Array<{
    id: string;
    name: string;
    engine: string;
    hours: number;
    depends_on?: string[];
  }>;
}

const DEFAULT_SPRINT_TEMPLATE: Record<string, SprintTemplate> = {
  sprint_0: {
    name: 'Campaign Intake & Baseline',
    duration_hours: 4,
    tasks: [
      { id: 'T001', name: 'Brief parsing & decomposition', engine: 'orchestrator', hours: 1 },
      { id: 'T002', name: 'Measurement framework design', engine: 'value', hours: 2 },
      { id: 'T003', name: 'Initial audience intelligence', engine: 'intelligence', hours: 2 },
      { id: 'T004', name: 'Competitive scan', engine: 'intelligence', hours: 2 },
      { id: 'T005', name: 'Governance baseline & waste estimate', engine: 'governance', hours: 2 },
    ],
  },
  sprint_1: {
    name: 'Strategy & Architecture',
    duration_hours: 16,
    tasks: [
      { id: 'T006', name: 'Channel architecture', engine: 'architect', hours: 4, depends_on: ['T003', 'T004'] },
      { id: 'T007', name: 'Revenue bridge setup', engine: 'architect', hours: 2, depends_on: ['T002'] },
      { id: 'T008', name: 'Media plan generation', engine: 'architect', hours: 4, depends_on: ['T006', 'T007'] },
      { id: 'T009', name: 'Budget optimization', engine: 'architect', hours: 2, depends_on: ['T008'] },
      { id: 'T009B', name: 'MMM Meridian pre-modeling data prep', engine: 'architect', hours: 3, depends_on: ['T002', 'T003'] },
      { id: 'T010', name: 'Creative brief generation', engine: 'activation', hours: 2, depends_on: ['T006'] },
      { id: 'T011', name: 'Supply chain audit', engine: 'governance', hours: 3, depends_on: ['T005', 'T008'] },
    ],
  },
  sprint_2: {
    name: 'Activation Setup',
    duration_hours: 16,
    tasks: [
      { id: 'T012', name: 'Creative development', engine: 'activation', hours: 8, depends_on: ['T010'] },
      { id: 'T013', name: 'Campaign setup & trafficking', engine: 'activation', hours: 4, depends_on: ['T008'] },
      { id: 'T014', name: 'Tag & taxonomy generation', engine: 'activation', hours: 2, depends_on: ['T002', 'T008'] },
      { id: 'T015', name: 'Media quality scoring', engine: 'governance', hours: 2, depends_on: ['T011'] },
      { id: 'T016', name: 'Pre-launch QA', engine: 'activation', hours: 2, depends_on: ['T012', 'T013', 'T014'] },
    ],
  },
  sprint_3: {
    name: 'Launch & Optimize',
    duration_hours: 8,
    tasks: [
      { id: 'T017', name: 'Campaign launch', engine: 'activation', hours: 1, depends_on: ['T016'] },
      { id: 'T018', name: '24h performance check', engine: 'value', hours: 1, depends_on: ['T017'] },
      { id: 'T019', name: 'Initial optimization pass', engine: 'activation', hours: 2, depends_on: ['T018'] },
      { id: 'T020', name: 'Attribution baseline', engine: 'value', hours: 2, depends_on: ['T017'] },
      { id: 'T021', name: 'Waste waterfall analysis', engine: 'governance', hours: 2, depends_on: ['T015', 'T018'] },
      { id: 'T022', name: 'MMM Meridian modeling & calibration', engine: 'architect', hours: 4, depends_on: ['T009B', 'T020'] },
      { id: 'T023', name: 'MMM Meridian scenario planning', engine: 'architect', hours: 2, depends_on: ['T022', 'T021'] },
    ],
  },
};

export function createCampaignState(data: CampaignCreateInput): CampaignState {
  const now = new Date().toISOString();
  const startDate = data.start_date ?? now;

  const engines: CampaignState['engines'] = {};
  for (const engine of Object.keys(ENGINE_DEPENDENCIES)) {
    engines[engine] = { state: 'IDLE', progress: 0 };
  }

  const sprints: CampaignState['sprints'] = {};
  for (const [sprintId, sprint] of Object.entries(DEFAULT_SPRINT_TEMPLATE)) {
    sprints[sprintId] = {
      name: sprint.name,
      duration_hours: sprint.duration_hours,
      tasks: sprint.tasks.map((t) => ({
        ...t,
        depends_on: t.depends_on ?? [],
        status: 'PENDING' as TaskStatus,
      })),
    };
  }

  return {
    campaign: {
      name: data.campaign_name,
      client: data.client,
      state: 'BRIEFED',
      start_date: startDate,
      brief_summary: data.brief_summary ?? '',
    },
    engines,
    sprints,
    blockers: [],
    created_at: now,
  };
}

export function updateTaskStatus(
  data: TaskUpdateInput,
): CampaignState | { error: string } {
  const state = data.state;
  const taskId = data.task_id;
  const newStatus = data.new_status;

  if (!VALID_TASK_STATUSES.includes(newStatus)) {
    return { error: `Invalid status: ${newStatus}. Valid: ${VALID_TASK_STATUSES.join(', ')}` };
  }

  let taskFound = false;
  for (const sprint of Object.values(state.sprints)) {
    for (const task of sprint.tasks) {
      if (task.id === taskId) {
        task.status = newStatus;
        taskFound = true;
        break;
      }
    }
  }

  if (!taskFound) return { error: `Task ${taskId} not found` };

  // Update engine states
  const engineTasks: Record<string, TaskStatus[]> = {};
  for (const sprint of Object.values(state.sprints)) {
    for (const task of sprint.tasks) {
      if (!engineTasks[task.engine]) engineTasks[task.engine] = [];
      engineTasks[task.engine].push(task.status);
    }
  }

  for (const [engine, statuses] of Object.entries(engineTasks)) {
    if (!state.engines[engine]) continue;
    const done = statuses.filter((s) => s === 'DONE' || s === 'SKIPPED').length;
    const total = statuses.length;
    const inProgress = statuses.filter((s) => s === 'IN_PROGRESS').length;
    const blocked = statuses.filter((s) => s === 'BLOCKED').length;

    state.engines[engine].progress = total > 0 ? Math.round((done / total) * 100) : 0;

    if (blocked > 0) state.engines[engine].state = 'BLOCKED';
    else if (inProgress > 0) state.engines[engine].state = 'ACTIVE';
    else if (done === total) state.engines[engine].state = 'COMPLETED';
  }

  state.blockers = checkBlockers(state);

  // Update campaign state
  const engineStates = Object.values(state.engines).map((e) => e.state);
  if (engineStates.every((s) => s === 'COMPLETED')) {
    state.campaign.state = 'COMPLETED';
  } else if (engineStates.includes('BLOCKED')) {
    state.campaign.state = 'BLOCKED' as CampaignStatus;
  } else if (engineStates.some((s) => s === 'ACTIVE')) {
    const activeEngines = Object.entries(state.engines)
      .filter(([, e]) => e.state === 'ACTIVE')
      .map(([n]) => n);
    if (activeEngines.includes('activation')) state.campaign.state = 'ACTIVATING';
    else if (activeEngines.includes('architect')) state.campaign.state = 'ARCHITECTING';
    else state.campaign.state = 'PLANNING';
  }

  return state;
}

function checkBlockers(state: CampaignState): string[] {
  const doneTasks = new Set<string>();
  for (const sprint of Object.values(state.sprints)) {
    for (const task of sprint.tasks) {
      if (task.status === 'DONE' || task.status === 'SKIPPED') {
        doneTasks.add(task.id);
      }
    }
  }

  const blockers: string[] = [];
  for (const sprint of Object.values(state.sprints)) {
    for (const task of sprint.tasks) {
      if (task.status === 'PENDING') {
        const unmet = task.depends_on.filter((d) => !doneTasks.has(d));
        if (unmet.length > 0) {
          blockers.push(`${task.id} (${task.name}) waiting on: ${unmet.join(', ')}`);
        }
      }
    }
  }

  return blockers;
}

export function getNextActions(state: CampaignState): NextAction[] {
  const doneTasks = new Set<string>();
  for (const sprint of Object.values(state.sprints)) {
    for (const task of sprint.tasks) {
      if (task.status === 'DONE' || task.status === 'SKIPPED') {
        doneTasks.add(task.id);
      }
    }
  }

  const ready: NextAction[] = [];
  for (const [sprintId, sprint] of Object.entries(state.sprints)) {
    for (const task of sprint.tasks) {
      if (task.status !== 'PENDING') continue;
      if (task.depends_on.every((d) => doneTasks.has(d))) {
        ready.push({
          task_id: task.id,
          task_name: task.name,
          engine: task.engine,
          sprint: sprintId,
          estimated_hours: task.hours,
        });
      }
    }
  }

  return ready;
}

export function campaignSummary(state: CampaignState) {
  let totalTasks = 0;
  let doneTasks = 0;
  for (const sprint of Object.values(state.sprints)) {
    for (const task of sprint.tasks) {
      totalTasks++;
      if (task.status === 'DONE' || task.status === 'SKIPPED') doneTasks++;
    }
  }

  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return {
    campaign: state.campaign,
    overall_progress: `${pct}%`,
    engines: state.engines,
    blockers: state.blockers,
    next_actions: getNextActions(state),
    tasks_done: doneTasks,
    tasks_total: totalTasks,
  };
}
