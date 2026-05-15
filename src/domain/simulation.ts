import { BASE_SPEED_MPS_MAX, BASE_SPEED_MPS_MIN, CONDITION_MAX, FORM_MPS, JITTER_MPS } from './constants'
import type { HorseId, LanePosition, Rng, Round, SimulationSnapshot } from './types'

type ConditionLookup = (horseId: HorseId) => number

const MS_PER_SECOND = 1000

// Per BUSINESS_LOGIC.md §3.4 / decision #12: additive linear interpolation
// from MIN..MAX over condition, with a caller-supplied jitter perturbation.
// Drawing jitter is a separate concern (kept out so this stays pure).
export function computeSpeed(condition: number, jitter: number): number {
  const conditionRatio = condition / CONDITION_MAX
  const speedRange = BASE_SPEED_MPS_MAX - BASE_SPEED_MPS_MIN
  return BASE_SPEED_MPS_MIN + conditionRatio * speedRange + jitter
}

// One rng draw → uniform sample in [-JITTER_MPS, +JITTER_MPS).
// rng() === 0.5 returns 0 exactly — the symmetry anchor that makes the
// closed-form finish-time test (cond=MAX, jitter=0) feasible.
export function drawJitter(rng: Rng): number {
  return (rng() - 0.5) * 2 * JITTER_MPS
}

// One rng draw → uniform sample in [-FORM_MPS, +FORM_MPS). Drawn once per
// lane at snapshot creation; the result lives on the LanePosition for the
// whole race. Symmetry around rng()=0.5 keeps closed-form anchors feasible.
export function drawForm(rng: Rng): number {
  return (rng() - 0.5) * 2 * FORM_MPS
}

// Per BUSINESS_LOGIC.md §3.4 / decision #14: advance one lane by speed*dt;
// if the lane crosses the line on this tick, clamp meters and back-solve
// the exact finishedAtMs via linear interpolation (sub-tick precision).
// Already-finished lanes are returned untouched — no double-finishes.
export function advanceLane(
  lane: LanePosition,
  speedMps: number,
  dtMs: number,
  distance: number,
  elapsedMsBeforeTick: number,
): LanePosition {
  if (lane?.finishedAtMs) return lane
  const advanced = lane.meters + speedMps * (dtMs / MS_PER_SECOND)
  if (advanced < distance) {
    return { ...lane, meters: advanced }
  }
  const remainingMeters = distance - lane.meters
  const timeToFinishMs = (remainingMeters / speedMps) * MS_PER_SECOND
  return { ...lane, meters: distance, finishedAtMs: elapsedMsBeforeTick + timeToFinishMs }
}

// Zeroed initial snapshot for a round. Lanes are 1-indexed in lane-order;
// horseIds come from the round's lane assignments (decision #9).
export function createSnapshot(round: Round, roundNumber: number): SimulationSnapshot {
  const lanes: LanePosition[] = round.lanes.map((horseId, index) => ({
    horseId,
    lane: index + 1,
    meters: 0,
    finishedAtMs: null,
  }))
  return { roundNumber, distance: round.distance, elapsedMs: 0, lanes }
}

// One simulation tick. Lanes are processed in lane-order 1→10 so the rng
// consumption order is deterministic (decision #13). Already-finished lanes
// skip both the jitter draw and the movement update — preserving rng order
// for finished lanes would waste entropy and isn't what the model needs.
export function step(
  snapshot: SimulationSnapshot,
  dtMs: number,
  conditionLookup: ConditionLookup,
  rng: Rng,
): SimulationSnapshot {
  const lanes = snapshot.lanes.map((lane) => {
    if (lane?.finishedAtMs) return lane
    const jitter = drawJitter(rng)
    const speed = computeSpeed(conditionLookup(lane.horseId), jitter)
    return advanceLane(lane, speed, dtMs, snapshot.distance, snapshot.elapsedMs)
  })
  return { ...snapshot, elapsedMs: snapshot.elapsedMs + dtMs, lanes }
}
