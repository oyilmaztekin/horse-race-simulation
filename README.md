# Beygir Yarışı — Horse Racing Simulation

An interactive horse racing simulation built with Vue 3, TypeScript, Pinia, and Hono. This project demonstrates clean architecture, SOLID principles, TDD discipline, and deterministic simulation with seeded RNG.

## Quick Start

```bash
npm install
npm run db:migrate          # Create dev.db, apply migrations, seed 20 horses (auto-runs db:seed)
npm run dev                 # Start Vite (:5173) + Hono (:3001) together
npm test                    # Run Vitest (245 tests, ~7s)
npx playwright install      # One-time: fetch chromium for E2E
npm run test:e2e            # Run Playwright happy path (~3.3 min wall clock)
```

### Other useful scripts

```bash
npm run lint        # ESLint v9 flat config
npm run typecheck   # vue-tsc --noEmit
npm run build       # Production bundle
npm run db:seed     # Reset roster to the deterministic 0xDECAF seed
```

`npm run db:migrate` is required before `npm run dev` — the API queries `dev.db`, which doesn't exist until the migration runs. The migration step automatically invokes `npm run db:seed` (configured under `"prisma": { "seed": ... }` in `package.json`), so 20 deterministic horses are inserted in one shot.

To re-seed without re-migrating (e.g. to reset conditions to their initial seeded values mid-meeting), run `npm run db:seed` on its own. The seed is idempotent — it `deleteMany` before `createMany`, using `createRng(0xDECAF)` so the same 20 horses with the same starting conditions appear every time.

### Verify the domain layer end-to-end (optional)

A reusable diagnostic exercises the full Phase 2 stack against the seeded DB — generates a program, simulates all 6 rounds, and applies fatigue/recovery between rounds. Read-only against the DB.

```bash
npx tsx scripts/smoke-phase2.ts
```

Output is human-inspectable: program with conditions per lane, finish order per round, and condition deltas (R = raced, -8; . = rested, +3; clamped to `[1, 100]`).

## For Reviewers: Understanding the Codebase with Graphify

This repository includes a **knowledge graph** of the codebase generated with [graphify](https://github.com/safishamsi/graphify). This graph surfaces architecture, relationships, and cross-community connections that would be hard to find with grep alone.

### Open the Interactive Graph

```bash
# In your browser, open:
graphify-out/graph.html
```

The graph shows:
- **39 nodes** — code files, domain concepts, and architectural decisions
- **37 edges** — relationships (imports, calls, citations, rationale)
- **11 communities** — clusters like "Architecture & Stores", "Domain Functions", "Race Simulation"
- **God nodes** — central abstractions (Business Logic, Architecture, CLAUDE.md)
- **Surprising connections** — hidden bridges between components
- **Hyperedges** — group relationships (e.g., "Core Game Flow" state machine)

### Query the Graph from the Command Line

```bash
# Find all nodes related to a concept
graphify query "Race Simulation"

# Trace the shortest path between two concepts
graphify path "The Roster" "useRaceSimulation Composable"

# Explain a single node and everything it connects to
graphify explain "Business Logic & Domain Decisions"
```

### Key Architectural Insights from the Graph

1. **The Roster is the central bridge** (betweenness centrality 0.214)
   - Connects Architecture & Stores, Project Guidance, and Race Simulation communities
   - Understanding the roster structure unlocks the whole simulation

2. **Core Game Flow hyperedge** — 5 tightly coupled nodes
   - `INITIAL → READY → RACING → FINISHED` state machine
   - Condition mutation, program schedule, and simulation model all participate

3. **Deterministic RNG system** — 4-node hyperedge
   - Fresh seed per "Generate Program" click
   - Propagates through useRaceSimulation and simulation.step

4. **TDD discipline is embedded** — CLAUDE.md references 5 domain concepts
   - Clean Code, no magic numbers, three-flavor test coverage

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full repository layout, state machine design, component inventory, and testing strategy.

For domain rules (roster, program, eligibility, simulation physics, colors), see [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md).

Engineering discipline guardrails (no hardcoded definitions, SOLID, TDD workflow) are in [CLAUDE.md](CLAUDE.md).

## Key Concepts

- **MVP-scoped:** Pause, restart, mid-race regeneration, and per-horse colors are intentional non-goals.
- **Server-authoritative:** Roster generation, condition mutation, and seeding all live on the backend.
- **Deterministic:** Same seed + same `SIM_TICK_MS` → identical race every time (testable).
- **Pure domain layer:** `src/domain/` has zero dependencies on Vue, Pinia, fetch, or the DOM.
- **Three-layer state sync:** Horses store (cached server snapshot), Race store (orchestrator), and useRaceSimulation composable (animation loop).

## Testing

- **Unit tests** (Vitest): Domain functions (`horseFactory`, RNG), stores, composables
- **Component tests** (@vue/test-utils): Smoke tests; defer happy paths to E2E
- **E2E tests** (Playwright): Generate → Start → watch races complete
- **Three-flavor coverage floor:** Happy path, edge case, negative case per behavior

## License

Insider One case study project.
