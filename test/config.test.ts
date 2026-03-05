import { describe, it, expect } from 'vitest';
import { defineConfig } from '../src/api/config.js';

describe('defineConfig', () => {
  it('returns the same config object', () => {
    const config = { strict: true };
    const result = defineConfig(config);
    expect(result).toBe(config);
  });

  it('accepts an empty config', () => {
    const config = defineConfig({});
    expect(config).toEqual({});
  });

  it('accepts include/exclude patterns', () => {
    const config = defineConfig({
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    });
    expect(config.include).toEqual(['src/**/*.ts']);
    expect(config.exclude).toEqual(['**/*.test.ts']);
  });
});
