import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram, createProgramFromTSProgram } from '../../src/application/index.js';
import { FIXTURES, buildProgram, buildProgramBare, getRootFiles } from '../helpers/fixtures.js';

// ────────────────────────────────────────────────────────────────────────

describe('createProgram', () => {
  it('creates a KSProgram with the full API', () => {
    const program = buildProgram('kind-basic');

    expect(program).toBeDefined();
    expect(program.getRootFileNames).toBeTypeOf('function');
    expect(program.getCompilationUnits).toBeTypeOf('function');
    expect(program.getKindDefinitions).toBeTypeOf('function');
    expect(program.getDiagnostics).toBeTypeOf('function');
    expect(program.getKSTree).toBeTypeOf('function');
  });

  it('provides compilation units for source files', () => {
    const program = buildProgram('kind-basic');

    const units = program.getCompilationUnits();
    expect(units.length).toBeGreaterThan(0);

    const mathFile = units.find(cu => cu.fileName.includes('math.ts'));
    expect(mathFile).toBeDefined();
  });

  it('finds kind definitions from source files', () => {
    const program = buildProgramBare('kind-basic');

    const defs = program.getKindDefinitions();
    const names = defs.map(d => d.name);
    expect(names).toContain('NoImports');
  });

  it('works with no config', () => {
    const program = buildProgramBare('kind-basic');

    expect(program.getKindDefinitions().length).toBeGreaterThan(0);
  });

  it('works with files that have no kinds', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const program = createProgram([file]);

    expect(program.getKindDefinitions()).toEqual([]);
  });

  it('getDiagnostics returns empty for clean code', () => {
    const program = buildProgram('kind-basic');

    const diagnostics = program.getDiagnostics();
    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics).toEqual([]);
  });

  it('getDiagnostics detects violations', () => {
    const program = buildProgram('kind-violations');

    const diagnostics = program.getDiagnostics();
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].kindName).toBe('NoImports');
    expect(diagnostics[0].property).toBe('noImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('createProgramFromTSProgram', () => {
  it('wraps an existing ts.Program', () => {
    const rootFiles = getRootFiles('kind-basic');
    const tsProgram = ts.createProgram(rootFiles, { strict: true });

    const ksProgram = createProgramFromTSProgram(tsProgram);

    expect(ksProgram.getRootFileNames().length).toBeGreaterThan(0);
    expect(ksProgram.getCompilationUnits().length).toBeGreaterThan(0);
    expect(ksProgram.getKSTree().root.kind).toBe('Program');
  });
});
