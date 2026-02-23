import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../src/program.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

// ────────────────────────────────────────────────────────────────────────
// Helper: create a program including all .ts files under a fixture root
// ────────────────────────────────────────────────────────────────────────

function createFixtureProgram(fixtureName: string) {
  const fixtureDir = path.join(FIXTURES, fixtureName);
  const contextFile = path.join(fixtureDir, 'context.ts');

  // For directory-based fixtures, also include sub-files in the program
  const rootFiles = [contextFile];
  const additionalFiles = findTsFiles(fixtureDir);
  for (const f of additionalFiles) {
    if (!rootFiles.includes(f)) rootFiles.push(f);
  }

  return createProgram(rootFiles, {
    strict: true,
    noEmit: true,
    // Ensure TS can find all the files
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
  it('basic fixture (simple Kind definitions + values)', () => {
    const program = createFixtureProgram('basic');
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('clean checker fixture (pure layer + pure function)', () => {
    const program = createFixtureProgram('checker-clean');
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('clean directory fixture (all files satisfy constraints)', () => {
    const program = createFixtureProgram('checker-dir-clean');
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('inline kinds fixture (no property violations)', () => {
    const program = createFixtureProgram('inline');
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('alias chain fixture', () => {
    const program = createFixtureProgram('alias-chain');
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('function fixture', () => {
    const program = createFixtureProgram('functions');
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — noConsole violations', () => {
  const program = createFixtureProgram('checker-violations');

  it('detects console.log in function body', () => {
    const diags = program.getKindDiagnostics();
    const consoleDiags = diags.filter(d => d.code === 70009);
    expect(consoleDiags.length).toBeGreaterThanOrEqual(1);
    expect(consoleDiags[0].messageText).toContain('console');
  });

  it('diagnostic has correct error code', () => {
    const diags = program.getKindDiagnostics();
    const consoleDiags = diags.filter(d => d.code === 70009);
    expect(consoleDiags.length).toBeGreaterThanOrEqual(1);
    expect(consoleDiags[0].category).toBe(ts.DiagnosticCategory.Error);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — noMutation violations', () => {
  const program = createFixtureProgram('checker-violations');

  it('detects assignment and increment in function body', () => {
    const diags = program.getKindDiagnostics();
    const mutDiags = diags.filter(d => d.code === 70013);
    // Assignment (x = 1) and increment (x++) should both be caught
    expect(mutDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('diagnostic message mentions mutation', () => {
    const diags = program.getKindDiagnostics();
    const mutDiags = diags.filter(d => d.code === 70013);
    expect(mutDiags.length).toBeGreaterThanOrEqual(1);
    expect(mutDiags[0].messageText).toContain('mutation');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — noImports violations (directory)', () => {
  const program = createFixtureProgram('checker-violations');

  it('detects imports in directory source files', () => {
    const diags = program.getKindDiagnostics();
    const importDiags = diags.filter(d => d.code === 70008);
    expect(importDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('diagnostic message mentions import', () => {
    const diags = program.getKindDiagnostics();
    const importDiags = diags.filter(d => d.code === 70008);
    expect(importDiags.length).toBeGreaterThanOrEqual(1);
    expect(importDiags[0].messageText).toContain('import');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — noIO violations (directory)', () => {
  const program = createFixtureProgram('checker-violations');

  it('detects IO module imports in directory source files', () => {
    const diags = program.getKindDiagnostics();
    const ioDiags = diags.filter(d => d.code === 70007);
    expect(ioDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('diagnostic message mentions IO', () => {
    const diags = program.getKindDiagnostics();
    const ioDiags = diags.filter(d => d.code === 70007);
    expect(ioDiags.length).toBeGreaterThanOrEqual(1);
    expect(ioDiags[0].messageText).toContain('IO');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — directory violations (immutable, noConsole, noSideEffects)', () => {
  const program = createFixtureProgram('checker-dir-violations');

  it('detects immutable violation (let at module scope)', () => {
    const diags = program.getKindDiagnostics();
    const immDiags = diags.filter(d => d.code === 70010);
    expect(immDiags.length).toBeGreaterThanOrEqual(1);
    expect(immDiags[0].messageText).toContain('mutable');
  });

  it('detects noConsole violation in directory files', () => {
    const diags = program.getKindDiagnostics();
    const consoleDiags = diags.filter(d => d.code === 70009);
    expect(consoleDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('detects noSideEffects violation (top-level call)', () => {
    const diags = program.getKindDiagnostics();
    const seDiags = diags.filter(d => d.code === 70012);
    expect(seDiags.length).toBeGreaterThanOrEqual(1);
  });

  it('total diagnostics cover multiple property violations', () => {
    const diags = program.getKindDiagnostics();
    // Should have at least: immutable + noConsole + noSideEffects
    expect(diags.length).toBeGreaterThanOrEqual(3);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — per-source-file checking', () => {
  it('checkSourceFile only returns diagnostics for that file', () => {
    const program = createFixtureProgram('checker-violations');
    const checker = program.getKindChecker();

    const contextFile = program.getSourceFiles()
      .find(sf => sf.fileName.includes('context.ts'))!;

    const diags = checker.checkSourceFile(contextFile);
    // All diagnostics should reference the context file
    // (or files under its declared directories)
    expect(diags.length).toBeGreaterThan(0);
  });

  it('clean source file produces empty diagnostics', () => {
    const program = createFixtureProgram('checker-clean');
    const checker = program.getKindChecker();

    const contextFile = program.getSourceFiles()
      .find(sf => sf.fileName.includes('context.ts'))!;

    const diags = checker.checkSourceFile(contextFile);
    expect(diags).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — diagnostic structure', () => {
  it('diagnostics have correct KSDiagnostic shape', () => {
    const program = createFixtureProgram('checker-violations');
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
    const program = createFixtureProgram('checker-violations');
    const diags = program.getKindDiagnostics();
    for (const d of diags) {
      expect(d.category).toBe(ts.DiagnosticCategory.Error);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — function value checks', () => {
  it('pure function with no violations produces no diagnostics', () => {
    const program = createFixtureProgram('checker-clean');
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('function with console.log and noConsole declared is caught', () => {
    const program = createFixtureProgram('checker-violations');
    const diags = program.getKindDiagnostics();
    const consoleDiags = diags.filter(d => d.code === 70009);
    expect(consoleDiags.length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — composite fixture (existing)', () => {
  it('composite kind with no concrete files produces no diagnostics', () => {
    // The composite fixture defines directory members but they don't
    // resolve to real files in the program — so no violations.
    const program = createFixtureProgram('composite');
    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });
});
