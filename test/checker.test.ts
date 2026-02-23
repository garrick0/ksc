import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../src/program.js';
import { defineConfig } from '../src/config.js';
import type { KindScriptConfig } from '../src/config.js';
import type { KSProgram } from '../src/types.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

// ────────────────────────────────────────────────────────────────────────
// Helper: create a program from a fixture directory with a config
// ────────────────────────────────────────────────────────────────────────

function createFixtureProgram(fixtureName: string, config: KindScriptConfig): KSProgram {
  const fixtureDir = path.join(FIXTURES, fixtureName);
  const rootFiles = findTsFiles(fixtureDir);

  return createProgram(rootFiles, config, {
    strict: true,
    noEmit: true,
    rootDir: fixtureDir,
  });
}

/** Recursively find all .ts files in a directory. */
function findTsFiles(dir: string): string[] {
  const fs = require('fs') as typeof import('fs');
  const results: string[] = [];

  function walk(d: string) {
    let entries: string[];
    try {
      entries = fs.readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.ts')) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

// ────────────────────────────────────────────────────────────────────────

describe('checker — clean fixtures produce zero diagnostics', () => {
  it('clean checker fixture (pure directory + pure function file)', () => {
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { pure: true, noIO: true, noImports: true } },
      pureFuncFile: { path: './src/funcs/pure-func.ts', rules: { noMutation: true, noConsole: true } },
    });
    const program = createFixtureProgram('checker-clean', config);
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('clean directory fixture (all files satisfy constraints)', () => {
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true, immutable: true, noSideEffects: true } },
    });
    const program = createFixtureProgram('checker-dir-clean', config);
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('empty config produces no diagnostics', () => {
    const config = defineConfig({});
    const program = createFixtureProgram('checker-clean', config);
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('config targeting non-existent directory produces no diagnostics', () => {
    const config = defineConfig({
      phantom: { path: './src/does-not-exist', rules: { noConsole: true } },
    });
    const program = createFixtureProgram('checker-clean', config);
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — noConsole violations', () => {
  const config = defineConfig({
    noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
    noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
    domain: { path: './src/domain', rules: { noImports: true } },
    infra: { path: './src/infra', rules: { noIO: true } },
  });

  it('detects console.log in source file', () => {
    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    const consoleDiags = diags.filter(d => d.code === 70009);
    expect(consoleDiags.length).toBeGreaterThanOrEqual(1);
    expect(consoleDiags[0].messageText).toContain('console');
  });

  it('diagnostic has correct error code', () => {
    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    const consoleDiags = diags.filter(d => d.code === 70009);
    expect(consoleDiags.length).toBeGreaterThanOrEqual(1);
    expect(consoleDiags[0].category).toBe(ts.DiagnosticCategory.Error);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — noMutation violations', () => {
  const config = defineConfig({
    noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
    noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
    domain: { path: './src/domain', rules: { noImports: true } },
    infra: { path: './src/infra', rules: { noIO: true } },
  });

  it('detects assignment and increment in source file', () => {
    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    const mutDiags = diags.filter(d => d.code === 70013);
    // Assignment (x = 1) and increment (x++) should both be caught
    expect(mutDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('diagnostic message mentions mutation', () => {
    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    const mutDiags = diags.filter(d => d.code === 70013);
    expect(mutDiags.length).toBeGreaterThanOrEqual(1);
    expect(mutDiags[0].messageText).toContain('mutation');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — noImports violations (directory)', () => {
  const config = defineConfig({
    noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
    noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
    domain: { path: './src/domain', rules: { noImports: true } },
    infra: { path: './src/infra', rules: { noIO: true } },
  });

  it('detects imports in directory source files', () => {
    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    const importDiags = diags.filter(d => d.code === 70008);
    expect(importDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('diagnostic message mentions import', () => {
    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    const importDiags = diags.filter(d => d.code === 70008);
    expect(importDiags.length).toBeGreaterThanOrEqual(1);
    expect(importDiags[0].messageText).toContain('import');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — noIO violations (directory)', () => {
  const config = defineConfig({
    noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
    noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
    domain: { path: './src/domain', rules: { noImports: true } },
    infra: { path: './src/infra', rules: { noIO: true } },
  });

  it('detects IO module imports in directory source files', () => {
    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    const ioDiags = diags.filter(d => d.code === 70007);
    expect(ioDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('diagnostic message mentions IO', () => {
    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    const ioDiags = diags.filter(d => d.code === 70007);
    expect(ioDiags.length).toBeGreaterThanOrEqual(1);
    expect(ioDiags[0].messageText).toContain('IO');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — directory violations (immutable, noConsole, noSideEffects)', () => {
  const config = defineConfig({
    impureDir: {
      path: './src/impure',
      rules: { noConsole: true, immutable: true, noSideEffects: true, static: true },
    },
  });

  it('detects immutable violation (let at module scope)', () => {
    const program = createFixtureProgram('checker-dir-violations', config);
    const diags = program.getKindDiagnostics();
    const immDiags = diags.filter(d => d.code === 70010);
    expect(immDiags.length).toBeGreaterThanOrEqual(1);
    expect(immDiags[0].messageText).toContain('mutable');
  });

  it('detects noConsole violation in directory files', () => {
    const program = createFixtureProgram('checker-dir-violations', config);
    const diags = program.getKindDiagnostics();
    const consoleDiags = diags.filter(d => d.code === 70009);
    expect(consoleDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('detects noSideEffects violation (top-level call)', () => {
    const program = createFixtureProgram('checker-dir-violations', config);
    const diags = program.getKindDiagnostics();
    const seDiags = diags.filter(d => d.code === 70012);
    expect(seDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('total diagnostics cover multiple property violations', () => {
    const program = createFixtureProgram('checker-dir-violations', config);
    const diags = program.getKindDiagnostics();
    // Should have at least: immutable + noConsole + noSideEffects
    expect(diags.length).toBeGreaterThanOrEqual(3);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — per-source-file checking', () => {
  it('checkSourceFile only returns diagnostics for that file', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
      infra: { path: './src/infra', rules: { noIO: true } },
    });

    const program = createFixtureProgram('checker-violations', config);
    const checker = program.getKindChecker();

    const noConsoleFile = program.getSourceFiles()
      .find(sf => sf.fileName.includes('no-console.ts'))!;

    const diags = checker.checkSourceFile(noConsoleFile);
    expect(diags.length).toBeGreaterThan(0);
    // All diagnostics should reference the no-console file
    for (const d of diags) {
      expect(d.file.fileName).toBe(noConsoleFile.fileName);
    }
  });

  it('clean source file produces empty diagnostics', () => {
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true, immutable: true } },
    });
    const program = createFixtureProgram('checker-clean', config);
    const checker = program.getKindChecker();

    const mathFile = program.getSourceFiles()
      .find(sf => sf.fileName.includes('math.ts'))!;

    const diags = checker.checkSourceFile(mathFile);
    expect(diags).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — diagnostic structure', () => {
  it('diagnostics have correct KSDiagnostic shape', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      noMutationFile: { path: './src/funcs/no-mutation.ts', rules: { noMutation: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
      infra: { path: './src/infra', rules: { noIO: true } },
    });

    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();

    expect(diags.length).toBeGreaterThan(0);

    for (const d of diags) {
      expect(d).toHaveProperty('file');
      expect(d).toHaveProperty('start');
      expect(d).toHaveProperty('length');
      expect(d).toHaveProperty('messageText');
      expect(d).toHaveProperty('category');
      expect(d).toHaveProperty('code');
      expect(typeof d.start).toBe('number');
      expect(typeof d.length).toBe('number');
      expect(d.start).toBeGreaterThanOrEqual(0);
      expect(d.length).toBeGreaterThan(0);
      expect(d.code).toBeGreaterThanOrEqual(70001);
      expect(d.code).toBeLessThanOrEqual(70015);
    }
  });

  it('diagnostics have Error category', () => {
    const config = defineConfig({
      noConsoleFile: { path: './src/funcs/no-console.ts', rules: { noConsole: true } },
      domain: { path: './src/domain', rules: { noImports: true } },
    });

    const program = createFixtureProgram('checker-violations', config);
    const diags = program.getKindDiagnostics();
    for (const d of diags) {
      expect(d.category).toBe(ts.DiagnosticCategory.Error);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — composite targets', () => {
  it('composite kind with no concrete files produces no diagnostics', () => {
    const config = defineConfig({
      app: {
        members: {
          domain: { path: './src/domain', rules: { pure: true, noIO: true } },
          infrastructure: { path: './src/infrastructure' },
          application: { path: './src/application', rules: { noConsole: true } },
        },
        rules: {
          noDependency: [['domain', 'infrastructure'], ['domain', 'application']],
          noCycles: ['domain', 'infrastructure', 'application'],
        },
      },
    });
    // Use checker-clean which doesn't have domain/infrastructure/application dirs
    const program = createFixtureProgram('checker-clean', config);
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });
});
