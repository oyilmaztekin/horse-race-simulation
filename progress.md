# Progress Log

## 2026-05-14 — Session 1: planning

- Read `BUSINESS_LOGIC.md` (all sections, 6 non-goals, 25 decisions).
- Read `ARCHITECTURE.md` (all 16 sections, 23 decisions).
- Verified project root is empty of code — only the three locked docs + `expectation.md` + `image.png` + `CLAUDE.md` present. No `package.json` yet, so Phase 0 is the literal starting point.
- Created `task_plan.md` with 11 phases (0–10) following `ARCHITECTURE.md` §15.4 inside-out build order.
- Created `findings.md` summarizing locked rules, architecture, and gotchas.

## Next action

Wait for user approval / direction. Plan does not start Phase 0 until user confirms.

## Files created

- `task_plan.md`
- `findings.md`
- `progress.md`

## 2026-05-14 — Session 2+: Phase 0–2 progress

### Phase 0 (scaffolding)
- `package.json`, `tsconfig.json`, `server/tsconfig.json`, `vite.config.ts`,
  `vitest.config.ts`, `tests/setup.ts`, `prisma/schema.prisma`, `.gitignore`
  in place. `package-lock.json` tracked. Typecheck excludes the two vite/vitest
  config files (resolves the vite@6 ↔ vitest@2 internal vite version clash).

### Phase 1 — constants + types
- `src/domain/constants.ts`: `HORSE_COUNT`, `CONDITION_MIN`, `CONDITION_MAX`,
  `ROUND_DISTANCES` (as const tuple), `ROUND_COUNT` (derived from tuple length).
- `src/domain/types.ts`: `Rng`, `HorseId`, `Horse`, `Round`, `Program`.

### Phase 2 — pure domain (in progress, TDD red→green→commit per behavior)

| Module                | Cycle | Status | Tests |
|-----------------------|-------|--------|-------|
| `rng.ts`              | mulberry32 seed → deterministic stream | ✅ committed `1385808` | 3 (happy/edge/sad) |
| `horseFactory.ts`     | `generateRoster(rng, lookupName)` + `pickConditionUniform(rng)` | ✅ committed `1f2e091` | 6 (3+3) |
| `programGenerator.ts` | scaffold 6 rounds with locked distances | ✅ committed `16490e7` | 3 (happy/edge/sad) |
| `programGenerator.ts` | lane assignments — LANE_COUNT distinct horses per round | ✅ committed `a5deff6` | 3 (happy/edge/sad) |
| `programGenerator.ts` | rest rule (`MIN_REST_ROUNDS = 1`) | ✅ committed `7e964c3` | 3 (happy/edge/sad) |
| `programGenerator.ts` | cap rule (`MAX_RACES_PER_HORSE`) | ⊘ skipped — structurally redundant per BUSINESS_LOGIC §3.3 ("Cap exhaustion is not a real concern in practice"). No observable behavior to drive via TDD. | n/a |
| `programGenerator.ts` | condition-weighted selection (decision #11) | ✅ committed `4bf4881` | 3 (happy/edge/sad) |
| `simulation.ts`       | SIM-A1 `computeSpeed(condition, jitter)` — pure additive linear interpolation (decision #12) | ✅ committed `fc21a3d` | 3 (happy/edge/sad) |
| `simulation.ts`       | SIM-A2 `drawJitter(rng)` — one rng draw → uniform sample in [-JITTER_MPS, +JITTER_MPS), anchored at rng()=0.5 → 0 | ✅ committed `0d638c8` | 3 (happy/edge/sad) |
| `simulation.ts`       | SIM-A3 `advanceLane(lane, speedMps, dtMs, distance, elapsedMsBeforeTick)` — per-tick position update + sub-tick finish interpolation (decision #14); already-finished lanes returned untouched | ✅ committed `191ed13` | 3 (happy/edge/sad) |
| `simulation.ts`       | SIM-A4 `createSnapshot(round, roundNumber)` — zeroed initial snapshot; lanes 1-indexed in lane-order, horseIds wired through, elapsedMs=0, finishedAtMs=null | ✅ committed `e5fda6e` | 3 (happy/edge/sad) |
| `simulation.ts`       | SIM-A5 `step(snapshot, dtMs, conditionLookup, rng)` — orchestrator; processes lanes in lane-order 1→10 (decision #13); already-finished lanes skip jitter draw + movement; `elapsedMs += dtMs` | ✅ committed `3070be4` | 3 (happy/edge/sad) |
| `conditionMutation.ts`| `applyRoundEffects(horses, raced)` — raced lose `FATIGUE_PER_RACE=8`, rested gain `RECOVERY_PER_REST=3`, clamped to `[CONDITION_MIN, CONDITION_MAX]`; identity (number, name) preserved | ✅ committed `141840e` | 3 (happy/edge/sad) |
| `wait.ts`             | `wait(ms)` — Promise wrapper over `setTimeout`; driven with fake timers (ARCHITECTURE §16.7) | ✅ committed | 3 (happy/edge/sad) |
| `errors.ts`           | `InvalidTransitionError(kind, action)` + `ApiError(status, body)`; both extend `Error` with discriminating `name` and informative `message` | ✅ committed | 6 (happy/edge/sad × 2 classes) |

### Doc amendments along the way
- `BUSINESS_LOGIC.md` decision #18 rewritten: horse names live in
  `prisma/horseNames.json` (data fixture, not a TS module).
- `ARCHITECTURE.md` §2/§8/decision #24 follow suit.
- `CLAUDE.md` §1 gains two sub-rules: algorithm-internal magic literals must
  be named consts; backend-owned persisted data never in any TS module.
- `CLAUDE.md` §2 caps comments at 1–3 lines, no multi-paragraph docstrings.
- `CLAUDE.md` §3 adds the three-flavor coverage floor (happy + edge + sad).

### Test count
- 48 tests across 7 files, all green. Typecheck clean.
- `simulation.ts` feature-complete for the inner-loop math (A1–A5).
- `conditionMutation.ts`, `wait.ts`, `errors.ts` all landed.
- **Phase 2 (pure domain) is COMPLETE.**
- `RacePhase` type added to `types.ts` so `InvalidTransitionError.kind` is type-safe.

### Phase 2 → Phase 3 bridge: real-data smoke (2026-05-14)
- **`prisma/seed.ts`** added: reads `prisma/horseNames.json` + `createRng(0xDECAF)` → `generateRoster` → `prisma.horse.createMany`.
- **`prisma migrate dev --name init`** ran: creates `prisma/migrations/20260514124617_init/migration.sql` and `dev.db` (both gitignored per project convention).
- **`prisma db seed`** ran (Prisma's `migrate dev` fired it automatically): 20 horses persisted.
- **`scripts/smoke-phase2.ts`** added: reads DB → generates a 6-round program with `createRng(0xC0FFEE)` → simulates each round to completion via `step` → applies `applyRoundEffects` between rounds. Read-only against DB; reusable for future Phase 2 sanity checks.
- **`SIM_TICK_MS = 1000 / 60`** named in `constants.ts` (its first-and-second consumer triggered §1's "no duplicate literals" rule). Refactored `simulation.test.ts` to import the constant instead of inlining `1000 / 60` (5 occurrences).
- Smoke output validated by inspection: deterministic roster, weighted selection, rest rule, condition-driven finish ordering, sub-tick finish times, fatigue/clamp behavior across all 6 rounds. **Phase 2 modules compose correctly against real data.**
- Migration files (`prisma/migrations/`) are gitignored per project convention — flagged to user as nonstandard for Prisma but defensible for a one-person MVP (schema.prisma + `migrate dev` reproduces).

## 2026-05-14 — Session 3: deployment planning (no code)

Planning-only session. No tests, no production code touched. Current implementation state unchanged (mid-Phase 2; simulation.ts is next).

### What was decided
- Deployment will be **Phase 11**, gated on Phase 9 (Playwright happy path) green.
- Stack: **Fly.io + single multi-stage Docker image + nginx + Hono via supervisord + 1GB volume for SQLite**.
- IaC artifact: **`fly.toml`** (no Terraform — community fly provider is third-party and flaky).
- CI/CD: **GitHub Actions** — push-to-main triggers test → build → `flyctl deploy --remote-only`.

### Discussion trail (for the record)
- User initially asked about Supabase and GCP. Discarded both: Supabase replaces the backend (invalidates `ARCHITECTURE.md`); GCP works but underuses the platform for a SQLite app.
- nginx role clarified: serves Vue `/dist` AND reverse-proxies `/api/*` to Hono on `127.0.0.1:3001`. Two upstreams, one process.
- Hono will be patched (in 11.1) to bind `127.0.0.1` via `HOST` env var so nginx is the only public ingress.

### Files modified
- `task_plan.md` — appended Phase 11 (sub-phases 11.1 container build / 11.2 manual Fly deploy / 11.3 GitHub Actions / 11.4 DEPLOYMENT.md).
- `findings.md` — added "Deployment (locked 2026-05-14)" section with request-flow diagram, gotchas, and the "why Fly over alternatives" rationale.
- `progress.md` — this entry.

### Next action
Resume implementation at Phase 2 (`simulation.ts`). Deployment is documented and queued; not started until Phase 9 green.

### Simulation design pinned (2026-05-14)
- Snapshot shape locked per `ARCHITECTURE.md` §6 (`LanePosition`, `SimulationSnapshot`).
- Speed-formula constants tuned: `BASE_SPEED_MPS_MIN = 14`, `BASE_SPEED_MPS_MAX = 18`,
  `JITTER_MPS = 1.5`. Closes `ARCHITECTURE.md` §16.2 TBDs.
- Decomposed into independent unit-testable functions (per user direction):
  `computeSpeed` (pure math), `drawJitter` (rng→sample), `advanceLane`
  (position + sub-tick finish), `createSnapshot` (factory), `step`
  (orchestrator that pulls them together).

## 2026-05-14 — Session 4: Fit-gate + Rest mechanism brainstorm (doc-only)

Triggered by `prisma/dev.db` inspection: the seeded roster (`createRng(0xDECAF)`)
rolled 10 of 20 horses below condition 40. A meeting generated against this
roster produces visually broken low-condition rounds. The current rules
(rest=1, cap=4, weighted selection) handle this *probabilistically* but
without a structural gate.

10-question brainstorm in this session pinned the design (see `BUSINESS_LOGIC.md`
decisions #26–#29 and `ARCHITECTURE.md` decisions #25–#30 for the full record).
Summary:

- **Fit-gate** at `INITIAL` only: program generation requires ≥ `MIN_FIT_HORSES_FOR_PROGRAM = 15`
  fit horses (derived from `LANE_COUNT × ROUND_COUNT / MAX_RACES_PER_HORSE`).
- **Rest mechanism**: 10-second real-time timer; server bumps every horse with
  `condition < MIN_RACEABLE_CONDITION (40)` to exactly 40. One click guarantees
  re-fit roster.
- **State machine**: new `RESTING` phase between `INITIAL` and itself. No mid-meeting rest.
- **API**: `GET /api/horses` returns `{ horses, restingUntil }` envelope (breaking
  change, not yet shipped); new `POST /api/horses/rest`; lazy-bump-on-poll
  inside `db.$transaction`. New `AppState` Prisma model holds `restingUntil`.
- **UX**: Generate stays clickable; on fit-gate failure surfaces a warning and
  reveals the Rest button. No disabled-by-default control.
- **In-race condition display**: plain numeric text above each sprite during
  RACING. No SVG variants — explicitly rejected.

### Files modified
- `BUSINESS_LOGIC.md` — §3.8 + §3.9 added, §4.2 + §4.3 amended, §4.7 added,
  §5 decisions #26–#29 appended, §6 non-goals extended.
- `ARCHITECTURE.md` — §2 layout updated, §4.1/§4.2 store extended, §5 state
  machine extended, §6 types extended (envelope), §7 API contract extended,
  §8 server + Prisma schema extended, §10 useRaceApi/useRestPolling, §11
  boot sequence rewritten, §12 decisions #25–#30 appended, §14
  components/visibility/props extended, §15 test inventory extended,
  §16.1b new constants/errors section.
- `task_plan.md` — Phase 1 constants list extended, Phase 2 conditionMutation
  amendment, Phase 3 AppState + envelope + rest endpoint, Phase 4 race store
  RESTING + rest actions, Phase 5 useRestPolling composable, Phase 6 HorseSprite
  condition prop, Phase 7 RaceControls Rest button + warning + countdown,
  Phase 9 E2E rest-flow inclusion, decision-log entry appended.

### Next action
Doc-only commit (no code). After commit, resume implementation by adding the
four new constants + `NotEnoughFitHorsesError` to Phase 1, then write the
red test for `applyRestEffects` / `isFit` in Phase 2 (`CLAUDE.md` §3 — one
failing test per behavior).

## 2026-05-15 — Session 5: Phase 4 (Pinia stores) — in progress

### What landed

- `src/domain/types.ts` — added `Ranking` and `RoundResult` types (required by race store).
- `src/composables/useRaceApi.ts` — stub implementation (full TDD in Phase 5); exported so stores can import it now.
- `src/stores/horses.ts` — full implementation: `horses` / `isLoading` / `error` refs; `fetchAll` (reads envelope, calls `race.resumeRestFromBoot` if `restingUntil !== null`); `applyServerUpdate`; `byId`; `conditionLookup` (miss → `CONDITION_MIN`).
- `src/stores/__tests__/horses.test.ts` — 12 tests (3 for `fetchAll`, 3 for `applyServerUpdate`, 3 for `byId`, 3 for `conditionLookup`); `useRaceApi` and race store mocked at module level via `vi.mock`.
- `src/stores/race.ts` — stub only (just `resumeRestFromBoot` no-op); full implementation is next.

### Test count

84 tests (11 files), all green.

### Next action

Write `src/stores/__tests__/race.test.ts` (RED), then implement full `src/stores/race.ts` (GREEN). This completes Phase 4.

## 2026-05-15 — Session 6: Phase 4 race store, cycle 1 (initial state)

### What landed

- `src/stores/__tests__/race.test.ts` — 3 tests (happy/edge/sad) covering the INITIAL skeleton: `state.kind === PHASE_INITIAL`, `phase` computed mirrors it, neutral derivations (`program === null`, `currentRound === null`, `currentRoundIndex === -1`, `results === []`, `restingUntil === null`, `seed === null`, `currentRng === null`).
- `src/stores/race.ts` — replaced stub with full `RaceState` discriminated union (5 variants) and INITIAL-only behavior: state ref, all read-side computed derivations, `resumeRestFromBoot` / `completeRound` left as stubs for later cycles.
- `src/domain/constants.ts` — added `PHASE_INITIAL`, `PHASE_RESTING`, `PHASE_READY`, `PHASE_RACING`, `PHASE_FINISHED` value-level constants. Tests and store now import these instead of inlining the strings (CLAUDE.md §1).

### Test count

87 tests (12 files), all green.

### Next action

Cycle 2 — `generateProgram` happy path from INITIAL → READY (fit-gate passes, fresh RNG carried on the union).

## 2026-05-15 — Session 7: Phase 4 race store, cycle 2 (generateProgram happy path)

### What landed

- `src/stores/__tests__/race.test.ts` — added 3 tests for `generateProgram` happy path: roster of 20 fit horses → READY with full 6-round program (each round has correct distance + LANE_COUNT lanes); seed defaults to `Date.now()` when called with no argument; different seeds produce different programs (so a constant-RNG stub would fail).
- `src/stores/race.ts` — `generateProgram(seed = Date.now())` action: reads `horses.horses` from the horses store, builds a fresh `createRng(seed)`, runs `generateProgramFn`, sets state to `{ kind: PHASE_READY, program, rng, seed }`. Imported `generateProgram` from programGenerator as `generateProgramFn` to avoid the action-name collision.
- READY branch of `RaceState` switched from string-literal `'READY'` to `typeof PHASE_READY`.

### Test count

90 tests (12 files), all green.

### Next action

Cycle 3 — `generateProgram` fit-gate failure: throws `NotEnoughFitHorsesError` when `count(fit) < MIN_FIT_HORSES_FOR_PROGRAM`, state stays INITIAL.

## 2026-05-15 — Session 8: Phase 4 race store, cycle 3a (countFitHorses)

### What landed

- `src/domain/conditionMutation.ts` — `countFitHorses(horses)` extracted as a pure domain helper. Unit-testable on its own; the race store will call it (and the upcoming `assertEnoughFitHorses` guard) instead of inlining `horses.filter(isFit).length`.
- `src/domain/__tests__/conditionMutation.test.ts` — 3 tests (happy / edge / sad): mixed roster returns correct count; empty input returns 0; all-unfit input returns 0 (a `return horses.length` stub would fail this).

### Decision

Decomposed the fit-gate into pure domain functions. `isFit` was already there; `countFitHorses` is the aggregate the store needs. The store should not own predicate math — it orchestrates state, not condition rules.

### Test count

93 tests (12 files), all green.

### Next action

Cycle 3b — `assertEnoughFitHorses(horses)` domain guard that throws `NotEnoughFitHorsesError` when the count is below threshold.

## 2026-05-15 — Session 9: Phase 4 race store, cycle 3b (assertEnoughFitHorses)

### What landed

- `src/domain/conditionMutation.ts` — `assertEnoughFitHorses(horses)` guard: calls `countFitHorses`, throws `NotEnoughFitHorsesError(fitCount, MIN_FIT_HORSES_FOR_PROGRAM)` if the count falls short, returns void otherwise.
- 3 unit tests (happy / edge / sad): below-threshold throws with correct counts; empty roster throws (zero fit); exactly `MIN_FIT_HORSES_FOR_PROGRAM` passes without throwing — guards against `<` vs `<=` off-by-ones.

### Test count

96 tests (12 files), all green.

### Next action

Cycle 3c — wire `assertEnoughFitHorses` into `race.generateProgram` and re-add the store-level integration tests that exercise the gate.

## 2026-05-15 — Session 10: Phase 4 race store, cycle 3c (wire fit-gate into store)

### What landed

- `src/stores/race.ts` — `generateProgram` calls `assertEnoughFitHorses(horses.horses)` at the top; on failure the domain error propagates and state stays INITIAL.
- `src/stores/__tests__/race.test.ts` — 1 store-level integration test: below-threshold roster throws `NotEnoughFitHorsesError` carrying the right `fitCount`, and state remains `PHASE_INITIAL` afterwards. The boundary / empty-roster cases live in the domain unit tests (cycle 3b) — no duplication here.

### Decision

Store-level test exercises only what the store owns: the wiring + the post-throw state invariant. Domain math (off-by-one, zero-roster) is unit-tested at the source.

### Test count

97 tests (12 files), all green.

### Next action

Phase 5 — composables (`useRaceApi` real implementation, `useRaceSimulation`, `useRestPolling`).

## 2026-05-15 — Session 13: Phase 5 — composables (complete)

### What landed

- `src/composables/__tests__/useRaceApi.test.ts` — 9 tests (3 per method × 3 methods). Happy: URL/method/body + return shape. Edge: non-null `restingUntil` envelope / empty raced list. Sad: `ApiError` carries `status` + `body` on non-2xx. `fetch` stubbed via `vi.stubGlobal` (avoids the TS variance issue with `vi.spyOn(globalThis, 'fetch')`). Implementation carried over from the Phase 4 bridge unchanged.
- `src/composables/useRaceSimulation.ts` — accumulator-pattern rAF loop at fixed `SIM_TICK_MS`. `(round, roundNumber, conditionLookup, rng) → { positions, finishOrder, done }`. `finishOrder` re-sorts by `finishedAtMs` then `lane` (decision #15 tie-break). Cleanup via `cancelAnimationFrame` in `onUnmounted`.
- `src/composables/__tests__/useRaceSimulation.test.ts` — 4 tests mounted inside a `defineComponent` host via `@vue/test-utils`; drive the loop with `vi.advanceTimersByTimeAsync`. Happy: positions grow after 500ms. Edge: after 120s every lane finishes, `done === true`, ranks 1..10 unique. Sad: identical seeds produce identical finish orders; different seed differs (catches a stub returning a constant). Sad: `cancelAnimationFrame` spy called on unmount.
- `src/composables/useRestPolling.ts` — watches `race.phase`; on entering `PHASE_RESTING` kicks off `setInterval(tick, REST_POLL_INTERVAL_MS)` plus an immediate `tick()`; on exiting clears the interval. `tick` calls `api.getHorses` then either `race.completeRest(envelope.horses)` (envelope cleared) or `horses.applyServerUpdate`. Catches and swallows network errors so the loop keeps retrying.
- `src/composables/__tests__/useRestPolling.test.ts` — 3 tests via a `defineComponent` host with a mocked `useRaceApi`. Happy: polls again every `REST_POLL_INTERVAL_MS`. Edge: envelope with `restingUntil: null` triggers `completeRest`, phase exits RESTING, polling halts (further timer advances produce no new calls). Sad: a rejected GET is swallowed; the next interval tick still fires.
- `tests/setup.ts` — extended fake-timer list to include `setInterval`/`clearInterval` so polling loops are deterministically drivable. All pre-existing tests still green.

### Test count

145 tests (15 files), all green. Typecheck clean.

### Next action

Phase 6 — presentational components: `ColorSwatch`, `HorseListItem`, `HorseSprite`, `RaceLane`, `ProgramRoundCard`, `ResultRoundCard`, `RankingRow`. One mount test per component (`@vue/test-utils`), pure prop-in → DOM-out.

## 2026-05-15 — Session 12: Phase 4 race store, cycles 5–10 (Phase 4 complete)

Six TDD cycles landed back-to-back; Phase 4 is now complete. Phase 4 tests grew from 4 to 31 (Phase 4 contributes the bulk of the 129-total). Each cycle: red→green→one behavior at a time.

### Cycle 5 — `start()`
`READY → RACING` carrying program/rng/seed; initializes `currentRoundIndex = 0`, `results = []`; throws `InvalidTransitionError(kind, 'start')` from any non-READY phase. 3 tests (happy/edge/sad).

### Cycle 6 — `completeRound(rankings)`
Phase-guarded on RACING. Builds `RoundResult { roundNumber, rankings }`, POSTs `racedIds` via `useRaceApi().completeRound`, then either:
- success + last round → `PHASE_FINISHED { program, seed, results }` (no wait), or
- success + mid-meeting → `wait(INTER_ROUND_DELAY_MS)` then RACING with advanced index, or
- failure → `PHASE_INITIAL` (decision #23 — local results evaporate; pre-call roster intact since `applyServerUpdate` was never called).

4 tests: happy (mid-meeting advance + POST args + roster applied), edge (last round → FINISHED, no wait), sad (POST rejects → INITIAL), sad (guard from non-RACING throws).

### Cycle 7 — `rest()`
Allowed only from INITIAL / FINISHED; throws `InvalidTransitionError` otherwise. POSTs via `useRaceApi().startRest`, sets `PHASE_RESTING { restingUntil: envelope.restingUntil }`. 3 tests (happy/edge/sad).

### Cycle 8 — `completeRest(updated)`
Allowed only from RESTING. Applies the bumped roster via `horses.applyServerUpdate(updated)` and transitions to INITIAL. 3 tests (happy + two sads — from INITIAL and from RACING, both throw + leave horses untouched).

### Cycle 9 — `resumeRestFromBoot(restingUntil)`
Called from `horses.fetchAll` when envelope.restingUntil is non-null. Transitions INITIAL → RESTING only if (a) currently in INITIAL and (b) the timestamp is still in the future. Otherwise no-op. 3 tests (happy / past-timestamp edge / non-INITIAL sad).

### Cycle 10 — Derived gates
`fitCount` (delegates to domain `countFitHorses`); `canGenerate` (roster-ready AND phase in INITIAL/READY/FINISHED); `canStart` (roster-ready AND phase === READY); `canRest` (roster-ready AND phase in INITIAL/FINISHED AND `fitCount < MIN_FIT_HORSES_FOR_PROGRAM`). 4 tests covering the four key combinations: fit/INITIAL, READY, unfit/INITIAL, locked (RACING / RESTING / loading).

### Test count

129 tests (12 files), all green. Typecheck clean. Phase 4 status: **complete**.

## 2026-05-15 — Session 27: useRestPolling forwards remainingRestMs to the store

### What landed

- `src/composables/useRestPolling.ts` — after each successful GET, calls `race.applyRestObservation(envelope.remainingRestMs)` when the field is non-null (still resting). The `restingUntil === null` early return switched to truthy `!envelope.restingUntil` per the new style note. `remainingRestMs !== null` retained because `0` is a meaningfully different signal from `null` (server reports 0 briefly before the next poll clears the rest entirely).
- `src/composables/__tests__/useRestPolling.test.ts` — 1 new test (sad — polling that ignored the field would fail): two queued envelopes with `remainingRestMs: 7500` then `6500`; the store's `restingMsRemaining` flips to each value as the polls land.

### Test count

187 tests (23 files), all green.

### Next action

Cycle D — refactor `RaceControls.vue` to render `race.restingMsRemaining` directly; remove `setInterval` + `displayNowMs` + the local computed. The countdown UX is now driven entirely by the 1s polling heartbeat.

## 2026-05-15 — Session 26: Race store carries server-polled remainingRestMs

### What landed

- `src/stores/race.ts` — `RESTING` variant of the `RaceState` union gains `remainingRestMs: number`. New computed `restingMsRemaining` exposes the latest server-polled value (null outside RESTING). New action `applyRestObservation(remainingRestMs)` no-ops outside RESTING and otherwise replaces `state.value.remainingRestMs` in place. `rest()` seeds the field from `envelope.remainingRestMs`. `resumeRestFromBoot(restingUntil, remainingRestMs)` signature updated; no-op when remainingRestMs ≤ 0.
- `src/stores/__tests__/race.test.ts` — 3 new tests for the new behavior (happy: rest() seeds the value; edge: applyRestObservation updates the value while RESTING; sad: applyRestObservation no-ops elsewhere). Existing RESTING-state literals updated to include the new field.
- `src/stores/horses.ts` + `src/stores/__tests__/horses.test.ts` — `resumeRestFromBoot` callsite passes both fields; mock signature widened.

### Why

The component will read `race.restingMsRemaining` directly; the polling composable will write it via `applyRestObservation`. Splits authority cleanly: the server *decides* (computes remainingRestMs each poll), the store *holds* it, the component *renders* it. No client-side `Date.now()` math anywhere downstream.

### Test count

186 tests (23 files), all green. Typecheck clean.

### Next action

Cycle C — `useRestPolling` calls `race.applyRestObservation(envelope.remainingRestMs)` on each mid-rest tick.

## 2026-05-15 — Session 25: Envelope carries server-computed remainingRestMs

### What landed

- `src/domain/types.ts` — `HorsesEnvelope` gains `remainingRestMs: number | null`. Server-computed at response time so the client renders the deadline without any local time math.
- `server/routes/horses.ts` — `readEnvelopeAndMaybeBump` + `startRestIfIdle` populate `remainingRestMs`: `null` when no rest is active or lazy-bump just cleared it; `restingUntil − now` while a rest is in flight.
- `server/__tests__/horses.test.ts` — 3 new tests (happy: matches `restingUntil − now` while resting; edge: null when no rest; sad: null after lazy-bump — a stub returning a number would fail).
- Test fixtures in `useRaceApi`, `useRestPolling`, `horses.store` updated for the wider envelope shape; typecheck clean.

### Why this shape (user-driven decision)

The previous client-side 250ms `setInterval` made `RaceControls` *look* like it owned the countdown, even though the server owned `restingUntil`. User flagged this as ambiguous to readers and asked for a clearly server-driven version. With `remainingRestMs` in the envelope, each 1s poll brings a fresh server-computed countdown; the client renders it verbatim. No `Date.now()` in the view.

### Test count

183 tests (23 files), all green. Typecheck clean.

### Next action

Cycle B — refactor `RaceControls` to render `race.restingMsRemaining` directly; drop the local interval. (Race store + `useRestPolling` need to wire the polled value onto state.)

## 2026-05-15 — Session 24: Phase 7 cycles 4+5 (RaceControls countdown + rest dispatch) — RaceControls complete

### What landed

- `src/components/RaceControls.vue` — added `secondsUntilRestComplete` computed (note the rename from the initially-drafted `countdownSeconds` after user feedback — name should signal *display*, not *authority*). A local `setInterval` (`DISPLAY_TICK_MS = 250`) bumps `displayNowMs` so the displayed seconds tick down between the 1s polls; an inline comment makes clear the server (`restingUntil` from POST /api/horses/rest, cleared by lazy-bump on GET /api/horses per BL §4.7 / ARCH decision #29) owns the timer. `onUnmounted` clears the interval. Countdown rendered as a `[data-testid="countdown"]` paragraph only while RESTING.
- `src/components/__tests__/RaceControls.test.ts` — 3 countdown tests (happy: 7000ms → '7'; edge: hidden outside RESTING; sad: Generate/Start/Rest all disabled when state flips to RESTING after the warning revealed Rest) plus 1 rest-dispatch test (sad: unfit roster → `canRest === true` → click invokes `race.rest`). Together they exercise the full ARCHITECTURE.md §4.2 button-and-phase matrix.

### Decision recorded as memory

User flagged "countdown" as ambiguous: it could read as if the client owns the rest timer. Saved as `feedback_server_authority_naming.md` — for any client value derived from server-authoritative state, name it as a *display value* (`secondsUntilX`, `remainingY`), and comment any local interval that's only a render trigger. Applies broadly (condition mutations, race state, etc.) — not just rest.

### Test count

180 tests (23 files), all green.

### Next action

Phase 7 cycle 6 — `HorseList.vue` container: iterate `horses.horses`; loading skeleton when `isLoading`.

## 2026-05-15 — Session 23: Phase 7 cycle 3 (RaceControls fit-gate warning + Rest reveal)

### What landed

- `src/components/RaceControls.vue` — local `lastWarning` ref + `onGenerate` handler that wraps `race.generateProgram()` in try/catch. `NotEnoughFitHorsesError` (the only expected throw) is caught locally and rendered as a `[data-testid="warning"]` paragraph; any other error rethrows. While `lastWarning !== null`, a `[data-testid="btn-rest"]` button is rendered (disabled flips via `race.canRest`).
- `src/components/__tests__/RaceControls.test.ts` — 3 new tests under a `fit-gate warning + Rest reveal` describe (interleaved with the existing block): no warning/Rest before any click (sad — a stub that always rendered would fail); warning + Rest revealed after a thrown `NotEnoughFitHorsesError` (happy), with the rendered text checked to contain both `fitCount` and `required` so a hardcoded message would fail; a successful Generate leaves warning + Rest hidden (edge).

### Decision

`lastWarning` lives on the component, not the store (`ARCHITECTURE.md` decision #25/#30): the rule "fit-gate fails" is in the store, the *display* of that failure is a view concern. This keeps the store free of UX state and matches the same pattern used by the existing fit-gate tests in `src/stores/__tests__/race.test.ts`.

### Test count

176 tests (23 files), all green.

### Next action

Cycle 4 — RESTING phase renders countdown derived from `race.restingUntil − Date.now()` and disables all three buttons.

## 2026-05-15 — Session 22: Phase 7 cycle 2 (RaceControls click dispatches)

### What landed

- `src/components/RaceControls.vue` — `@click="race.generateProgram()"` and `@click="race.start()"` on the two buttons.
- `src/components/__tests__/RaceControls.test.ts` — 3 new tests under a `button click dispatches` describe: Generate click invokes `race.generateProgram` (happy); Start click invokes `race.start` and not generateProgram (edge); a disabled Generate (RESTING phase) does NOT fire the handler (sad — a stub that fired regardless would fail). `createTestingPinia` auto-stubs actions, so the assertions read directly from the spies.

### Test count

173 tests (23 files), all green.

### Next action

Cycle 3 — on `NotEnoughFitHorsesError` thrown from `generateProgram`, surface the warning banner and reveal the Rest button.

## 2026-05-15 — Session 21: Phase 7 cycle 1 (RaceControls button enabled state)

### What landed

- `src/components/RaceControls.vue` — minimal scaffold: two buttons (`btn-generate`, `btn-start`) wired to `race.canGenerate` / `race.canStart`. No click handlers yet; Rest button + warning + countdown land in later cycles.
- `src/components/__tests__/RaceControls.test.ts` — 3 tests (happy/edge/sad) using `createTestingPinia({ initialState })` to drive race + horses stores: Generate enabled / Start disabled in INITIAL with full roster (happy); both enabled in READY (edge); both disabled in RESTING (sad — a stub returning enabled would fail).

### Decision

`createTestingPinia` with seeded `initialState` is the right test seam for container components: the actual `canGenerate` / `canStart` computeds run against the seeded `state` ref, so a regression in those gates is caught here too. Actions are stubbed by default — handlers are deferred to cycle 2.

### Test count

170 tests (23 files), all green.

### Next action

Cycle 2 — `Generate` click dispatches `race.generateProgram()`; one happy/edge/sad set.

## 2026-05-15 — Session 20: Phase 6 cycle 7 (RankingRow) — Phase 6 complete

### What landed

- `src/components/RankingRow.vue` — renders `position` + `ColorSwatch(LANE_COLORS[laneIndex])` + `horse.name`. Pure props per ARCHITECTURE.md §14.3; no emits.
- `src/components/__tests__/RankingRow.test.ts` — 3 tests (happy/edge/sad): all three slots render; positions 1 and 10 both render verbatim; lane change re-colors the swatch (sad: stub ignoring `laneIndex` would fail).

### Test count

167 tests (22 files), all green. Typecheck clean. **Phase 6 (presentational components) is COMPLETE.**

### Next action

Phase 7 — container components. Start with `RaceControls` (most behavior; surfaces fit-gate warning, Rest reveal, countdown).

## 2026-05-15 — Session 19: Phase 6 cycle 6 (ResultRoundCard)

### What landed

- `src/components/ResultRoundCard.vue` — `<section>` with round header and finish-order rows; each row composes a `ColorSwatch` colored by `LANE_COLORS[laneIndex]` per ARCHITECTURE.md §14.3. Pure props; no store access.
- `src/components/__tests__/ResultRoundCard.test.ts` — 3 tests (happy/edge/sad): header + LANE_COUNT finish rows; one ColorSwatch per entry with correct color; reordered entries rerender in new order (sad).

### Test count

164 tests (21 files), all green. Typecheck clean.

### Next action

Phase 6 cycle 7 — `RankingRow.vue` (final presentational component).

## 2026-05-15 — Session 18: Phase 6 cycle 5 (ProgramRoundCard)

### What landed

- `src/components/ProgramRoundCard.vue` — `<section>` with header "Round N — D m" and an ordered list of LANE_COUNT entries (lane number + horse name). `--current` modifier class flips with `isCurrent` prop. Pure props per ARCHITECTURE.md §14.3; no store access.
- `src/components/__tests__/ProgramRoundCard.test.ts` — 3 tests (happy/edge/sad): all entries render in lane order with header text; `isCurrent` toggles class; reversed entries prop re-renders in new order (sad: a stub iterating a captured snapshot would fail).

### Test count

161 tests (20 files), all green. Typecheck clean.

### Next action

Phase 6 cycle 6 — `ResultRoundCard.vue`: finish-order rendering with swatches from `laneIndex`.

## 2026-05-15 — Session 17: Phase 6 cycle 4 (RaceLane)

### What landed

- `src/components/RaceLane.vue` — derives `color` from `LANE_COLORS[laneIndex]` and `progress` from `positionM / distanceM`, forwards `horse.condition` to a child `HorseSprite`. Pure prop-in/markup-out per ARCHITECTURE.md §14.3; no store access.
- `src/components/__tests__/RaceLane.test.ts` — 3 tests (happy/edge/sad): child sprite receives correct color + condition; progress is `positionM/distanceM` at 0, midpoint, and finish; different `laneIndex` produces a different color (sad: stub returning a fixed color would fail).
- TS note: `noUncheckedIndexedAccess` returns `string | undefined` for `LANE_COLORS[i]`; fallback to `LANE_COLORS[0]` keeps the type a plain `string` while preserving the runtime invariant already asserted at import time.

### Test count

158 tests (19 files), all green. Typecheck clean.

### Next action

Phase 6 cycle 5 — `ProgramRoundCard.vue`: lane-order list with `isCurrent` highlight.

## 2026-05-15 — Session 16: Phase 6 cycle 3 (HorseSprite)

### What landed

- `src/components/HorseSprite.vue` — pure presentational SVG with three props (`color`, `progress: 0..1`, `condition: number`). Horizontal position bound via CSS custom property `--horse-progress`, so positioning is data-driven and free of inline math in the template. Condition rendered as plain numeric text above the SVG per BUSINESS_LOGIC.md §3.9 / decision #27 — no threshold logic, no sprite variants.
- `src/components/__tests__/HorseSprite.test.ts` — 3 tests (happy/edge/sad): SVG present, fill color matches prop, condition text visible; setting `progress` to 0 then 1 updates the `--horse-progress` CSS var; setting `condition` from MIN to MAX swaps the rendered number (sad: stub ignoring the prop would fail).

### Test count

154 tests (18 files), all green. Typecheck clean.

### Next action

Phase 6 cycle 4 — `RaceLane.vue`: lane wrapper that derives `LANE_COLORS[laneIndex]`, converts `positionM / distanceM → progress`, mounts `HorseSprite`.

## 2026-05-15 — Session 15: Phase 6 cycle 2 (HorseListItem)

### What landed

- `src/components/HorseListItem.vue` — `<li>` rendering `horse.name` + `horse.condition` as separate spans. Single `horse: Horse` prop per ARCHITECTURE.md §14.3; no emits, no swatch (decision #21).
- `src/components/__tests__/HorseListItem.test.ts` — 3 tests (happy/edge/sad): name + condition visible; CONDITION_MIN/MAX rendered verbatim at boundaries; `setProps` rerender swaps in the new name/condition and drops the old (sad: a stub returning a constant template would fail).

### Test count

151 tests (17 files), all green. Typecheck clean.

### Next action

Phase 6 cycle 3 — `HorseSprite.vue`: SVG + condition text prop (BUSINESS_LOGIC §3.9 / decision #27).

## 2026-05-15 — Session 14: Phase 6 cycle 1 (ColorSwatch)

### What landed

- `src/components/ColorSwatch.vue` — pure `<span>` with inline `background-color` from a single `color: string` prop. Scoped styles for size/radius; no emits, no store access (per ARCHITECTURE.md §14.3).
- `src/components/__tests__/ColorSwatch.test.ts` — 3 tests (happy/edge/sad): hex color rendered via `style`; arbitrary CSS color strings (e.g., `rebeccapurple`) pass through unchanged; `setProps` rerender updates the style and removes the old color (sad: stub ignoring the prop would fail).

### Test count

148 tests (16 files), all green. Typecheck clean.

### Next action

Phase 6 cycle 2 — `HorseListItem.vue`: render `horse.name` + `horse.condition`; one mount test (happy/edge/sad).

## 2026-05-15 — Session 11: Phase 4 race store, cycle 4 (generateProgram phase guard)

### What landed

- `src/stores/race.ts` — `generateProgram` now reads `state.value.kind` first; if it's `PHASE_RACING` or `PHASE_RESTING` it throws `InvalidTransitionError(kind, 'generateProgram')` before touching the horses store or RNG. INITIAL / READY / FINISHED continue to transition to READY (READY re-rolls in place; FINISHED naturally clears prior results since the new READY variant has no `results` field).
- `src/stores/__tests__/race.test.ts` — 4 tests under a new `generateProgram phase guard` describe: READY re-rolls (happy), FINISHED → READY clears results (edge), RACING throws + state unchanged (sad), RESTING throws + state unchanged (sad).

### Test count

109 tests (12 files), all green. Typecheck clean.

### Next action

Cycle 5 — `start()` action: READY → RACING with `currentRoundIndex = 0`, `results = []`; throws `InvalidTransitionError` from non-READY phases.

## 2026-05-15 — Session N: Phase 5 audit fix (1/3) — useRestPolling unmount cleanup

### What landed

- `src/composables/__tests__/useRestPolling.test.ts` — new sad-flavor test spies on `globalThis.clearInterval`, mounts the host, enters RESTING, waits for the immediate tick, unmounts, then asserts (a) `clearInterval` was called and (b) no further `getHorses` calls fire after advancing the fake timer `REST_POLL_INTERVAL_MS * 5`. Verified red by commenting out `onUnmounted(stop)` in `useRestPolling.ts` — the new test failed; restoring the line returned to green.

### Why

Phase 5 audit found the `onUnmounted(stop)` branch in `useRestPolling.ts:51` had no test coverage. A regression that dropped that line would leak a polling interval across HMR / route unmount and survive the existing 3-test suite. `useRaceSimulation.test.ts:79-86` already locks down the symmetric `cancelAnimationFrame` cleanup; this brings rest polling to parity.

### Test count

159 tests (19 files), all green. Typecheck clean.

### Next action

Phase 5 audit fix (2/3) — `useRestPolling` mid-rest branch: assert `horses.applyServerUpdate` is called while `restingUntil !== null`.

## 2026-05-15 — Session N: Phase 5 audit fix (2/3) — useRestPolling mid-rest applyServerUpdate

### What landed

- `src/composables/__tests__/useRestPolling.test.ts` — the happy test now seeds the `horses` store with `condition: 5`, lets the immediate rest-poll fire with an envelope of `condition: 20` + non-null `restingUntil`, then asserts every horse in the store flipped to `condition: 20`. Verified red by commenting out `horses.applyServerUpdate(envelope.horses)` in `useRestPolling.ts:24` — the new assertion failed; restoring the line returned to green.

### Why

Audit found the mid-rest arm of `tick()` had no observable assertion. The previous happy test only counted `getHorses` calls, so a regression that dropped `applyServerUpdate` would have left UI roster stale while still passing all three pre-existing tests. The store-state assertion is the cheapest reliable witness — no extra spy, no double-mocking.

### Test count

161 tests (20 files), all green.

### Next action

Phase 5 audit fix (3/3) — `useRaceSimulation`: tighten finish-order test to assert horseId uniqueness across the LANE_COUNT-long ranking.

## 2026-05-15 — Session N: Phase 5 audit fix (3/3) — useRaceSimulation horseId uniqueness

### What landed

- `src/composables/__tests__/useRaceSimulation.test.ts` — the edge test (`fills finishOrder and flips done`) now also asserts (a) the finishOrder horseIds form a set of size `LANE_COUNT` and (b) the sorted horseIds equal `ROUND.lanes`. Verified red by mutating the composable to emit `horseId: 1` for every entry — the uniqueness assertion failed (and the deterministic-across-seeds test also caught the collapsed mapping). Restoring `horseId: lane.horseId` returned to green.

### Why

The pre-existing assertion only checked that ranks were `[1..10]`. A regression that duplicated a horseId across two lanes — or dropped one — would have left the rank shape intact and slipped past the suite. Adding a `Set` size check + sorted-equality against the input lane assignment locks down the per-horse identity guarantee that downstream `RaceTrack` → `race.completeRound(finishOrder)` depends on.

### Test count

164 tests (21 files), all green.

### Next action

Resume Phase 6 component scaffolding (parallel work in progress on `ProgramRoundCard.vue` / `ResultRoundCard.vue`). Smaller Phase 5 audit residuals (rng `lastRealTs` sentinel cleanup, narrowed catch in `useRestPolling`, log `useRaceApi` test-after deviation to Errors table) tracked for a later sweep.






## 2026-05-15 — Session N+1: Phase 6 audit fix — collapse ResultRoundCard row into RankingRow

### What landed

- `src/components/ResultRoundCard.vue` — each result row now delegates to `<RankingRow>` instead of inlining `position + ColorSwatch + name`. `ColorSwatch` import + `colorFor` helper + `__position`/`__name` element styles deleted from this component.
- `src/components/__tests__/ResultRoundCard.test.ts` — edge test rewritten: asserts `findAllComponents(RankingRow)` has `LANE_COUNT` rows and every row receives the matching `{position, horse, laneIndex}` props. Verified red by running before the refactor (`expected [] to have a length of 10`). After the refactor, 170/170 green; vue-tsc clean.

### Why

`RankingRow` and `ResultRoundCard`'s inlined row were duplicate definitions of "one ranked finisher row" — same trio (position + LANE_COLORS swatch + name). Phase 7's `ResultsPanel` only consumes `ResultRoundCard`, leaving `RankingRow` orphaned. Collapsing the inline row into the component makes `RankingRow` the single source of truth for that shape (open/closed: a future variant — bold winner, time delta — changes one file), eliminates the duplicate CSS, and keeps every Phase-6 component with a real consumer before Phase 7 wiring lands on top.

### Test count

170 tests (23 files), all green.

### Next action

Begin Phase 7 — start with `App.vue` + `useRestPolling()` mount-once wiring per `ARCHITECTURE.md` §11 step 3.
