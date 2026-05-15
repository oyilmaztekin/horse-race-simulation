import { expect, test } from '@playwright/test'
import { HORSE_COUNT, LANE_COUNT, ROUND_COUNT } from '../../src/domain/constants'

test('happy path: roster → (rest if needed) → generate → start → 6 rounds finish', async ({ page }) => {
  test.setTimeout(360_000)

  await page.goto('/')

  await expect(page.getByTestId('phase-indicator')).toHaveText('state:INITIAL')
  await expect(page.locator('.horse-list-item')).toHaveCount(HORSE_COUNT)

  await page.getByTestId('btn-generate').click()

  const warning = page.getByTestId('warning')
  if (await warning.isVisible().catch(() => false)) {
    await page.getByTestId('btn-rest').click()
    await expect(page.getByTestId('phase-indicator')).toHaveText('state:RESTING', { timeout: 5_000 })
    await expect(page.getByTestId('phase-indicator')).toHaveText('state:INITIAL', { timeout: 30_000 })
    await page.getByTestId('btn-generate').click()
  }

  await expect(page.getByTestId('phase-indicator')).toHaveText('state:READY')

  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('phase-indicator')).toHaveText('state:RACING', { timeout: 5_000 })

  const speedUp = page.getByTestId('race-track-speed-increase')
  await speedUp.waitFor({ state: 'visible' })
  for (let click = 0; click < 4; click++) {
    if (await speedUp.isEnabled()) await speedUp.click()
  }
  await expect(page.getByTestId('race-track-speed-readout')).toContainText('4×')

  await expect(page.getByTestId('phase-indicator')).toHaveText('state:FINISHED', { timeout: 300_000 })
  await expect(page.locator('.result-round-card__row')).toHaveCount(LANE_COUNT * ROUND_COUNT)
})
