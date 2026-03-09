/**
 * End-to-end tests for the KindScript compiler.
 *
 * Tests the full pipeline: createProgram → getKindDefinitions / getDiagnostics
 * using real fixtures to verify the binder + checker AG specs work together.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram, createProgramFromTSProgram } from '../app/lib/program.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

const _programCache = new Map();
function cachedProgram(fixtureDir: string) {
  if (_programCache.has(fixtureDir)) return _programCache.get(fixtureDir);
  const program = createProgram(getRootFiles(fixtureDir), undefined, {
    strict: true, noEmit: true,
  });
  _programCache.set(fixtureDir, program);
  return program;
}

// ────────────────────────────────────────────────────────────────────────

describe('e2e — kind-basic (clean, type-only imports)', () => {
  it('finds kind definitions and produces 0 diagnostics', () => {
    const program = cachedProgram('kind-basic');

    const defs = program.getKindDefinitions();
    expect(defs.length).toBeGreaterThan(0);
    expect(defs.map(d => d.name)).toContain('NoImports');

    const diagnostics = program.getDiagnostics();
    expect(diagnostics).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('e2e — kind-violations (import reference in annotated function)', () => {
  it('detects the import violation', () => {
    const program = cachedProgram('kind-violations');

    const diagnostics = program.getDiagnostics();
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);

    // Should flag `helper` in violating.ts
    const violation = diagnostics.find(d => d.fileName.includes('violating.ts'));
    expect(violation).toBeDefined();
    expect(violation!.message).toContain('helper');
    expect(violation!.kindName).toBe('NoImports');
    expect(violation!.property).toBe('noImports');
    expect(violation!.pos).toBeGreaterThanOrEqual(0);
    expect(violation!.end).toBeGreaterThan(violation!.pos);
  });

  it('does not flag clean.ts', () => {
    const program = cachedProgram('kind-violations');

    const cleanViolations = program.getDiagnostics().filter(
      d => d.fileName.includes('clean.ts'),
    );
    expect(cleanViolations).toEqual([]);
  });

  it('binder and checker work together — definitions are available', () => {
    const program = cachedProgram('kind-violations');

    expect(program.getKindDefinitions().map(d => d.name)).toContain('NoImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('e2e — checker edge cases', () => {
  it('parameter shadowing: no violation when param shadows import', () => {
    const program = cachedProgram('checker-edges');

    const paramShadow = program.getDiagnostics().filter(
      d => d.fileName.includes('param-shadow.ts'),
    );
    expect(paramShadow).toEqual([]);
  });

  it('nested function with outer param shadow: no violation', () => {
    const program = cachedProgram('checker-edges');

    const nestedShadow = program.getDiagnostics().filter(
      d => d.fileName.includes('nested-shadow.ts'),
    );
    expect(nestedShadow).toEqual([]);
  });

  it('nested function referencing import: violation detected', () => {
    const program = cachedProgram('checker-edges');

    const nestedViolation = program.getDiagnostics().filter(
      d => d.fileName.includes('nested-violation.ts'),
    );
    expect(nestedViolation.length).toBeGreaterThanOrEqual(1);
    expect(nestedViolation[0].message).toContain('helper');
  });

  it('local variable shadowing import: no violation', () => {
    const program = cachedProgram('checker-edges');

    const localShadow = program.getDiagnostics().filter(
      d => d.fileName.includes('local-shadow.ts'),
    );
    expect(localShadow).toEqual([]);
  });

  it('no annotation: no violations even with imports used', () => {
    const program = cachedProgram('checker-edges');

    const noAnnotation = program.getDiagnostics().filter(
      d => d.fileName.includes('no-annotation.ts'),
    );
    expect(noAnnotation).toEqual([]);
  });

  it('multiple imports: flags all used imports in annotated function', () => {
    const program = cachedProgram('checker-edges');

    const multiViolations = program.getDiagnostics().filter(
      d => d.fileName.includes('multiple-imports.ts'),
    );
    // Should flag both `helper` and `other` in the first function
    const violationNames = multiViolations.map(d => d.message);
    expect(violationNames.some(m => m.includes('helper'))).toBe(true);
    expect(violationNames.some(m => m.includes('other'))).toBe(true);

    // The second function `g` is clean — it only uses parameters
    // So total violations should be exactly 2 (one for each imported name)
    expect(multiViolations.length).toBe(2);
  });

  it('type-only imports: no violations', () => {
    const program = cachedProgram('checker-edges');

    const typeOnly = program.getDiagnostics().filter(
      d => d.fileName.includes('type-only-import.ts'),
    );
    expect(typeOnly).toEqual([]);
  });

  it('destructured parameter shadowing import: no violation', () => {
    const program = cachedProgram('checker-edges');

    const destructured = program.getDiagnostics().filter(
      d => d.fileName.includes('destructured-param.ts'),
    );
    expect(destructured).toEqual([]);
  });

  it('destructured local variable shadowing import: no violation', () => {
    const program = cachedProgram('checker-edges');

    const destructured = program.getDiagnostics().filter(
      d => d.fileName.includes('destructured-local.ts'),
    );
    expect(destructured).toEqual([]);
  });

  it('array-destructured parameter shadowing import: no violation', () => {
    const program = cachedProgram('checker-edges');

    const destructured = program.getDiagnostics().filter(
      d => d.fileName.includes('array-destructured.ts'),
    );
    expect(destructured).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('e2e — createProgramFromTSProgram integration', () => {
  it('produces same diagnostics as createProgram', () => {
    const rootFiles = getRootFiles('kind-violations');

    const fromCreate = cachedProgram('kind-violations');
    const tsProgram = ts.createProgram(rootFiles, { strict: true, noEmit: true });
    const fromTS = createProgramFromTSProgram(tsProgram);

    const diags1 = fromCreate.getDiagnostics();
    const diags2 = fromTS.getDiagnostics();

    expect(diags1.length).toBe(diags2.length);
    expect(diags1.map(d => d.message).sort()).toEqual(
      diags2.map(d => d.message).sort(),
    );
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('e2e — files with no kinds at all', () => {
  it('no kinds, no violations', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const program = createProgram([file]);

    expect(program.getKindDefinitions()).toEqual([]);
    expect(program.getDiagnostics()).toEqual([]);
  });
});
