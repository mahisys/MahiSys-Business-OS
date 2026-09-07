import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@mahisys/shared': path.resolve(__dirname, 'core/shared/src/index.ts'),
      '@mahisys/krn-01': path.resolve(__dirname, 'core/krn-01/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
