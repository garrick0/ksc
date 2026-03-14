import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram, createProgramFromTSProgram } from 'ksc/ts-kind-checking';
import { FIXTURES, buildProgram, buildProgramBare, getRootFiles } from '../helpers/fixtures.js';

describe('createProgram', () => {
  it('provides compilation units for source files', () => {
    const program = buildProgram('kind-basic');
    const units = program.getCompilationUnits();
    expect(units.length).toBeGreaterThan(0);
    expect(units.find(cu => cu.fileName.includes('math.ts'))).toBeDefined();
  });

  it('finds kind definitions from source files', () => {
    const program = buildProgramBare('kind-basic');
    const names = program.getKindDefinitions().map(d => d.name);
    expect(names).toContain('NoImports');
  });

  it('getDiagnostics detects violations with correct metadata', () => {
    const program = buildProgram('kind-violations');
    const diagnostics = program.getDiagnostics();
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].kindName).toBe('NoImports');
    expect(diagnostics[0].property).toBe('noImports');
  });

  it('works with files that have no kinds', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const program = createProgram([file]);
    expect(program.getKindDefinitions()).toEqual([]);
  });
});

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
