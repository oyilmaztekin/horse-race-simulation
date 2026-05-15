import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { HORSE_COUNT } from '../../domain/constants'
import type { Horse } from '../../domain/types'
import ErrorBanner from '../ErrorBanner.vue'
import { useHorsesStore } from '../../stores/horses'

function makeHorses(): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_: unknown, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: 60,
  }))
}

function mountBanner(initialHorses: Partial<{ horses: Horse[]; isLoading: boolean; error: Error | null }>) {
  return mount(ErrorBanner, {
    global: {
      plugins: [
        createTestingPinia({
          stubActions: false,
          initialState: {
            horses: {
              horses: initialHorses.horses ?? [],
              isLoading: initialHorses.isLoading ?? false,
              error: initialHorses.error ?? null,
            },
          },
        }),
      ],
    },
  })
}

describe('ErrorBanner', () => {
  it('shows the banner with the error message and a Retry button when horses.error is set (happy)', async () => {
    const wrapper = mountBanner({ horses: [], error: new Error('network offline') })
    const banner = wrapper.find('[data-testid="error-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('network offline')
    expect(wrapper.find('[data-testid="btn-retry"]').exists()).toBe(true)
  })

  it('shows the banner when the roster is empty and not loading even without an error (edge)', () => {
    const wrapper = mountBanner({ horses: [], isLoading: false, error: null })
    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(true)
  })

  it('is hidden when the roster is loaded and there is no error (sad: a stub always-rendering would fail)', () => {
    const wrapper = mountBanner({ horses: makeHorses(), isLoading: false, error: null })
    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(false)
  })

  it('dispatches horses.fetchAll when Retry is clicked (action wiring)', async () => {
    const wrapper = mountBanner({ horses: [], error: new Error('boom') })
    const horses = useHorsesStore()
    horses.fetchAll = (async () => {}) as typeof horses.fetchAll
    const spy = vi.spyOn(horses, 'fetchAll')
    await wrapper.find('[data-testid="btn-retry"]').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

