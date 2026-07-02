import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup-env.ts'],
    // Coverage is opt-in (`npm run test:coverage`) so the default `vitest run`
    // stays fast. Reports lib/ + app logic; excludes generated types, config,
    // and test files. No thresholds yet — first we measure, then we ratchet.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['lib/**', 'app/**', 'components/**', 'hooks/**'],
      exclude: [
        'lib/supabase/types.ts',
        '**/*.d.ts',
        '**/*.config.*',
        'tests/**',
      ],
    },
  },
})
