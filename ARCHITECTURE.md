# Architecture & Implementation Design — Horse Racing

**Date:** 2026-05-13
**Author:** Özer Yılmaztekin
**Reference mockup:** `image.png` — UI layout reference shipped with the assessment.
**Status:** Approved. This document locks the **architecture, state design, server contract, code organization, component-level design, and testing strategy** that delivers the rules in `BUSINESS_LOGIC.md`. See §13 for surface-level deferred work and §16 for open implementation decisions surfaced in the 2026-05-13 gap audit.

**Relationship to other documents:**
- `BUSINESS_LOGIC.md` — *what* the application does (rules, flow, decisions about behavior).
- `ARCHITECTURE.md` (this doc) — *how* the application is structured (layers, stores, types, server contract, components, testing). §16 holds implementation prerequisites that surface during TDD.
- `CLAUDE.md` — engineering-discipline guardrails (no magic numbers, SOLID, TDD).

---

## 1. Tech stack

| Concern | Choice |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Language | TypeScript |
| State management | Pinia (setup-style stores) |
| Build tool | Vite |
| Backend framework | Hono (Node.js) |
| ORM | Prisma |
| Database | SQLite (one file: `prisma/dev.db`) |
| Styling | Tailwind v3 (`@apply` inside scoped CSS) + CSS variables in `tokens.css`; BEM class names preserved on every element |
| Unit testing | Vitest + `@vue/test-utils` |
| E2E testing | Playwright |
| Lint / format | ESLint (`@typescript-eslint`, `eslint-plugin-vue`), Prettier, `vue-tsc` |
| Dev orchestration | `concurrently` — single `npm run dev` runs Vite + Hono together |

---

## 2. Repository layout

```
horse-race/
├── BUSINESS_LOGIC.md             # rules contract (§1 in source-of-truth chain)
├── ARCHITECTURE.md               # this doc (§2)
├── CLAUDE.md                     # engineering discipline (§3)
├── expectation.md                # original assessment requirements
├── package.json
├── vite.config.ts                # proxies /api/* to Hono dev port
├── tsconfig.json
│
├── src/                          # frontend (Vue + Vite)
│   ├── main.ts                   # createApp + createPinia + mount
│   ├── App.vue                   # root layout
│   ├── components/               # 14 files — see §14 for full inventory
│   │
│   ├── composables/
│   │   ├── useRaceSimulation.ts  # per-round rAF loop + positions + finish detection
│   │   ├── useRaceApi.ts         # thin fetch wrapper
│   │   └── useRestPolling.ts     # 1s GET /api/horses poll while RESTING (BUSINESS_LOGIC.md §3.8 / §4.7)
│   │
│   ├── stores/
│   │   ├── horses.ts             # cached server snapshot
│   │   └── race.ts               # orchestrator + state machine
│   │
│   ├── domain/                   # PURE TS — no Vue, no Pinia, no DOM, no fetch
│   │   ├── constants.ts          # HORSE_COUNT, ROUND_DISTANCES, …
│   │   ├── types.ts              # Horse, Round, Ranking, …
│   │   ├── errors.ts             # InvalidTransitionError, ApiError
│   │   ├── rng.ts                # createRng (mulberry32)
│   │   ├── horseFactory.ts       # generateRoster (used by SERVER seed)
│   │   ├── programGenerator.ts   # generateProgram (used by CLIENT)
│   │   ├── simulation.ts         # step(snapshot, dtMs, conditionLookup, rng)
│   │   ├── conditionMutation.ts  # applyRoundEffects + applyRestEffects + isFit (used by SERVER and client)
│   │   └── wait.ts               # wait(ms): Promise<void>
│   │
│   ├── styles/
│   │   ├── tokens.css            # CSS variables (colors, spacing, radii)
│   │   ├── reset.css
│   │   └── main.css
│   └── assets/
│
├── server/                       # backend (Hono + Prisma)
│   ├── index.ts                  # Hono app entry; runs on its own port
│   ├── db.ts                     # Prisma client singleton
│   ├── routes/
│   │   ├── horses.ts             # GET /api/horses
│   │   └── rounds.ts             # POST /api/rounds/complete
│   └── tsconfig.json             # extends root; allows importing from src/domain/
│
├── prisma/
│   ├── schema.prisma             # Horse model
│   ├── horseNames.json           # server-side editorial seed data (NOT code; no TS module encodes names)
│   ├── seed.ts                   # imports horseFactory, reads horseNames.json → seeds DB
│   └── dev.db                    # SQLite file (gitignored)
│
└── tests/
    ├── unit/                     # Vitest — domain, stores, composables, components
    └── e2e/                      # Playwright — happy paths
```

**Layering invariants (enforced by review; consider eslint-plugin-boundaries later):**
- `src/domain/` imports **nothing from Vue, Pinia, fetch, or the DOM.** Pure TypeScript only.
- `src/stores/` and `src/composables/` may import from `src/domain/`. The reverse is forbidden.
- `src/components/` may import from `src/stores/` and `src/composables/`, never from `src/domain/` (Law of Demeter per CLAUDE.md §2).
- `server/` imports from `src/domain/` for types and pure functions. It must NOT import from `src/stores/`, `src/composables/`, or `src/components/`.
- The condition-mutation formula lives in **one** file (`src/domain/conditionMutation.ts`) and is called by the server. The client never calls it directly — the server is authoritative.

---

## 3. Architecture layers

```
┌─────────────────────────────────────────────────────────────┐
│  Components (.vue) — to be designed                         │
│  - render UI from store slices                              │
│  - call store actions / emit events                         │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│ Pinia stores         │    │ Composables                      │
│ - horses             │    │ - useRaceSimulation              │
│ - race (orchestrator)│    │     (positions + rAF, per-round) │
└──────────┬───────────┘    │ - useRaceApi (fetch)             │
           │                └──────────┬───────────────────────┘
           ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│  src/domain/  (pure TypeScript — no framework, no I/O)      │
│  types, constants, errors, rng,                             │
│  programGenerator, simulation, conditionMutation, wait      │
└─────────────────────────────────────────────────────────────┘

           ─── network seam (HTTP) ───

┌─────────────────────────────────────────────────────────────┐
│  server/  (Hono routes)                                     │
│  - GET /api/horses                                          │
│  - POST /api/rounds/complete                                │
│      → imports src/domain/conditionMutation                 │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│  Prisma + SQLite                                            │
└─────────────────────────────────────────────────────────────┘
```

**Layering rule:** higher layers depend on lower; lower layers know nothing about higher. Domain is the bottom and is shared by client + server. This is the *only* shared code; everything else is layer-local.

---

## 4. State management — two Pinia stores

The store layer holds *durable* state: facts that survive across rounds (roster, conditions, program, results, phase). The *transient* state of a single in-flight round — per-frame positions and finishes-as-they-happen — lives in a component-scoped composable (`useRaceSimulation`, see §10). The composable hands the final `Ranking[]` to the race store at the moment the round ends; the store owns everything else.

### 4.1 `horses` store — cached server snapshot

```ts
// src/stores/horses.ts
export const useHorsesStore = defineStore('horses', () => {
  const horses    = ref<Horse[]>([])
  const isLoading = ref(false)
  const error     = ref<Error | null>(null)

  const api = useRaceApi()

  async function fetchAll() {
    isLoading.value = true
    error.value = null
    try {
      const env = await api.getHorses()                    // envelope per §7
      horses.value = env.horses
      // If restingUntil is non-null here, App.vue's onMounted handler reads it from the race store
      // and transitions to RESTING — see §11 boot sequence step 3.
      if (env.restingUntil !== null) {
        useRaceStore().resumeRestFromBoot(env.restingUntil)   // see §4.2 store action
      }
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  function applyServerUpdate(updated: Horse[]) {
    horses.value = updated
  }

  function byId(id: HorseId): Horse | undefined {
    return horses.value.find((h) => h.number === id)
  }

  function conditionLookup(id: HorseId): number {
    return byId(id)?.condition ?? CONDITION_MIN
  }

  return { horses, isLoading, error, fetchAll, applyServerUpdate, byId, conditionLookup }
})
```

- **Owns:** the roster cached from `GET /api/horses`.
- **Writes only via:** `fetchAll()` (initial), `applyServerUpdate(...)` (after each round).
- **Does NOT:** generate horses, compute conditions, decide who races.
- **`conditionLookup`** is the curried helper the simulation tick uses; isolated so the simulation store never has to traverse two dots into `horses`.

### 4.2 `race` store — orchestrator + state machine

```ts
// src/stores/race.ts
type RaceState =
  | { kind: 'INITIAL' }
  | { kind: 'RESTING';  restingUntil: number }                                                         // BUSINESS_LOGIC.md §3.8 / §4.7
  | { kind: 'READY';    program: Program; rng: Rng; seed: number }
  | { kind: 'RACING';   program: Program; rng: Rng; seed: number; currentRoundIndex: number; results: RoundResult[] }
  | { kind: 'FINISHED'; program: Program; seed: number; results: RoundResult[] }

export const useRaceStore = defineStore('race', () => {
  const state = ref<RaceState>({ kind: 'INITIAL' })

  const horses = useHorsesStore()
  const api    = useRaceApi()

  function generateProgram(seed: number = Date.now()) {           // BUSINESS_LOGIC.md decision #25
    if (state.value.kind === 'RACING' || state.value.kind === 'RESTING') {
      throw new InvalidTransitionError(state.value.kind, 'generateProgram')
    }
    const fitCount = horses.horses.filter(isFit).length           // BUSINESS_LOGIC.md §3.8 fit-gate
    if (fitCount < MIN_FIT_HORSES_FOR_PROGRAM) {
      throw new NotEnoughFitHorsesError(fitCount, MIN_FIT_HORSES_FOR_PROGRAM)
    }
    const meetingRng = createRng(seed)                            // fresh RNG per meeting
    const program    = generateProgramFn(horses.horses, meetingRng)
    state.value = { kind: 'READY', program, rng: meetingRng, seed }
  }

  async function rest() {                                          // BUSINESS_LOGIC.md §3.8 / §4.7
    if (state.value.kind !== 'INITIAL') {
      throw new InvalidTransitionError(state.value.kind, 'rest')
    }
    const envelope = await api.startRest()                         // POST /api/horses/rest — idempotent
    horses.applyServerUpdate(envelope.horses)
    if (envelope.restingUntil === null) {
      // server already cleared the rest (clock skew or very-late call); stay at INITIAL with fresh roster.
      return
    }
    state.value = { kind: 'RESTING', restingUntil: envelope.restingUntil }
    // useRestPolling (composable) watches state.kind === 'RESTING' and polls GET /api/horses every
    // REST_POLL_INTERVAL_MS. When the envelope returns restingUntil === null, it calls completeRest().
  }

  function completeRest(updated: Horse[]) {
    if (state.value.kind !== 'RESTING') {
      throw new InvalidTransitionError(state.value.kind, 'completeRest')
    }
    horses.applyServerUpdate(updated)
    state.value = { kind: 'INITIAL' }
  }

  // Called from the horses-store boot path if the initial envelope shows restingUntil != null
  // (i.e., a rest was in progress when the page was reloaded — refresh resilience per §4.7).
  function resumeRestFromBoot(restingUntil: number) {
    if (state.value.kind !== 'INITIAL') return                 // only resume into a clean INITIAL
    if (restingUntil <= Date.now()) return                     // already elapsed; next poll lazy-bumps
    state.value = { kind: 'RESTING', restingUntil }
  }

  function start() {
    if (state.value.kind !== 'READY') {
      throw new InvalidTransitionError(state.value.kind, 'start')
    }
    state.value = {
      kind: 'RACING',
      program:           state.value.program,
      rng:               state.value.rng,
      seed:              state.value.seed,
      currentRoundIndex: 0,
      results:           [],
    }
    // RaceTrack mounts (v-if), instantiates useRaceSimulation, runs round 0.
    // When that round ends, RaceTrack calls completeRound(rankings) below.
  }

  async function completeRound(rankings: Ranking[]) {
    const racing = assertRacing(state.value)
    const round  = racing.program[racing.currentRoundIndex]

    // 1) Push result immediately — UI sees the ranking before the network round-trip.
    mutateRacing((s) => { s.results.push({ roundNumber: round.number, rankings }) })

    // 2) Server applies fatigue + recovery, returns updated roster.
    const raced = round.horseIds
    try {
      const updated = await api.completeRound(raced)
      horses.applyServerUpdate(updated)
    } catch (e) {
      // Mid-meeting failure (BUSINESS_LOGIC.md decision #23):
      // End the meeting in place. horses.horses already reflects pre-round-N
      // server state — no divergence. Drop local meeting state; banner shows.
      horses.error = e as Error
      state.value = { kind: 'INITIAL' }
      return
    }

    // 3) Final round? Transition to FINISHED. (rng is no longer needed; drop it.)
    if (racing.currentRoundIndex === ROUND_COUNT - 1) {
      const final = assertRacing(state.value)
      state.value = {
        kind:    'FINISHED',
        program: final.program,
        seed:    final.seed,
        results: final.results,
      }
      return
    }

    // 4) Otherwise pause, then advance — RaceTrack re-keys and the next round begins.
    await wait(INTER_ROUND_DELAY_MS)
    mutateRacing((s) => { s.currentRoundIndex += 1 })
  }

  // narrow read-side derivations — components depend only on what they render
  const phase             = computed(() => state.value.kind)
  const program           = computed(() => 'program' in state.value ? state.value.program : null)
  const currentRound      = computed(() =>
    state.value.kind === 'RACING' ? state.value.program[state.value.currentRoundIndex] : null
  )
  const currentRoundIndex = computed(() => state.value.kind === 'RACING' ? state.value.currentRoundIndex : -1)
  const results           = computed(() => 'results' in state.value ? state.value.results : [])
  const canGenerate       = computed(() =>
    (state.value.kind === 'INITIAL' || state.value.kind === 'READY' || state.value.kind === 'FINISHED')
    && !horses.isLoading
    && horses.horses.length === HORSE_COUNT     // per BUSINESS_LOGIC.md decision #20
  )
  const canStart          = computed(() => state.value.kind === 'READY')
  // BUSINESS_LOGIC.md §3.8: Rest is available only at INITIAL (or FINISHED, after a meeting fatigued the roster).
  // It is "available" in the rule-sense — the *visibility* in the UI is gated by whether the warning is active
  // (see decision #30 below). Two separate concerns; the store owns the rule, the container owns the reveal.
  const canRest           = computed(() =>
    (state.value.kind === 'INITIAL' || state.value.kind === 'FINISHED')
    && !horses.isLoading
    && horses.horses.length === HORSE_COUNT
    && horses.horses.filter(isFit).length < MIN_FIT_HORSES_FOR_PROGRAM
  )
  const restingUntil      = computed<number | null>(() =>
    state.value.kind === 'RESTING' ? state.value.restingUntil : null
  )
  const fitCount          = computed(() => horses.horses.filter(isFit).length)
  const currentRng        = computed<Rng | null>(() =>
    state.value.kind === 'RACING' ? state.value.rng : null
  )
  const seed              = computed<number | null>(() =>
    'seed' in state.value ? state.value.seed : null
  )

  return {
    state, phase, program, currentRound, currentRoundIndex, results,
    canGenerate, canStart, canRest, restingUntil, fitCount,
    currentRng, seed,                      // RaceTrack reads currentRng; seed is for logging/debug
    generateProgram, start, completeRound, rest, completeRest, resumeRestFromBoot,
  }
})
```

- **Owns:** `phase`, `program`, `currentRoundIndex`, `results`, the meeting RNG seed.
- **Receives `Ranking[]` from `RaceTrack`** at the end of each round (via `completeRound`); never sees per-frame positions.
- **Orchestrates the 6-round loop** by advancing `currentRoundIndex` — which causes `RaceTrack` to re-key (see §14.5) — and pausing `INTER_ROUND_DELAY_MS` between rounds.
- **Discriminated union for `state`:** the *only* way to mutate phase. TypeScript catches invalid access (`program` not present in `INITIAL`).
- **Guards throw — never silently no-op.** `InvalidTransitionError` is loud; silent rejections hide bugs.
- **`mutateRacing` + `assertRacing`:** tiny helpers that re-narrow the union after an `await` (TS loses narrowing across awaits). Implemented alongside `RaceState`.

---

## 5. The state machine

```
    INITIAL ◄──────────┐               (page load — roster fetched into `horses`)
       │   ▲           │
       │   │ completeRest()  (poll observed restingUntil === null)
       │   │           │
       │   └─── RESTING                (rest() — only when count(fit) < MIN_FIT_HORSES_FOR_PROGRAM)
       │
       │ generateProgram()             (throws NotEnoughFitHorsesError if fit-gate fails)
       ▼
    READY ◄────────────┐
       │               │
       │ start()       │ generateProgram()       (re-roll; clears results in FINISHED→READY)
       ▼               │
    RACING             │
       │               │
       │ (round 6 done)│
       ▼               │
    FINISHED ──────────┘
```

| Phase | Allowed transitions | Trigger | Carries |
|---|---|---|---|
| `INITIAL` | → `READY` (fit-gate passes), → `RESTING` (fit-gate fails, user clicks Rest) | `generateProgram()`, `rest()` | — |
| `RESTING` | → `INITIAL` | `completeRest()` (driven by `useRestPolling` when envelope returns `restingUntil === null`) | `restingUntil` |
| `READY` | → `READY` (re-roll), → `RACING` | `generateProgram()`, `start()` | `program` |
| `RACING` | → `FINISHED` | last round completes inside `completeRound()` | `program`, `currentRoundIndex`, `results` |
| `FINISHED` | → `READY` (fit-gate passes), → `RESTING` (fit-gate fails after fatigued meeting) | `generateProgram()`, `rest()` | `program`, `results` |

**Compile-time invariants** (from the union shape):
- `currentRoundIndex` exists *only* in `RACING`.
- `program` is absent in `INITIAL`.
- `results` accessible only in `RACING` and `FINISHED`.
- Every consumer must guard `state.kind` before touching variant-specific fields; TypeScript narrows after the guard.

**Runtime invariants:**
- All phase-changing actions throw `InvalidTransitionError(currentKind, attemptedAction)` if called from the wrong phase.
- The button-enablement matrix in `BUSINESS_LOGIC.md` §4.3 mirrors these guards: `canStart`, `canGenerate` are computed from `state.kind`, so buttons disable in lock-step with the underlying state machine. No drift possible.

---

## 6. Domain types

```ts
// src/domain/types.ts

export type HorseId = number   // a horse's number, 1..HORSE_COUNT — the only identifier

export type Phase = 'INITIAL' | 'RESTING' | 'READY' | 'RACING' | 'FINISHED'

export interface Horse {
  number: HorseId         // 1..HORSE_COUNT, primary key
  name: string
  condition: number       // CONDITION_MIN..CONDITION_MAX
}

// BUSINESS_LOGIC.md §3.8 / decision #29 — GET /api/horses and POST /api/horses/rest both return this shape.
export interface HorsesEnvelope {
  horses: Horse[]
  restingUntil: number | null     // epoch millis; null when no rest is active
}

export interface Round {
  number: number          // 1..ROUND_COUNT
  distance: number        // one of ROUND_DISTANCES
  horseIds: HorseId[]     // length === LANE_COUNT; index = lane - 1
}

export type Program = Round[]   // length === ROUND_COUNT

export interface Ranking {
  rank: number            // 1..LANE_COUNT
  horseId: HorseId
  lane: number            // 1..LANE_COUNT
  finishTimeMs: number
}

export interface RoundResult {
  roundNumber: number
  rankings: Ranking[]     // length === LANE_COUNT, sorted by rank ascending
}

export interface LanePosition {
  horseId: HorseId
  lane: number            // 1..LANE_COUNT
  meters: number          // 0..round.distance
  finishedAtMs: number | null
}

export interface SimulationSnapshot {
  roundNumber: number
  distance: number
  elapsedMs: number
  lanes: LanePosition[]   // length === LANE_COUNT
}

// One row of the end-of-meeting score table (BUSINESS_LOGIC.md §3.10).
// Produced by `computeStandings(results, lookupHorse)` from `src/domain/standings.ts`.
export interface Standing {
  rank: number             // 1..N, dense, unique (tiebreaker by horseId asc guarantees this)
  horseId: HorseId
  number: number           // horse's number, mirrored for display + tiebreak
  name: string             // resolved at compute time via lookupHorse
  wins: number             // count of rounds finished 1st
  podiums: number          // count of rounds finished in top PODIUM_RANK_MAX (= 3)
  roundsRun: number
  totalFinishTimeMs: number
}

export type Rng = () => number   // returns a uniform value in [0, 1)
```

**Array-length invariants** (`horseIds.length === LANE_COUNT`, `rankings.length === LANE_COUNT`, `lanes.length === LANE_COUNT`) are not expressible in TypeScript cleanly. They are enforced by **factory functions** in `domain/` (e.g., `makeRound(...)`, `makeRoundResult(...)`) and verified exhaustively by unit tests.

---

## 7. API contract

Base URL: `/api`. Vite dev server proxies `/api/*` to the Hono port (e.g., `3001`).

| Method | Path | Body | Response | Purpose |
|---|---|---|---|---|
| `GET` | `/api/horses` | — | `HorsesEnvelope` | Read current roster + rest state. **Lazy-bumps** unfit horses if `restingUntil ≤ now` (see §8). |
| `POST` | `/api/rounds/complete` | `{ raced: HorseId[] }` | `Horse[]` (full updated roster) | Apply fatigue + recovery server-side per `BUSINESS_LOGIC.md` §3.7. |
| `POST` | `/api/horses/rest` | — | `HorsesEnvelope` | Start a rest session per `BUSINESS_LOGIC.md` §3.8. Idempotent: if already resting, returns the existing envelope unchanged (no double-rest, no timer reset). |

**Rationale notes:**
- `raced` is what the server actually needs (rested = `roster \ raced`). No `ranking` in the body — per `CLAUDE.md` §2 we don't ship for hypothetical-future requirements; add it back when an actual feature needs it.
- `GET /api/horses` returns an **envelope** (object) rather than a flat array, because both the roster snapshot AND the rest-in-progress flag must travel together on every poll (decision #29). The envelope shape is the canonical state — there is no separate `/api/rest-status` endpoint.
- `/api/rounds/complete` continues to return a flat `Horse[]` rather than the envelope: a round completion never happens while resting, so the rest flag is structurally irrelevant on that response.
- All bodies/responses are JSON. **No auth, no pagination, no API versioning** in MVP.
- **No reset endpoint over HTTP.** Reseeding the DB happens via the `prisma db seed` CLI; no privileged HTTP surface to protect.

---

## 8. Server architecture (`server/`)

```ts
// server/index.ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { horses } from './routes/horses'
import { rounds } from './routes/rounds'

const app = new Hono()
app.route('/api/horses', horses)
app.route('/api/rounds', rounds)

serve({ fetch: app.fetch, port: 3001 })
```

```ts
// server/routes/horses.ts
import { Hono } from 'hono'
import { db } from '../db'
import { applyRestEffects } from '../../src/domain/conditionMutation'
import { REST_DURATION_MS } from '../../src/domain/constants'

export const horses = new Hono()

// GET /api/horses — returns envelope; lazy-bumps unfit horses if restingUntil has elapsed (decision #29).
horses.get('/', async (c) => c.json(await readEnvelopeAndMaybeBump()))

// POST /api/horses/rest — idempotent. Starts a rest if none is active; otherwise returns the existing envelope.
horses.post('/rest', async (c) => c.json(await startRestIfIdle()))

async function readEnvelopeAndMaybeBump(): Promise<HorsesEnvelope> {
  return db.$transaction(async (tx) => {
    const meta = await tx.appState.findUnique({ where: { id: 1 } })
    const now = Date.now()
    if (meta?.restingUntil && meta.restingUntil.getTime() <= now) {
      const current = await tx.horse.findMany({ orderBy: { number: 'asc' } })
      const bumped  = applyRestEffects(current)              // pure domain fn — bumps unfit to MIN_RACEABLE_CONDITION
      await Promise.all(bumped.map((h) =>
        tx.horse.update({ where: { number: h.number }, data: { condition: h.condition } })
      ))
      await tx.appState.update({ where: { id: 1 }, data: { restingUntil: null } })
      return { horses: bumped, restingUntil: null }
    }
    const horses = await tx.horse.findMany({ orderBy: { number: 'asc' } })
    return { horses, restingUntil: meta?.restingUntil?.getTime() ?? null }
  })
}

async function startRestIfIdle(): Promise<HorsesEnvelope> {
  return db.$transaction(async (tx) => {
    const meta = await tx.appState.findUnique({ where: { id: 1 } })
    const now  = Date.now()
    if (meta?.restingUntil && meta.restingUntil.getTime() > now) {
      // Already resting — idempotent return.
      const horses = await tx.horse.findMany({ orderBy: { number: 'asc' } })
      return { horses, restingUntil: meta.restingUntil.getTime() }
    }
    const restingUntil = new Date(now + REST_DURATION_MS)
    await tx.appState.upsert({
      where:  { id: 1 },
      update: { restingUntil },
      create: { id: 1, restingUntil },
    })
    const horses = await tx.horse.findMany({ orderBy: { number: 'asc' } })
    return { horses, restingUntil: restingUntil.getTime() }
  })
}
```

```ts
// server/routes/rounds.ts
import { Hono } from 'hono'
import { db } from '../db'
import { applyRoundEffects } from '../../src/domain/conditionMutation'

export const rounds = new Hono()

rounds.post('/complete', async (c) => {
  const body = await c.req.json<{ raced: number[] }>()
  const current = await db.horse.findMany()
  const updated = applyRoundEffects(current, body.raced)  // pure domain fn

  await db.$transaction(updated.map((h) =>
    db.horse.update({ where: { id: h.id }, data: { condition: h.condition } })
  ))

  return c.json(updated)
})
```

```prisma
// prisma/schema.prisma
datasource db { provider = "sqlite"; url = "file:./dev.db" }
generator client { provider = "prisma-client-js" }

model Horse {
  number    Int    @id    // 1..HORSE_COUNT — natural primary key, no surrogate
  name      String
  condition Int
}

// BUSINESS_LOGIC.md §3.8 / decision #29 — single-row meta table holding global rest state.
// Seeded with id=1 alongside the roster; restingUntil is nullable and toggled by /api/horses/rest
// and by the lazy-bump path on GET /api/horses.
model AppState {
  id           Int       @id @default(1)
  restingUntil DateTime?
}
```

```ts
// prisma/seed.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { generateRoster } from '../src/domain/horseFactory'
import { createRng } from '../src/domain/rng'

const db = new PrismaClient()

// JSON, not TS — no code module encodes the names. See decision #24.
const NAMES_PATH = fileURLToPath(new URL('./horseNames.json', import.meta.url))
const NAMES: readonly string[] = JSON.parse(readFileSync(NAMES_PATH, 'utf8'))

const lookupName = (number: number): string => {
  const name = NAMES[number - 1]
  if (name === undefined) throw new Error(`No name configured for horse #${number}`)
  return name
}

async function main() {
  await db.horse.deleteMany()
  const rng = createRng(0xDECAF)              // deterministic seed for reproducibility
  await db.horse.createMany({ data: generateRoster(rng, lookupName) })
  // Single-row AppState — decision #29. restingUntil=null on a fresh seed; no rest in progress.
  await db.appState.upsert({ where: { id: 1 }, update: { restingUntil: null }, create: { id: 1, restingUntil: null } })
}

main().finally(() => db.$disconnect())
```

`horseFactory.generateRoster(rng, lookupName)` takes the name lookup as a DI argument so `domain/` carries no editorial content (per `CLAUDE.md` §1 and decision #24 below). The seed script reads `prisma/horseNames.json` once at startup and supplies the lookup at the boundary.

**Why this shape works:**
- Server is ~50 lines of routing — Hono's sweet spot. The substantive logic stays in the shared `domain/` layer.
- `applyRoundEffects` is the **single** place the fatigue/recovery formula lives. Imported by the server route. Tested as a pure function.
- Prisma + SQLite gives the seam without infrastructure cost. `prisma migrate dev` applies the schema; `prisma db seed` populates.
- Server is independently runnable: `tsx watch server/index.ts`. No Vue, no Pinia, no DOM, no client-side anything.

---

## 9. Determinism & RNG

**Why determinism matters:**
- Unit tests must produce identical race outcomes from identical inputs.
- Bugs must be reproducible from a recorded seed.

**Implementation:**
- `src/domain/rng.ts` exports `createRng(seed: number): Rng`. Implementation: **mulberry32** — a 4-line PRNG with full determinism, no entropy from the runtime.
- The `race` store creates a **fresh RNG per meeting** at `generateProgram` time, defaulting the seed to `Date.now()` (per `BUSINESS_LOGIC.md` decision #25). The seed and RNG are carried on the `RaceState` union from READY through RACING; FINISHED keeps the seed for logging/debugging but drops the RNG.
- The meeting RNG is passed to every domain function that needs randomness: `generateProgramFn(horses, rng)`, `simulationStep(snapshot, dt, lookup, rng)`.
- In unit tests, callers pass an explicit seed: `race.generateProgram(KNOWN_SEED)`. The entire meeting becomes a deterministic function of that seed alone — independent of boot time, click history, or any prior meeting.
- The server's seed script uses `createRng(0xDECAF)` so the initial roster is identical across machines and CI runs.

**No `Math.random()` anywhere in `domain/` or `server/`.** This is a hard rule; review must reject any such call.

---

## 10. Composables

### `useRaceSimulation`

```ts
// src/composables/useRaceSimulation.ts
import type { Round, Ranking, LanePosition, SimulationSnapshot, Rng, HorseId } from '../domain/types'
import { LANE_COUNT, SIM_TICK_MS } from '../domain/constants'
import { step as simulationStep } from '../domain/simulation'

export function useRaceSimulation(
  round: Round,
  conditionLookup: (id: HorseId) => number,
  rng: Rng,
) {
  const snapshot = ref<SimulationSnapshot>({
    roundNumber: round.number,
    distance:    round.distance,
    elapsedMs:   0,
    lanes: round.horseIds.map((id, i) => ({
      horseId: id,
      lane:    i + 1,
      meters:  0,
      finishedAtMs: null,
    })),
  })

  const positions   = computed<LanePosition[]>(() => snapshot.value.lanes)
  const finishOrder = computed<Ranking[]>(() =>
    [...snapshot.value.lanes]
      .filter((l): l is LanePosition & { finishedAtMs: number } => l.finishedAtMs !== null)
      .sort((a, b) => a.finishedAtMs - b.finishedAtMs)
      .map((l, i) => ({ rank: i + 1, horseId: l.horseId, lane: l.lane, finishTimeMs: l.finishedAtMs }))
  )
  const done = computed(() => finishOrder.value.length === LANE_COUNT)

  let handle: number | null = null
  let lastRealTs = 0
  let accumulator = 0

  function loop(realTs: number) {
    if (done.value) { handle = null; return }
    const realDt = lastRealTs ? realTs - lastRealTs : 0
    lastRealTs = realTs
    accumulator += realDt
    while (accumulator >= SIM_TICK_MS && !done.value) {
      snapshot.value = simulationStep(snapshot.value, SIM_TICK_MS, conditionLookup, rng)
      accumulator -= SIM_TICK_MS
    }
    if (!done.value) handle = requestAnimationFrame(loop)
  }

  onMounted(() => { lastRealTs = 0; accumulator = 0; handle = requestAnimationFrame(loop) })
  onUnmounted(() => { if (handle !== null) cancelAnimationFrame(handle); handle = null })

  return { positions, finishOrder, done }
}
```

- **Lifetime = one round.** Instantiated by `RaceTrack` when it mounts (or re-keys per §14.5); refs are garbage-collected when `RaceTrack` unmounts. No manual reset.
- **`positions` is reactive but not persisted.** No store, no survival across rounds, no global state. Single consumer: `RaceTrack`.
- **`finishOrder` is a `computed`** derived from `snapshot.lanes`. The pure `step()` mutates `lane.finishedAtMs` the instant a horse crosses; the computed re-sorts on access.
- **Loop self-terminates** when `done` flips true — no external stop call needed.
- **Fixed simulation cadence** (`SIM_TICK_MS`) per `BUSINESS_LOGIC.md` decision #16. The accumulator decouples sim time from render time: same seed + same `SIM_TICK_MS` → identical race regardless of browser frame rate. `simulation.step` always receives `SIM_TICK_MS` as its `dt`, never a variable rAF delta.
- **Cleanup on unmount is mandatory** — leaked rAF handles are a rejection-worthy bug.
- **Tested with `vi.useFakeTimers()`:** `vi.advanceTimersByTime` drives the rAF callback deterministically; finish events are asserted by inspecting `finishOrder`.

### `useRaceApi`

```ts
// src/composables/useRaceApi.ts
export function useRaceApi() {
  async function getHorses(): Promise<HorsesEnvelope> {       // envelope per §7
    const res = await fetch('/api/horses')
    if (!res.ok) throw new ApiError(res.status, await res.text())
    return res.json()
  }

  async function startRest(): Promise<HorsesEnvelope> {       // POST /api/horses/rest — idempotent
    const res = await fetch('/api/horses/rest', { method: 'POST' })
    if (!res.ok) throw new ApiError(res.status, await res.text())
    return res.json()
  }

  async function completeRound(raced: HorseId[]): Promise<Horse[]> {
    const res = await fetch('/api/rounds/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raced }),
    })
    if (!res.ok) throw new ApiError(res.status, await res.text())
    return res.json()
  }

  return { getHorses, startRest, completeRound }
}
```

### `useRestPolling`

```ts
// src/composables/useRestPolling.ts — BUSINESS_LOGIC.md §3.8 / §4.7
// Bounded poll: starts when race.phase becomes 'RESTING', stops when it leaves.
// Polls GET /api/horses every REST_POLL_INTERVAL_MS; when the envelope returns
// restingUntil === null, calls race.completeRest(envelope.horses).
export function useRestPolling() {
  const race    = useRaceStore()
  const horses  = useHorsesStore()
  const api     = useRaceApi()
  let handle: ReturnType<typeof setInterval> | null = null

  async function tick() {
    try {
      const env = await api.getHorses()
      if (env.restingUntil === null) {
        race.completeRest(env.horses)                          // store transitions RESTING → INITIAL
        return                                                  // tick stops naturally on next watch flush
      }
      horses.applyServerUpdate(env.horses)                      // keep roster fresh during the wait
    } catch (e) {
      // Polling failures are non-fatal — keep the interval running; next tick will retry.
      // A persistent failure surfaces via horses.error on the next GET that succeeds.
    }
  }

  watch(
    () => race.phase,
    (phase) => {
      if (phase === 'RESTING' && handle === null) {
        handle = setInterval(tick, REST_POLL_INTERVAL_MS)
        void tick()                                             // first poll immediately; don't wait 1s
      } else if (phase !== 'RESTING' && handle !== null) {
        clearInterval(handle)
        handle = null
      }
    },
    { immediate: true },
  )

  onUnmounted(() => { if (handle !== null) { clearInterval(handle); handle = null } })
}
```

- **Lifetime = single mount of the host container (`App.vue`).** The watch handles entering and leaving `RESTING` repeatedly without reinstantiating the composable.
- **Tested with `vi.useFakeTimers()`:** `vi.advanceTimersByTimeAsync(REST_POLL_INTERVAL_MS)` drives each poll deterministically; stubbed `fetch` returns the envelope.
- **No backoff, no jitter, no cap on retries** — at 1 Hz over a 10s window, worst case is 10 failed polls; the next successful GET writes the truth back into `horses`.

- Thin wrapper. No caching, no retry, no abort controllers in MVP.
- `ApiError` is thrown on non-2xx; consumers capture it into `horses.error` or surface in component error UI.
- **Tested by stubbing `fetch` globally** (`vi.spyOn(globalThis, 'fetch')`).

### `wait` (in `domain/`, not `composables/`)

```ts
// src/domain/wait.ts
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

- Pure, framework-free, importable from any layer (including the server, if needed).
- Vitest's `vi.useFakeTimers()` controls it precisely.

---

## 11. Boot sequence

1. `main.ts` creates the Vue app, installs Pinia, mounts `App.vue`.
2. `App.vue` in `onMounted`: calls `horses.fetchAll()` → `GET /api/horses` → envelope `{ horses, restingUntil }`. The store writes `horses.value`; if `restingUntil !== null`, it also calls `race.resumeRestFromBoot(restingUntil)` so a rest that was already in flight when the page was loaded continues to count down (BUSINESS_LOGIC.md §4.7 refresh resilience).
3. `App.vue` instantiates `useRestPolling()` once (lifetime = app lifetime). The composable's internal `watch` is dormant until `race.phase === 'RESTING'`.
4. `App.vue` renders all panels regardless of fetch state — `HorseList` shows a skeleton while `isLoading`.
5. User clicks `Generate Program` → `race.generateProgram()`:
   - **Happy path**: fit-gate passes → `state = READY` (program assigned).
   - **Sad path**: fit-gate fails → throws `NotEnoughFitHorsesError(fitCount, required)`. `RaceControls` catches the error, sets a local `lastWarning` ref ("Cannot generate: only N of 15 horses are fit to race"), and renders the **Rest the horses** button. State stays `INITIAL`.
6. User clicks `Rest` → `race.rest()` → `POST /api/horses/rest` → envelope returned → `state = RESTING` with `restingUntil`. `useRestPolling`'s watcher fires and begins polling.
7. Each 1s poll: `GET /api/horses`. As long as `restingUntil !== null`, the composable updates `horses.horses` and continues polling. When the server lazy-bumps and clears `restingUntil`, the envelope returns `restingUntil: null` → composable calls `race.completeRest(envelope.horses)` → `state = INITIAL` with the bumped roster. Polling halts.
8. User clicks `Generate Program` again → now `fitCount === HORSE_COUNT (20) ≥ MIN_FIT_HORSES_FOR_PROGRAM (15)` → fit-gate passes → `state = READY`.
9. User clicks `Start` → `race.start()` → `state = RACING` → orchestration loop runs.
10. Per round: `App` renders `<RaceTrack :key="race.currentRoundIndex">` → `RaceTrack` instantiates `useRaceSimulation(currentRound, conditionLookup, rng)` → rAF loop advances `positions` and appends to `finishOrder` → `done` flips true → `RaceTrack` calls `race.completeRound(finishOrder)` → store pushes result to `state.results` (UI updates instantly), POSTs to `/api/rounds/complete`, applies the fresh roster via `horses.applyServerUpdate`, awaits `wait(INTER_ROUND_DELAY_MS)`, then increments `currentRoundIndex` → `RaceTrack` re-keys → fresh `useRaceSimulation` instance for the next round.
11. After round 6 → `state = FINISHED`.
12. User clicks `Generate Program` again → fit-gate re-applies; either `state = READY` (clears results, new program) or the Rest reveal flow re-triggers (per step 5 sad path) if the prior meeting's fatigue dropped the roster below 15 fit horses.

---

## 12. Decision log

| # | Decision | Rationale |
|---|---|---|
| 1 | ~~**3 Pinia stores: `horses`, `race`, `simulation`**~~ *(superseded by #17)* | Initially modelled as three stores so high-frequency position writes were isolated. Later collapsed to two — see #17 for the rationale and the current layout. |
| 2 | **Hono + Prisma + SQLite, separate `server/`** | Real HTTP boundary, real persistence, zero infrastructure cost. Hono picked over Nuxt/Nitro/Express because explicit code reads better cold and avoids framework magic. |
| 3 | **Program generation client-side** | The assessment evaluates this code; belongs in `src/domain/programGenerator.ts`. |
| 4 | **Conditions mutate; server-authoritative formula; persisted in SQLite** | Reverses earlier non-goal. Realistic dynamics; survives page reload; one formula across client/server. See `BUSINESS_LOGIC.md` §3.7. |
| 5 | **`Horse` = 4 fields (`id`, `number`, `name`, `condition`)** | YAGNI; richer fields can be added when a real use case appears. |
| 6 | **Single identifier: `number` (1..HORSE_COUNT) is the primary key; no surrogate `id`** | The set of horses never changes (`BUSINESS_LOGIC.md` §6 non-goal), so a surrogate key earns nothing. `HorseId` is a type alias for the natural number key. Eliminates the "happen to be equal" assumption and the redundant field. |
| 7 | **API surface = 2 endpoints (`GET /api/horses`, `POST /api/rounds/complete`)** | Minimum useful; reset deferred to `prisma db seed` CLI. |
| 8 | **No reset endpoint over HTTP** | Avoids needing auth for a privileged operation; reset is a developer action, not a user action. |
| 9 | **Orchestration inside `race` store actions** | One place to read "what happens on Start"; no hidden conductor composable; Pinia setup-stores handle imperative orchestration fine. |
| 10 | **State machine = discriminated union + `InvalidTransitionError`** | Same safety as XState at ~5% the weight; reviewer doesn't need to know XState; TS narrowing enforces invariants at compile time. |
| 11 | **`Ranking.lane` stored, not derived** | Result panel reads `Ranking` directly without joining `Round`. |
| 12 | **`Program = Round[]` (type alias)** | Zero ceremony; metadata can wrap later if needed. |
| 13 | **`SimulationSnapshot.lanes` = array of `LanePosition` objects** | Readability beats micro-perf at 10 lanes × 60Hz. |
| 14 | **RNG created fresh per meeting at `generateProgram(seed?)` time; carried on `RaceState` union; passed to domain functions.** Default seed = `Date.now()`; tests pass an explicit `KNOWN_SEED`. | Per `BUSINESS_LOGIC.md` decision #25, each meeting is self-reproducible from a single seed — independent of boot time or click history. **No `Math.random()` anywhere in `domain/` or `server/`.** |
| 15 | **`useRaceApi` as a separate composable** | Stores stay HTTP-free; trivial to mock in tests. |
| 16 | **`wait(ms)` helper for inter-round delay** | Readable; Vitest fake-timers friendly. |
| 17 | **Drop `simulation` store; positions live in `useRaceSimulation` composable** | Supersedes #1 (was three stores). Positions are render-only state with a single consumer (`RaceTrack`) and no meaning outside one round. Game-dev pattern: persistent state in stores, transient render state in component-scoped refs. |
| 18 | **Rename composable: `useRaceLoop` → `useRaceSimulation`** | The composable owns both the rAF loop AND positions/finish detection — not just timing. "Simulation" reflects its actual responsibility. |
| 19 | **Container / presentational split (7 + 7)** | Containers read stores, run composables, dispatch actions. Presentationals are pure prop → render. Clearest mental model for SRP and for testing. |
| 20 | **Presentationals receive pre-resolved `Horse` objects, never `HorseId`s** | `ProgramPanel` / `ResultsPanel` resolve IDs via `horses.byId` and pass `Horse` objects down. Cards never touch a store; tests need no store mocks. |
| 21 | **`HorseList` shows no color swatch** | Per `BUSINESS_LOGIC.md` A5, horses have no identity color — only per-round lane colors. A color in the roster would imply persistent identity the rules don't support. |
| 22 | **`RaceTrack` mounts only during RACING; re-keys on `currentRoundIndex`** | Component lifetime exactly matches the simulation's. Round advance = new key = new `useRaceSimulation` instance = fresh positions. No manual reset code. |
| 23 | **Hybrid phase-based visibility** | Header + `HorseList` + `ResultsPanel` always mounted (the last pre-scaffolds six round headers from `ROUND_DISTANCES` per `BUSINESS_LOGIC.md` §3.6 — the meeting structure is visible from page load). `ProgramPanel` mounts once a program exists. `RaceTrack` only during RACING. No placeholder UI for MVP. |
| 24 | **Name list is a JSON fixture (`prisma/horseNames.json`), never a TS module.** Frontend ships zero name strings. `generateRoster(rng, lookupName)` takes the name resolver as a DI argument; the seed script reads the JSON and supplies the lookup at the boundary. | Names are server-owned persisted data, same class as `number` and `condition`. Storing them as JSON keeps editorial content out of code entirely — a rename is a JSON edit + reseed, not a code change. The only path from a horse number to a name on the client is `GET /api/horses`; there is no fallback list bundled anywhere. Keeps `src/domain/` behavior-only and DI-friendly (the test passes a stub `lookupName`). Recorded in `BUSINESS_LOGIC.md` decision #18 (2026-05-14 amendment). |
| 25 | **Fit-gate as a `NotEnoughFitHorsesError` thrown from `race.generateProgram()`; `RaceControls` catches and surfaces the warning.** Errors-as-control-flow inside the store; container owns the UX response. | Returning a discriminated result from `generateProgram()` (e.g., `{ kind: 'OK' } \| { kind: 'NEEDS_REST' }`) — diverges from the existing `InvalidTransitionError` pattern in the same store, two error idioms side-by-side. Pre-check inside the container — duplicates the rule in two places. Storing a `lastWarning` ref in the store — mixes view-layer concerns into the store. Cementing the existing throw idiom keeps one error pattern across the store and one place that knows the rule. Mirrors `BUSINESS_LOGIC.md` decision #26. |
| 26 | **Rest as an action on the race store + a watcher in `useRestPolling`.** The store action posts to `/api/horses/rest` and transitions to `RESTING`; the composable owns the polling loop and calls `completeRest` when the envelope clears. | Polling inside the store action (mixes async I/O with reactive state — hard to test, no clean teardown). Polling inside a component (couples the rest loop to that component's lifetime). Polling in `App.vue` directly (over-stuffs the root). Composable-with-watch isolates the polling lifecycle (start on phase, stop on phase) and is unit-testable with fake timers like `useRaceSimulation`. Mirrors `BUSINESS_LOGIC.md` decision #27. |
| 27 | **In-race condition: numeric text rendered inside `HorseSprite.vue` as a sibling `<span>` to the SVG.** Prop: `condition: number`. No threshold logic in the sprite. | Render the text in `RaceLane` so the sprite stays pure — pushes the prop one layer up; saves nothing. Render in a separate `ConditionLabel` component — premature factoring for one `<span>`. Threshold-aware sprite (binary fit/tired) — rejected by `BUSINESS_LOGIC.md` decision #28. Keeping the text inside `HorseSprite` keeps the whole horse rendering (icon + label) co-located; styling can position the label relative to the SVG without lifting state. |
| 28 | **`AppState` single-row Prisma table; lazy-bump-on-poll inside `db.$transaction`.** Both `GET /api/horses` and `POST /api/horses/rest` route through a shared transactional read. | In-memory module variable (lost on restart). `RestSession` audit table (overkill). Per-horse `restingUntil` column (20 copies). Background job / cron-style scheduler (extra moving parts; not justified). Single-row meta-table is restart-safe, observable via Prisma Studio, and extensible if a future global flag is needed. Mirrors `BUSINESS_LOGIC.md` decision #29. |
| 29 | **Envelope shape: `GET /api/horses` returns `{ horses, restingUntil }` (object) instead of `Horse[]` (array).** Breaking change to the contract; not yet shipped to any consumer. | Add a sibling `/api/rest-status` endpoint — two GETs per poll; coordination logic on the client. Encode rest state in an HTTP header — fragile across proxies / tests. Keep the flat array and store `restingUntil` only on the client — server is no longer the source of truth. The envelope makes rest state a first-class part of the roster snapshot; one endpoint, one source of truth. Mirrors `BUSINESS_LOGIC.md` decision #29. |
| 30 | **The Rest button is rendered by `RaceControls`, not by a new `RestButton.vue` container.** The warning banner + Rest button + `lastWarning` ref all live in `RaceControls`. | Separate `RestButton.vue` (and possibly `RestWarning.vue`) — splits two pieces of one UX moment into two files; raises the file count without earning anything. Keeping them in `RaceControls` matches the "two-button surface" framing of `BUSINESS_LOGIC.md` §4.1 (the Rest button only exists when the warning is active; co-locating keeps the conditional reveal tight). |
| 31 | **Tailwind v3 with `@apply` inside scoped CSS, BEM class names unchanged on every element.** `tailwind.config.ts` maps CSS-variable tokens (`bg-bg`, `text-text-muted`, `gap-s3`, `font-racing`, `shadow-current`, etc.) so utilities reference `tokens.css` rather than hardcoded values. Preflight disabled — our own `reset.css` already covers it, plus a `*` rule sets `border-width:0; border-style:solid; border-color: var(--color-border)` so Tailwind's `border-*` utilities actually render. | Tailwind utilities sprinkled in templates would have renamed every element's class string and broken `wrapper.classes()` assertions (e.g. `program-round-card--current`). `@apply` inside the existing scoped blocks keeps templates byte-identical and tests green, while letting us layer utilities + tokens + light hand-written CSS for gradients/shadows/finish-line stripes. CSS-var-backed theme keeps `tokens.css` as the single editorial surface for color/spacing/typography; theme key `racing` (not `display`) avoids collision with the `font-display` descriptor name. |
| 32 | **Trackside-at-night palette + Russo One / Chakra Petch / JetBrains Mono typography.** Deep-navy bg (`#060912`), charcoal panels, section-tinted headers (gold roster / cyan program / emerald results), amber accent (`#fbbf24`) for the live round with `box-shadow` glow, neon-red dashed finish line with shadow halo. Display font (Russo One) on headings + CTAs, body (Chakra Petch) on prose, mono (JetBrains Mono) on numbers and the phase pill. | Original pastel palette (coral header, yellow/blue/green strip headers on a white bg) read like a spreadsheet, not a racing game. Sportsbook / arcade-HUD vibe via dark mode + glow + bold display type signals "competitive sim" without going full cyberpunk. WCAG: text colors verified ≥ 4.5:1 against the navy surface; `:focus-visible` ring uses the amber accent for keyboard nav; `prefers-reduced-motion` neutralizes transitions in `reset.css`. |
| 33 | **Browser floor = `chrome >= 87, firefox >= 78, safari >= 14, edge >= 88` (`.browserslistrc`); polyfilled via `@vitejs/plugin-legacy` with `modernPolyfills: true` and legacy `targets: 'defaults'`.** `terser` and `core-js` added as devDeps (plugin-legacy requires terser; Vite 6 no longer bundles it). Asserted by `src/__tests__/build-polyfills.test.ts` (programmatic `vite build` checks modern + legacy chunks exist). | Bare Vite default would tighten the floor at exactly the modern target with no nomodule fallback — anything below Safari 14 / Chrome 87 simply 404s on script execution. Plugin-legacy emits a second nomodule bundle for older browsers and lets the modern bundle stay lean. Legacy bundle costs ~41 kB gz (vs ~38 kB modern) since our code uses zero APIs needing transpilation; the payload is dominated by the runtime, not our own modernity. Reviewed: 2026-05-15. Trade-offs accepted: (a) `terser` build dependency; (b) plugin-legacy injects an inline detection script — any future CSP needs a `'nonce-…'` or it breaks; (c) nginx caching config must hash-bust both bundles uniformly. |

---

## 13. Deferred to future design sessions

- **Concrete speed-formula tuning constants** — m/s range, jitter magnitude, on-screen scale (`SPEED_SCALE` etc.).
- ~~**Lane visual styling**~~ *(resolved Phase 8.5: dark turf bg, 10%-step vertical guides, neon-red dashed finish line)*
- **Specific `LANE_COLORS` hex values** — chosen for contrast and color-blind friendliness.
- **Milestones inside MVP** — what ships first (e.g., static layout) vs. last (e.g., E2E green bar).
- ~~**Styling system / design tokens**~~ *(resolved Phase 8.5: see §12 decisions #31–#32 and `src/styles/tokens.css`)*
- ~~**CSS architecture**~~ *(resolved Phase 8.5: Tailwind `@apply` inside scoped `<style>` blocks, BEM class names preserved on every element)*
- **Error UI** — how `horses.error` and `ApiError` surface to the user.
- **`package.json` scripts** — `dev`, `build`, `test`, `test:e2e`, `db:seed`, `db:migrate`.

---

## 14. Components

Designed in the second brainstorming session (2026-05-13). Decisions recorded in §12 entries 17–23.

### 14.1 Inventory (15 files)

```
App.vue
AppHeader.vue              (absorbs title + phase indicator)
  RaceControls.vue
HorseList.vue
  HorseListItem.vue
RaceTrack.vue              (absorbs round label + finish-line graphic)
  RaceLane.vue
    HorseSprite.vue
ProgramPanel.vue
  ProgramRoundCard.vue
ResultsPanel.vue
  ResultRoundCard.vue
    RankingRow.vue
ScoreTable.vue             (end-of-meeting aggregate — center slot when FINISHED, BUSINESS_LOGIC.md §3.10)
ColorSwatch.vue            (shared)
```

| Component | Single responsibility |
|---|---|
| `App` | Compose the three regions; conditionally render `RaceTrack` by phase. |
| `AppHeader` | Render the header row (title + phase indicator) and `RaceControls`. |
| `RaceControls` | Render the action buttons; dispatch `race.generateProgram` and `race.start`. |
| `HorseList` | Render the roster panel; iterate `horses.horses`. |
| `HorseListItem` | Render one horse's identity row (name + condition). |
| `RaceTrack` | Render the lane container, round label, and finish line; run `useRaceSimulation`; call `race.completeRound` when the round ends. |
| `RaceLane` | Render one lane (index + sprite + lane background). |
| `HorseSprite` | Render the SVG horse at a given progress fraction. |
| `ProgramPanel` | Render the schedule panel; iterate the 6 rounds. |
| `ProgramRoundCard` | Render one round's lineup. |
| `ResultsPanel` | Render the results panel; iterate completed rounds. |
| `ResultRoundCard` | Render one round's finish order. |
| `RankingRow` | Render one finish-order entry. |
| `ScoreTable` | Render the end-of-meeting aggregate (wins / podiums / total time) via `computeStandings`; mounted in the center slot when `phase === FINISHED`. |
| `ColorSwatch` | Render a colored square. |

### 14.2 Container / presentational split

7 containers read stores, run composables, and dispatch actions. 7 presentationals are pure prop → render with **zero store access**. The split is a hard rule — violations are review-blocking.

| Layer | Component | Reads | Runs | Writes |
|---|---|---|---|---|
| **container** | `App` | `race.phase` (for `RaceTrack` / `ScoreTable` swap), `race.currentRoundIndex` | – | `horses.fetchAll()` in `onMounted` |
| **container** | `AppHeader` | `race.phase` | – | – |
| **container** | `RaceControls` | `race.canGenerate`, `race.canStart`, `race.canRest`, `race.phase`, `race.restingUntil`, `race.fitCount` | – | `race.generateProgram()`, `race.start()`, `race.rest()` |
| **container** | `HorseList` | `horses.horses`, `horses.isLoading` | – | – |
| **container** | `RaceTrack` | `race.currentRound`, `race.currentRng`, `horses.conditionLookup`, `horses.byId` | `useRaceSimulation` | `race.completeRound(rankings)` |
| **container** | `ProgramPanel` | `race.program`, `race.currentRoundIndex`, `horses.byId` | – | – |
| **container** | `ResultsPanel` | `race.results`, `horses.byId` (+ `ROUND_DISTANCES` constant) | – | – |
| **container** | `ScoreTable` | `race.results`, `horses.byId` | – | – |
| **presentational** | `HorseListItem` | – | – | – |
| **presentational** | `RaceLane` | – | – | – |
| **presentational** | `HorseSprite` | – | – | – |
| **presentational** | `ProgramRoundCard` | – | – | – |
| **presentational** | `ResultRoundCard` | – | – | – |
| **presentational** | `RankingRow` | – | – | – |
| **presentational** | `ColorSwatch` | – | – | – |

**Implications:**

- **ID resolution is a container responsibility.** `ProgramPanel` / `ResultsPanel` resolve `HorseId → Horse` via `horses.byId` and pass resolved `Horse` objects down. Cards never see raw IDs.
- **`HorseSprite` is dumb.** It receives `progress: 0..1` and `color: string`. It doesn't know what a horse is, doesn't know what meters are. `RaceLane` performs the `positionM / distanceM` conversion.
- **`HorseList` shows no color swatch** — per `BUSINESS_LOGIC.md` A5, horses have no identity color.

### 14.3 Prop contracts (presentational)

```ts
// ColorSwatch.vue
defineProps<{ color: string }>()

// HorseListItem.vue
defineProps<{ horse: Horse }>()
// renders: name + condition

// HorseSprite.vue — pure SVG + condition label (BUSINESS_LOGIC.md §3.9 / decision #27)
defineProps<{
  color: string
  progress: number       // 0..1 — RaceLane does the meters→fraction conversion
  condition: number      // CONDITION_MIN..CONDITION_MAX — rendered as plain text above the SVG
}>()

// RaceLane.vue
defineProps<{
  laneIndex: number      // 0..LANE_COUNT-1 — derives color via LANE_COLORS[laneIndex]
  horse: Horse
  positionM: number
  distanceM: number      // round distance — for progress = positionM / distanceM
}>()
// RaceLane reads horse.condition and passes it through to HorseSprite. The lane itself does no
// threshold logic — the label is condition-as-text regardless of value.

// ProgramRoundCard.vue
defineProps<{
  roundNumber: number    // 1..ROUND_COUNT
  distance: number       // meters
  entries: { laneIndex: number; horse: Horse }[]   // LANE_COUNT entries, lane order
  isCurrent: boolean     // highlight the live round
}>()

// ResultRoundCard.vue
defineProps<{
  roundNumber: number
  distance: number
  entries: { position: number; horse: Horse; laneIndex: number }[]   // LANE_COUNT entries, finish order
}>()

// RankingRow.vue
defineProps<{
  position: number       // 1..LANE_COUNT
  horse: Horse
  laneIndex: number      // for `ColorSwatch` color
}>()
```

**No `emits` on any presentational component.** Pure input → rendered output. Actions only happen in containers.

### 14.4 Phase-based visibility (hybrid)

| Component | INITIAL | RESTING | READY | RACING | FINISHED |
|---|:---:|:---:|:---:|:---:|:---:|
| `AppHeader` / `RaceControls` | ✓ | ✓ (countdown shown, buttons disabled) | ✓ | ✓ | ✓ |
| `HorseList` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ProgramPanel` | – | – | ✓ | ✓ | ✓ |
| `RaceTrack` | – | – | – | ✓ | – |
| `ResultsPanel` | ✓ (headers only) | ✓ (headers only) | ✓ (headers only) | ✓ (filling) | ✓ |

- **Header + `HorseList`** anchor the layout at all times.
- **`ProgramPanel`** mounts when a program exists (`v-if="race.phase !== 'INITIAL'"`).
- **`ResultsPanel`** is mounted in every phase; pre-renders the six round headers from `ROUND_DISTANCES` so the meeting structure is visible from page load per `BUSINESS_LOGIC.md` §3.6. Round bodies fill in as each `RoundResult` is pushed to `race.results`.
- **`RaceTrack` mounts only during RACING** and re-keys on `race.currentRoundIndex`:

```vue
<RaceTrack
  v-if="race.phase === 'RACING'"
  :key="race.currentRoundIndex"
/>
```

The `:key` forces Vue to unmount the old `RaceTrack` and mount a fresh one when `currentRoundIndex` advances. The fresh instance creates a new `useRaceSimulation`, which initializes positions to zero. **No manual reset code is needed.**

### 14.5 Per-round lifecycle

```
phase: RACING, currentRoundIndex: i
   │
   ▼
RaceTrack mounts (keyed on i)
   │
   ▼
useRaceSimulation(program[i], conditionLookup, rng) instantiated
   - positions:   ref<LanePosition[]>  initialized to start line
   - finishOrder: computed<Ranking[]>  derived from snapshot.lanes
   - done:        computed<boolean>    finishOrder.length === LANE_COUNT
   │
   ▼
rAF loop runs:
   each tick → simulationStep mutates positions; finishedAtMs set as horses cross
   │
   ▼
finishOrder.length reaches LANE_COUNT  →  done = true  →  loop self-terminates
   │
   ▼
watch(done) in RaceTrack fires → race.completeRound(finishOrder.value)
   │
   ▼
race store action:
   1) push RoundResult to state.results        (UI updates instantly)
   2) POST /api/rounds/complete                (await — server applies fatigue + recovery)
   3) horses.applyServerUpdate(fresh)          (HorseList re-renders)
   4) if last round → state = FINISHED         (RaceTrack unmounts entirely)
   5) else → await wait(INTER_ROUND_DELAY_MS)
           → mutateRacing(s => s.currentRoundIndex += 1)
                ↑ RaceTrack re-keys → repeat from top with i+1
```

Three invariants in this flow:

- **`useRaceSimulation` has exactly one lifetime per round.** No reuse, no reset, no leak.
- **`RaceTrack` knows nothing about rounds 2–6 or about FINISHED.** It just renders one round and reports its `Ranking[]`.
- **The race store knows nothing about positions or rAF.** It only sees the final `Ranking[]` payload.

---

## 15. Testing strategy

### 15.1 Discipline

Per `CLAUDE.md` §3: 🔴 **Red** (failing test first, fails for the *right* reason) → 🟢 **Green** (minimum code) → 🛠️ **Refactor** (only on green). No production code without a failing test that requires it.

### 15.2 Tools

| Concern | Tool |
|---|---|
| Unit (domain, stores, composables, components) | Vitest |
| Component mount | `@vue/test-utils` |
| Store mocks in component tests | `@pinia/testing` (`createTestingPinia`) |
| Fake time (rAF + `wait`) | Vitest's `vi.useFakeTimers()` |
| Network stubs | `vi.spyOn(globalThis, 'fetch')` |
| E2E | Playwright |

### 15.3 Per-layer test inventory

```
src/domain/__tests__/
├── rng.test.ts                 # mulberry32 produces known sequence from known seed
├── horseFactory.test.ts        # generateRoster: HORSE_COUNT entries; conditions in [MIN..MAX]; unique numbers
├── programGenerator.test.ts    # ROUND_COUNT rounds × LANE_COUNT picks; rest rule; cap rule; deterministic from seed
├── simulation.test.ts          # step() advances positions; finishedAtMs set on crossing; jitter bounded; deterministic
├── conditionMutation.test.ts   # applyRoundEffects (fatigue/recovery, clamp);
                                #   applyRestEffects (bump unfit to MIN_RACEABLE_CONDITION, fit horses untouched);
                                #   isFit (boundary at MIN_RACEABLE_CONDITION)
├── wait.test.ts                # resolves after N ms (fake timers)
└── errors.test.ts              # InvalidTransitionError carries kind + action

src/stores/__tests__/
├── horses.test.ts              # fetchAll wires error/loading; applyServerUpdate replaces; byId / conditionLookup
└── race.test.ts                # every illegal transition throws InvalidTransitionError;
                                # generateProgram allowed from INITIAL/READY/FINISHED (re-roll);
                                # generateProgram throws NotEnoughFitHorsesError when fitCount < threshold;
                                # rest() POSTs and transitions to RESTING with restingUntil;
                                # completeRest applies updated roster and returns to INITIAL;
                                # resumeRestFromBoot only fires when state is INITIAL and timestamp is in the future;
                                # start only from READY → RACING with currentRoundIndex=0, results=[];
                                # completeRound pushes result, awaits api, advances index, FINISHED on last round

src/composables/__tests__/
├── useRaceSimulation.test.ts   # fake-timer rAF; advance time → positions grow; finishOrder fills; done flips; deterministic
├── useRaceApi.test.ts          # stubbed fetch; correct URL/method/body; ApiError on non-2xx; envelope shape for getHorses & startRest
└── useRestPolling.test.ts      # fake timers; enters polling when phase becomes RESTING; calls completeRest when envelope clears;
                                # stops polling when phase leaves RESTING; tolerates a failed GET without crashing

src/components/__tests__/
# Presentationals — mount({props}), assert rendered output (one test each):
├── ColorSwatch.test.ts
├── HorseListItem.test.ts
├── HorseSprite.test.ts         # renders SVG with color; renders condition text; condition text scales with prop
├── RaceLane.test.ts
├── ProgramRoundCard.test.ts
├── ResultRoundCard.test.ts
├── RankingRow.test.ts
# Containers — createTestingPinia(), assert dispatched actions + rendered store slice:
├── App.test.ts                 # fetchAll called on mount; RaceTrack v-if respects race.phase
├── AppHeader.test.ts           # phase rendered from store
├── RaceControls.test.ts        # buttons disabled state matches canGenerate/canStart/canRest;
                                # generate click dispatches generateProgram; on NotEnoughFitHorsesError catches
                                #   and renders warning + Rest button reveal; rest click dispatches race.rest;
                                #   RESTING phase renders countdown and disables all three buttons
├── HorseList.test.ts           # iterates horses; loading state visible when isLoading
├── RaceTrack.test.ts           # useRaceSimulation mocked; when done flips, race.completeRound called with finishOrder
├── ProgramPanel.test.ts        # iterates rounds; resolves IDs to names; isCurrent on currentRoundIndex
└── ResultsPanel.test.ts        # iterates results; resolves IDs to names; cards reveal as results array grows

server/__tests__/
├── horses.test.ts              # GET /api/horses returns envelope (horses + restingUntil); in-memory SQLite fixture;
                                #   lazy-bump-on-poll: when restingUntil <= now, applyRestEffects runs in a transaction
                                #     and the response clears restingUntil;
                                #   POST /api/horses/rest sets restingUntil = now + REST_DURATION_MS;
                                #   POST /api/horses/rest while already resting returns existing envelope unchanged (idempotent)
└── rounds.test.ts              # POST /api/rounds/complete applies conditionMutation; persists; returns full roster

tests/e2e/
└── happy-path.spec.ts          # load → Generate visible → click Start → wait FINISHED → assert 6 result cards
```

### 15.4 Build order — inside-out

Each step starts on red, ends on green, refactors on green:

1. **Domain** first (pure, fastest feedback, no framework). `rng` → `horseFactory` → `programGenerator` → `simulation` → `conditionMutation` → `wait` → `errors`.
2. **Server** routes (depend only on domain + Prisma). Backend usable before frontend exists.
3. **Stores** (`horses` first, then `race`). Mock `useRaceApi`.
4. **Composables**. `useRaceApi` test stubs `fetch`. `useRaceSimulation` test mounts a tiny harness component with fake timers.
5. **Presentational components**. Pure prop-in tests with `@vue/test-utils`.
6. **Container components**. `createTestingPinia()` to mock actions. `RaceTrack` test mocks `useRaceSimulation`.
7. **E2E happy path** (Playwright). The acceptance gate — proves all the above wire together.

### 15.5 Fake-timer pattern for `useRaceSimulation`

```ts
it('produces deterministic finish order from a known seed', () => {
  vi.useFakeTimers()
  let result!: ReturnType<typeof useRaceSimulation>

  mount(defineComponent({
    setup() {
      result = useRaceSimulation(testRound, () => 50, createRng(KNOWN_SEED))
      return () => h('div')
    },
  }))

  vi.advanceTimersByTime(20_000)   // simulate 20s of rAF ticks

  expect(result.done.value).toBe(true)
  expect(result.finishOrder.value).toHaveLength(LANE_COUNT)
  expect(result.finishOrder.value.map((r) => r.horseId)).toEqual([/* deterministic order */])
})
```

### 15.6 What to test vs what NOT to test

**Test:**
- State machine transitions (every legal → green, every illegal → throws).
- Deterministic outputs from seeded RNG (programGenerator, simulation, useRaceSimulation).
- Fake-timer driven simulation outcomes (finish order, done flip).
- Server route side-effects (rows mutated as expected; full roster returned).
- Dispatched actions from container components.

**Do NOT test:**
- Vue's reactivity (assume the framework works).
- Prisma's persistence layer (assume the ORM works).
- Exact rendered HTML strings — assert classes/text/structure, not whole markup.
- `Math.random()` values (forbidden in `domain/` and `server/`; review must reject any such call).

### 15.7 Acceptance gate

The Playwright happy path (`tests/e2e/happy-path.spec.ts`) is the canonical green-bar for "the app works." Unit tests prove correctness of pieces; E2E proves they wire together. Both must be green in CI.

---

## 16. Implementation prerequisites

Implementation work that surfaces during TDD but isn't a *design* decision — config files, tuning constants, code patterns. Originally surfaced in the 2026-05-13 gap audit alongside design gaps; the design gaps have since been resolved into `BUSINESS_LOGIC.md` and the body of this document (subsections marked *(resolved YYYY-MM-DD)* below preserve the trail). What's left is the prerequisite work — kept here because the subsections hold useful detail (code examples, setup patterns) that the matching tests will need.

### 16.1 RNG injection seam *(resolved 2026-05-13)*

**Resolved by `BUSINESS_LOGIC.md` decision #25 (per-meeting timestamped seed).** The seed is now an optional parameter on `generateProgram(seed?: number)`; production defaults to `Date.now()`, tests pass an explicit `KNOWN_SEED`. The seed becomes a meeting-local value carried on the `RaceState` union — no module-level globals, no test-only setters, no factory-argument trickery. See §4.2 store code and §9 for the locked pattern.

### 16.1c Phase-name constants *(landed 2026-05-15)*

Phase string literals (`'INITIAL' | 'RESTING' | 'READY' | 'RACING' | 'FINISHED'`) appear in the `RaceState` union, the state machine guards, the button-enablement matrix, and the tests that exercise every transition. Per `CLAUDE.md` §1, that's more than one use; they are exported as value-level constants `PHASE_INITIAL` / `PHASE_RESTING` / `PHASE_READY` / `PHASE_RACING` / `PHASE_FINISHED` from `src/domain/constants.ts`. The type-level union `RacePhase` (in `src/domain/types.ts`) remains the type-system view and is unchanged.

### 16.1b Rest-mechanism constants and errors *(blocker for Phase 1)*

Surfaced by the 2026-05-14 brainstorm (`BUSINESS_LOGIC.md` decisions #26–#29). Required exports:

- `src/domain/constants.ts`:
  - `MIN_RACEABLE_CONDITION = 40`
  - `MIN_FIT_HORSES_FOR_PROGRAM` — **derived**: `(LANE_COUNT * ROUND_COUNT) / MAX_RACES_PER_HORSE`. No parallel literal.
  - `REST_DURATION_MS = 10_000`
  - `REST_POLL_INTERVAL_MS = 1_000`
- `src/domain/errors.ts`:
  - `NotEnoughFitHorsesError(fitCount: number, required: number)` — thrown from `race.generateProgram()` per decision #25.
- `src/domain/conditionMutation.ts`:
  - `applyRestEffects(horses: Horse[]): Horse[]` — pure; bumps every horse with `condition < MIN_RACEABLE_CONDITION` to exactly `MIN_RACEABLE_CONDITION`. Identity (number, name) preserved.
  - `isFit(horse: Horse): boolean` — predicate; `horse.condition >= MIN_RACEABLE_CONDITION`.

### 16.2 Speed-formula tuning constants *(blocker)*

`simulation.step` is unimplementable and untestable without named constants. Required exports in `src/domain/constants.ts` (final names TBD):

- `BASE_SPEED_MPS_MIN`, `BASE_SPEED_MPS_MAX` — slow vs. fast horse baseline m/s.
- `JITTER_MPS` — per-tick noise magnitude.
- `FORM_MPS` — per-race form magnitude (Phase 9 revision). Drawn once per lane at snapshot creation; `drawForm(rng)` returns a uniform sample in `[-FORM_MPS, +FORM_MPS)` with the same symmetry-at-0.5 property as `drawJitter`.
- `CONDITION_WEIGHT` — how condition (1..100) maps onto the m/s range.

Numbers TBD in a short follow-up. They only need to produce believable, reproducible races, not realistic ones.

### 16.3 `LANE_COLORS` values *(blocker)*

`CLAUDE.md` §1 mandates an exported array of exactly `LANE_COUNT` color tokens. Hex values undecided. Recommend the Wong / Okabe-Ito 8-class palette extended with two extras — color-blind friendly out of the box.

### 16.4 `package.json` scripts *(blocker — blocks day-1 TDD)*

Day-1 TDD cannot start without `npm test`. Required scripts:

| script | command |
|---|---|
| `dev` | `concurrently 'npm:dev:*'` |
| `dev:web` | `vite` |
| `dev:server` | `tsx watch server/index.ts` |
| `build` | `vite build` |
| `preview` | `vite preview` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `test:e2e` | `playwright test` |
| `lint` | `eslint .` |
| `typecheck` | `vue-tsc --noEmit` |
| `db:migrate` | `prisma migrate dev` |
| `db:seed` | `prisma db seed` |

### 16.5 `vite.config.ts` + `vitest.config.ts` *(blocker)*

- Vite must proxy `/api/*` to `http://localhost:3001`.
- Vitest config needs: `environment: 'jsdom'`, `globals: true`, and a `setupFiles` entry for shared fake-timer setup (§16.7) and `@vue/test-utils` global config.
- Pure-domain tests may opt into `// @vitest-environment node` per file if jsdom overhead becomes noticeable.

### 16.6 Server `tsconfig.json` cross-package resolution *(blocker)*

`server/` imports from `src/domain/`. `tsx watch` does not honor Vite path aliases. Two options:

- **(a) Plain relative imports** (`../../src/domain/conditionMutation`). Simple, slightly ugly. **Recommended.**
- **(b) `tsconfig-paths`** loaded by tsx (`tsx --tsconfig server/tsconfig.json`). Works, more moving parts.

Either way, server `tsconfig.json` extends the root and explicitly includes `../src/domain/**/*`.

### 16.7 `vi.useFakeTimers()` must fake `requestAnimationFrame` *(blocker)*

The §15.5 sample test will hang as written — Vitest's default `toFake` list excludes rAF, so `useRaceSimulation`'s loop never ticks. Fix project-wide via a Vitest setup file:

```ts
// tests/setup.ts
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout', 'clearTimeout',
      'requestAnimationFrame', 'cancelAnimationFrame',
      'performance', 'Date',
    ],
  })
})
afterEach(() => { vi.useRealTimers() })
```

Pure-domain tests that don't touch time may call `vi.useRealTimers()` per-test.

### 16.8 Mid-meeting API failure policy *(resolved 2026-05-13)*

**Resolved by `BUSINESS_LOGIC.md` decision #23.** On a `completeRound` API failure, the race store sets `horses.error` and transitions `state.value → INITIAL`. Local meeting state evaporates with the transition; `horses.horses` already reflects the pre-failure server state, so the client cache equals server truth with no extra bookkeeping. The C3 banner displays a contextual mid-meeting-failure message. See `ARCHITECTURE.md` §4.2 `completeRound` `catch` block for the implementation pattern.

### 16.9 Pre-flight guard on `generateProgram` *(blocker)*

`race.generateProgram()` reads `horses.horses` without checking `horses.horses.length === HORSE_COUNT`. If the user clicks Generate before `fetchAll` resolves, the program is malformed. Apply both:

- Assert in the action; rethrow as a controlled error.
- Tighten `canGenerate` computed to `!horses.isLoading && horses.horses.length === HORSE_COUNT`.

### 16.10 `assertRacing` / `mutateRacing` definitions *(blocker)*

§4.2 uses both helpers but never defines them. Decisions:

- **Location:** alongside `RaceState` in `src/stores/race.ts` — they are union-private.
- **Mutation strategy:** hand-rolled clone vs. Immer. Recommend hand-rolled — three call-sites total, no library pull worth doing.

Reference implementation:

```ts
function assertRacing(s: RaceState): Extract<RaceState, { kind: 'RACING' }> {
  if (s.kind !== 'RACING') throw new InvalidTransitionError(s.kind, 'mutateRacing')
  return s
}
function mutateRacing(fn: (s: Extract<RaceState, { kind: 'RACING' }>) => void) {
  const next = structuredClone(assertRacing(state.value))
  fn(next)
  state.value = next
}
```

### 16.11 `watch(done)` must fire exactly once *(blocker)*

§14.5 says `RaceTrack` watches `done` and dispatches `race.completeRound`. The watch must fire **once** per round mount, or `completeRound` is called repeatedly. Use Vue 3.4+ `watch(done, fn, { once: true })` — terser than an internal `dispatched` ref and intention-revealing.

### 16.12 Drop `ranking` from `POST /api/rounds/complete` *(resolved 2026-05-14)*

**Resolved as part of the A1 design lock** (`BUSINESS_LOGIC.md` §3.7 API contract: `{ raced: HorseId[] }` only). Cascaded through §7 contract row, §8 server route handler, §10 `useRaceApi.completeRound` signature, and §4.2 `completeRound` action body. Re-introduce when an actual feature requires it.

### 16.13 Documentation fix-ups *(housekeeping)*

Applied during this audit:

- §5 table row for `RACING → FINISHED` corrected: trigger is `completeRound()`, not `start()`.
- Decision log #1 (three stores) annotated `(superseded by #17)`.

Outstanding doc tweaks to apply when the next round of edits happens to those sections:

- `Round.number` is 1-based; `currentRoundIndex` is 0-based — add `program[i].number === i + 1` assertion to `programGenerator.test.ts` and a one-line note in §6.
- `Horse.number` vs `Horse.id` — clarify in §6 whether they may diverge or are guaranteed equal; if equal, drop one.
- `Ranking.finishTimeMs` vs `LanePosition.finishedAtMs` — same value, two names. One-line note in §6 explaining the rename at the layer boundary.
- `ResultsPanel` empty-state during READY — placeholder text vs. hidden header. Decide when wiring the component.

---

This document covers architecture, state design, server contract, component-level design, testing strategy, and known open decisions. §13 holds surface concerns (styling, milestones) that don't alter contracts; §16 holds the prerequisites that must be resolved before `vitest run` is meaningful.
