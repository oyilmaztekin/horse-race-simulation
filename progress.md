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
| `errors.ts`           | `InvalidTransitionError`, `ApiError` | ⏳ Phase 2 cont. | — |

### Doc amendments along the way
- `BUSINESS_LOGIC.md` decision #18 rewritten: horse names live in
  `prisma/horseNames.json` (data fixture, not a TS module).
- `ARCHITECTURE.md` §2/§8/decision #24 follow suit.
- `CLAUDE.md` §1 gains two sub-rules: algorithm-internal magic literals must
  be named consts; backend-owned persisted data never in any TS module.
- `CLAUDE.md` §2 caps comments at 1–3 lines, no multi-paragraph docstrings.
- `CLAUDE.md` §3 adds the three-flavor coverage floor (happy + edge + sad).

### Test count
- 42 tests across 6 files, all green. Typecheck clean.
- `simulation.ts` feature-complete for the inner-loop math (A1–A5).
- `conditionMutation.ts` added: end-of-round fatigue/recovery + clamp.
- `wait.ts` added: Promise wrapper over `setTimeout`, fake-timer-driven.
  `errors.ts` is the last Phase 2 module before Phase 3 (Hono server).

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
