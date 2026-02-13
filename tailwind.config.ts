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
        // Dark theme from SRS Section 7.1
        background: '#0F172A',   // slate-900
        card: '#1E293B',         // slate-800
        'card-hover': '#334155', // slate-700
        border: '#334155',       // slate-700
        accent: '#38BDF8',       // sky-400
        'accent-bg': '#0EA5E9',  // sky-500
      },
      fontFamily: {
        sans: [
          'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
