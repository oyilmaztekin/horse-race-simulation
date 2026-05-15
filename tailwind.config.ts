import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        'surface-elevated': 'var(--color-surface-elevated)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        header: 'var(--color-header)',
        'header-text': 'var(--color-header-text)',
        'header-accent': 'var(--color-header-accent)',
        'roster-header': 'var(--color-roster-header)',
        'program-header': 'var(--color-program-header)',
        'results-header': 'var(--color-results-header)',
        track: 'var(--color-track)',
        'track-alt': 'var(--color-track-lane-alt)',
        'track-line': 'var(--color-track-line)',
        accent: 'var(--color-current)',
        'accent-bg': 'var(--color-current-bg)',
        'warning-bg': 'var(--color-warning-bg)',
        'warning-border': 'var(--color-warning-border)',
        'warning-text': 'var(--color-warning-text)',
        finish: 'var(--color-finish)',
        primary: 'var(--color-primary)',
        'primary-text': 'var(--color-primary-text)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
      },
      fontFamily: {
        sans: 'var(--font-body)',
        body: 'var(--font-body)',
        racing: 'var(--font-racing)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius-2)',
        sm: 'var(--radius-1)',
        lg: 'var(--radius-3)',
        pill: 'var(--radius-pill)',
      },
      spacing: {
        s1: 'var(--space-1)',
        s2: 'var(--space-2)',
        s3: 'var(--space-3)',
        s4: 'var(--space-4)',
        s5: 'var(--space-5)',
        s6: 'var(--space-6)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        current: 'var(--shadow-current)',
        finish: 'var(--shadow-finish)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}

export default config
