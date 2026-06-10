import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
    // The original lib tests (scheduler/streakCalc/prCalc/securityGuards) are
    // plain Node scripts using console.log/process.exit, not describe/it — run
    // those with `node src/lib/<name>.test.js`. Newer lib tests written for
    // vitest (e.g. syncMerge) are picked up here.
    exclude: [
      '**/node_modules/**',
      'src/lib/scheduler.test.js',
      'src/lib/streakCalc.test.js',
      'src/lib/prCalc.test.js',
      'src/lib/securityGuards.test.js',
    ],
    include: [
      'src/components/**/*.test.{js,jsx,ts,tsx}',
      'src/lib/**/*.test.{js,jsx}',
    ],
  },
})
