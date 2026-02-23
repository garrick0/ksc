import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { createProgram } from '../src/program.js';
import { defineConfig } from '../src/config.js';
import { exportDashboardData } from '../src/export.js';
import type { KindScriptConfig } from '../src/config.js';
import type { KSProgram } from '../src/types.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function createFixtureProgram(fixtureName: string, config: KindScriptConfig): KSProgram {
  const fixtureDir = path.join(FIXTURES, fixtureName);
  const rootFiles = findTsFiles(fixtureDir);

  return createProgram(rootFiles, config, {
    strict: true,
    noEmit: true,
    rootDir: fixtureDir,
  });
}

function findTsFiles(dir: string): string[] {
  const fs = require('fs') as typeof import('fs');
  const results: string[] = [];
  function walk(d: string) {
    let entries: string[];
    try { entries = fs.readdirSync(d); } catch { return; }
    for (const entry of entries) {
      const full = path.join(d, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.ts')) results.push(full);
    }
  }
  walk(dir);
  return results;
}

// ────────────────────────────────────────────────────────────────────────

describe('exportDashboardData — structure', () => {
  it('returns correct top-level shape', () => {
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true } },
    });
    const program = createFixtureProgram('checker-clean', config);
    const data = exportDashboardData(program, { root: '/test' });

    expect(data.version).toBe(1);
    expect(data.project.root).toBe('/test');
    expect(data.project.generatedAt).toBeTruthy();
    expect(data.project.rootFiles.length).toBeGreaterThan(0);
    expect(data.parse).toBeDefined();
    expect(data.bind).toBeDefined();
    expect(data.check).toBeDefined();
  });

  it('parse stage lists source files with declarations', () => {
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true } },
    });
    const program = createFixtureProgram('checker-clean', config);
    const data = exportDashboardData(program);

    expect(data.parse.sourceFiles.length).toBeGreaterThan(0);
    for (const sf of data.parse.sourceFiles) {
      expect(sf.fileName).toBeTruthy();
      expect(sf.lineCount).toBeGreaterThan(0);
      expect(Array.isArray(sf.declarations)).toBe(true);
    }
  });

  it('parse stage includes source text when requested', () => {
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true } },
    });
    const program = createFixtureProgram('checker-clean', config);
    const withSource = exportDashboardData(program, { includeSource: true });
    const withoutSource = exportDashboardData(program);

    const sfWith = withSource.parse.sourceFiles[0];
    const sfWithout = withoutSource.parse.sourceFiles[0];

    expect(sfWith.source).toBeTruthy();
    expect(sfWithout.source).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('exportDashboardData — bind stage', () => {
  it('lists all kind symbols with unique IDs', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
      infra: { path: './src/infra', rules: { noIO: true } },
    });
    const program = createFixtureProgram('checker-violations', config);
    const data = exportDashboardData(program);

    expect(data.bind.symbols.length).toBeGreaterThan(0);
    const ids = data.bind.symbols.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('symbols have required fields', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
    });
    const program = createFixtureProgram('checker-violations', config);
    const data = exportDashboardData(program);

    for (const sym of data.bind.symbols) {
      expect(sym.id).toBeTruthy();
      expect(sym.name).toBeTruthy();
      expect(sym.declaredProperties).toBeDefined();
    }
  });

  it('directory values have path', () => {
    const config = defineConfig({
      domain: { path: './src/domain', rules: { noImports: true } },
      infra: { path: './src/infra', rules: { noIO: true } },
    });
    const program = createFixtureProgram('checker-violations', config);
    const data = exportDashboardData(program);

    const dirValues = data.bind.symbols.filter(s => s.valueKind === 'directory');
    for (const sym of dirValues) {
      expect(sym.path).toBeTruthy();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('exportDashboardData — check stage', () => {
  it('reports diagnostics for violation fixtures', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
      infra: { path: './src/infra', rules: { noIO: true } },
    });
    const program = createFixtureProgram('checker-violations', config);
    const data = exportDashboardData(program);

    expect(data.check.diagnostics.length).toBeGreaterThan(0);
  });

  it('diagnostics have line/column', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
    });
    const program = createFixtureProgram('checker-violations', config);
    const data = exportDashboardData(program);

    for (const d of data.check.diagnostics) {
      expect(d.line).toBeGreaterThanOrEqual(1);
      expect(d.column).toBeGreaterThanOrEqual(1);
      expect(d.property).toBeTruthy();
      expect(d.code).toBeGreaterThanOrEqual(70001);
    }
  });

  it('clean fixtures have zero diagnostics', () => {
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true, immutable: true } },
      pureFuncFile: { path: './src/funcs/pure-func.ts', rules: { noMutation: true, noConsole: true } },
    });
    const program = createFixtureProgram('checker-clean', config);
    const data = exportDashboardData(program);

    expect(data.check.diagnostics).toEqual([]);
    expect(data.check.summary.totalDiagnostics).toBe(0);
  });

  it('summary aggregates are consistent', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
      infra: { path: './src/infra', rules: { noIO: true } },
    });
    const program = createFixtureProgram('checker-violations', config);
    const data = exportDashboardData(program);
    const s = data.check.summary;

    expect(s.totalDiagnostics).toBe(data.check.diagnostics.length);
    expect(s.totalFiles).toBeGreaterThan(0);
    expect(s.totalSymbols).toBe(data.bind.symbols.length);
    expect(s.cleanFiles + s.violatingFiles).toBeLessThanOrEqual(s.totalFiles);
  });

  it('byProperty has entries for violated properties', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
      infra: { path: './src/infra', rules: { noIO: true } },
    });
    const program = createFixtureProgram('checker-violations', config);
    const data = exportDashboardData(program);

    const violatedProps = new Set(data.check.diagnostics.map(d => d.property));
    for (const prop of violatedProps) {
      expect(data.check.summary.byProperty[prop]).toBeDefined();
      expect(data.check.summary.byProperty[prop].violations).toBeGreaterThan(0);
    }
  });
});
