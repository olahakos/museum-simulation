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

- **Language:** TypeScript (strict), no UI framework.
- **Build/dev:** Vite. **Test:** Vitest. **Render:** HTML5 Canvas 2D.
- **Entry point:** `src/main.ts` → `src/app/app.ts`.
- **Install:** `npm install`
- **Test:** `npm test`
- **Build:** `npm run build` (outputs `dist/`)
- **Run (QA app):** `npm run dev` — serves on `http://localhost:5173` by default.
- **QA restart (production build, what we hand back to Akos):**
  ```bash
  pkill -f 'vite preview' 2>/dev/null
  npm run build
  npx vite preview --host 127.0.0.1 --port 4173 &
  ```
  Serves the production build at `http://127.0.0.1:4173`. **Bind to 127.0.0.1
  explicitly** — Vite's default preview binds to IPv6 localhost only, which
  won't be reachable by any reverse proxy listening on IPv4. After restart,
  verify with `curl -sI http://127.0.0.1:4173` (expect `HTTP/1.1 200 OK`) and
  `ss -ltn | grep 4173` (expect `127.0.0.1:4173`, not `[::1]:4173`).

  For live development (HMR), use `npm run dev` — but for **handoff
  verification** always use the production preview so Akos sees the latest
  build, not stale HMR state.

The simulation engine (`src/sim/`) and model (`src/model/`) are pure and
DOM-free — run them headless under Vitest. The renderer (`src/render/`) and app
wiring (`src/app/`) own all DOM/canvas access.
