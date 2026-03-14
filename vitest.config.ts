import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@ksc/grammar': path.resolve(__dirname, './libs/grammar'),
      '@ksc/evaluation': path.resolve(__dirname, './libs/evaluation'),
      '@ksc/behavior': path.resolve(__dirname, './libs/behavior'),
      '@ksc/ag-ports': path.resolve(__dirname, './libs/ag-ports/src/index.ts'),
      '@ksc/analysis-ts-kind-checking': path.resolve(__dirname, './libs/analyses/ts-kind-checking/src/index.ts'),
      '@ksc/analysis-eslint-equiv': path.resolve(__dirname, './libs/analyses/eslint-equiv/src/index.ts'),
      '@ksc/analysis-mock': path.resolve(__dirname, './libs/analyses/mock/src/index.ts'),
      '@ksc/language-ts-ast': path.resolve(__dirname, './libs/languages/ts-ast/src'),
      '@ksc/language-mock': path.resolve(__dirname, './libs/languages/mock/src'),
      'ksc': path.resolve(__dirname, './packages/ksc'),
      '@ksc/kinds': path.resolve(__dirname, './libs/kinds/src/index.ts'),
      '@ksc/types': path.resolve(__dirname, './libs/types/src/index.ts'),
      '@ksc/user-config': path.resolve(__dirname, './libs/user-config/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    maxConcurrency: 10,
    poolOptions: {
      forks: { maxForks: 5 },
    },
  },
});
