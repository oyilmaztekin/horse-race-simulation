# Implementation Plan — Horse Racing MVP

**Created:** 2026-05-14
**Source of truth:** `BUSINESS_LOGIC.md` (rules) + `ARCHITECTURE.md` (structure). Both are locked. Code follows the docs; never reverse.
**Discipline:** TDD per `CLAUDE.md` §3 — every production file is preceded by a failing test. No magic numbers (`CLAUDE.md` §1). No `Math.random()` in `domain/` or `server/`.

## Goal

Ship a Vue 3 + TS + Pinia + Hono + Prisma horse-racing simulation matching the locked specs: 20-horse roster (server-seeded), 6 rounds, weighted selection, live-tick simulation with deterministic seeded RNG, server-authoritative condition mutation, two-button control surface, Playwright happy-path green.

## Build order

Inside-out per `ARCHITECTURE.md` §15.4. Each phase ends with all of its tests green before the next begins.

---

### Phase 0 — Bootstrap & prerequisites (`ARCHITECTURE.md` §16 blockers)
Status: `complete` ✓

Everything needed before `vitest run` is meaningful.

- [x] `package.json` with the 12 scripts from §16.4 and the locked deps from §1.
- [x] `tsconfig.json` (root) + `server/tsconfig.json` extending it with `../src/domain/**/*` includes (§16.6, option (a) relative imports).
- [x] `vite.config.ts` — proxy `/api/*` → `http://localhost:3001`.
- [x] `vitest.config.ts` — `environment: 'jsdom'`, `globals: true`, `setupFiles: ['tests/setup.ts']`.
- [x] `tests/setup.ts` — `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout','requestAnimationFrame','cancelAnimationFrame','performance','Date'] })` in `beforeEach`; `useRealTimers` in `afterEach` (§16.7).
- [x] `prisma/schema.prisma` — `Horse { number @id, name, condition }` (§8). `prisma migrate dev` creates `dev.db`.
- [x] ESLint + Prettier configs; `vue-tsc` wired.
- [x] `.gitignore` covers `dev.db`, `node_modules`, `dist`.

Exit: `npm test` runs (zero tests), `npm run typecheck` passes on empty src, `npm run dev` boots both processes. ✓

---

### Phase 1 — Domain constants & types
Status: `in_progress` — constants and types are added as the TDD cycles that need them turn red. Items get checked off as they land in the codebase.

The vocabulary every later layer imports. No tests yet — these are pure declarations consumed by Phase 2+ tests.

- [x] `src/domain/constants.ts` — `HORSE_COUNT`, `CONDITION_MIN`, `CONDITION_MAX`, `ROUND_DISTANCES`, `ROUND_COUNT` (derived), `LANE_COUNT`, `FATIGUE_PER_RACE=8`, `RECOVERY_PER_REST=3`, `SIM_TICK_MS=1000/60`. Still pending: `MIN_REST_ROUNDS`, `MAX_RACES_PER_HORSE`, `INTER_ROUND_DELAY_MS=1500`.
- [x] Speed-formula tuning constants (§16.2): `BASE_SPEED_MPS_MIN=14`, `BASE_SPEED_MPS_MAX=18`, `JITTER_MPS=1.5`. Believability rationale documented inline.
- [ ] `LANE_COLORS` array — exactly `LANE_COUNT` hex strings. Use Wong / Okabe-Ito palette extended to 10 (§16.3). Runtime assertion: `LANE_COLORS.length === LANE_COUNT`.
- [x] Phase string-literal union `'INITIAL'|'READY'|'RACING'|'FINISHED'` (§4.2 phase names) — exported as `RacePhase` from `types.ts`.
- [x] `src/domain/types.ts` — `Rng`, `HorseId`, `Horse`, `Round`, `Program`. Still pending: `Ranking`, `RoundResult`, `LanePosition`, `SimulationSnapshot`.
- [x] `src/domain/errors.ts` — `InvalidTransitionError(kind, action)`, `ApiError(status, body)`.

Exit: `npm run typecheck` green.

---

### Phase 2 — Pure domain (TDD, in dependency order)
Status: `complete`

Each module: red test → green impl → refactor. Test files live in `src/domain/__tests__/`.

- [x] **`rng.ts`** — mulberry32 (committed `1385808`).
- [x] **`horseFactory.ts`** — `generateRoster(rng, lookupName)` + `pickConditionUniform(rng)` (committed `1f2e091`).
- [x] **Horse-name list** — backend-owned per decision #18; will arrive as `prisma/horseNames.json` in Phase 3. Frontend stays content-free.
- [x] **`programGenerator.ts`** — scaffold + lanes + rest rule + condition-weighted selection (commits `16490e7`, `a5deff6`, `7e964c3`, `4bf4881`). Cap rule cycle deliberately skipped (alternation theorem makes it structurally redundant; logged in commit history).
- [ ] **`simulation.ts`** — decomposed into independent unit-testable functions:
  - [x] SIM-A1 `computeSpeed(condition, jitter)` — additive linear interpolation, pure (committed `fc21a3d`).
  - [x] SIM-A2 `drawJitter(rng)` — uniform sample in `[-JITTER_MPS, +JITTER_MPS)`, anchored at `rng()=0.5 → 0` (committed `0d638c8`).
  - [x] SIM-A3 `advanceLane(lane, speedMps, dtMs, distance, elapsedMsBeforeTick)` — per-tick position update with sub-tick finish interpolation (decision #14) and clamp; already-finished lanes returned untouched (committed `191ed13`).
  - [x] SIM-A4 `createSnapshot(round, roundNumber)` — zeroed initial snapshot factory; lanes 1-indexed in lane-order, horseIds wired through, `elapsedMs=0`, `finishedAtMs=null` (committed `e5fda6e`).
  - [x] SIM-A5 `step(snapshot, dtMs, conditionLookup, rng)` — orchestrator; lane-order jitter draw (decision #13); already-finished lanes skip jitter and movement; `elapsedMs += dtMs`.
- [x] **`conditionMutation.ts`** — `applyRoundEffects(horses, raced)`: raced lose `FATIGUE_PER_RACE`, rested gain `RECOVERY_PER_REST`, clamped to `[CONDITION_MIN, CONDITION_MAX]`; roster identity preserved (committed `141840e`).
- [x] **`wait.ts`** — `wait(ms)` Promise wrapper over `setTimeout`; driven with fake timers (ARCHITECTURE §16.7).

Exit: `npm test` green for all `src/domain/**`.

---

### Phase 3 — Server (Hono + Prisma)
Status: `pending`

Backend runnable end-to-end before the frontend exists.

- [ ] **`server/db.ts`** — Prisma client singleton.
- [x] **`prisma/seed.ts`** — imports `generateRoster` with `createRng(0xDECAF)`; reads `horseNames.json`; deletes + recreates rows. Migration `20260514124617_init` applied; 20 rows persisted.
- [ ] **`server/routes/horses.ts`** — `GET /` → ordered `Horse[]`. Test (red first): GET returns seeded rows in number-asc order.
- [ ] **`server/routes/rounds.ts`** — `POST /complete` with `{ raced }`, calls `applyRoundEffects`, persists via `$transaction`, returns full roster. Test: fatigue applied, rested recovered, response matches DB state.
- [ ] **`server/index.ts`** — Hono app, mount routes, `serve` on 3001.
- [ ] Server tests in `server/__tests__/` use an in-memory SQLite fixture or a per-test temp file.

Exit: `tsx watch server/index.ts` boots; `curl localhost:3001/api/horses` returns 20 rows; server tests green.

---

### Phase 4 — Pinia stores
Status: `pending`

Order: `horses` first, then `race` (race depends on horses + api).

- [ ] **`src/stores/horses.ts`** — state (horses, isLoading, error); actions `fetchAll`, `applyServerUpdate`; getters `byId`, `conditionLookup`. Tests stub `useRaceApi`: fetchAll wires loading/error; applyServerUpdate replaces; byId / conditionLookup correct on hit and miss (miss → CONDITION_MIN).
- [ ] **`src/stores/race.ts`** — `RaceState` discriminated union + `assertRacing` + `mutateRacing` (§16.10 ref impl). Actions: `generateProgram(seed?)`, `start()`, `completeRound(rankings)`. Computed: `phase`, `program`, `currentRound`, `currentRoundIndex`, `results`, `canGenerate`, `canStart`, `currentRng`, `seed`. Tests: every illegal transition throws `InvalidTransitionError`; legal paths land in the right kind; `completeRound` pushes result → POSTs → applies server update → either FINISHED or advances index after `wait`; `completeRound` failure transitions to INITIAL and surfaces banner (`BUSINESS_LOGIC.md` decision #23 / §16.8); `canGenerate` reflects roster readiness (§16.9, decision #20).

Exit: `src/stores/**` tests green.

---

### Phase 5 — Composables
Status: `pending`

- [ ] **`src/composables/useRaceApi.ts`** — `getHorses`, `completeRound`. Tests stub `globalThis.fetch`: correct URL/method/body; throws `ApiError` on non-2xx.
- [ ] **`src/composables/useRaceSimulation.ts`** — accumulator-pattern rAF loop at fixed `SIM_TICK_MS`. Cleanup on unmount. Tests use the §15.5 fake-timer harness: advance time → positions grow; `finishOrder` fills as horses cross; `done` flips at LANE_COUNT; deterministic from seed; `cancelAnimationFrame` called on unmount.

Exit: composables tests green.

---

### Phase 6 — Presentational components
Status: `pending`

All 7 pure-prop components. Each gets one `@vue/test-utils` mount test: prop in → expected text/class out. No store access, no emits.

- [ ] `ColorSwatch.vue` + test
- [ ] `HorseListItem.vue` + test (name + condition; no swatch per decision #21)
- [ ] `HorseSprite.vue` + test (SVG, `progress: 0..1`)
- [ ] `RaceLane.vue` + test (derives color from `LANE_COLORS[laneIndex]`, converts meters→progress)
- [ ] `ProgramRoundCard.vue` + test (lane order, `isCurrent` highlight)
- [ ] `ResultRoundCard.vue` + test (finish order, swatch from `laneIndex`)
- [ ] `RankingRow.vue` + test

Exit: presentational tests green.

---

### Phase 7 — Container components
Status: `pending`

Each container uses `createTestingPinia()` for store mocks. `RaceTrack` test mocks `useRaceSimulation`.

- [ ] `App.vue` + test (`fetchAll` on mount; `<RaceTrack v-if="phase==='RACING'" :key="currentRoundIndex">`)
- [ ] `AppHeader.vue` + test
- [ ] `RaceControls.vue` + test (disabled state from `canGenerate`/`canStart`; clicks dispatch actions)
- [ ] `HorseList.vue` + test (iterate `horses.horses`; loading skeleton)
- [ ] `ProgramPanel.vue` + test (mount when phase ≠ INITIAL; resolve IDs via `byId`; `isCurrent` reflects `currentRoundIndex`)
- [ ] `ResultsPanel.vue` + test (pre-render 6 headers from `ROUND_DISTANCES`; cards fill as `results` grows)
- [ ] `RaceTrack.vue` + test (runs `useRaceSimulation`; `watch(done, fn, { once: true })` per §16.11; calls `race.completeRound(finishOrder)`)
- [ ] **Error banner component** (§16.8 / decision #22) — single banner covering `horses.error !== null` OR empty roster OR mid-meeting-fail message; manual Retry button.

Exit: all container tests green.

---

### Phase 8 — Styling & layout
Status: `pending`

Surface concerns deferred in `ARCHITECTURE.md` §13.

- [ ] `src/styles/tokens.css` — CSS variables (spacing, radii, neutral palette). `LANE_COLORS` already exported from constants.
- [ ] `src/styles/reset.css`, `src/styles/main.css`.
- [ ] Scoped component styles matching `image.png` layout. Track + lanes + finish line in `RaceTrack` / `RaceLane`.
- [ ] Manual smoke in dev server: Generate → Start → 6 rounds → FINISHED → Generate again.

Exit: visually matches the mockup; no console errors; no Vue warnings.

---

### Phase 9 — Playwright happy path
Status: `pending`

- [ ] `tests/e2e/happy-path.spec.ts` — load page → roster visible → click Generate → ProgramPanel renders → click Start → wait until 6 result cards visible → assert FINISHED phase indicator.
- [ ] Playwright config: webServer command runs `npm run dev`; baseURL `http://localhost:5173`.

Exit: `npm run test:e2e` green. This is the acceptance gate (§15.7).

---

### Phase 10 — Polish
Status: `pending`

- [ ] Run `npm run lint`, `npm run typecheck`, full `npm test`, `npm run test:e2e` — all green.
- [ ] README with run/test instructions.
- [ ] Verify CLAUDE.md §4 pre-commit checklist for each changed function.
- [ ] Manual reload-during-RACING smoke check (per `BUSINESS_LOGIC.md` §6 non-goal: discards local state, conditions persist).

Exit: ready to ship.

---

### Phase 11 — Deployment (Fly.io + nginx + Docker + GitHub Actions)
Status: `pending`

Reviewer-facing artifact. Runs only after Phase 9 (Playwright happy path) is green — E2E is the acceptance gate; deploy is downstream.

**Locked decisions** (from 2026-05-14 discussion; see `findings.md` Deployment section):
- Host: **Fly.io** free allowance. Single region. 1GB persistent volume for `prisma/dev.db`.
- Container: **single multi-stage Docker image**. nginx + node (Hono) inside, run by `supervisord`.
- nginx role: serves `/dist` (Vue build) AND reverse-proxies `/api/*` → `127.0.0.1:3001` (Hono). Two upstreams, one process.
- TLS: terminated at **Fly edge**; nginx speaks plain HTTP inside the VM.
- Hono binds **`127.0.0.1:3001`**, not `0.0.0.0` — nginx is sole ingress.
- IaC: **`fly.toml` is the IaC artifact**. No Terraform (community fly provider adds flakiness; fly.toml is declarative and reviewer-recognizable).
- CI/CD: GitHub Actions. Push-to-main → test → build → `flyctl deploy --remote-only`.

#### Sub-phase 11.1 — Container build (local smoke test only, no deploy yet)
- [ ] `Dockerfile` — multi-stage: `web-build` (Vue → `/dist`), `server-build` (tsc over `server/` + `src/domain/` + `prisma/seed.ts` → `/server-dist`), `runtime` (alpine + nginx + nodejs + supervisor; copies dist + server-dist + `prisma/schema.prisma` + `prisma/horseNames.json`; runs `prisma generate`; exposes :80).
- [ ] `nginx.conf`: SPA fallback at `/`; `proxy_pass` for `/api/`.
- [ ] `supervisord.conf` — two services: nginx + node.
- [ ] Patch `server/index.ts` to bind `127.0.0.1:3001` via `HOST` env var (default `127.0.0.1`).
- [ ] `.dockerignore` excludes `node_modules`, `dev.db`, `dist`, `.git`, `tests/`, `*.md`.
- [ ] Local verify: `docker build`, `docker run -p 8080:80 -v $(pwd)/_data:/app/prisma`; browser walks Generate → Start → FINISHED; restart container → `dev.db` survives.

Exit: container boots, SPA loads, `/api/horses` returns 20 rows, volume persists.

#### Sub-phase 11.2 — Fly.io deploy (manual, first push)
- [ ] User: `flyctl auth login` (one-time, documented in DEPLOYMENT.md).
- [ ] `flyctl launch --no-deploy --copy-config` to scaffold `fly.toml`.
- [ ] Edit `fly.toml`: app name + `primary_region` (e.g., `fra`); `[build] dockerfile`; `[[mounts]]` data → `/app/prisma`; `[http_service]` `internal_port=80`, `force_https=true`, `auto_stop_machines="stop"`, `min_machines_running=0`; `[deploy] release_command` runs migrate + seed; `[checks]` HTTP on `/api/horses`.
- [ ] `flyctl volumes create data --size 1 --region fra`.
- [ ] `flyctl deploy` from local — first push.
- [ ] Browser smoke at `https://beygir-yarisi.fly.dev`.

Exit: app live, TLS green, persists across machine restarts.

#### Sub-phase 11.3 — GitHub Actions CI/CD
- [ ] `.github/workflows/ci.yml` — PR + push to main: lint, typecheck, vitest, playwright (with `--with-deps chromium`).
- [ ] `.github/workflows/deploy.yml` — `workflow_run` on ci success, main only: `superfly/flyctl-actions/setup-flyctl` → `flyctl deploy --remote-only`. Uses `secrets.FLY_API_TOKEN`.
- [ ] User adds `FLY_API_TOKEN` to repo secrets (`flyctl auth token`).
- [ ] Verify: dummy PR → CI green → merge → deploy fires → live URL updated within ~3 min.

Exit: push-to-main is the only deploy path.

#### Sub-phase 11.4 — `DEPLOYMENT.md` (reviewer-facing doc)
- [ ] One-paragraph architecture summary; ASCII flow diagram (Fly edge → nginx → static OR Hono); per-file artifact inventory; five-command "deploy from scratch"; three-sentence "how CI/CD works"; live URL; cost note (free under Fly's allowance).

Exit: reviewer reads `DEPLOYMENT.md` in under 5 minutes and grasps the deploy story.

---

## Errors encountered

| Phase | Error | Attempt | Resolution |
|---|---|---|---|

## Decisions made during implementation

| Date | Decision | Rationale |
|---|---|---|

## Open questions (raise to user)

- Speed-formula tuning constants (§16.2 numbers) — pick during Phase 1 and document; ask user only if Phase 9 reveals races finish too fast/slow.
- Exact `LANE_COLORS` hex values (§16.3) — pick Wong/Okabe-Ito in Phase 1; ask user only if accessibility concerns surface.
- Confirm horse-name editorial list (§18) — propose during Phase 2; ask user for theme preference.
