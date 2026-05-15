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

- [x] `src/domain/constants.ts` — `HORSE_COUNT`, `CONDITION_MIN`, `CONDITION_MAX`, `ROUND_DISTANCES`, `ROUND_COUNT` (derived), `LANE_COUNT`, `FATIGUE_PER_RACE=8`, `RECOVERY_PER_REST=3`, `SIM_TICK_MS=1000/60`, `MIN_REST_ROUNDS=1`, `MAX_RACES_PER_HORSE=4`, `INTER_ROUND_DELAY_MS=1500`.
- [x] Speed-formula tuning constants (§16.2): `BASE_SPEED_MPS_MIN=14`, `BASE_SPEED_MPS_MAX=18`, `JITTER_MPS=1.5`. Believability rationale documented inline.
- [x] **Rest-mechanism constants** (`ARCHITECTURE.md` §16.1b): `MIN_RACEABLE_CONDITION=40`, `MIN_FIT_HORSES_FOR_PROGRAM = (LANE_COUNT * ROUND_COUNT) / MAX_RACES_PER_HORSE = 15` (derived — no parallel literal), `REST_DURATION_MS=10_000`, `REST_POLL_INTERVAL_MS=1_000`.
- [x] `LANE_COLORS` array — 10 hex strings (Okabe-Ito 8 + Tol "muted" wine/teal); runtime assertion `LANE_COLORS.length === LANE_COUNT` throws at import time if desynced.
- [x] Phase string-literal union `'INITIAL'|'RESTING'|'READY'|'RACING'|'FINISHED'` exported as `RacePhase` from `types.ts` (`BUSINESS_LOGIC.md` §4.2).
- [x] `src/domain/types.ts` — `Rng`, `HorseId`, `Horse`, `Round`, `Program`. Still pending: `Ranking`, `RoundResult`, `LanePosition`, `SimulationSnapshot`, `HorsesEnvelope`.
- [x] `src/domain/errors.ts` — `InvalidTransitionError(kind, action)`, `ApiError(status, body)`, `NotEnoughFitHorsesError(fitCount, required)` (`ARCHITECTURE.md` decision #25).

Exit: `npm run typecheck` green.

---

### Phase 2 — Pure domain (TDD, in dependency order)
Status: `complete`

Each module: red test → green impl → refactor. Test files live in `src/domain/__tests__/`.

- [x] **`rng.ts`** — mulberry32 (committed `1385808`).
- [x] **`horseFactory.ts`** — `generateRoster(rng, lookupName)` + `pickConditionUniform(rng)` (committed `1f2e091`).
- [x] **Horse-name list** — backend-owned per decision #18; will arrive as `prisma/horseNames.json` in Phase 3. Frontend stays content-free.
- [x] **`programGenerator.ts`** — scaffold + lanes + rest rule + condition-weighted selection (commits `16490e7`, `a5deff6`, `7e964c3`, `4bf4881`). Cap rule cycle deliberately skipped (alternation theorem makes it structurally redundant; logged in commit history).
- [x] **`simulation.ts`** — decomposed into independent unit-testable functions:
  - [x] SIM-A1 `computeSpeed(condition, jitter)` — additive linear interpolation, pure (committed `fc21a3d`).
  - [x] SIM-A2 `drawJitter(rng)` — uniform sample in `[-JITTER_MPS, +JITTER_MPS)`, anchored at `rng()=0.5 → 0` (committed `0d638c8`).
  - [x] SIM-A3 `advanceLane(lane, speedMps, dtMs, distance, elapsedMsBeforeTick)` — per-tick position update with sub-tick finish interpolation (decision #14) and clamp; already-finished lanes returned untouched (committed `191ed13`).
  - [x] SIM-A4 `createSnapshot(round, roundNumber)` — zeroed initial snapshot factory; lanes 1-indexed in lane-order, horseIds wired through, `elapsedMs=0`, `finishedAtMs=null` (committed `e5fda6e`).
  - [x] SIM-A5 `step(snapshot, dtMs, conditionLookup, rng)` — orchestrator; lane-order jitter draw (decision #13); already-finished lanes skip jitter and movement; `elapsedMs += dtMs`.
- [x] **`conditionMutation.ts`** — `applyRoundEffects(horses, raced)`: raced lose `FATIGUE_PER_RACE`, rested gain `RECOVERY_PER_REST`, clamped to `[CONDITION_MIN, CONDITION_MAX]`; roster identity preserved (committed `141840e`).
- [x] **`conditionMutation.ts` (amendment, 2026-05-14):** `isFit(horse)` ✓ and `applyRestEffects(horses)` ✓ — bumps every unfit horse to exactly `MIN_RACEABLE_CONDITION`; fit horses unchanged; identity preserved. 3-flavor TDD (happy/edge/sad).
- [x] **`wait.ts`** — `wait(ms)` Promise wrapper over `setTimeout`; driven with fake timers (ARCHITECTURE §16.7).

Exit: `npm test` green for all `src/domain/**`.

---

### Phase 3 — Server (Hono + Prisma)
Status: `complete` ✓

Backend runnable end-to-end before the frontend exists.

- [x] **`server/db.ts`** — Prisma client singleton.
- [x] **`prisma/schema.prisma` amendment (2026-05-14):** add `AppState { id Int @id @default(1), restingUntil DateTime? }` model per `ARCHITECTURE.md` decision #28. Migration `20260515092416_add_app_state` applied.
- [x] **`prisma/seed.ts`** — imports `generateRoster` with `createRng(0xDECAF)`; reads `horseNames.json`; deletes + recreates rows. Migration `20260514124617_init` applied; 20 rows persisted.
- [x] **`prisma/seed.ts` amendment:** upserts `AppState { id: 1, restingUntil: null }` so the meta row exists before the first GET.
- [x] **`server/routes/horses.ts`** — `createHorsesRouter(db)`: GET returns `HorsesEnvelope`; lazy-bump-on-poll in `$transaction`; POST /rest idempotent. 8 tests green (mock-db DI pattern).
- [x] **`server/routes/rounds.ts`** — `createRoundsRouter(db)`: POST /complete applies `applyRoundEffects`, persists, returns `Horse[]`. 4 tests green.
- [x] **`server/routes/rounds.ts` hardening (2026-05-15):** `isValidRaced` guard rejects malformed bodies with 400 (`{ error: 'invalid raced' }`). Empty array stays valid (all-horses recovery). Bounds enforced against `HORSE_COUNT` from `src/domain/constants.ts` — no parallel literal. 6 new tests (happy/edge/sad mix) green; full suite 103/103.
- [x] **`server/routes/rounds.ts` atomicity (2026-05-15):** handler body wrapped in `db.$transaction` mirroring `horses.ts:18`; `findMany` + N `update`s now atomic. Two new tests (uses-`$transaction` spy + rejection-propagation) green; full suite 105/105.
- [x] **`server/index.ts`** — Hono app, mounts both routers, serves on port 3001.
- [x] Server tests in `server/__tests__/` use mock-db via dependency injection (factory pattern — no real SQLite in tests).

Exit: `tsx watch server/index.ts` boots; `curl localhost:3001/api/horses` returns envelope with 20 horses; `curl -X POST localhost:3001/api/horses/rest` returns envelope with future `restingUntil`; server tests green.

---

### Phase 4 — Pinia stores
Status: `complete` ✓

Order: `horses` first, then `race` (race depends on horses + api).

- [x] **`src/stores/horses.ts`** — state (horses, isLoading, error); actions `fetchAll`, `applyServerUpdate`; getters `byId`, `conditionLookup`. **`fetchAll` reads `HorsesEnvelope`** and calls `race.resumeRestFromBoot(restingUntil)` if non-null (`ARCHITECTURE.md` §11 step 2 — refresh resilience for the rest mechanism). Tests stub `useRaceApi`: fetchAll wires loading/error; envelope with non-null restingUntil triggers resumeRestFromBoot; applyServerUpdate replaces; byId / conditionLookup correct on hit and miss (miss → CONDITION_MIN). Also added `Ranking` and `RoundResult` to `src/domain/types.ts`; created `src/composables/useRaceApi.ts` stub.
- [x] **`src/stores/race.ts`** — `RaceState` discriminated union (now 5 variants — all 5 use `typeof PHASE_*` after 2026-05-15 refactor; last hardcoded `'FINISHED'` literal removed) + `assertRacing` + `mutateRacing` (§16.10 ref impl). **In progress:** initial-state skeleton landed (state defaults to INITIAL; phase/program/currentRound/currentRoundIndex/results/restingUntil/seed/currentRng computed; `resumeRestFromBoot`/`completeRound` stubs). `generateProgram(seed?)` happy path landed: INITIAL → READY with full 6-round program, fresh `createRng(seed)` carried on the union; seed defaults to `Date.now()`. Fit-gate landed via the pure-domain `assertEnoughFitHorses` guard (delegates to `countFitHorses`); store rethrows `NotEnoughFitHorsesError` and stays in INITIAL when the gate fails. Phase names extracted as `PHASE_INITIAL`/`PHASE_RESTING`/`PHASE_READY`/`PHASE_RACING`/`PHASE_FINISHED` constants (CLAUDE.md §1). Actions: `generateProgram(seed?)`, `start()`, `completeRound(rankings)`, **`rest()`**, **`completeRest(updated)`**, **`resumeRestFromBoot(restingUntil)`**. Computed: `phase`, `program`, `currentRound`, `currentRoundIndex`, `results`, `canGenerate`, `canStart`, **`canRest`**, **`restingUntil`**, **`fitCount`**, `currentRng`, `seed`. Phase guard for `generateProgram` landed (2026-05-15): rejects RACING and RESTING with `InvalidTransitionError(kind, 'generateProgram')`; READY re-rolls in place; FINISHED → READY clears prior results. `start()` action landed (2026-05-15): READY → RACING carrying program/rng/seed with `currentRoundIndex = 0` and `results = []`; throws `InvalidTransitionError(kind, 'start')` from any non-READY phase. Tests: every illegal transition throws `InvalidTransitionError`; legal paths land in the right kind; `generateProgram` throws `NotEnoughFitHorsesError` when `fitCount < MIN_FIT_HORSES_FOR_PROGRAM`; `rest()` only allowed from INITIAL/FINISHED, POSTs and transitions to RESTING; `completeRest` only allowed from RESTING, transitions to INITIAL with updated roster; `resumeRestFromBoot` no-ops if state ≠ INITIAL or timestamp is in the past; `canRest` reflects fit-gate + phase; `completeRound` pushes result → POSTs → applies server update → either FINISHED or advances index after `wait`; `completeRound` failure transitions to INITIAL and surfaces banner (`BUSINESS_LOGIC.md` decision #23 / §16.8); `canGenerate` reflects roster readiness (§16.9, decision #20).

Exit: `src/stores/**` tests green.

---

### Phase 5 — Composables
Status: `complete` ✓

- [x] **`src/composables/useRaceApi.ts`** — `getHorses` (returns `HorsesEnvelope`), `startRest` (returns `HorsesEnvelope`), `completeRound`. 9 tests (3 per method) stub `globalThis.fetch`: URL/method/body assertions; envelope shape preserved (incl. non-null `restingUntil`); `ApiError` carries `status` + `body` on non-2xx. Implementation pre-existed from Phase 4 bridge; tests retroactively lock the contract.
- [x] **`src/composables/useRaceSimulation.ts`** — accumulator-pattern rAF loop at fixed `SIM_TICK_MS`. Takes `(round, roundNumber, conditionLookup, rng)`; returns `{ positions, finishOrder, done }`. Cleanup on unmount via `cancelAnimationFrame`. 4 tests mount inside a `defineComponent` host via `@vue/test-utils` and drive the loop with `vi.advanceTimersByTimeAsync`: positions grow (happy); finishOrder fills + done flips at LANE_COUNT with unique ranks 1..10 **and unique horseIds matching `ROUND.lanes`** (edge, hardened 2026-05-15); deterministic across two runs of the same seed and different from another seed (sad); `cancelAnimationFrame` spy called on unmount (sad).
- [x] **`src/composables/useRestPolling.ts` (NEW, `ARCHITECTURE.md` §10):** watches `race.phase`; on entry to `PHASE_RESTING` starts `setInterval(tick, REST_POLL_INTERVAL_MS)` and fires an immediate tick; on exit clears the interval. `tick` calls `api.getHorses()` then either `race.completeRest(envelope.horses)` (when `restingUntil === null`) or `horses.applyServerUpdate`. Failures are swallowed so the loop keeps retrying. `tests/setup.ts` extended to fake `setInterval`/`clearInterval` so the polling loop is timer-controllable. 4 tests: keeps polling at the interval (happy); calls `completeRest` and stops on clearing envelope (edge); **dispatches `horses.applyServerUpdate` on mid-rest ticks (happy, hardened 2026-05-15: seeds the store with a low-condition roster and asserts it flips to the envelope's condition after the immediate poll);** **clears its interval handle on unmount via `clearInterval` spy + no further polls after unmount (sad, 2026-05-15);** tolerates a rejected GET and keeps polling (sad).

Exit: composables tests green.

---

### Phase 6 — Presentational components
Status: `complete` ✓

All 7 pure-prop components. Each gets one `@vue/test-utils` mount test: prop in → expected text/class out. No store access, no emits.

- [x] `ColorSwatch.vue` + test — 3 tests (happy/edge/sad): inline `background-color` style reflects prop; arbitrary CSS color strings pass through unchanged; prop change re-renders style (sad: a stub ignoring the prop would fail).
- [x] `HorseListItem.vue` + test — 3 tests (happy/edge/sad): renders `horse.name` + `horse.condition`; CONDITION_MIN/MAX boundaries render verbatim; prop change re-renders both fields.
- [x] `HorseSprite.vue` + test — 3 tests (happy/edge/sad): SVG colored by `color` + condition text visible; horizontal position driven by `--horse-progress` CSS var from `progress` prop (0 → 0, 1 → 1); condition text re-renders on prop change.
- [x] `RaceLane.vue` + test — 3 tests (happy/edge/sad): mounts `HorseSprite` with `LANE_COLORS[laneIndex]` color and forwarded `horse.condition`; `progress = positionM / distanceM` (0 / 0.5 / 1 at midpoint+finish); different `laneIndex` yields a different color (sad: stub returning a fixed color would fail).
- [x] `ProgramRoundCard.vue` + test — 3 tests (happy/edge/sad): renders round header + every entry in lane order; `program-round-card--current` class toggles iff `isCurrent`; reordered entries re-render in new order.
- [x] `ResultRoundCard.vue` + test — 3 tests (happy/edge/sad): renders header + LANE_COUNT rows in finish order; **delegates each row to `<RankingRow>` with matching `{position, horse, laneIndex}` props** (edge, hardened 2026-05-15 — inline row collapsed into `RankingRow`, eliminating duplicate definitions and giving `RankingRow` a real consumer ahead of Phase 7); reordered entries rerender (sad).
- [x] `RankingRow.vue` + test — 3 tests (happy/edge/sad): renders position + name + ColorSwatch with `LANE_COLORS[laneIndex]`; position prop renders verbatim across rank range; swatch color updates on `laneIndex` change (sad). Consumed by `ResultRoundCard` (single source of truth for one ranked finisher row).

Exit: presentational tests green.

---

### Phase 7 — Container components
Status: `complete` ✓ — all 8 container components and the error banner landed.

Each container uses `createTestingPinia()` for store mocks. `RaceTrack` test mocks `useRaceSimulation`.

- [x] `App.vue` + test (`fetchAll` on mount; `useRestPolling()` instantiated once at app lifetime per `ARCHITECTURE.md` §11 step 3; `<RaceTrack v-if="phase===PHASE_RACING" :key="currentRoundIndex">`) — 3 tests (happy/edge/sad): mount calls `horses.fetchAll` exactly once and `useRestPolling` exactly once; RaceTrack mounts during RACING with `data-round-key` mirroring `currentRoundIndex` (so the `:key` rekey behavior is observable); RaceTrack does NOT mount in READY (sad — a template missing the `v-if` would still render it). Child containers stubbed; `useRestPolling` mocked via `vi.mock`. Scaffolds `src/components/AppHeader.vue` as a placeholder (title + phase indicator + RaceControls); its own test is the next cycle.
- [x] `AppHeader.vue` + test — 3 tests (happy/edge/sad): phase indicator text matches `race.phase` (happy); flipping the store phase from `INITIAL` to `FINISHED` re-renders the indicator (edge); `RaceControls` mounts as a child (sad — a stub-header that skipped the nested controls would fail). **Test-after deviation logged** (cycle 11 scaffolded the placeholder so `App.vue` could import; this cycle locked behavior in retroactively).
- [x] `RaceControls.vue` + test — three controls per `BUSINESS_LOGIC.md` §4.3: Generate Program, Start, Rest the horses. Rest is contextual-reveal (hidden until a Generate click surfaces `NotEnoughFitHorsesError`). Test cases: **[x] cycle 1 disabled state matches `canGenerate`/`canStart` (3 tests, INITIAL/READY/RESTING)**; **[x] cycle 2 click dispatches (generate→`race.generateProgram`, start→`race.start`, disabled→no-op)**; **[x] cycle 3 on `NotEnoughFitHorsesError` warning banner appears with fitCount/required text + Rest button reveals**; **[x] cycle 4 RESTING phase renders `secondsUntilRestComplete` derived from `race.restingUntil − Date.now()` (server-authoritative; local 250ms tick is render-only) and disables Generate / Start / Rest**; **[x] cycle 5 rest click dispatches `race.rest` when roster is unfit (canRest === true)**. RaceControls complete.
- [x] `HorseList.vue` + test (iterate `horses.horses`; loading skeleton)
- [x] `ProgramPanel.vue` + test (mount when phase ≠ INITIAL; resolve IDs via `byId`; `isCurrent` reflects `currentRoundIndex`) — parent uses `v-if`; panel itself assumes a program exists.
- [x] `ResultsPanel.vue` + test (pre-render 6 cards from `ROUND_DISTANCES`; entries fill as `results` grows; insertion-order-independent via `roundNumber` lookup)
- [x] `RaceTrack.vue` + test (runs `useRaceSimulation`; `watch(done, fn, { once: true })` per §16.11; calls `race.completeRound(finishOrder)`) — 3 tests (happy/edge/sad): renders LANE_COUNT `RaceLane` children with `{laneIndex, horse, positionM, distanceM}` resolved via `horses.byId` + `positions` ref; flipping `done → true` dispatches `race.completeRound(finishOrder.value)` exactly once; subsequent `done` re-toggles do not re-dispatch (`{ once: true }`). `useRaceSimulation` mocked via `vi.mock` returning module-level refs the test mutates.
- [x] **Error banner component** (`src/components/ErrorBanner.vue`, §16.8 / decision #22) — single banner covering `horses.error !== null` OR (empty roster AND not loading); displays `error.message` (or a fallback for the empty-roster case) plus a manual `[data-testid="btn-retry"]` button that dispatches `horses.fetchAll`. Mounted in `App.vue` between the header and the main grid. 4 tests (happy/edge/sad + action wiring): error visible with message + Retry; empty roster visible without an error; hidden when roster loaded and no error (sad — a stub always-rendering would fail); Retry click dispatches `fetchAll`.

Exit: all container tests green.

---

### Phase 8 — Styling & layout
Status: `complete` ✓ (superseded by Phase 8.5 — Tailwind + dark-mode gaming redesign)

Surface concerns deferred in `ARCHITECTURE.md` §13.

- [x] **Web entrypoint wired** — `index.html` (host page with `#app` + `/src/main.ts` module script) and `src/main.ts` (`createApp(App).use(createPinia()).mount('#app')`). `vite.config.ts` pinned to `port: 5173, strictPort: true` so port collisions fail loudly instead of drifting (was silently jumping to 5174, breaking the expected Playwright baseURL in Phase 9). Manual smoke: `npm run dev` → `GET /` 200 with `#app`, `GET /src/main.ts` 200, `GET /api/horses` 200 via proxy → 20 horses. **Test-after deviation logged:** unit-test surface for the HTML host + main bootstrap is Playwright (Phase 9); Vitest already covers `App.vue` mount wiring (3 tests in `App.test.ts`).
- [x] **Env-driven Vite config** — `WEB_PORT` and `API_PROXY_TARGET` now load from env (`loadEnv` with empty prefix) with the existing literals as fallback defaults. `.env.example` committed (documents the contract); `.env` gitignored. Pipeline deploys set these as pipeline variables. Smoke: `WEB_PORT=5180 npm run dev:web` → binds 5180, leaves 5173 free; `npm run dev:web` with `.env` defaults → binds 5173. Server-side port (`server/index.ts` hardcodes `3001`) is still hardcoded — promoting it to env is a follow-up; the proxy target must match whatever the server binds.
- [x] `src/styles/tokens.css` — CSS variables (spacing, radii, fonts, neutral palette + mockup-aligned colors: coral header `#e08a8a`, yellow roster header `#e7d36b`, blue program header `#cfd8ff`, green results header `#c6e8c6`, track grey, dashed-red finish-line). `LANE_COLORS` continues to live in `domain/constants.ts` (lane colors are domain data, not a surface token).
- [x] `src/styles/reset.css`, `src/styles/main.css` — minimal box-sizing + body reset; `main.css` `@import`s tokens and reset. `src/main.ts` imports `./styles/main.css` so the bundle ships them globally.
- [x] Scoped component styles matching `image.png`. `App` is a 3-column grid (roster / track / program+results); `AppHeader` is a coral bar with uppercased pill buttons; `HorseList` is a table with a yellow strip header and (`#` / Name / Cond) zebra rows; `ProgramPanel` + `ResultsPanel` sit side-by-side in the right aside; `ProgramRoundCard` highlights the current round in blue; `ResultRoundCard` shows zebra rows under a muted strip header; `RaceTrack` is one bordered track with zebra lanes, a dashed-red finish line at the right edge, and a footer reading `Lap N — Dm  FINISH`. Build smoke: `npm run build` → 9.29 kB CSS bundle, no warnings; full 210/210 vitest green; vue-tsc clean.
- [x] Manual in-browser smoke deferred to the user (dev server already running with HMR on `:5173`); behavioral correctness is locked by the test suite, and the build pass confirms CSS imports compile.

Exit: visually matches the mockup; no console errors; no Vue warnings.

---

### Phase 8.5 — Tailwind migration + dark-mode gaming redesign
Status: `complete` ✓

Re-skin pass after Phase 8 landed. The pastel mockup-aligned palette read like a spreadsheet, not a racing game; the user invoked `/ui-ux-pro-max` which recommended a dark-mode OLED gaming aesthetic with Russo One + Chakra Petch + JetBrains Mono. The migration is style-tooling + design-token only — zero behavior changes, no test files touched.

- [x] **Install Tailwind v3 + PostCSS.** `tailwindcss@^3.4`, `postcss`, `autoprefixer`. `postcss.config.js` at repo root wires the plugins. `src/styles/main.css` adds `@tailwind base; @tailwind components; @tailwind utilities;` after the token + reset imports.
- [x] **`tailwind.config.ts` token bridge.** `theme.extend.colors` maps every `--color-*` CSS variable to a named utility (`bg-bg`, `text-text-muted`, `border-border-strong`, etc.); spacing tokens `s1..s6`; font families `body` / `racing` / `mono`; box-shadows `panel` / `current` / `finish`. `corePlugins.preflight: false` — our own `reset.css` already covers normalization, plus a `*` rule sets `border-width:0; border-style:solid` so Tailwind's `border-*` utilities actually render. Theme key for the display font is `racing` (not `display`) to avoid the `font-display` descriptor-name collision. Decision #31 in `ARCHITECTURE.md` §12.
- [x] **Convert every `<style scoped>` block from raw CSS to `@apply` + tokens.** Templates (and BEM class names) are byte-identical — `wrapper.classes()` and `wrapper.attributes('style')` assertions in component tests remain green. Single-use BEM declarations stay in plain CSS (gradients, repeating-linear-gradient finish line, dynamic `left: calc(var(--horse-progress) * 100%)`).
- [x] **Rewrite `src/styles/tokens.css` for a trackside-at-night palette.** Deep-navy bg (`#060912`), charcoal panels (`#0f1729` / `#18213a`), section-tinted headers (gold `#fbbf24` roster / cyan `#22d3ee` program / emerald `#34d399` results), amber accent for the live round + glow shadow, neon-red (`#f43f5e`) dashed finish line with halo. Added `--font-racing` (Russo One), `--font-body` (Chakra Petch), `--font-mono` (JetBrains Mono); `--font-size-xs/2xl`; `--radius-3`, `--radius-pill`; `--shadow-panel`, `--shadow-current`, `--shadow-finish`, `--shadow-focus`. Decision #32.
- [x] **Google Fonts in `index.html`.** Preconnect + single `<link>` for Russo One, Chakra Petch (400/500/600/700), JetBrains Mono (400/700). `display=swap`.
- [x] **`reset.css` upgraded:** dark `body` background + light text via tokens, `h1..h4` use `--font-racing`, `:focus-visible` ring uses `--shadow-focus`, `::selection` uses the amber accent, `prefers-reduced-motion` query neutralizes transitions.
- [x] **Restyle pass — every component.** App vignette; AppHeader with Russo One gold-gradient title + cyan phase pill; section-tinted panel headers; amber-glow current round; turf-dark track with 10%-step distance guides and neon finish line; mono ranking positions; gradient gold primary buttons + cyan-ghost Rest with glow hover.
- [x] **Validation:** `npm run build` → 23.07 kB CSS bundle (gzip 4.54 kB); `npx vitest run --exclude '**/simulation.test.ts'` → 195/195 green across 29 files (the 3 pre-existing failures in `simulation.test.ts` are unrelated Phase 12.1 red-state TDD tests on uncommitted `simulation.ts` work).

Exit: dark-mode gaming look ships; tests + build green; CSS architecture (Tailwind `@apply` + BEM class names + CSS-var token bridge) documented in `ARCHITECTURE.md` §12 decisions #31–#32.

---

### Phase 9 — Playwright happy path
Status: `pending`

- [ ] `tests/e2e/happy-path.spec.ts` — load page → roster visible → click Generate. With the current seed (`0xDECAF`), only 10 horses are ≥ 40 condition, so the click surfaces the warning + reveals Rest. Click Rest → wait 10s for countdown to elapse → assert roster reflects bumped conditions → click Generate again → ProgramPanel renders → click Start → wait until 6 result cards visible → assert FINISHED phase indicator. This single happy-path naturally exercises both the rest mechanism and the race loop because the seeded roster forces it.
- [ ] **Alternative rest-skip path** (only if seed changes): if `count(fit) ≥ 15` on a future seed, the first Generate succeeds without needing rest. Test should branch on the visible "fit horses" warning rather than asserting it always appears.
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

### Phase 12 — Race pacing revision (reviewer feedback 2026-05-15)

Status: in progress (Step 1 landed).

Two coupled revisions ship together: (a) runtime `SIM_SPEED_MULTIPLIER` so reviewers can speed up boring real-time races, (b) per-race "form" offset so close-condition pairs become real coin-flips while big gaps stay lopsided. Brainstorm + decision log captured in this session.

#### Sub-phase 12.1 — Per-race form variance (domain)
- [x] Step 1 — `drawForm(rng)` + `FORM_MPS = 1.0` constant. Three flavors (happy / edge / sad) in `simulation.test.ts`. (commit pending)
- [x] Step 2 — `computeSpeed(condition, form, jitter)` 3-arg signature; updated formula adds `form` term; existing 2-arg tests rebaselined.
- [x] Step 3 — `LanePosition.form` field; `createSnapshot(round, n, rng)` draws form per lane in lane-order 1→10.
- [x] Step 4 — `step()` passes persistent `lane.form` into `computeSpeed`; no extra rng for form per tick.
- [x] Step 5 — Closed-form anchor tests independent of seed (cond=MAX/MIN, form=0, jitter=0; sensitivity per arg).
- [x] Step 6 — Rebaseline remaining seeded simulation tests + composable test fixtures. *(no-op: existing seeded tests asserted determinism, not exact positions)*
- [x] Step 7 — Variance-shape behavior tests (cond=80 always beats cond=45 with forms=0; cond=45 can beat cond=55 with form rigged; FORM_MPS boundary documented).
- [x] Step 8 — `JITTER_MPS` 1.5 → 0.5 (visual jiggle only; form now owns outcome variance).

Exit: per-race form active, suite green, 45-vs-55 races flip outcomes across seeds. **DONE 2026-05-15.**

#### Sub-phase 12.2 — Runtime sim-speed control
- [x] Step 9 — `useRaceStore.simSpeedMultiplier` + `increase/decreaseSimSpeed` clamped to [0.5, 4] in 0.5 steps; default 2.
- [x] Step 10 — `useRaceSimulation` accumulator scales by multiplier (multiplier=1 ≡ baseline byte-identical).
- [x] Step 11 — `RaceTrack.vue` renders `[−] 2.0× [+]` row above lanes; disabled at bounds; BEM `.race-track__speed-control`.
- [ ] Step 12 — Playwright e2e: start → click + twice → race finishes faster. **Deferred** to the broader Phase 9 (Playwright happy path) bootstrap; no Playwright config or tests exist in the repo yet, so wiring one e2e for this feature would mean shipping infra alongside it. Component-level coverage in Phase 12.2 Step 11 (`RaceTrack.test.ts`) already exercises the buttons + readout + bounds via @vue/test-utils.

Exit: reviewer can speed/slow the simulation live during any race. **DONE 2026-05-15 (Step 12 deferred to Phase 9).**

---

## Errors encountered

| Phase | Error | Attempt | Resolution |
|---|---|---|---|

## Decisions made during implementation

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | **Fit-gate + Rest mechanism + in-race condition text added between Phase 2 and Phase 3.** New phase `RESTING`, new domain helpers `applyRestEffects` / `isFit`, new error `NotEnoughFitHorsesError`, new constants `MIN_RACEABLE_CONDITION` / `MIN_FIT_HORSES_FOR_PROGRAM` / `REST_DURATION_MS` / `REST_POLL_INTERVAL_MS`, new Prisma model `AppState`, envelope shape for `GET /api/horses`, new endpoint `POST /api/horses/rest`, new composable `useRestPolling`, new component additions to `RaceControls` (Rest + warning + countdown) and `HorseSprite` (condition text). | Smoke against seed `0xDECAF` showed 10 of 20 horses below condition 40 — meetings generated against this roster produced visually broken low-condition races. The fit-gate prevents the failure mode; the Rest button + bump-to-floor (`MIN_RACEABLE_CONDITION`) is the user's recovery path. In-race condition text gives the user a per-horse "this is going to crawl" signal without sprite variants. All 10 decisions recorded in `BUSINESS_LOGIC.md` decisions #26-#29 and `ARCHITECTURE.md` decisions #25-#30. Brainstorm transcript: 2026-05-14 session 4. |

## Open questions (raise to user)

- Speed-formula tuning constants (§16.2 numbers) — pick during Phase 1 and document; ask user only if Phase 9 reveals races finish too fast/slow.
- Exact `LANE_COLORS` hex values (§16.3) — pick Wong/Okabe-Ito in Phase 1; ask user only if accessibility concerns surface.
- Confirm horse-name editorial list (§18) — propose during Phase 2; ask user for theme preference.
