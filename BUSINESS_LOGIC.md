# Business Logic & Domain Decisions — Horse Racing

**Date:** 2026-05-13
**Author:** Özer Yılmaztekin
**Status:** Approved. This document locks the **rules, flow, and domain decisions** for the MVP. Component design, store layout, and code organization are intentionally out of scope here and follow in a separate document.

---

## 1. What we are building

An interactive horse racing simulation, scoped to MVP. The user clicks **Generate Program**, then **Start**, then watches six animated races play out sequentially with results revealed as each round completes.

The codebase is judged on clean architecture, separation of concerns, state management discipline, and TDD-friendly domain logic — not on feature richness. This document locks the **rules and flow** that the application must implement; the **shape of the code** is intentionally left for a follow-up design session.

---

## 2. Assumptions

| # | Assumption | Why |
|---|---|---|
| A1 | **Roster size = 20, fixed.** | Resolves the ambiguity in `expectation.md` (requirement #2 says "1 to 20 randomly generated"; rule #1 says "20 available"). We lock to 20. |
| A2 | **DNF is not modeled.** | Every horse always reaches the finish line. The simulation produces a complete ranking. |
| A3 | **Inter-round delay ≈ 1.5 s.** | Tunable named constant. Gives the viewer time to read the just-revealed result before the next round starts. |
| A4 | **Speed formula = `f(condition, jitter)`,** integrated by `position += speed × dt`. Exact constants (m/s range, jitter magnitude, on-screen scale) are tuned during implementation and live in a single constants module. | Simplest live-tick model that satisfies the spec. |
| A5 | **Spec rule #2 ("each horse should be represented with a unique color") is reinterpreted as "each racing horse has a unique color within its round".** | The lane-color palette is decoupled from roster size — scales to N horses without needing N colors. |

---

## 3. Domain Rules

### 3.1 The roster
- The application has **20 horses**.
- Each horse has a **name** (from a fixed curated list, indexed by `number` — no RNG used for names), a **number** (1–20), and a **condition** score in `[1, 100]` drawn **uniformly at random** from the seed RNG at first run.
- The roster is **seeded once on the server** (at first run). Subsequent app loads fetch the existing roster — no client-side generation.
- **The name list is server-side data, not code**: it lives as a JSON fixture (`prisma/horseNames.json`) read by the seed script — there is no TS module anywhere (client or server) that statically encodes the names. After the seed runs, the DB is the source of truth. The frontend ships zero name strings; names reach the UI only via `GET /api/horses`. This mirrors how `number` and `condition` are handled: backend owns the row, client receives it as JSON.
- The set of horses (count, names, numbers, IDs) is stable after initial seeding. **Conditions, however, mutate across rounds** per §3.7 and persist server-side across page reloads.

### 3.2 The program (schedule)
- A program consists of **exactly 6 rounds**.
- The round distances are fixed and ordered:
  - Round 1: 1200 m
  - Round 2: 1400 m
  - Round 3: 1600 m
  - Round 4: 1800 m
  - Round 5: 2000 m
  - Round 6: 2200 m
- Each round selects **10 horses** from the 20-horse roster.
- Selection is **weighted random by condition** from the **eligible pool** for that round (see §3.3). The algorithm is **sequential weighted-without-replacement** with **linear weight = `horse.condition`**: each pick samples one horse from the remaining eligible pool with probability `condition / sum(remaining_conditions)`; the chosen horse is removed before the next pick. Repeated until 10 horses are selected.
- The 10 selected horses' **selection order** becomes their **lane assignment** (selection-index 1 → lane 1, selection-index 10 → lane 10).

**Note on emergent lane-1 bias.** Combining "selection order = lane order" with the weighted-without-replacement algorithm (decision #11) produces an emergent statistical property: the highest-condition eligible horse is the most likely first pick, so lane 1 tends to host the strongest runner of the round. This is **intentional and harmless** — lane index has no effect on speed (A4 / decision #12), so the strongest horse still has to *run* to win. Lane is purely a visual slot; the bias is cosmetic. A future maintainer should not "fix" it by post-pick shuffling — that would silently break decision #9.

### 3.3 Eligibility — the "availability" rules
A horse is eligible for round *N* if and only if **both** of these hold:

1. **Rest rule:** the horse did **not** race in round *N − 1*. (`MIN_REST_ROUNDS = 1`)
2. **Cap rule:** the horse has raced in fewer than **4** of the prior rounds. (`MAX_RACES_PER_HORSE = 4`)

For round 1, all 20 horses are eligible (no prior round to rest from, no races accumulated).

Both rules are **intra-meeting**: "prior rounds" means prior rounds within the program currently being generated. A new Generate Program click builds a fresh 6-round schedule without considering previous meetings' usage. The eligibility check is recomputed at each round's program-generation step as rounds 1..6 are built sequentially.

**Pool-size sanity.** The rest rule alone guarantees ≥ 10 eligible horses per round (the 10 horses who did not race in round *N − 1*). Across the 6 rounds the total demand is 60 horse-slots; the cap rule provides capacity 80 (20 horses × 4 races). Cap exhaustion is therefore not a real concern in practice.

### 3.4 The race — simulation model
- A race is a continuous, time-stepped simulation that runs at a **fixed simulation cadence** (`SIM_TICK_MS`, defaulting to ~16.67 ms ≈ 60 Hz). `requestAnimationFrame` drives the *loop*, not the *tick size*: the loop measures real elapsed time and runs as many fixed-`dt` sim ticks as fit (accumulator pattern). On a slow render frame the loop performs multiple sim ticks; on a fast frame it may perform zero. Same seed + same `SIM_TICK_MS` → identical race on every machine.
- Per simulation tick, each running horse's position advances:
  ```
  position += speed × dt        // dt = SIM_TICK_MS in milliseconds
  ```
- Speed is `f(condition, jitter)` — **additive linear interpolation** on the condition range, with a per-tick jitter perturbation:
  ```
  speed = BASE_SPEED_MIN + (condition / CONDITION_MAX) × (BASE_SPEED_MAX − BASE_SPEED_MIN) + jitter
  ```
  A horse at `condition = CONDITION_MIN` runs near `BASE_SPEED_MIN`; a horse at `condition = CONDITION_MAX` runs near `BASE_SPEED_MAX`. The two endpoint constants and the jitter magnitude are tuned during implementation per A4 — only the **shape** is locked here.
- **Jitter scope: independent per (horse, tick).** Every tick, every still-racing horse draws its own jitter sample from the shared RNG. The draw order within a tick is **lane 1 first → lane 10 last**, so a known seed reproduces an exact race. This produces natural relative variance between horses (one pulls ahead this frame, another the next); a shared-per-tick or fixed-per-round scheme would flatten that variance.
- A horse **finishes** when `position ≥ round.distance`. The finish time is recorded with **sub-tick interpolation** — the exact fractional millisecond *within* the crossing frame, not the frame boundary:
  ```
  needed = (distance − prevPosition) / speed     // partial-frame ms to reach line
  finishedAtMs = elapsedMsBeforeTick + needed
  position    = distance                           // clamp at finish line
  ```
  This makes finish times closed-form testable from a known seed: with `condition = CONDITION_MAX, jitter = 0, distance = D`, the finish time is exactly `D / BASE_SPEED_MAX × 1000` ms, independent of frame cadence.
- A round ends when **all 10 horses** have crossed the finish line.
- A horse's **rank** within the round is determined by finish time, earliest first. On an exact tie in `finishedAtMs`, **lower lane number wins** (lane 1 beats lane 2, etc.). The sort comparator is `(a, b) => a.finishedAtMs − b.finishedAtMs || a.lane − b.lane`. Ranks are unique 1..`LANE_COUNT` — no shared-rank case in MVP.
- The simulation must be deterministic given a seeded RNG (so that the same seed reproduces the same race outcome — required for testability).

### 3.5 Colors
- A fixed palette of **10 lane colors** is defined as a constant (`LANE_COLORS`).
- Horses themselves have **no permanent color**. The horse list shows each horse by number + name + condition.
- At the start of each round, the 10 selected horses are placed into lanes 1–10 (selection order = lane order, per §3.2). Each horse adopts the color of its lane for the duration of that round.
- The result swatch in the results panel shows the lane color the horse had **in that round**. The same horse may therefore appear with different swatch colors across different rounds.

### 3.6 Results
- After each round completes, that round's results become visible: **rank, lane-color swatch, horse name, finish time**.
- Results are revealed **per round**, as each round finishes — never in batch at the end.
- All six round headers ("Round 1 — 1200 m" … "Round 6 — 2200 m") are visible from page load; their result bodies fill in as rounds complete.
- Order **within a round**: rank 1 (top) → rank 10 (bottom).
- Order **of rounds** in the panel: round 1 (top) → round 6 (bottom).

### 3.7 Condition mutation

After each round completes, every horse's condition is updated on the server:

- Each horse that **raced** in that round: `condition -= FATIGUE_PER_RACE` (default `8`).
- Each horse that **did not race** in that round: `condition += RECOVERY_PER_REST` (default `3`).
- The result is clamped to `[CONDITION_MIN, CONDITION_MAX]` (i.e., `[1, 100]`).

**Authority.** The mutation is **server-authoritative**. The client posts the round's outcome; the server runs the formula, persists the updated conditions, and returns the refreshed roster. The client then updates its local `horses` snapshot with the response.

**Persistence.** Conditions persist across page reloads via SQLite (one row per horse, one column for `condition`). On app boot, `GET /api/horses` returns the roster with its **current** conditions — a new meeting begins where the previous one left off.

**API contract (informal, for rule reference; precise types in `ARCHITECTURE.md` §7):**
- `GET /api/horses` → `Horse[]` (current state)
- `POST /api/rounds/complete` with `{ raced: HorseId[] }` → `Horse[]` (updated state). The server does not need a round number; the formula depends only on who raced.

**Feedback loop.** Condition affects two distinct game systems:
1. **Selection weight** in `programGenerator` (higher condition → higher pick probability, per §3.2).
2. **Speed** in the simulation (higher condition → higher base speed, per §3.4).

A heavily-used horse therefore becomes **both less likely to be picked AND slower if picked** — and a rested horse recovers toward its peak.

**Edge cases.**
- A horse at `condition = CONDITION_MAX` (100) gains nothing from further rest (clamp).
- A horse at `condition = CONDITION_MIN` (1) loses nothing from further racing (clamp), but the cap rule (§3.3) still prevents over-racing.
- The eligibility rules (§3.3) remain unchanged: rest = 1 round, cap = 4 races per meeting. The cap is intentionally kept as a hard safety rail — though **rest=1 alone** makes it structurally redundant in 6 rounds (max possible races = `ceil(ROUND_COUNT/2) = 3`, below the cap of 4). Fatigue is an additional probabilistic disincentive on top, not the structural reason for redundancy.

### 3.8 Fit-gate and the Rest mechanism

A horse is **fit to race** when `condition ≥ MIN_RACEABLE_CONDITION` (= **40**). Fitness is a property of the **current** roster, not a property of individual rounds — it is checked once, at the moment the user clicks **Generate Program**, against the live roster snapshot. Once the program is generated, fitness no longer gates anything; the simulation runs the committed lanes regardless of in-race condition drift.

**The fit-gate.** Program generation requires at least `MIN_FIT_HORSES_FOR_PROGRAM` fit horses in the roster. The threshold is **derived**, not hand-tuned:

```
MIN_FIT_HORSES_FOR_PROGRAM = (LANE_COUNT × ROUND_COUNT) / MAX_RACES_PER_HORSE
                           = (10 × 6) / 4
                           = 15
```

With fewer than 15 fit horses, a program cannot be assembled without violating the cap rule (§3.3) — every fit horse would have to race more than 4 times to cover the 60 lane-slots.

**The Rest mechanism.** When the fit-gate fails, the application offers the user a single global action: **Rest the horses**.

1. The user clicks Generate Program. If `count(fit horses) < MIN_FIT_HORSES_FOR_PROGRAM`, the click fails with an inline warning (e.g., "Cannot generate: only 10 of 15 horses are fit to race") and reveals a **Rest the horses** button.
2. The user clicks Rest. The application transitions to a new phase `RESTING` (see §4.2) for `REST_DURATION_MS = 10_000 ms` (10 seconds).
3. On rest completion (server-side, lazy-bumped on the next poll — see §4.7), **every horse with `condition < MIN_RACEABLE_CONDITION` is bumped to exactly `MIN_RACEABLE_CONDITION`**. Horses already at or above the threshold are unchanged. The application returns to `INITIAL`.
4. The user clicks Generate Program again. With every horse now at ≥ 40 condition, the fit-gate passes (20 ≥ 15) and a program is generated.

**Authority.** The fit-bump is **server-authoritative**, like fatigue and recovery (§3.7). The client never mutates conditions; it polls and observes.

**Idempotency.** A `POST /api/horses/rest` call while a rest is already in flight is a no-op — the server returns the existing rest state without resetting the timer or creating a second rest. There is no way to start two concurrent rests or to chain rests in flight.

**Scope.** Rest is **only available at the `INITIAL` phase**. It cannot be triggered mid-meeting (between rounds), during a race, or from `READY` / `RACING` / `FINISHED`. A meeting once started runs to completion regardless of how tired its horses become. The per-horse identity of "tired" is communicated visually (see §3.9) but is not a control surface.

**Why this shape.** The fit-gate prevents the visible failure mode where a generated meeting is mostly low-condition horses crawling to the finish line. The bump-to-floor (not bump-by-delta) guarantees that **one** rest click always re-fits every horse — the user never needs to click Rest twice. The threshold of 15 is derived from `LANE_COUNT × ROUND_COUNT / MAX_RACES_PER_HORSE`, not an arbitrary tuning knob, so it stays correct if those constants ever change.

### 3.9 In-race condition display

While a round is running, each horse's **current condition** (the value the horse is racing with — fatigue/recovery applies between rounds per §3.7, not during a race) is shown as **plain numeric text** above its sprite on the track. No sprite variants, no opacity tricks, no condition bars — just the number.

This is the user's signal that a low-condition horse is going to lag visibly. It appears only during `RACING`; the roster panel continues to show condition in its own way (see `HorseListItem`, `ARCHITECTURE.md` §14).

---

## 4. Application Flow

### 4.1 Controls
The control surface is exactly **two buttons**: `Generate Program` and `Start`. No pause, restart, cancel, or other controls exist in the MVP.

### 4.2 Phases
The application moves through five phases:

| Phase | Description |
|---|---|
| **INITIAL** | Roster fetched (`horses.horses.length === HORSE_COUNT`). No program yet. Before the initial fetch resolves, the application is in an orthogonal *loading* substate owned by the `horses` store — not a phase. |
| **RESTING** | The user clicked **Rest the horses** (§3.8). A 10-second timer (`REST_DURATION_MS`) is running server-side; the roster is locked. On timer elapse the server bumps every unfit horse to `MIN_RACEABLE_CONDITION` and the application returns to `INITIAL`. Reachable **only** from `INITIAL`; exits **only** back to `INITIAL`. |
| **READY** | A program has been generated. The race has not yet started. |
| **RACING** | Auto-chaining through rounds 1–6. |
| **FINISHED** | All 6 rounds have completed; the results panel is fully populated. |

### 4.3 Button enablement matrix

| Phase | `Generate Program` | `Start` | `Rest the horses` |
|---|---|---|---|
| INITIAL | ✅ click always allowed; on `count(fit) < MIN_FIT_HORSES_FOR_PROGRAM` the click surfaces a warning and reveals the Rest button rather than transitioning | ❌ | 🔓 **conditional** — hidden by default; revealed once a Generate click has surfaced the warning, or whenever the warning is still active. Click → RESTING |
| RESTING | ❌ | ❌ | ❌ (rest already in progress) |
| READY | ✅ → READY (re-rolls program in place) | ✅ → RACING | ❌ |
| RACING | ❌ | ❌ | ❌ |
| FINISHED | ✅ → READY (clears results, generates new program; fit-gate re-applies — if the prior meeting's fatigue dropped `count(fit) < MIN_FIT_HORSES_FOR_PROGRAM`, the same warning + Rest reveal flow runs here) | ❌ | 🔓 conditional, same rule as INITIAL |

Disabled means **visibly disabled** (not silently no-op). A user never clicks a button that does nothing.

All three buttons are additionally gated on **roster readiness** — disabled while `horses.isLoading` or `horses.horses.length !== HORSE_COUNT`, regardless of phase. This guards against clicks before the boot-time fetch resolves or after it errors.

The Rest button is a *contextual reveal*, not a phase-controlled action: even at `INITIAL` it stays hidden until something demonstrates that rest is needed (a failed Generate click). This keeps the controls minimal in the common case (most random rosters have ≥ 15 fit horses on first load and never surface Rest at all) while remaining discoverable on demand.

### 4.4 RACING flow
On entering RACING:

1. Round 1 begins. Horses animate from the start line; the live-tick simulation runs.
2. When all 10 horses have finished, round 1's result row is appended to the results panel.
3. The system pauses for **`INTER_ROUND_DELAY_MS` ≈ 1500 ms**.
4. Round 2 begins. Repeat through round 6.
5. After round 6 finishes and its result row appears, the phase transitions to **FINISHED**.

`Generate Program` is disabled for the entire duration of RACING; a click during this phase is impossible (the button is disabled, not no-op).

### 4.5 Re-running the meeting
To run a new meeting after finishing, the user clicks `Generate Program` from the FINISHED phase. This:
- Clears the existing results,
- Generates a brand-new program from the same (unchanged) roster,
- Returns to the READY phase.

The user then clicks `Start` to begin again.

### 4.6 Error states

If the initial `GET /api/horses` fails or returns an empty roster, the application shows a **banner** with a manual **Retry** button. The retry button re-calls `horses.fetchAll()`. No game phase is active while the roster is unavailable (per decision #20); Generate Program and Start are disabled via the roster-readiness gate.

The same banner covers both the network-error case (`horses.error !== null`) and the empty-roster case (`horses.horses.length === 0`). One recovery path, one component.

If `POST /api/rounds/complete` fails mid-meeting, the meeting is **ended in place**:
- The race store transitions `state.value` back to `INITIAL`, discarding the in-flight `program`, `currentRoundIndex`, and the locally-pushed-but-uncommitted round N result.
- `horses.horses` already reflects the pre-round-N server state (the failed call never landed `applyServerUpdate`), so the client cache equals server truth — no divergence.
- The same banner displays a contextual message (e.g., "Round N couldn't save. Meeting ended; horses kept what they earned."). The user clicks Generate Program to start a fresh meeting with the partial-meeting-mutated conditions intact.

This is symmetric with §6's "no reload-resume" non-goal — an API failure produces the same observable outcome as a page reload, but explicitly rather than silently.

### 4.7 RESTING flow

On entering `RESTING`:

1. The race store records `restingUntil` (the server-returned epoch-millis timestamp at which the rest completes — `serverNow + REST_DURATION_MS`).
2. The client begins polling `GET /api/horses` every `REST_POLL_INTERVAL_MS` (= **1000 ms**). The polling is owned by a dedicated composable (`useRestPolling`, see `ARCHITECTURE.md` §10); it is bounded — it starts on entering `RESTING` and stops on exiting it.
3. The UI displays a countdown derived from `restingUntil − Date.now()`. Generate, Start, and Rest are all disabled. There is no Cancel.
4. On any poll where the server detects `restingUntil ≤ now`, the server handler lazy-bumps every horse with `condition < MIN_RACEABLE_CONDITION` to exactly `MIN_RACEABLE_CONDITION`, clears `restingUntil`, and returns the fresh roster envelope. The bump + clear runs in a single Prisma transaction so it is atomic with respect to any other request.
5. The client observes `restingUntil === null` in the envelope, stops polling, and transitions back to `INITIAL`. The fit count is now 20 (all horses ≥ 40).

**Refresh resilience.** A page reload during `RESTING` returns the user to `INITIAL` (the meeting hasn't started; nothing to lose). The server-side `restingUntil` is unaffected by the reload — if the user clicks Generate before the timer elapses, the next `GET /api/horses` will still report `restingUntil != null`, and the client transitions back into `RESTING` with the remaining countdown. If the user does nothing, the next page load that lands after `restingUntil` will lazy-bump conditions on its first GET and present a fresh roster.

**Double-click protection.** `POST /api/horses/rest` is idempotent: if `restingUntil != null && now < restingUntil`, the handler returns the existing envelope unchanged. The user can mash the button — only the first click sets the timer.

---

## 5. Decision Log

| # | Decision | Alternatives considered | Why this option |
|---|---|---|---|
| 1 | **Control surface = `Generate Program` + `Start` only.** No pause, restart, or cancel. | Pause/Resume; Restart-race vs. Restart-tournament; single Restart button | MVP scope. Pause/restart logic deferred. |
| 2 | **Auto-chain 6 rounds with ~1.5 s inter-round delay.** | One round per click; no delay; overlay between rounds | Single button-press matches the spec ("when Start is clicked, the races should begin, running one round at a time"); the delay gives the viewer breathing room without extra UI. |
| 3 | **Roster generated once at page load; stable.** | Generated by `Generate Program`; re-rolled on every `Generate Program` click | The mockup shows a populated horse list before any click; matches real-stable semantics; cleaner separation (roster is immutable, program is mutable). |
| 4 | **Eligibility = rest(1) + cap(4); weighted-random by condition.** | Rest-only (forces deterministic alternation in rounds 2–6); cap-only (allows back-to-back overuse); fatigue model with condition decay; pure uniform random | Realistic, satisfies 20-horse / 60-slot math, preserves real randomness in rounds 2–6 while preventing unrealistic overuse. |
| 5 | **Live-tick simulation.** | Pre-computed result with scripted animation; hybrid pre-compute + tick playback | Single source of truth — displayed position and recorded result come from the same code path. Deterministic with a seeded RNG. No "two timelines" drift problem. |
| 6 | **State machine = 4 phases (INITIAL / READY / RACING / FINISHED) with the locked button matrix.** | 3 phases (no INITIAL); pause-capable variants; restart-capable variants | No hidden no-op buttons; no edge cases around mid-race actions; trivially testable. |
| 7 | **Results = rank + lane-color swatch + horse name + finish time; pre-scaffolded round headers; round 1→6 top-to-bottom; rank 1→10 top-to-bottom; no DNF.** | Minimum (rank + name); rounds appear only as they finish; reversed orderings | Mockup-aligned; structure is visible from page load; ordering matches natural reading direction. |
| 8 | **Color model = 10-color lane palette only; per-round lane assignment; no permanent horse colors.** | 20 identity colors (one per horse); hybrid 20 identity + 10 lane decoration; 10 shared identity colors with no-collision constraint | Scales beyond 20 horses; decouples roster size from palette size; simpler picker (no color-uniqueness constraint). |
| 9 | **Lane assignment = selection order from picker.** | Sorted by condition (descending or ascending); independent random shuffle; by horse number | Simplest; no hidden semantics in lane index; lane is purely a visual slot. |
| 10 | **Conditions mutate across rounds with fatigue + recovery; persisted server-side; server-authoritative formula; clamped to `[1, 100]`.** | Static conditions (prior decision); fatigue-only with no recovery; end-of-meeting reroll; client-authoritative formula; client/server hybrid; localStorage persistence | User direction. Conditions now drive a feedback loop (heavily-used horses become slower and less likely to be picked; rested horses recover). Server ownership prevents a future "real backend" from needing two implementations of the formula. SQLite persistence satisfies the "even if we restart the page" requirement; localStorage rejected as unrealistic. Reverses the prior non-goal "Persistent horse fatigue". |
| 11 | **Selection algorithm = sequential weighted-without-replacement, linear weight `w = condition`.** | Efraimidis-Spirakis weighted shuffle (statistically equivalent but lane-order = sort-order, conflicts with decision #9); exponential weight `w = condition²` (adds a tuning constant, obscures the rule); deterministic top-10 (not actually random) | Simplest reading of "weighted random by condition." Preserves "pick order = lane order" from decision #9. ~6-line implementation, trivially testable from a seeded RNG. |
| 12 | **Speed formula = additive linear interpolation: `speed = BASE_SPEED_MIN + (condition / CONDITION_MAX) × (BASE_SPEED_MAX − BASE_SPEED_MIN) + jitter`.** | Multiplicative term `BASE × (1 + condition × k)` (three tuning knobs, harder to bound, ratio depends on `k`); sigmoid / exponential curves (adds complexity, no MVP justification) | Two tuning knobs (the speed endpoints) plus jitter magnitude — small surface. Monotone in condition, bounded, trivially testable (`condition = CONDITION_MAX, jitter = 0 → speed = BASE_SPEED_MAX` exactly). Aligns with §3.7 feedback statement without over-fitting. |
| 13 | **Jitter scope = independent per (horse, tick), drawn in lane order 1 → 10.** | Shared-per-tick (all horses get the same jitter — no relative variance); fixed-per-round offset (race feels scripted) | Natural relative variance between horses is the visual point of the simulation. Fixed lane-order draw guarantees seed → race determinism. mulberry32 handles the ~15 000 draws / round trivially. |
| 14 | **Finish detection = sub-tick interpolation; `finishedAtMs = elapsedMsBeforeTick + (distance − prevPosition) / speed`; position clamped at the line.** | Tick-resolution snap (over-counts by up to one frame; same-frame crossings all tie) | Closed-form testable from constants; avoids systematic over-count; removes most accidental ties so exact ties (B5) become rare and meaningful. Three extra lines in `simulation.step`. |
| 15 | **Tie-break on equal `finishedAtMs` = lower lane wins.** Sort comparator `(a, b) => a.finishedAtMs − b.finishedAtMs ‖ a.lane − b.lane`. Ranks remain unique 1..`LANE_COUNT`. | Higher lane wins (no semantic anchor); horse number ascending (disconnected from the race); RNG draw at tie (extra determinism cost, invisible to viewer); shared rank (changes type + UI) | Deterministic, one-line implementation, semantically anchored to the lane signal from decision #9. Keeps the `Ranking` type unchanged. |
| 16 | **Fixed simulation cadence `SIM_TICK_MS` (≈ 60 Hz), decoupled from rAF via an accumulator in `useRaceSimulation`.** | Variable rAF `dt` (production deterministic "approximately" only — contradicts §3.4 as written); pre-compute the full race then animate playback (reverses decision #5, reintroduces two-timeline drift) | Honors §3.4 determinism literally — same seed → identical race on any machine, any browser frame rate. Doesn't reverse decision #5 (tick still happens in real time, just at a locked cadence). ~8 lines in `useRaceSimulation`; `simulation.step` unchanged. |
| 17 | **Cap rule scope = intra-meeting.** "Prior rounds" in §3.3 means prior rounds within the program currently being generated; race counts reset on every Generate Program click. | Cumulative across meetings (requires server schema change + reset mechanism, significant scope creep); drop cap entirely (removes a safety rail) | Matches the natural reading of "prior rounds." No server-side bookkeeping. The §3.3 pool-size analysis already implicitly assumes per-meeting scope (`HORSE_COUNT × MAX_RACES_PER_HORSE = 80` slots per meeting). |
| 18 | **Horse names are a server-side JSON fixture** (`prisma/horseNames.json`), read by `prisma/seed.ts` and stored in SQLite. **No TS module — client or server — statically encodes the names.** After seeding, the DB is the source of truth; the frontend reaches names only via `GET /api/horses`. `generateRoster(rng, lookupName)` receives the resolver as a DI argument (update 2026-05-14). | Procedural generation (consumes RNG, collision risk, solves a non-problem); numbered placeholders ("Horse N", makes the `name` field redundant); a TS module like `src/domain/horseNames.ts` (puts names in the frontend bundle); a TS module like `prisma/horseNames.ts` (still embeds editorial data in code) | Names are persisted server-owned data, same class as `number` and `condition` — not frontend decoration. Storing them as JSON keeps editorial content out of code entirely: a rename is a JSON edit + reseed, never a code change. Backend ownership keeps the editorial choice (theme, language) reversible without a frontend rebuild. `generateRoster(rng, lookupName)` is a pure function; the seed script reads the JSON and supplies the lookup at the boundary. |
| 19 | **Initial condition distribution = uniform integer in `[CONDITION_MIN, CONDITION_MAX]`, one RNG draw per horse.** | Truncated normal around midpoint (needs Box-Muller, two draws + transform); tighter uniform band like [30, 80] (extra tuning constants, reduces visible variance); custom mixed distribution (most complexity, no MVP need) | Aligns with the literal reading of "condition score 1 to 100." Simplest implementation. Visible variance without engineering. Uniformity is straightforward to assert in a histogram-style test from a known seed. |
| 20 | **`INITIAL` precondition: roster loaded.** Phase is a game-state machine; data-fetch state lives in the `horses` store and is orthogonal. Buttons are runtime-gated on roster readiness in addition to phase. | Introduce a `LOADING` phase (mixes orthogonal concerns, forces a 5-phase machine); rely on runtime gating alone with no rule update (leaves the contract ambiguous) | Clean separation: `phase` = game progress, `horses.isLoading` = data state. The runtime gate (`OPEN_DECISIONS` #9) is the implementation; this is the rule it implements. |
| 21 | **No reload-resume in MVP.** A reload during RACING discards local program/results; server-side condition mutations from already-completed rounds persist. The user returns to `INITIAL` with a partially-fatigued roster but loses the in-flight meeting. | Persist meeting state to localStorage (scope creep, contradicts multi-device non-goal); persist to server (schema work, cleanup, session management); transactional condition rollback (contradicts server-authoritative simplicity) | This is what the architecture already does; making it explicit prevents a future reader from misreading the gap as a bug. |
| 22 | **Roster-fetch error UX = banner + manual Retry button.** Triggered when `horses.error !== null` or roster is empty; retry re-calls `horses.fetchAll()`. No game phase active while the roster is unavailable. | Reload-only recovery (brittle); auto-retry with backoff (out of MVP scope); fatal modal (treats recoverable error as terminal) | Single component, single recovery path covers both error and empty-roster cases. Pairs naturally with decision #20 (no phase until roster ready). |
| 23 | **Mid-meeting `completeRound` failure = end the meeting in place; transition `state` → `INITIAL`; surface banner.** Server-confirmed condition mutations from earlier rounds persist; the locally-pushed round-N result evaporates with the state transition. | Halt-and-reload-only (brittle); optimistic-with-rollback + retry button (most complex; new "stuck in RACING with retry" sub-state); silent best-effort (bad UX, conditions drift cosmetically) | Local state ends up exactly equal to server state with no bookkeeping. Symmetric with the no-reload-resume non-goal (decision #21) — an API failure produces the same observable outcome as an explicit reload. Reuses the C3 banner component. |
| 24 | **Client trusts server response wholesale; no runtime guard on `applyServerUpdate`.** The no-roster-mutation rule (§6) is a server-side invariant; the client replaces its cache as given. | Runtime guard on the client (defense-in-depth against an invariant we'd only violate by breaking our own server); conditions-delta API (`Record<HorseId, condition>` — tighter contract, more code on both sides) | At 20 rows over one route, defense-in-depth and tight delta contracts are premature. Server tests are the right place to catch contract violations. |
| 25 | **Per-meeting RNG: fresh seed per Generate Program click, carried on the `RaceState` union.** `generateProgram(seed?: number)` defaults to `Date.now()`; tests pass `KNOWN_SEED` explicitly. Seed + RNG travel READY → RACING; FINISHED keeps the seed for logging and drops the RNG. | Single boot RNG (re-roll click-sensitivity; needs both boot time and click history to reproduce); per-meeting counter seed (still click-sensitive within a meeting); split streams (over-engineered) | Each meeting becomes self-reproducible from one seed — matches §3.4's "same seed reproduces the same race outcome" literally. Provides the OPEN_DECISIONS #7 injection seam at the meeting boundary without test-only API surface. |
| 26 | **Fit-gate at meeting-start: `MIN_RACEABLE_CONDITION = 40`, `MIN_FIT_HORSES_FOR_PROGRAM = (LANE_COUNT × ROUND_COUNT) / MAX_RACES_PER_HORSE = 15`.** Generate Program fails if the live roster has fewer than 15 fit horses. | Lower threshold (e.g., 20): leaves many random rosters where the gate never triggers; gameplay still produces visually broken low-condition rounds. Higher threshold (e.g., 60): triggers on most rosters, creates a frustrating click-pattern. No fit-gate at all: status quo — visible failure mode on lopsided seeds. Hand-picked count not tied to existing constants: drifts if cap or round count change. | Threshold of 40 triggers reliably on the current seeded roster (10 of 20 below 40) without firing on healthy random rosters. The 15-horse count is **derived**, not hand-tuned — it remains correct if `LANE_COUNT`, `ROUND_COUNT`, or `MAX_RACES_PER_HORSE` change. Required by `CLAUDE.md` §1: derived constant, no parallel literal. |
| 27 | **Rest mechanism: 10-second real-time timer; bump every horse with `condition < MIN_RACEABLE_CONDITION` to exactly `MIN_RACEABLE_CONDITION`; pre-meeting only.** New phase `RESTING` between `INITIAL` and itself. | Instant bump (no timer): "rest" becomes a misnomer — it is just a button that pads conditions. Bump-by-delta (+X to every horse): may need multiple clicks; introduces a retry loop. Mid-meeting rest (between rounds): doubles the state-machine surface; conflicts with the locked "no pause" non-goal. Auto-rest (no user click): removes user agency. Per-horse rest UI: scope creep. | Real-time timer makes rest observable in the UX (10s countdown). Bump-to-floor guarantees **one** click always re-fits the whole roster — no retry, no "rest more" affordance. Pre-meeting only keeps the state machine flat: one new phase, no transitions out of `RACING`. Server-authoritative bump matches §3.7. |
| 28 | **In-race condition display: plain numeric text above each horse sprite during `RACING`. No SVG variants, no condition bars, no opacity tricks.** | Binary SVG swap (fit/tired): two assets, two code paths, threshold-aware sprite layer. Three-tier SVG: same problems, more assets. CSS desaturation / opacity: looks "broken" not "tired". Condition bar: extra DOM, extra prop, extra styling. | The condition value is already in the store; rendering it as `<span>` is one prop and one line of Vue template. Zero new assets. The race itself already encodes "tired" — low-condition horses run slower because of the speed formula; the text just **labels** what the user is already seeing. |
| 29 | **Server stores rest state in a single-row `AppState` Prisma model (`restingUntil DateTime?`); `GET /api/horses` returns an envelope `{ horses, restingUntil }`; lazy-bump-on-poll applies inside a transaction.** | In-memory module variable on the server: lost on restart, breaks multi-process. Per-horse `restingUntil` column: 20 copies of the same value, leaks rest semantics into the horse aggregate. Dedicated `RestSession` audit table: overkill for one button. Separate `/api/rest-status` endpoint: two-call coordination dance for the same fact. | Single source of truth for both roster and rest state in one envelope, one poll, one endpoint. `AppState` is restart-safe, observable in DB, and trivially extensible if a future feature needs another global flag. Lazy-bump-on-poll keeps the timer logic in one place (the GET handler) — no scheduled job, no separate worker. |

---

## 6. Explicit Non-goals

The following are deliberately **not** part of MVP:

- **Pause / Resume** mid-race.
- **Restart** (single race or whole tournament).
- **Mid-race regeneration or abort.**
- **DNF** modeling (every horse always finishes).
- **Pre-computed results** with scripted animation.
- **Per-horse identity colors** or any 20-color palette.
- **Roster mutation:** the *set* of horses (count, names, numbers) does not change after the server's initial seeding. Only `condition` mutates (per §3.7). **Server-side invariant:** the server is responsible for upholding this rule. The client trusts the server's response and replaces its roster cache wholesale via `applyServerUpdate` — no runtime guard on the client side.
- **Betting / odds / wager UI.**
- **Multi-user or multi-device** experiences. (Persistence across page reloads is now **in scope** — see §3.7.)
- **Resume after reload during RACING.** A page reload mid-meeting discards the local program and results. Condition mutations from already-completed rounds persist server-side (per §3.7), so the user returns to `INITIAL` with a roster that reflects the partial meeting, but the in-flight meeting itself is lost. Restarting via Generate Program is the only path forward.
- **Mid-meeting rest.** Once a meeting starts (`READY` → `RACING`), the Rest mechanism (§3.8) is unavailable until the meeting ends. A meeting in flight runs to completion regardless of in-race condition drift; rest exists only to *prevent* a broken meeting from starting, not to repair one in progress.
- **Per-horse manual rest.** The user cannot select which horses rest. The Rest mechanism (§3.8) always operates on the whole roster — every horse below `MIN_RACEABLE_CONDITION` is bumped to exactly that value, and horses already above the threshold are unchanged. There is no UI to "rest horse #3 specifically."
- **Sprite variants for tired horses.** No fit/tired SVG swap, no opacity desaturation, no condition bar. The only in-race signal is the plain numeric condition text above each sprite (§3.9). Explicitly rejected during the 2026-05-14 brainstorm in favor of zero new assets.

---

## 7. Deferred to the next design session

The following are intentionally **out of scope for this document** and will be designed separately:

- Store boundary and contracts (what lives in `horses` vs. `race`; exact actions and getters).
- Component responsibilities, props, and store-read contracts.
- Concrete tuning constants for the speed formula (m/s range, jitter magnitude, on-screen scale).
- Lane visual styling and track layout.
- Specific `LANE_COLORS` hex values.
- Testing strategy (per-layer scope, how the rAF loop is faked, which tests get smoke vs. exhaustive).
- Milestones inside the MVP (what ships first, what ships last).

This document is the **rule-level contract**. The next document will be the **implementation-level contract** that delivers these rules.
