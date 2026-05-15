import { expect, test } from '@playwright/test'
import {
  HORSE_COUNT,
  LANE_COUNT,
  MIN_FIT_HORSES_FOR_PROGRAM,
  MIN_RACEABLE_CONDITION,
  ROUND_COUNT,
} from '../../src/domain/constants'

test('happy path: roster → (rest if needed) → generate → start → 6 rounds finish', async ({ page }) => {
  test.setTimeout(360_000)

  await page.goto('/')

  await expect(page.getByTestId('phase-indicator')).toHaveText('state:INITIAL')
  await expect(page.locator('.horse-list-item')).toHaveCount(HORSE_COUNT)

  await page.getByTestId('btn-generate').click()

  const warning = page.getByTestId('warning')
  if (await warning.isVisible().catch(() => false)) {
    await expect(warning).toContainText(`${MIN_FIT_HORSES_FOR_PROGRAM}`)
    await expect(page.getByTestId('btn-rest')).toBeVisible()

    await page.getByTestId('btn-rest').click()
    await expect(page.getByTestId('phase-indicator')).toHaveText('state:RESTING', { timeout: 5_000 })
    await expect(page.getByTestId('countdown')).toBeVisible()
    await expect(page.getByTestId('btn-generate')).toBeDisabled()
    await expect(page.getByTestId('btn-start')).toBeDisabled()
    await expect(page.getByTestId('btn-rest')).toBeDisabled()

    await expect(page.getByTestId('phase-indicator')).toHaveText('state:INITIAL', { timeout: 30_000 })

    const conditions = await page.locator('.horse-list-item__condition').allTextContents()
    for (const value of conditions) {
      expect(Number(value)).toBeGreaterThanOrEqual(MIN_RACEABLE_CONDITION)
    }

    await page.getByTestId('btn-generate').click()
  }

  await expect(page.getByTestId('phase-indicator')).toHaveText('state:READY')
  await expect(page.locator('.program-round-card')).toHaveCount(ROUND_COUNT)
  await expect(page.locator('.program-round-card__entry')).toHaveCount(LANE_COUNT * ROUND_COUNT)
  await expect(page.locator('.ranking-row')).toHaveCount(0)

  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('phase-indicator')).toHaveText('state:RACING', { timeout: 5_000 })

  const speedUp = page.getByTestId('race-track-speed-increase')
  await speedUp.waitFor({ state: 'visible' })
  for (let click = 0; click < 4; click++) {
    if (await speedUp.isEnabled()) await speedUp.click()
  }
  await expect(page.getByTestId('race-track-speed-readout')).toContainText('4×')
  await expect(speedUp).toBeDisabled()

  await expect(page.locator('.ranking-row').first()).toBeVisible({ timeout: 90_000 })

  await expect(page.getByTestId('phase-indicator')).toHaveText('state:FINISHED', { timeout: 300_000 })

  await expect(page.locator('.result-round-card__row')).toHaveCount(LANE_COUNT * ROUND_COUNT)
  await expect(page.locator('.ranking-row')).toHaveCount(LANE_COUNT * ROUND_COUNT)

  const firstCardPositions = page.locator('.result-round-card').first().locator('.ranking-row__position')
  await expect(firstCardPositions).toHaveCount(LANE_COUNT)
  expect(await firstCardPositions.allTextContents()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
})
