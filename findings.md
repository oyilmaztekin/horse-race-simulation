# Findings — Horse Racing MVP

Research notes derived from reading `BUSINESS_LOGIC.md` and `ARCHITECTURE.md` (both locked, 2026-05-13/14). Treat as data — these are summaries, not authoritative. The docs are the source of truth.

## Locked rules (BUSINESS_LOGIC.md)

- 20-horse roster (A1), server-seeded once, then `condition` mutates across rounds.
- 6 rounds at fixed distances `[1200,1400,1600,1800,2000,2200]`.
- Each round: 10 horses, weighted-random-without-replacement by `condition`, **selection order = lane order** (decision #9, #11).
- Eligibility: rest ≥ 1 round (didn't race in N−1) AND cap < 4 races/meeting. Intra-meeting scope (decision #17).
- Sim: fixed `SIM_TICK_MS` (~60Hz) via accumulator (decision #16). Speed = additive linear interp of condition + per-(horse,tick) jitter in lane order 1→10 (decision #13). Sub-tick interpolation at finish line (decision #14). Tie-break: lower lane wins (decision #15).
- Conditions: `±FATIGUE_PER_RACE/RECOVERY_PER_REST` clamped [1..100], server-authoritative via `POST /api/rounds/complete { raced }` → returns full roster.
- Phases: INITIAL / READY / RACING / FINISHED. Two-button control surface. No pause / restart / DNF.
- Mid-meeting API failure → end meeting in place → INITIAL + banner (decision #23).
- Per-meeting seed: `generateProgram(seed?)`, default `Date.now()`, carried on RaceState (decision #25).

## Locked architecture (ARCHITECTURE.md)

- **Two stores**: `horses` (cached server snapshot) + `race` (orchestrator with discriminated-union state). Positions live in `useRaceSimulation` composable, not in a store (decision #17).
- **Layering**: `domain/` is pure TS (no Vue/Pinia/fetch/DOM). Shared by client + server. Components never import `domain/` directly (LoD).
- **Server**: Hono + Prisma + SQLite. 2 endpoints. `applyRoundEffects` lives once in `domain/conditionMutation.ts`, called by server only.
- **Components**: 14 files, 7 containers + 7 presentationals. Presentationals receive resolved `Horse` objects, never IDs (decision #20). No emits on presentationals.
- **`RaceTrack`** mounts only during RACING, **re-keys on `currentRoundIndex`** — fresh `useRaceSimulation` per round, no manual reset (decision #22).
- **State machine**: discriminated union + `InvalidTransitionError` thrown loudly (decision #10).

## Critical gotchas

- `vi.useFakeTimers()` default `toFake` list **excludes rAF** — `useRaceSimulation` will hang in tests. Must configure setup file with `toFake: [..., 'requestAnimationFrame', 'cancelAnimationFrame']` (§16.7).
- TS narrowing **lost across `await`** in `completeRound`. Use `assertRacing` / `mutateRacing` helpers (§16.10).
- `watch(done, fn, { once: true })` in `RaceTrack` — must fire **once** per round (§16.11). Vue 3.4+ supports `once` option.
- `Horse.number` IS the primary key — no surrogate `id` (decision #6). `HorseId = number` type alias.
- `programGenerator` reads `horses.horses`; pre-flight guard required (§16.9) — `canGenerate` must check `length === HORSE_COUNT`.
- Server `tsconfig.json` must include `../src/domain/**/*`; use relative imports (§16.6 option a) since `tsx watch` doesn't honor Vite aliases.
- No `Math.random()` anywhere in `domain/` or `server/` — review rejects.

## Constants checklist (CLAUDE.md §1)

Every literal in the list MUST be a named export in `src/domain/constants.ts`. No inline literals in production code or tests. Tests import the same constants as production.

Required: `HORSE_COUNT`, `LANE_COUNT`, `ROUND_COUNT`, `ROUND_DISTANCES`, `MIN_REST_ROUNDS`, `MAX_RACES_PER_HORSE`, `CONDITION_MIN`, `CONDITION_MAX`, `FATIGUE_PER_RACE`, `RECOVERY_PER_REST`, `INTER_ROUND_DELAY_MS`, `SIM_TICK_MS`, `LANE_COLORS`, phase names, speed-formula tuning constants.

## Test ordering (ARCHITECTURE.md §15.4)

Inside-out: domain → server → stores → composables → presentationals → containers → E2E. Each layer green before the next starts.

## Deferred (not blocking start)

- Concrete speed-formula numbers (`BASE_SPEED_MPS_*`, `JITTER_MPS`) — pick believable values in Phase 1.
- `LANE_COLORS` hex values — Wong/Okabe-Ito 8-class + 2 extras.
- Lane visual styling, track layout, finish-line graphic — Phase 8.
- Curated horse-name list — Phase 2.
- Error banner concrete copy/styling — Phase 7.
