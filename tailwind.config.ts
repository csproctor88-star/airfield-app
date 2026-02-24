import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        card: 'var(--color-bg-surface)',
        'card-hover': 'var(--color-bg-surface-solid)',
        border: 'var(--color-border)',
        'border-active': 'var(--color-border-active)',
        accent: 'var(--color-accent)',
        'accent-bg': 'var(--color-accent-secondary)',
        'accent-dark': 'var(--color-accent-dark)',
        muted: {
          DEFAULT: 'var(--color-text-2)',
          dark: 'var(--color-text-3)',
          darker: 'var(--color-text-4)',
        },
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        warning: 'var(--color-warning)',
        orange: 'var(--color-orange)',
        purple: 'var(--color-purple)',
        cyan: 'var(--color-cyan)',
      },
      fontFamily: {
        sans: [
          'Outfit', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      borderRadius: {
        card: '10px',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1' }],    // 10px — labels
        '3xs': ['0.5rem', { lineHeight: '1' }],       // 8px — tiny
      },
    },
  },
  plugins: [],
}

export default config
