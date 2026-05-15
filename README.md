# Horse Racing Simulation

This README is written for reviewers. The goal isn't to advertise what the app does — that's `BUSINESS_LOGIC.md`. The goal is to show **how the design was reasoned about**: which constraints were chosen, what was deliberately left out, and where the seams are.

If you have 15 minutes, read this file, then skim `BUSINESS_LOGIC.md` §5 (decision log) and `ARCHITECTURE.md` §12 (decision log). Those three documents are the source of truth — the code follows them, never the other way around.

## Run it

```bash
npm install
npm run db:migrate     # creates dev.db, applies schema, auto-seeds 20 horses (seed = 0xDECAF)
npm run dev            # Vite :5173 + Hono :3001
npm test               # vitest, 248 unit/component tests (~7s)
npx playwright install # one-time chromium fetch
npm run test:e2e       # playwright happy path (~3.3 min wall clock — real timers)
```

`db:migrate` is required before `dev` — the API reads from `dev.db`, and migration auto-invokes `db:seed` (`prisma.seed` in `package.json`). The seed is idempotent (`deleteMany` → `createMany` under a fixed RNG seed), so re-running resets the roster to a known state.

## Decision log — three choices that show the thinking

### 1. Server-authoritative roster, condition, and rest

**Problem.** Where does horse condition live? If the client owns it, the simulation is trivially testable but the system has no integrity — a refresh, a second tab, or a debugger console wipes state. If the server owns it, every behavior needs an API and the client becomes a renderer.

**Options.** (a) Client-owned with localStorage; (b) hybrid — server seeds, client mutates; (c) server-owned end-to-end.

**Chosen.** (c). The server owns the roster, applies fatigue/recovery at round boundaries, and computes rest deadlines as wall-clock timestamps (`restingUntil`). The client renders.

**Why.** The assessment is small but the *shape* matters: an asymmetric truth boundary is the most common source of bugs in interactive apps, and pretending it doesn't exist for an MVP teaches the wrong instincts. The cost paid is two stores instead of one (`horses` = cached snapshot, `race` = orchestrator) and a deliberate convention that client variables for server-derived countdowns are named for what they *display* (`secondsUntilEligible`), never for what they appear to own (`countdown`, `timer`). See `ARCHITECTURE.md` §4.

### 2. Pure domain layer with injected RNG and clock

**Problem.** The race must be **deterministic for tests** (same seed → identical finish order) and **non-deterministic for users** (every Generate click feels fresh). Most simulators tangle these by reaching for `Math.random()` and `performance.now()` inline.

**Options.** (a) Mock `Math.random` per test; (b) global seedable singleton; (c) injection seam — every domain function takes `rng` and (where relevant) `dt` as arguments.

**Chosen.** (c). `src/domain/` has zero imports from Vue, Pinia, fetch, or the DOM. `createRng(seed)` returns a mulberry32 PRNG; the server reseeds per "Generate Program" click and threads the RNG through `generateRoster`, `generateProgram`, and `simulation.step`. The `useRaceSimulation` composable runs a fixed-tick accumulator (`SIM_TICK_MS ≈ 16.67`) decoupled from `requestAnimationFrame`, so simulation cadence is independent of display refresh rate.

**Why.** Determinism becomes a property of the *type signature*, not of test setup. The trade-off is verbosity at every call site — but that verbosity is the documentation. See `BUSINESS_LOGIC.md` decision #16 (fixed cadence) and #25 (per-meeting reseed), `ARCHITECTURE.md` §9.

### 3. Domain literals live in code; backend-owned data does not

**Problem.** Where do "horse names" go? They're data, but they're also a fixed editorial list of 20 strings. A naive answer is `const HORSE_NAMES = [...]` in `domain/`.

**Options.** (a) Hardcoded array in `domain/`; (b) JSON next to the seed script, loaded once at seed time; (c) admin UI / CMS.

**Chosen.** (b). `prisma/horseNames.json` is read by the seed script and written to SQLite. After seeding, the DB is the source of truth. The pure domain function `generateRoster(rng, lookupName)` takes the name-lookup as a **DI argument** — the function itself stays content-free and stubbable. The frontend bundle never carries truth-state it doesn't need.

**Why.** Editorial changes (rename, retheme, localise) become JSON edits + a reseed, not a code change. Tests pass a fake `lookupName` and never need to know the real list. Three different concerns — *what's content*, *what's structure*, *what's a pure transform* — get three different homes. See `BUSINESS_LOGIC.md` decision #18, `ARCHITECTURE.md` decision #24.

## Constraint-based design — what was deliberately left out

The MVP scope is enforced by **explicit non-goals**. Each one removes a category of state complexity that wouldn't survive an honest cost/benefit pass:

- **No pause / resume / restart mid-race.** Pause turns a state machine of 4 phases into one with a cross-cutting `paused` flag on every transition, plus a "what does fatigue mean for a paused round" question that has no good answer. Cut.
- **No mid-race regeneration.** "Regenerate" while RACING means defining whether in-flight conditions roll back, which means versioning condition history. Cut.
- **No DNF / scratch / injury.** Adds an N+1th outcome per horse per round and bleeds into eligibility math. Cut.
- **No per-horse identity colors.** Colors are per-lane (`LANE_COLORS[laneIndex]`), not per-horse — the same horse in lane 3 of round 1 and lane 7 of round 4 is a different color. This is counterintuitive at first glance, which is exactly why it's documented: it keeps the eye on *the race*, not on tracking individuals across rounds.

Each of these is one line in `BUSINESS_LOGIC.md` §6. Adding any of them is a doc change first, then a code change — never the reverse.

## Layering

Three rings, each with one responsibility:

```
domain/        pure functions, no Vue, no Pinia, no fetch, no DOM
  ↑ called by
stores/        Pinia: horses (server snapshot), race (orchestrator + state machine)
  ↑ read by
components/    presentational (props in, emits out) + container (wires stores)
```

Concrete rules that fall out:
- A component never reaches more than one dot into a store (Law of Demeter).
- A domain function never imports a store; a store never imports a component.
- The `useRaceSimulation` composable is the *only* place that owns the rAF loop. Positions live there, not in a store (`ARCHITECTURE.md` decision #17) — 60 writes/second through Pinia would drown DevTools and serve nothing.
- Magic numbers don't exist. Every domain constant (`HORSE_COUNT`, `ROUND_DISTANCES`, `FATIGUE_PER_RACE`, etc.) is a named export in `domain/constants.ts`; tests import the same constants production code does. `CLAUDE.md` §1 lists the full required set.
- CSS classes follow **BEM** (`block__element--modifier`): `race-lane`, `race-lane__label`, `race-lane--current`. Selectors stay flat, intent is in the name, and styling order mirrors the component hierarchy.

The point isn't that SOLID is followed — it's that you can guess where a new behavior goes from the layer rules alone.

## Testing philosophy

Test counts are vanity; **coverage shape** is the discipline. Every behavior under test gets *at least* three cases:

1. **Happy path** — the canonical input.
2. **Edge case** — boundary input where naive implementations break (empty roster, condition at clamp, last round).
3. **Negative case** — either an error path, or a test that an "obvious wrong implementation" would still fail. For pure functions, this is the test that catches `return 0.5` or `return []` — "different inputs produce different outputs" rather than "this specific input produces this specific output."

This is the floor, not a target. The reason is that happy-only suites give false confidence — they prove the function isn't broken *for the case the author already considered*. The negative case is the one that proves you reasoned about it.

Per-layer:
- `domain/` — exhaustive unit tests with deterministic seeds. Every named constant has at least one test that would fail if the value drifted.
- `stores/` — test wiring, not math (math is already tested in `domain/`).
- `composables/useRaceSimulation` — fake timers that also fake `requestAnimationFrame` (`ARCHITECTURE.md` §15.5). Real rAF leaking into a unit test is a guaranteed flake.
- `components/` — `@vue/test-utils` smoke tests only; the happy path belongs to Playwright.
- Playwright — one happy path per top-level action (Generate → Start → results), no more.

## End-to-end testing

Playwright asserts what only a real browser can: state machine reaches `FINISHED`, server-authoritative conditions reach the DOM, button-enablement matrix holds. One happy path, real timers (~3 min wall clock). Everything cheaper is covered upstream.

## CI

`.github/workflows/ci.yml` runs on every PR and push to `master`: `npm ci` → `prisma generate` → `npm run lint` → `npm run typecheck` → `npm test`. ~3 minutes wall clock on `ubuntu-latest`. Playwright is intentionally not in CI — it needs the dev server + a seeded DB and adds ~3 minutes for one test that local development already exercises constantly. Deployment is out of scope; the assessment is judged on the source tree, not a live URL.

## Graphify — using the knowledge graph as a meta-tool

The repo ships with a [graphify](https://github.com/safishamsi/graphify) knowledge graph under `graphify-out/`. It indexes the docs (`BUSINESS_LOGIC.md`, `ARCHITECTURE.md`, `CLAUDE.md`, plan files) and the code together — 39 nodes, 37 edges, 11 communities.

The reason it's worth looking at isn't novelty — it's that the graph **predicts where coupling lives** before you read any code:

- **`The Roster` is the central bridge** (betweenness centrality 0.214). It connects *Architecture & Stores*, *Project Guidance*, and *Race Simulation*. That's not an accident — the roster is the single piece of data the server owns, the simulation consumes, the eligibility rules filter, and the UI displays. If you wanted to refactor one thing without reading the whole codebase, this is the node you'd start from.
- **Core Game Flow** is a 5-node hyperedge — `INITIAL → READY → RACING → FINISHED` plus condition mutation, program schedule, and the simulation model all participate. The graph makes the implicit coupling between "state machine" and "condition mutation" *explicit*: rest deadlines tick during RACING, fatigue applies at the RACING → READY edge, recovery applies to rested horses at the same edge. A reviewer who reads only `ARCHITECTURE.md` §5 misses the link to §3.7; the graph forces both into one view.
- **Determinism is a 4-node hyperedge.** Per-meeting reseed (decision #25) → `useRaceSimulation` → fixed cadence (decision #16) → simulation model. The graph surfaces that determinism is a *system property*, not a single function — change any one node and the property breaks.

Useful one-liners:

```bash
open graphify-out/graph.html                                # interactive view
graphify query "Race Simulation"                            # nodes around a concept
graphify path "The Roster" "useRaceSimulation Composable"   # shortest path
graphify explain "Business Logic & Domain Decisions"        # node + neighborhood
```

Per `CLAUDE.md`, exploration in this repo is graphify-first, grep-last — relationships beat string matches by ~70x in token cost, and "where is X used" returns *meaning*, not just file paths.

## What I'd do differently

- **Two stores is the right call for this MVP, but the `race` store's discriminated-union state machine has grown enough that a tiny state-charts library (xstate) would be cheaper than the hand-rolled `assertRacing` / `mutateRacing` guards in `ARCHITECTURE.md` §16.10.** Worth it the next time a new phase appears.
- **The `useRaceSimulation` fake-timer pattern (§15.5) is correct but painful** — every test needs `vi.useFakeTimers({ toFake: [..., 'requestAnimationFrame', 'cancelAnimationFrame'] })`. A custom matcher (`expectSimulationToFinish`) would absorb that.
- **The graphify output is regenerated manually.** A pre-commit hook that fails when docs change but the graph hasn't would close the loop.

## Files worth opening in order

1. `BUSINESS_LOGIC.md` — domain rules + decision log. The *what* and *why*.
2. `ARCHITECTURE.md` — layers, store shapes, state machine, testing strategy. The *how*.
3. `CLAUDE.md` — engineering guardrails (no hardcoded definitions, TDD cycle, three-flavor coverage). The *discipline*.
4. `src/domain/` — pure functions; read `constants.ts` first.
5. `src/stores/race.ts` — the orchestrator and the state machine.
6. `src/composables/useRaceSimulation.ts` — the only place rAF lives.
