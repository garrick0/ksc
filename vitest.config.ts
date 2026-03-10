import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/codegen/codegen-mock.test.ts'],
    poolOptions: {
      forks: { maxForks: 5 },
    },
  },
});
