import { describe, expect, it } from 'vitest'
import { ApiError, InvalidTransitionError, NotEnoughFitHorsesError } from '../errors'

describe('InvalidTransitionError', () => {
  it('stores kind and action on the instance (happy)', () => {
    const err = new InvalidTransitionError('INITIAL', 'completeRound')
    expect(err.kind).toBe('INITIAL')
    expect(err.action).toBe('completeRound')
  })

  it('is an Error with name "InvalidTransitionError" (edge — instanceof + name)', () => {
    const err = new InvalidTransitionError('RACING', 'generateProgram')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(InvalidTransitionError)
    expect(err.name).toBe('InvalidTransitionError')
  })

  it('message includes both kind and action (sad — a stub that only stored fields would leave message blank)', () => {
    const err = new InvalidTransitionError('FINISHED', 'start')
    expect(err.message).toContain('FINISHED')
    expect(err.message).toContain('start')
  })
})

describe('ApiError', () => {
  it('stores status and body on the instance (happy)', () => {
    const err = new ApiError(503, 'Service Unavailable')
    expect(err.status).toBe(503)
    expect(err.body).toBe('Service Unavailable')
  })

  it('is an Error with name "ApiError" (edge — instanceof + name)', () => {
    const err = new ApiError(500, '')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.name).toBe('ApiError')
  })

  it('message includes the status code (sad — a stub that only stored fields would leave message blank)', () => {
    const err = new ApiError(404, 'Not Found')
    expect(err.message).toContain('404')
  })
})

describe('NotEnoughFitHorsesError', () => {
  it('stores fitCount and required on the instance (happy)', () => {
    const err = new NotEnoughFitHorsesError(10, 15)
    expect(err.fitCount).toBe(10)
    expect(err.required).toBe(15)
  })

  it('is an Error with name "NotEnoughFitHorsesError" (edge — instanceof + name)', () => {
    const err = new NotEnoughFitHorsesError(0, 15)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(NotEnoughFitHorsesError)
    expect(err.name).toBe('NotEnoughFitHorsesError')
  })

  it('message includes both counts (sad — a stub that only stored fields would leave message blank)', () => {
    const err = new NotEnoughFitHorsesError(7, 15)
    expect(err.message).toContain('7')
    expect(err.message).toContain('15')
  })
})
