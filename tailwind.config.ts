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
        // Matched to Airfield_OPS_Unified_Prototype.jsx color system
        background: '#04070C',
        card: 'rgba(10,16,28,0.92)',
        'card-hover': 'rgba(10,16,28,1)',
        border: 'rgba(56,189,248,0.06)',
        'border-active': 'rgba(56,189,248,0.2)',
        accent: '#38BDF8',       // sky-400 — primary accent
        'accent-bg': '#0EA5E9',  // sky-500 — button gradient end
        'accent-dark': '#0369A1', // sky-800 — button gradient start
        muted: {
          DEFAULT: '#94A3B8',    // t2 — secondary text
          dark: '#64748B',       // t3 — tertiary text
          darker: '#334155',     // t4 — borders, inactive
        },
        success: '#34D399',      // emerald-400
        danger: '#EF4444',       // red-500
        warning: '#FBBF24',      // amber-400
        orange: '#F97316',       // orange-500
        purple: '#A78BFA',       // violet-400
        cyan: '#22D3EE',         // cyan-400
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
