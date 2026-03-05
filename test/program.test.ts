import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram, createProgramFromTSProgram } from '../src/program.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

// ────────────────────────────────────────────────────────────────────────

describe('createProgram', () => {
  it('creates a KSProgram with the full API', () => {
    const rootFiles = getRootFiles('kind-basic');
    const program = createProgram(rootFiles, undefined, {
      strict: true,
      noEmit: true,
    });

    expect(program).toBeDefined();
    expect(program.getRootFileNames).toBeTypeOf('function');
    expect(program.getCompilationUnits).toBeTypeOf('function');
    expect(program.getKindDefinitions).toBeTypeOf('function');
    expect(program.getDiagnostics).toBeTypeOf('function');
    expect(program.getKSTree).toBeTypeOf('function');
  });

  it('provides compilation units for source files', () => {
    const rootFiles = getRootFiles('kind-basic');
    const program = createProgram(rootFiles, undefined, {
      strict: true,
      noEmit: true,
    });

    const units = program.getCompilationUnits();
    expect(units.length).toBeGreaterThan(0);

    const mathFile = units.find(cu => cu.fileName.includes('math.ts'));
    expect(mathFile).toBeDefined();
  });

  it('finds kind definitions from source files', () => {
    const rootFiles = getRootFiles('kind-basic');
    const program = createProgram(rootFiles);

    const defs = program.getKindDefinitions();
    const names = defs.map(d => d.name);
    expect(names).toContain('NoImports');
  });

  it('works with no config', () => {
    const rootFiles = getRootFiles('kind-basic');
    const program = createProgram(rootFiles);

    expect(program.getKindDefinitions().length).toBeGreaterThan(0);
  });

  it('works with files that have no kinds', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const program = createProgram([file]);

    expect(program.getKindDefinitions()).toEqual([]);
  });

  it('getDiagnostics returns empty for clean code', () => {
    const rootFiles = getRootFiles('kind-basic');
    const program = createProgram(rootFiles, undefined, {
      strict: true,
      noEmit: true,
    });

    const diagnostics = program.getDiagnostics();
    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics).toEqual([]);
  });

  it('getDiagnostics detects violations', () => {
    const rootFiles = getRootFiles('kind-violations');
    const program = createProgram(rootFiles, undefined, {
      strict: true,
      noEmit: true,
    });

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
