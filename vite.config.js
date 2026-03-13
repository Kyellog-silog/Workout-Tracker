import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
    // Exclude plain Node.js test files (scheduler, streakCalc, prCalc)
    // that use console.log/process.exit instead of describe/it
    exclude: ['**/node_modules/**', 'src/lib/*.test.js'],
    include: ['src/components/**/*.test.{js,jsx,ts,tsx}'],
  },
})
