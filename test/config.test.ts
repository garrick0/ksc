import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { defineConfig } from '../app/lib/config.js';
import { createProgram } from '../app/lib/program.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

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

describe('analysisDepth configuration', () => {
  it('parse-level: syntactic properties still detected (immutable)', () => {
    const program = createProgram(
      getRootFiles('checker-properties'),
      { analysisDepth: 'parse' },
      { strict: true, noEmit: true },
    );
    // immutable violation (let binding) is syntax-only — should still work at parse level
    const immutableViolations = program.getDiagnostics().filter(
      d => d.property === 'immutable',
    );
    expect(immutableViolations.length).toBeGreaterThanOrEqual(1);
  });

  it('parse-level: import-dependent properties NOT detected (noImports)', () => {
    const program = createProgram(
      getRootFiles('kind-violations'),
      { analysisDepth: 'parse' },
      { strict: true, noEmit: true },
    );
    // noImports depends on resolvesToImport which requires the checker —
    // at parse level, resolvesToImport is always false, so no violations
    const importViolations = program.getDiagnostics().filter(
      d => d.property === 'noImports',
    );
    expect(importViolations).toEqual([]);
  });

  it('check-level: all properties detected (default)', () => {
    const program = createProgram(
      getRootFiles('kind-violations'),
      { analysisDepth: 'check' },
      { strict: true, noEmit: true },
    );
    const importViolations = program.getDiagnostics().filter(
      d => d.property === 'noImports',
    );
    expect(importViolations.length).toBeGreaterThanOrEqual(1);
  });
});
