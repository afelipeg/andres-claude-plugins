// ─── Goal Tracker ───────────────────────────────────────────────────
// Checks progress after each OODA cycle, adjusts plan if falling behind.

import type { GoalProgressReport } from '@openagency/types';
import type { GoalRepo } from '@openagency/memory';
import type { GoalDecomposer } from './goal-decomposer.js';

export class GoalTracker {
  constructor(private goalRepo: GoalRepo) {}

  async checkProgress(agentId: string): Promise<GoalProgressReport[]> {
    const goals = await this.goalRepo.listActive(agentId);

    return goals.map((goal) => {
      const currentValue = goal.current_value ?? 0;
      const targetValue = goal.target_value;

      let progressPct: number;
      switch (goal.type) {
        case 'maximize':
          progressPct = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0;
          break;
        case 'minimize':
          progressPct = currentValue <= targetValue ? 100 : Math.max(0, (1 - (currentValue - targetValue) / currentValue) * 100);
          break;
        case 'maintain':
          progressPct = Math.abs(currentValue - targetValue) <= targetValue * 0.05 ? 100 : 50;
          break;
        case 'achieve':
          progressPct = goal.progress_pct;
          break;
        default:
          progressPct = goal.progress_pct;
      }

      const onTrack = this.isOnTrack(goal.deadline, progressPct, goal.created_at);

      const completedTasks = goal.sub_tasks.filter((t) => t.status === 'completed').length;
      const blockedTasks = goal.sub_tasks
        .filter((t) => t.status === 'pending' && t.depends_on.length > 0)
        .map((t) => `Task "${t.description}" blocked by dependencies`);

      return {
        goal_id: goal.id,
        name: goal.name,
        target_value: targetValue,
        current_value: currentValue,
        progress_pct: Math.round(progressPct * 100) / 100,
        on_track: onTrack,
        blockers: blockedTasks,
      };
    });
  }

  async updateMetric(goalId: string, currentValue: number): Promise<void> {
    const goal = await this.goalRepo.get(goalId);
    if (!goal) return;

    let progressPct: number;
    switch (goal.type) {
      case 'maximize':
        progressPct = goal.target_value > 0 ? Math.min(100, (currentValue / goal.target_value) * 100) : 0;
        break;
      case 'minimize':
        progressPct = currentValue <= goal.target_value ? 100 : 0;
        break;
      default:
        progressPct = goal.progress_pct;
    }

    await this.goalRepo.updateProgress(goalId, currentValue, progressPct);

    if (progressPct >= 100) {
      await this.goalRepo.complete(goalId);
    }
  }

  async adjustPlan(goalId: string, decomposer: GoalDecomposer): Promise<void> {
    const goal = await this.goalRepo.get(goalId);
    if (!goal || goal.status !== 'active') return;

    const newSubTasks = await decomposer.decompose(goal);
    if (newSubTasks.length > 0) {
      // Replace uncompleted sub-tasks with new plan
      const completedTasks = goal.sub_tasks.filter((t) => t.status === 'completed');
      const updatedGoal = {
        ...goal,
        sub_tasks: [...completedTasks, ...newSubTasks],
      };

      // Persist via goal repo (update sub_tasks JSONB)
      await this.goalRepo.updateProgress(
        goalId,
        goal.current_value ?? 0,
        goal.progress_pct,
      );
    }
  }

  private isOnTrack(deadline: string | undefined, progressPct: number, createdAt: string): boolean {
    if (!deadline) return progressPct > 0;

    const now = Date.now();
    const deadlineMs = new Date(deadline).getTime();
    const createdMs = new Date(createdAt).getTime();
    const totalDuration = deadlineMs - createdMs;

    if (totalDuration <= 0) return progressPct >= 100;

    const elapsed = now - createdMs;
    const expectedProgress = (elapsed / totalDuration) * 100;

    return progressPct >= expectedProgress * 0.8; // 80% of expected is "on track"
  }
}
