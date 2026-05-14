# Beygir Yarışı — Horse Racing Simulation

An interactive horse racing simulation built with Vue 3, TypeScript, Pinia, and Hono. This project demonstrates clean architecture, SOLID principles, TDD discipline, and deterministic simulation with seeded RNG.

## Quick Start

```bash
npm install
npm run dev        # Start Vite + Hono together
npm run test       # Run Vitest
npm run e2e        # Run Playwright
```

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
