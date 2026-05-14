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
Status: `pending`

Everything needed before `vitest run` is meaningful.

- [ ] `package.json` with the 12 scripts from §16.4 and the locked deps from §1.
- [ ] `tsconfig.json` (root) + `server/tsconfig.json` extending it with `../src/domain/**/*` includes (§16.6, option (a) relative imports).
- [ ] `vite.config.ts` — proxy `/api/*` → `http://localhost:3001`.
- [ ] `vitest.config.ts` — `environment: 'jsdom'`, `globals: true`, `setupFiles: ['tests/setup.ts']`.
- [ ] `tests/setup.ts` — `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout','requestAnimationFrame','cancelAnimationFrame','performance','Date'] })` in `beforeEach`; `useRealTimers` in `afterEach` (§16.7).
- [ ] `prisma/schema.prisma` — `Horse { number @id, name, condition }` (§8). `prisma migrate dev` creates `dev.db`.
- [ ] ESLint + Prettier configs; `vue-tsc` wired.
- [ ] `.gitignore` covers `dev.db`, `node_modules`, `dist`.

Exit: `npm test` runs (zero tests), `npm run typecheck` passes on empty src, `npm run dev` boots both processes.

---

### Phase 1 — Domain constants & types
Status: `pending`

The vocabulary every later layer imports. No tests yet — these are pure declarations consumed by Phase 2+ tests.

- [ ] `src/domain/constants.ts` — exports every named constant from `CLAUDE.md` §1 *required list* (HORSE_COUNT, LANE_COUNT, ROUND_COUNT, ROUND_DISTANCES, MIN_REST_ROUNDS, MAX_RACES_PER_HORSE, CONDITION_MIN, CONDITION_MAX, FATIGUE_PER_RACE=8, RECOVERY_PER_REST=3, INTER_ROUND_DELAY_MS=1500, SIM_TICK_MS=1000/60).
- [ ] Speed-formula tuning constants (§16.2): `BASE_SPEED_MPS_MIN`, `BASE_SPEED_MPS_MAX`, `JITTER_MPS`. Pick believable numbers; document in a comment why.
- [ ] `LANE_COLORS` array — exactly `LANE_COUNT` hex strings. Use Wong / Okabe-Ito palette extended to 10 (§16.3). Runtime assertion: `LANE_COLORS.length === LANE_COUNT`.
- [ ] Phase string-literal union `'INITIAL'|'READY'|'RACING'|'FINISHED'` (§4.2 phase names).
- [ ] `src/domain/types.ts` — all interfaces from `ARCHITECTURE.md` §6: `Horse`, `Round`, `Program`, `Ranking`, `RoundResult`, `LanePosition`, `SimulationSnapshot`, `Rng`, `HorseId`.
- [ ] `src/domain/errors.ts` — `InvalidTransitionError(kind, action)`, `ApiError(status, body)`.

Exit: `npm run typecheck` green.

---

### Phase 2 — Pure domain (TDD, in dependency order)
Status: `pending`

Each module: red test → green impl → refactor. Test files live in `src/domain/__tests__/`.

- [ ] **`rng.ts`** — mulberry32. Test: known seed → known first 5 values.
- [ ] **`horseFactory.ts`** — `generateRoster(rng): Horse[]`. Tests: HORSE_COUNT entries; conditions ∈ [MIN..MAX]; numbers 1..20 unique; names from curated list indexed by number (decision #18, no RNG for names); deterministic from seed.
- [ ] **Horse-name list** — fixed curated 20-name array, indexed by number. Lives wherever `horseFactory` reads it (probably `src/domain/horseNames.ts`).
- [ ] **`programGenerator.ts`** — `generateProgram(horses, rng): Program`. Tests: ROUND_COUNT rounds; each round LANE_COUNT horses; rest rule (no horse in N and N-1); cap rule (≤MAX_RACES_PER_HORSE); selection-order = lane-order (decision #9); weighted-without-replacement (decision #11); deterministic from seed; `program[i].number === i + 1`.
- [ ] **`simulation.ts`** — `step(snapshot, dtMs, conditionLookup, rng): SimulationSnapshot`. Tests: position advances per tick; speed formula closed-form (`cond=MAX, jitter=0 → speed=BASE_MAX`); jitter drawn per (horse,tick) in lane order 1→10 (decision #13); sub-tick interpolation at finish (decision #14); position clamps to distance; deterministic from seed.
- [ ] **`conditionMutation.ts`** — `applyRoundEffects(horses, raced): Horse[]`. Tests: raced lose FATIGUE_PER_RACE; rested gain RECOVERY_PER_REST; clamped to [MIN..MAX]; roster set unchanged (only condition mutates).
- [ ] **`wait.ts`** — `wait(ms)`. Test: resolves after N ms using fake timers.

Exit: `npm test` green for all `src/domain/**`.

---

### Phase 3 — Server (Hono + Prisma)
Status: `pending`

Backend runnable end-to-end before the frontend exists.

- [ ] **`server/db.ts`** — Prisma client singleton.
- [ ] **`prisma/seed.ts`** — imports `generateRoster` with `createRng(0xDECAF)`; deletes + recreates rows.
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
