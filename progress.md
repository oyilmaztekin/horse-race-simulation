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
| `simulation.ts`       | step / closed-form speed / clamp | ⏳ next | — |
| `conditionMutation.ts`| fatigue + recovery per round | ⏳ Phase 2 cont. | — |
| `wait.ts`             | inter-round delay | ⏳ Phase 2 cont. | — |
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
- 21 tests across 3 files, all green. Typecheck clean.
