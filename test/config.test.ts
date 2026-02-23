import { describe, it, expect } from 'vitest';
import { defineConfig, isCompositeEntry } from '../src/config.js';

describe('defineConfig', () => {
  it('returns the same config object', () => {
    const config = { domain: { path: './src/domain', rules: { pure: true as const } } };
    const result = defineConfig(config);
    expect(result).toBe(config);
  });

  it('accepts an empty config', () => {
    const config = defineConfig({});
    expect(config).toEqual({});
  });

  it('accepts composite entries', () => {
    const config = defineConfig({
      app: {
        members: {
          domain: { path: './src/domain', rules: { pure: true } },
          infra: { path: './src/infra' },
        },
        rules: {
          noDependency: [['domain', 'infra']],
        },
      },
    });
    expect(config.app).toBeDefined();
  });
});

describe('isCompositeEntry', () => {
  it('returns true for composite entries', () => {
    expect(isCompositeEntry({
      members: { a: { path: './a' } },
    })).toBe(true);
  });

  it('returns false for target entries', () => {
    expect(isCompositeEntry({
      path: './src/domain',
      rules: { pure: true },
    })).toBe(false);
  });
});
