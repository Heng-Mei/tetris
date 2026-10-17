# AGENTS.md

## Run / verify

- No build step and no dependencies. ES modules only load over HTTP:
  `python3 -m http.server 8123` → http://localhost:8123
  Port 8080 is occupied by another app on this machine; README uses 8123.
- Tests: `npm test` (= `node --test`). Single suite: `node --test test/engine.test.mjs`.
  Do not pass the directory (`node --test test/`) — it fails on Node 24.
- There is no lint, typecheck, or formatter config. `package.json` exists only for `"type": "module"` and the test script; don't add a bundler/framework unless asked.
- Tests are DOM-free and run in plain Node.

## Architecture

- DOM-free core (keep it that way so Node tests stay possible): `js/engine.js` (board, lock, clears, 7-bag, scoring, garbage), `js/handling.js` (DAS/ARR), `js/rotations.js` (shapes + kick tables), `js/settings.js` (defaults, presets, validation, persistence), `js/attack.js` (attack table + damage), `js/modes.js` (mode rules/outcomes), `js/ai.js` (placement search).
- DOM layer: `js/main.js` (fixed-step loop, mode clock, battle/AI wiring), `js/render.js` (canvas, shared board painter, opponent view), `js/ui.js` (settings panel), `js/rotation-editor.js` and `js/attack-editor.js` (graphical modals).
- `window.__tetris` exposes `game`, `settings`, `system`, `opponent`, `modeClock`, `sides`, `start()` for console/CDP checks.
- Settings persist in `localStorage['tetris.settings.v1']`, all params in milliseconds.
- Custom rotation systems are validated by `validateCustomRotation`; attack tables by `validateAttackTable`. The UI deliberately has no JSON textarea; JSON only enters/leaves through file import/export.

## Tetris conventions easy to break

- Shape coordinates are box-local `[x, y]` with **y pointing down**. SRS kick tables are already flipped from the wiki's y-up tables. Kick arrays are tried in order; `'*'` is the fallback; O never kicks.
- Board is 10×22 with 2 hidden rows (`HIDDEN = 2`). Spawn `y = 2` relies on that so a new piece is immediately visible; changing `HIDDEN` means revisiting spawn and render offsets.
- Fixed 60 Hz logic (max 6 catch-up steps/frame, frame dt clamped to 100 ms); rendering is rAF. DAS completion performs one shift, then ARR repeats; ARR 0 snaps to the wall.
- Mode clock advances inside the same fixed-step loop, never per rAF, so pause/ARE semantics match. Sprint/Blitz/VS all end through `checkOutcome`, not ad-hoc checks in `frame()`.
- Battle order per lock: compute attack → cancel own incoming → send leftover → insert remaining incoming. Garbage is stored as `GARBAGE = 8` cells with one hole per row; adjacent inserted rows never share a hole.
- AI is one-ply: `choosePlacement` enumerates rotations/columns, scores height/holes/bumpiness, and difficulty only changes interval + blunder rate. Don't add lookahead without revisiting the difficulty table.
- Blitz gravity is `max(user gravity, 1 + (level-1) * 0.6)`; level still only multiplies score.
- Level is `lines/10 + 1` and only multiplies score. Outside Blitz, gravity is user-set and must not auto-increase with level.
- Deliberate approximations, don't “fix” silently: ARS uses SRS shapes with Arika kicks, SRS 180° uses a generic kick table (not TETR.IO's SRS+), line clears flash the whole board instead of per-row animation.
- Deliberate AI/battle approximations: one-ply AI with no hold or T-Spin setup, random garbage holes (adjacent-row avoidance only), fixed Blitz curve.
- The settings drawer only scrolls if `#panelBody` stays a constrained flex column (`flex:1; min-height:0`); it is a sibling of `.app`, not inside it.

## Deploy

- Push to `main` deploys https://heng-mei.github.io/tetris/ via `.github/workflows/pages.yml` (Pages `build_type=workflow`).
- Keep the pinned runner `ubuntu-24.04` and current action majors (checkout v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5). Reverting to GitHub's generated legacy Pages workflow reintroduces Node 20 / ubuntu-latest warnings.

## Gotchas

- Headless Chrome against the local Python server intermittently drops module requests (`ERR_CONNECTION_RESET`); retry or verify against the deployed URL. It is not an app bug.
- `docs/superpowers/specs/2026-10-17-tetris-design.md` records the agreed design; keep README's “已知取舍” in sync when behavior changes.

## Commits

- Conventional Commits, English, imperative, one logical change per commit. No AI/co-author trailers.
