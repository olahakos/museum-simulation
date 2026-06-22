# CLAUDE.md

Conventions for AI-assisted work in this repo. **Read this before making changes.**

## Workflow: issue-first, one branch per issue

Every change starts with a GitHub issue. No PR without an issue to anchor it.

1. Open (or find) a GitHub issue describing the change. Keep scope tight — one issue, one concern.
2. Branch from `main`: `git checkout -b issue-<number>-<short-slug>`
   (e.g. `issue-12-fix-pending-tx-dedup`).
3. Commit in small logical steps. Reference the issue in commit messages (`#12`).
4. Open a PR with `gh pr create`. Title and body reference the issue.
5. **Wait for explicit approval from Akos before merging.** Do not self-merge.
6. After merge, delete the branch.

### Superseded PRs
If a later PR makes an earlier one obsolete, **close the older PR with a clear
comment** pointing at the successor. Do not merge the obsolete one — leave the
trail clean.

## Verification handoff: always restart the QA app

Whenever work is finished and handed back to Akos for verification, **restart the
QA application** so the latest build is live when he goes to look at it. Don't
just push the code and stop — rebuild + restart, then report that it's live.

If the QA environment, port, or restart procedure isn't documented yet, find
out how it currently runs (process list, systemd, scripts in the repo, etc.)
and document it here so the next time is one command, not an investigation.

## Repository rules

- Default branch is `main`. Direct pushes to `main` happen via PR — never `git push` straight to `main`.
- Don't commit secrets, `.env`, build artifacts, or editor cruft (see `.gitignore`).
- Keep PRs scoped — one concern per PR. Big refactors split into their own PR.

## Project goal

Input: museum layout (floor plan with rooms and connecting paths) plus parameters
— group size, delay between group starts, desired dwell time per room.
Output: visualization of the resulting group dynamics, with one dot per
simulated visitor overlaid on the museum layout.

## Stack

TBD — to be filled in when the first implementation PR lands. When added,
include: language, build command, test command, run command, entry point,
and the QA restart command.
