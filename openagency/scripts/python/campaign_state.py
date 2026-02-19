#!/usr/bin/env python3
"""
Campaign State Machine
Tracks campaign lifecycle, engine states, and task dependencies across 6 engines.
Generates sprint backlogs and identifies blockers.

Usage: echo '{"command":"create","data":{"campaign_name":"Q1 Launch","client":"Acme"}}' | python3 campaign_state.py
Commands: create, update_task, summary, next_actions
"""

import json
import sys
from datetime import datetime


VALID_STATES = {
    "campaign": ["BRIEFED", "PLANNING", "ARCHITECTING", "ACTIVATING", "LIVE",
                  "OPTIMIZING", "WRAPPING", "COMPLETED"],
    "engine": ["IDLE", "ACTIVE", "BLOCKED", "COMPLETED"],
    "task": ["PENDING", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE", "SKIPPED"],
}

ENGINE_DEPENDENCIES = {
    "orchestrator": [],
    "intelligence": ["orchestrator"],
    "architect": ["orchestrator", "intelligence"],
    "activation": ["architect"],
    "value": ["orchestrator"],
    "governance": ["orchestrator"],
}

DEFAULT_SPRINT_TEMPLATE = {
    "sprint_0": {
        "name": "Campaign Intake & Baseline",
        "duration_hours": 4,
        "tasks": [
            {"id": "T001", "name": "Brief parsing & decomposition",
             "engine": "orchestrator", "hours": 1},
            {"id": "T002", "name": "Measurement framework design",
             "engine": "value", "hours": 2},
            {"id": "T003", "name": "Initial audience intelligence",
             "engine": "intelligence", "hours": 2},
            {"id": "T004", "name": "Competitive scan",
             "engine": "intelligence", "hours": 2},
            {"id": "T005", "name": "Governance baseline & waste estimate",
             "engine": "governance", "hours": 2},
        ],
    },
    "sprint_1": {
        "name": "Strategy & Architecture",
        "duration_hours": 16,
        "tasks": [
            {"id": "T006", "name": "Channel architecture",
             "engine": "architect", "hours": 4,
             "depends_on": ["T003", "T004"]},
            {"id": "T007", "name": "Revenue bridge setup",
             "engine": "architect", "hours": 2,
             "depends_on": ["T002"]},
            {"id": "T008", "name": "Media plan generation",
             "engine": "architect", "hours": 4,
             "depends_on": ["T006", "T007"]},
            {"id": "T009", "name": "Budget optimization",
             "engine": "architect", "hours": 2,
             "depends_on": ["T008"]},
            {"id": "T009B", "name": "MMM Meridian pre-modeling data prep",
             "engine": "architect", "hours": 3,
             "depends_on": ["T002", "T003"]},
            {"id": "T010", "name": "Creative brief generation",
             "engine": "activation", "hours": 2,
             "depends_on": ["T006"]},
            {"id": "T011", "name": "Supply chain audit",
             "engine": "governance", "hours": 3,
             "depends_on": ["T005", "T008"]},
        ],
    },
    "sprint_2": {
        "name": "Activation Setup",
        "duration_hours": 16,
        "tasks": [
            {"id": "T012", "name": "Creative development",
             "engine": "activation", "hours": 8,
             "depends_on": ["T010"]},
            {"id": "T013", "name": "Campaign setup & trafficking",
             "engine": "activation", "hours": 4,
             "depends_on": ["T008"]},
            {"id": "T014", "name": "Tag & taxonomy generation",
             "engine": "activation", "hours": 2,
             "depends_on": ["T002", "T008"]},
            {"id": "T015", "name": "Media quality scoring",
             "engine": "governance", "hours": 2,
             "depends_on": ["T011"]},
            {"id": "T016", "name": "Pre-launch QA",
             "engine": "activation", "hours": 2,
             "depends_on": ["T012", "T013", "T014"]},
        ],
    },
    "sprint_3": {
        "name": "Launch & Optimize",
        "duration_hours": 8,
        "tasks": [
            {"id": "T017", "name": "Campaign launch",
             "engine": "activation", "hours": 1,
             "depends_on": ["T016"]},
            {"id": "T018", "name": "24h performance check",
             "engine": "value", "hours": 1,
             "depends_on": ["T017"]},
            {"id": "T019", "name": "Initial optimization pass",
             "engine": "activation", "hours": 2,
             "depends_on": ["T018"]},
            {"id": "T020", "name": "Attribution baseline",
             "engine": "value", "hours": 2,
             "depends_on": ["T017"]},
            {"id": "T021", "name": "Waste waterfall analysis",
             "engine": "governance", "hours": 2,
             "depends_on": ["T015", "T018"]},
            {"id": "T022", "name": "MMM Meridian modeling & calibration",
             "engine": "architect", "hours": 4,
             "depends_on": ["T009B", "T020"]},
            {"id": "T023", "name": "MMM Meridian scenario planning",
             "engine": "architect", "hours": 2,
             "depends_on": ["T022", "T021"]},
        ],
    },
}


def create_campaign_state(campaign_name, client, start_date=None,
                          brief_summary=""):
    """Initialize a new campaign state machine."""
    start = start_date or datetime.now().isoformat()

    state = {
        "campaign": {
            "name": campaign_name,
            "client": client,
            "state": "BRIEFED",
            "start_date": start,
            "brief_summary": brief_summary,
        },
        "engines": {
            engine: {"state": "IDLE", "progress": 0}
            for engine in ENGINE_DEPENDENCIES
        },
        "sprints": {},
        "blockers": [],
        "created_at": datetime.now().isoformat(),
    }

    for sprint_id, sprint in DEFAULT_SPRINT_TEMPLATE.items():
        state["sprints"][sprint_id] = {
            "name": sprint["name"],
            "duration_hours": sprint["duration_hours"],
            "tasks": [
                {**task, "status": "PENDING"}
                for task in sprint["tasks"]
            ],
        }

    return state


def update_task_status(state, task_id, new_status):
    """Update a task's status and cascade effects to engines and campaign."""
    if new_status not in VALID_STATES["task"]:
        return {"error": f"Invalid status: {new_status}. "
                f"Valid: {VALID_STATES['task']}"}

    task_found = False
    for sprint in state["sprints"].values():
        for task in sprint["tasks"]:
            if task["id"] == task_id:
                task["status"] = new_status
                task_found = True
                break

    if not task_found:
        return {"error": f"Task {task_id} not found"}

    # Update engine states based on task statuses
    engine_tasks = {}
    for sprint in state["sprints"].values():
        for task in sprint["tasks"]:
            engine = task["engine"]
            if engine not in engine_tasks:
                engine_tasks[engine] = []
            engine_tasks[engine].append(task["status"])

    for engine, statuses in engine_tasks.items():
        done = statuses.count("DONE") + statuses.count("SKIPPED")
        total = len(statuses)
        in_progress = statuses.count("IN_PROGRESS")
        blocked = statuses.count("BLOCKED")

        state["engines"][engine]["progress"] = (
            round(done / total * 100) if total > 0 else 0
        )

        if blocked > 0:
            state["engines"][engine]["state"] = "BLOCKED"
        elif in_progress > 0:
            state["engines"][engine]["state"] = "ACTIVE"
        elif done == total:
            state["engines"][engine]["state"] = "COMPLETED"

    state["blockers"] = check_blockers(state)

    # Update campaign state
    engine_states = [e["state"] for e in state["engines"].values()]
    if all(s == "COMPLETED" for s in engine_states):
        state["campaign"]["state"] = "COMPLETED"
    elif "BLOCKED" in engine_states:
        state["campaign"]["state"] = "BLOCKED"
    elif any(s == "ACTIVE" for s in engine_states):
        active = [n for n, e in state["engines"].items()
                  if e["state"] == "ACTIVE"]
        if "activation" in active:
            state["campaign"]["state"] = "ACTIVATING"
        elif "architect" in active:
            state["campaign"]["state"] = "ARCHITECTING"
        else:
            state["campaign"]["state"] = "PLANNING"

    return state


def check_blockers(state):
    """Identify blocked tasks and their dependency chains."""
    done_tasks = set()
    for sprint in state["sprints"].values():
        for task in sprint["tasks"]:
            if task["status"] in ("DONE", "SKIPPED"):
                done_tasks.add(task["id"])

    blockers = []
    for sprint in state["sprints"].values():
        for task in sprint["tasks"]:
            if task["status"] == "PENDING":
                deps = task.get("depends_on", [])
                unmet = [d for d in deps if d not in done_tasks]
                if unmet:
                    blockers.append({
                        "task_id": task["id"],
                        "task_name": task["name"],
                        "waiting_on": unmet,
                        "engine": task["engine"],
                    })

    return blockers


def get_next_actions(state):
    """Get tasks that are ready to start (all dependencies met)."""
    done_tasks = set()
    for sprint in state["sprints"].values():
        for task in sprint["tasks"]:
            if task["status"] in ("DONE", "SKIPPED"):
                done_tasks.add(task["id"])

    ready = []
    for sprint_id, sprint in state["sprints"].items():
        for task in sprint["tasks"]:
            if task["status"] != "PENDING":
                continue
            deps = task.get("depends_on", [])
            if all(d in done_tasks for d in deps):
                ready.append({
                    "task_id": task["id"],
                    "task_name": task["name"],
                    "engine": task["engine"],
                    "sprint": sprint_id,
                    "estimated_hours": task["hours"],
                })

    return ready


def campaign_summary(state):
    """Generate campaign progress summary."""
    total_tasks = 0
    done_tasks = 0
    for sprint in state["sprints"].values():
        for task in sprint["tasks"]:
            total_tasks += 1
            if task["status"] in ("DONE", "SKIPPED"):
                done_tasks += 1

    pct = round(done_tasks / total_tasks * 100) if total_tasks > 0 else 0

    return {
        "campaign": state["campaign"],
        "overall_progress": f"{pct}%",
        "engines": state["engines"],
        "blockers": state["blockers"],
        "next_actions": get_next_actions(state),
        "tasks_done": done_tasks,
        "tasks_total": total_tasks,
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"create\",\"data\":{...}}' | python3 campaign_state.py",
            "commands": ["create", "update_task", "summary", "next_actions"],
            "example_create": {
                "command": "create",
                "data": {"campaign_name": "Q1 Launch", "client": "Acme"}
            },
            "example_update": {
                "command": "update_task",
                "data": {"state": "...", "task_id": "T001",
                         "new_status": "DONE"}
            },
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "create":
        result = create_campaign_state(**data)
    elif cmd == "update_task":
        state = data.get("state", {})
        result = update_task_status(state, data["task_id"],
                                    data["new_status"])
    elif cmd == "summary":
        result = campaign_summary(data)
    elif cmd == "next_actions":
        result = get_next_actions(data)
    else:
        result = {"error": f"Unknown command: {cmd}. "
                  "Valid: create, update_task, summary, next_actions"}

    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
