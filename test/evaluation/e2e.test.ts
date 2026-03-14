/**
 * End-to-end tests for the KindScript compiler.
 *
 * Tests the full pipeline: createProgram → getKindDefinitions / getDiagnostics
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram, createProgramFromTSProgram } from 'ksc/ts-kind-checking';
import { FIXTURES, buildProgram, getRootFiles } from '../helpers/fixtures.js';

describe('e2e — kind-basic (clean, type-only imports)', () => {
  it('finds kind definitions and produces 0 diagnostics', () => {
    const program = buildProgram('kind-basic');
    const defs = program.getKindDefinitions();
    expect(defs.length).toBeGreaterThan(0);
    expect(defs.map(d => d.name)).toContain('NoImports');
    expect(program.getDiagnostics()).toEqual([]);
  });
});

describe('e2e — kind-violations', () => {
  it('detects violation with correct metadata, does not flag clean.ts', () => {
    const program = buildProgram('kind-violations');
    const diagnostics = program.getDiagnostics();
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);

    const violation = diagnostics.find(d => d.fileName.includes('violating.ts'));
    expect(violation).toBeDefined();
    expect(violation!.message).toContain('helper');
    expect(violation!.kindName).toBe('NoImports');
    expect(violation!.property).toBe('noImports');
    expect(violation!.end).toBeGreaterThan(violation!.pos);

    expect(diagnostics.filter(d => d.fileName.includes('clean.ts'))).toEqual([]);
  });
});

describe('e2e — checker edge cases (no-violation)', () => {
  it('param shadow, nested shadow, local shadow, no annotation, type-only imports, destructured: all clean', () => {
    const program = buildProgram('checker-edges');
    const diags = program.getDiagnostics();
    for (const file of [
      'param-shadow.ts', 'nested-shadow.ts', 'local-shadow.ts',
      'no-annotation.ts', 'type-only-import.ts',
      'destructured-param.ts', 'destructured-local.ts', 'array-destructured.ts',
    ]) {
      expect(diags.filter(d => d.fileName.includes(file))).toEqual([]);
    }
  });
});

describe('e2e — checker edge cases (violations)', () => {
  it('nested function referencing import + multiple imports: flags correctly', () => {
    const program = buildProgram('checker-edges');
    const diags = program.getDiagnostics();

    const nested = diags.filter(d => d.fileName.includes('nested-violation.ts'));
    expect(nested.length).toBeGreaterThanOrEqual(1);
    expect(nested[0].message).toContain('helper');

    const multi = diags.filter(d => d.fileName.includes('multiple-imports.ts'));
    expect(multi.map(d => d.message).some(m => m.includes('helper'))).toBe(true);
    expect(multi.map(d => d.message).some(m => m.includes('other'))).toBe(true);
    expect(multi.length).toBe(2);
  });
});

describe('e2e — createProgramFromTSProgram integration', () => {
  it('produces same diagnostics as createProgram', () => {
    const rootFiles = getRootFiles('kind-violations');
    const fromCreate = buildProgram('kind-violations');
    const fromTS = createProgramFromTSProgram(ts.createProgram(rootFiles, { strict: true, noEmit: true }));

    expect(fromCreate.getDiagnostics().map(d => d.message).sort())
      .toEqual(fromTS.getDiagnostics().map(d => d.message).sort());
  });
});

describe('e2e — files with no kinds at all', () => {
  it('no kinds, no violations', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const program = createProgram([file]);
    expect(program.getKindDefinitions()).toEqual([]);
    expect(program.getDiagnostics()).toEqual([]);
  });
});
