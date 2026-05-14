# Graph Report - .  (2026-05-14)

## Corpus Check
- Corpus is ~23,572 words - fits in a single context window. You may not need a graph.

## Summary
- 39 nodes · 37 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 62% EXTRACTED · 38% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.89)
- Token cost: 52,070 input · 52,071 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Architecture & Stores|Architecture & Stores]]
- [[_COMMUNITY_Domain Functions|Domain Functions]]
- [[_COMMUNITY_Project Guidance|Project Guidance]]
- [[_COMMUNITY_Race Simulation|Race Simulation]]
- [[_COMMUNITY_UI Design|UI Design]]
- [[_COMMUNITY_Progress Tracking|Progress Tracking]]

## God Nodes (most connected - your core abstractions)
1. `Business Logic & Domain Decisions — Horse Racing` - 6 edges
2. `Architecture & Implementation Design — Horse Racing` - 6 edges
3. `CLAUDE.md - Project Engineering Discipline` - 5 edges
4. `The Roster - 20 Horses with Name, Number, and Condition` - 5 edges
5. `The Program - 6 Rounds, 10 Horses per Round, Weighted Random Selection` - 4 edges
6. `createRng()` - 3 edges
7. `Implementation Plan — Horse Racing MVP` - 3 edges
8. `Horses Store - Cached Server Snapshot with fetchAll and applyServerUpdate` - 3 edges
9. `useRaceSimulation Composable - rAF Loop with Fixed Tick Accumulator` - 3 edges
10. `horseName()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `Example UI Layout - Horse Racing Simulation` --references--> `Architecture & Implementation Design — Horse Racing`  [EXTRACTED]
  image.png → ARCHITECTURE.md
- `Component Inventory - 14 Components (7 Containers + 7 Presentationals)` --rationale_for--> `Example UI Layout - Horse Racing Simulation`  [INFERRED]
  ARCHITECTURE.md → image.png
- `Domain Types - Horse, Round, Program, Ranking, RoundResult, SimulationSnapshot` --rationale_for--> `The Roster - 20 Horses with Name, Number, and Condition`  [INFERRED]
  ARCHITECTURE.md → BUSINESS_LOGIC.md
- `Insider One - Software Developer Assessment Project` --conceptually_related_to--> `Business Logic & Domain Decisions — Horse Racing`  [EXTRACTED]
  expectation.md → BUSINESS_LOGIC.md
- `Findings — Horse Racing MVP` --references--> `Business Logic & Domain Decisions — Horse Racing`  [EXTRACTED]
  findings.md → BUSINESS_LOGIC.md

## Hyperedges (group relationships)
- **Core Game Flow - INITIAL → READY → RACING → FINISHED State Progression** — business_logic_state_machine, business_logic_program_schedule, business_logic_simulation_model, business_logic_condition_mutation, architecture_race_store [EXTRACTED 1.00]
- **Deterministic RNG System - Seed Propagation Through Simulation** — business_logic_decision_25, architecture_use_race_simulation, architecture_decision_16, business_logic_simulation_model [INFERRED 0.90]
- **Store and Component Layering - Clean Separation of Concerns** — architecture_horses_store, architecture_race_store, architecture_components_inventory, architecture_use_race_simulation [INFERRED 0.85]

## Communities (11 total, 2 thin omitted)

### Community 0 - "Architecture & Stores"
Cohesion: 0.22
Nodes (10): Domain Types - Horse, Round, Program, Ranking, RoundResult, SimulationSnapshot, Horses Store - Cached Server Snapshot with fetchAll and applyServerUpdate, Race Store - Orchestrator with Discriminated Union State Machine, Tech Stack - Vue 3, TypeScript, Pinia, Vite, Hono, Prisma, SQLite, Condition Mutation - Fatigue (−8) and Recovery (+3), Server-Authoritative, Decision #25 - Per-Meeting RNG with Fresh Seed per Generate Click, Eligibility Rules - Rest (1 round) and Cap (4 races/meeting), The Program - 6 Rounds, 10 Horses per Round, Weighted Random Selection (+2 more)

### Community 1 - "Domain Functions"
Cohesion: 0.22
Nodes (3): generateRoster(), horseName(), createRng()

### Community 2 - "Project Guidance"
Cohesion: 0.39
Nodes (8): Architecture & Implementation Design — Horse Racing, Business Logic & Domain Decisions — Horse Racing, No Hardcoded Definitions - All Literals as Named Constants, CLAUDE.md - Project Engineering Discipline, TDD Discipline - Red / Green / Refactor with Three-Flavor Test Coverage, Insider One - Software Developer Assessment Project, Findings — Horse Racing MVP, Implementation Plan — Horse Racing MVP

### Community 3 - "Race Simulation"
Cohesion: 0.5
Nodes (4): Decision #16 - Fixed Simulation Cadence Decoupled from rAF via Accumulator, Decision #17 - Positions in useRaceSimulation Composable, Not Store, useRaceSimulation Composable - rAF Loop with Fixed Tick Accumulator, Race Simulation Model - Fixed Tick Cadence, Speed Formula, Jitter, Finish Detection

## Knowledge Gaps
- **10 isolated node(s):** `Insider One - Software Developer Assessment Project`, `Progress Log`, `Eligibility Rules - Rest (1 round) and Cap (4 races/meeting)`, `Decision #25 - Per-Meeting RNG with Fresh Seed per Generate Click`, `Domain Types - Horse, Round, Program, Ranking, RoundResult, SimulationSnapshot` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `The Roster - 20 Horses with Name, Number, and Condition` connect `Architecture & Stores` to `Project Guidance`, `Race Simulation`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Why does `Business Logic & Domain Decisions — Horse Racing` connect `Project Guidance` to `Architecture & Stores`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Why does `Architecture & Implementation Design — Horse Racing` connect `Project Guidance` to `Architecture & Stores`, `UI Design`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `The Roster - 20 Horses with Name, Number, and Condition` (e.g. with `The Program - 6 Rounds, 10 Horses per Round, Weighted Random Selection` and `Race Simulation Model - Fixed Tick Cadence, Speed Formula, Jitter, Finish Detection`) actually correct?**
  _`The Roster - 20 Horses with Name, Number, and Condition` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `The Program - 6 Rounds, 10 Horses per Round, Weighted Random Selection` (e.g. with `The Roster - 20 Horses with Name, Number, and Condition` and `Eligibility Rules - Rest (1 round) and Cap (4 races/meeting)`) actually correct?**
  _`The Program - 6 Rounds, 10 Horses per Round, Weighted Random Selection` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Insider One - Software Developer Assessment Project`, `Progress Log`, `Eligibility Rules - Rest (1 round) and Cap (4 races/meeting)` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._