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

