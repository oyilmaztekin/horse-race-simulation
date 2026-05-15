# CLAUDE.md

Guidance for Claude Code working in this repository.


## Before Every Task

1. **Orient with graphify** (`graphify-out/GRAPH_REPORT.md`, then `graphify query` / `graphify path` / `graphify explain`).
2. **Read `ARCHITECTURE.md` and `BUSINESS_LOGIC.md`** — authoritative source for domain rules (BUSINESS_LOGIC §3), state stores (ARCHITECTURE §4), domain types (ARCHITECTURE §6), component inventory (ARCHITECTURE §14), and testing strategy (ARCHITECTURE §15).
3. **Build your progress plan** — list each behavior to implement as a separate step; each step maps to exactly one Red→Green→Commit cycle (see Mandatory Change Cycle below).

## Mandatory Change Cycle (MANDATORY)

Every behavior change — no matter how small — follows this exact sequence. No shortcuts, no batching steps, no skipping steps.

1. **graphify query** — identify which nodes and edges are affected; understand propagation before touching anything.
2. **🔴 Red** — write the failing test; confirm it fails for the right reason.
3. **Minimum code change** — smallest edit that makes the test pass. Stop there.
4. **🟢 Green** — run the full suite (`vitest run`); all tests pass.
5. **Docs update** — update `ARCHITECTURE.md` or `BUSINESS_LOGIC.md` (whichever governs the changed behavior) in the same working-tree state, before staging.
6. **task_plan.md checkboxes** — tick every completed item in `task_plan.md` and update the phase `Status:` line in the same working-tree state, before staging.
7. **progress.md log entry** — append a short note to `progress.md` describing the behavior added, the test file, and any decisions worth recalling. Same working-tree state, before staging.
8. **Commit** — code + docs + task_plan.md + progress.md go in the same commit. Nothing separate, nothing batched.

Violations:
- Code committed without a prior failing test → blocker.
- Docs updated in a separate follow-up commit → blocker.
- task_plan.md checkboxes updated in a separate follow-up commit → blocker.
- progress.md entry written in a separate follow-up commit → blocker.
- More than one behavior bundled into a single Red→Green cycle → blocker.

## Exploration: graphify-first, grep-last, find-last (MANDATORY)

For any "where is X / what uses Y / how does Z connect" question, **you must use graphify before any grep, find, ripgrep, or Glob/Grep tool call.** Graphify is ~71x cheaper in tokens and surfaces relationships (node → prompt → output model → state field) that grep cannot.

**Required workflow:**
1. Start at run `graphify query "<concept>"`.
2. Follow relations with `graphify path <a> <b>` and `graphify explain <node>`.
3. Think in **communities and relations**, not file paths.

**Grep/find is allowed only as a fallback for:**
- Exact literal hunts (error strings, magic constants, specific config keys).
- Files graphify hasn't indexed (state it explicitly when this happens).
- Verifying a specific line/symbol after graphify has pointed you to the file.

**Subagents must follow the same rule** — when delegating exploration (Explore, general-purpose, etc.), instruct them to use graphify first and treat grep as fallback. Do not let the default Explore agent reflexively grep this repo.

If graphify output looks stale, surface that to the user instead of silently switching to grep.

## 0. Source of truth

Domain rules and architecture decisions are split across two locked documents. Read both before writing any production code. If a rule or architectural decision needs to change, change the **document first** (with rationale in its decision log) — code follows the doc, never the reverse.

Source-of-truth chain (highest first):
1. **`BUSINESS_LOGIC.md`** — domain rules, application flow, decision log, non-goals (the *what*).
2. **`ARCHITECTURE.md`** — tech stack, repo layout, layering, store shapes, domain types, API contract, server architecture, component design, testing strategy, decision log (the *how*).
3. **`expectation.md`** — original assessment requirements (deviations called out in `BUSINESS_LOGIC.md` §2).

This codebase is **MVP-scoped**. Pause, restart, mid-race regeneration, DNF, and per-horse identity colors are **explicit non-goals** — do not add them without first updating `BUSINESS_LOGIC.md`. Implementation prerequisites (config files, tuning constants, code patterns) live in `ARCHITECTURE.md` §16; surface-level deferred work in §13. Design gaps were resolved in the 2026-05-13/14 brainstorming pass — see `BUSINESS_LOGIC.md` decisions #11–#25 and the `*(resolved)*` annotations in `ARCHITECTURE.md` §16.

## 1. No Hardcoded Definitions

**Rule:** if a literal — number, string, tuple, or shape — is used more than once, it does **not** live in code. Move it to an enum or constants file before the second use.

- Enums and shared constants live in `src/domain/constants.ts` (or a topic-specific file like `src/domain/distances.ts`).
- No magic numbers in components, stores, or tests. Tests import the same constants production code does — never re-type a literal in a `toBe(...)`.
- No parallel arrays describing the same thing in two places.
- A second occurrence of the same literal in a PR is a blocker.

**Rule (also — algorithm-internal magic literals):** even a *single-use* literal must be a named `const` if the reader can't tell what it means without decoding the math. This covers hex constants (`0x6d2b79f5`), bit-shift amounts (`>>> 15`), bit masks (`| 1`, `| 61`), prime-ish mixing constants, byte offsets, and mathematical constants like `2 ** 32`. Naming makes the algorithm self-documenting — the reader reads names, not bit patterns. Constants live at the top of the file (module scope or in the closure where they apply) with intention-revealing names like `MULBERRY32_INCREMENT`, `FIRST_XORSHIFT_BITS`, `UINT32_RANGE`. The same applies inside any test fixture that encodes algorithm-internal values.

**Rule (also — backend-owned data does NOT live in code).** Data that is persisted server-side and reaches the client via the API (horse names, conditions, anything stored in a row) **must not exist as a hardcoded list in any TS module** — neither in `domain/`, nor in frontend code, nor even in a server-side TS file. The editorial content lives as a **data artifact** next to persistence (`prisma/*.json` or a SQL fixture); the seed script reads it once and writes to the DB. After seeding, the DB is the source of truth. Pure domain functions that need the data take it as a **DI argument** (e.g., `generateRoster(rng, lookupName)`), so the function itself stays content-free and stubbable in tests. Three reasons: (1) the frontend bundle never carries truth-state it doesn't need; (2) editorial changes (rename, retheme, localise) are JSON edits + a reseed, not a code change; (3) the domain function stays a pure transform. Reference: `BUSINESS_LOGIC.md` decision #18, `ARCHITECTURE.md` decision #24.

**Required named constants** (derived from `BUSINESS_LOGIC.md` — each must exist as a named export, no inline literals):

- `HORSE_COUNT = 20` — roster size (§3.1)
- `LANE_COUNT = 10` — horses per round (§3.2)
- `ROUND_COUNT = 6` — rounds per meeting (§3.2)
- `ROUND_DISTANCES = [1200, 1400, 1600, 1800, 2000, 2200]` — meters, ordered (§3.2)
- `MIN_REST_ROUNDS = 1` — rest-rule constant (§3.3)
- `MAX_RACES_PER_HORSE = 4` — cap-rule constant (§3.3)
- `CONDITION_MIN = 1`, `CONDITION_MAX = 100` — condition score bounds (§3.1)
- `FATIGUE_PER_RACE ≈ 8` — condition lost from racing one round (§3.7)
- `RECOVERY_PER_REST ≈ 3` — condition regained from sitting out one round (§3.7)
- `INTER_ROUND_DELAY_MS ≈ 1500` — pause between rounds (§4.4)
- `SIM_TICK_MS ≈ 1000 / 60` — fixed simulation tick cadence (`BUSINESS_LOGIC.md` decision #16); used by the accumulator loop in `useRaceSimulation` and passed as `dt` to `simulation.step`.
- `LANE_COLORS` — array of exactly `LANE_COUNT` color tokens (§3.5)
- Phase names: `INITIAL`, `READY`, `RACING`, `FINISHED` (§4.2) — string-literal union, defined once
- Speed-formula tuning constants (m/s range, jitter magnitude, on-screen scale) — TBD during implementation, named on first definition

Cross-references like `LANE_COUNT === LANE_COLORS.length` must be enforced by type or runtime invariant — never by hoping the literals stay in sync.

## 2. Clean Code & SOLID

**Clean Code:**
- Functions ≤20 lines, one level of abstraction, do one thing, ≤2 args (else options object).
- Intention-revealing names. Types/classes are nouns; functions are verbs; booleans are predicates (`isRunning`, `hasFinished`).
- **Parameter names must be full words, never single-letter abbreviations.** `context` not `c`; `transaction` not `tx`; `horse` not `h`; `event` not `e`. Single-letter names are a blocker regardless of how conventional they are in a framework.
- **Every parameter must carry an explicit type annotation — including inline callback parameters.** `.reduce((sum: number, horse: Horse) => …)`, `.filter((horse: Horse) => …)`, `.map((horse: Horse, index: number) => …)`. Inferred-from-context types are still a blocker: the reader (and the diff) shouldn't have to chase a generic to know what `sum` or `horse` is. The only exception is a parameter whose type is *literally* `unknown` because no narrower type exists yet — and that requires a one-line justification.
- Banned suffixes: `Manager`, `Helper`, `Util`, `Data`, `Info` — they signal undefined responsibility.
- No hidden side effects. Pure functions in `domain/`; state writes only via store actions.
- No flag arguments. No `null` returned or passed — use `undefined` or a discriminated union.
- Comments explain *why*, never *what*. No commented-out code, no section banners, no dead code.
- Comments are **terse**: default is zero, max is **1–3 lines** when a comment is warranted (e.g. algorithm-internal magic literals per §1). No multi-paragraph docstrings, no `@param`/`@returns` JSDoc blocks — the type signature already conveys that. Link to a URL or doc section if more depth is genuinely needed. Reviewer time is the budget; assume they skip anything longer.
- Law of Demeter: components never traverse more than one dot into a store.

**SOLID (mapped to this codebase):**
- **S** — `horses` and `race` are separate stores; domain helpers each own one responsibility. Don't collapse them.
- **O** — Extend by adding a domain function or component, not by editing `simulation.step`.
- **L** — Swappable primitives (`rng`, clock) must honor the same contract: same shape, same purity.
- **I** — Narrow `*Input`/`*Output` types over fat schemas. Components depend only on the slice they render.
- **D** — Inject collaborators so tests pass fakes. Never import a concrete singleton inside a domain function.

A violation without a written justification is a bug.

## 3. TDD — Red / Green / Refactor

No production code without a failing test that requires it. Tools: **Vitest + `@vue/test-utils`**, **Playwright** for E2E.

- **🔴 Red** — write the failing test first; confirm it fails for the *right reason* (not a typo or missing import). One behavior per test, named in business terms.
- **🟢 Green** — minimum code to pass. Hardcoding is fine here. Run the full suite (`vitest run`) before declaring green.
- **🛠️ Refactor** — only with a green bar. Apply §1 and §2. No new behavior — if a case is missing, go back to Red.

**Three-flavor coverage floor.** Every behavior under test gets **at least** three cases — happy-only suites give false confidence. The three flavors:

1. **Happy path** — canonical correct usage. What the function is *for*.
2. **Edge case** — boundary input: empty / zero / max / duplicate / off-by-one zones where naive impls break.
3. **Negative (sad) path** — either an error case (if the function can throw) OR a test that an "obvious wrong implementation" would still fail. For pure functions with no error path, this is the test that catches a stub like `return 0.5` / `return []`: e.g., "different inputs produce different outputs", "result depends on every argument", "two calls don't return identical values".

Three is the **floor**, not a fixed count — add more when a behavior genuinely has more zones. Don't pad with redundant cases either.

**Per layer:**
- `domain/` — exhaustive unit tests with deterministic seeds.
- `stores/` — test wiring, not math.
- `components/` — `@vue/test-utils` smoke tests; defer happy paths to Playwright.
- `useRaceSimulation` — fake timers (`vi.useFakeTimers({ toFake: [..., 'requestAnimationFrame', 'cancelAnimationFrame'] })`); never let real rAF leak into unit tests.
- Playwright — one happy path per top-level action (Generate → Start → results).

Rejected: test-after, asserting on implementation details, skipping/disabling failing tests, refactoring on a red bar.

## 4. Pre-commit checklist

Every changed function answers **yes** to all:

- [ ] ≤20 lines, does one thing, ≤2 args?
- [ ] Names intention-revealing? No banned suffixes?
- [ ] No hidden side effects, no `null` in/out, no flag arguments?
- [ ] Zero comments that restate the code?
- [ ] Has a failing-test-first commit (§3)?
- [ ] No §1 duplication introduced?

A "no" is a blocker. Override requires a one-line justification in the PR.
