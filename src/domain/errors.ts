import type { RacePhase } from './types'

// Thrown by the race store when a phase-illegal action is attempted
// (ARCHITECTURE.md §16.10). Carries `kind` (current phase) and `action`
// (the attempted operation) so the error banner can show useful context.
export class InvalidTransitionError extends Error {
  public readonly kind: RacePhase
  public readonly action: string

  constructor(kind: RacePhase, action: string) {
    super(`Invalid transition: cannot ${action} while in ${kind}`)
    this.name = 'InvalidTransitionError'
    this.kind = kind
    this.action = action
  }
}

// Thrown by `useRaceApi` on a non-2xx HTTP response (ARCHITECTURE.md §10).
// `status` is the HTTP code; `body` is the raw response text.
export class ApiError extends Error {
  public readonly status: number
  public readonly body: string

  constructor(status: number, body: string) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}
