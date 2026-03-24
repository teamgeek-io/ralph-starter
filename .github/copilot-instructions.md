# Copilot Instructions

## What This Repo Is

This is a **Copilot CLI agentic workflow starter** ("ralph"). It provides a shell-script harness for running `copilot` CLI as an autonomous, PRD-driven coding agent. The agent reads `PRD.md` and `progress.txt`, picks the next task, implements it, commits, and updates the log — either once or in a loop until the PRD is complete.

## How the Workflow Works

### Key Files

- **`PRD.md`** — The product requirements document. Write tasks here for the agent to pick up. The agent marks tasks done directly in this file.
- **`progress.txt`** — An append-only log. The agent appends a summary after each completed task.
- **`ralph-once.sh`** — Runs one iteration: read PRD + progress, implement the next task, commit, update `progress.txt`.
- **`ralph-afk.sh <N>`** — Runs up to N iterations of the same loop. Stops early if the agent outputs `<promise>COMPLETE</promise>`.

### Running the Agent

```bash
# Single task
./ralph-once.sh

# Run up to 10 tasks autonomously
./ralph-afk.sh 10
```

## Agent Loop Contract

When acting as the autonomous agent (invoked by these scripts), follow this protocol:

1. Read `PRD.md` and `progress.txt` to understand what has been done and what remains.
2. Pick the **single highest-priority incomplete task** from `PRD.md`.
3. Implement it fully — including tests and type checks if applicable to the project being built.
4. Commit the changes.
5. Append a concise summary of what was done to `progress.txt`.
6. Update `PRD.md` to reflect the completed task.
7. If all tasks are done, output `<promise>COMPLETE</promise>`.

**Never work on more than one task per invocation.**

## PRD Format Convention

Tasks in `PRD.md` should be written as a list. Completed tasks are typically marked or removed. The agent uses the presence/absence of completion markers to determine what remains. Keep tasks atomic and verifiable.

## Committing

Each completed task should be a single commit. Commit messages should describe what was implemented, not just "update PRD".
