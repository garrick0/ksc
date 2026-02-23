import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram, createProgramFromTSProgram } from '../src/program.js';
import { defineConfig } from '../src/config.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('createProgram', () => {
  it('creates a KSProgram from root files and config', () => {
    const rootFile = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const config = defineConfig({
      pure: { path: './src/pure', rules: { noConsole: true } },
    });
    const program = createProgram([rootFile], config, {
      strict: true,
      noEmit: true,
    });

    expect(program).toBeDefined();
    expect(program.getTSProgram).toBeTypeOf('function');
    expect(program.getSourceFiles).toBeTypeOf('function');
    expect(program.getCompilerOptions).toBeTypeOf('function');
    expect(program.getTSTypeChecker).toBeTypeOf('function');
    expect(program.getAllKindSymbols).toBeTypeOf('function');
    expect(program.getKindChecker).toBeTypeOf('function');
    expect(program.getKindDiagnostics).toBeTypeOf('function');
  });

  it('delegates scan/parse to TypeScript — source files are available', () => {
    const rootFile = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const config = defineConfig({});
    const program = createProgram([rootFile], config, {
      strict: true,
      noEmit: true,
    });

    const sourceFiles = program.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    const mathFile = sourceFiles.find(sf => sf.fileName.includes('math.ts'));
    expect(mathFile).toBeDefined();
  });

  it('returns populated KindSymbols from config', () => {
    const rootFile = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true, immutable: true } },
    });
    const program = createProgram([rootFile], config);

    const symbols = program.getAllKindSymbols();
    expect(symbols.length).toBe(1);
    expect(symbols[0].name).toBe('pureDir');
    expect(symbols[0].declaredProperties).toEqual({ noConsole: true, immutable: true });
  });

  it('lazily creates the checker', () => {
    const rootFile = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const config = defineConfig({});
    const program = createProgram([rootFile], config);

    const checker1 = program.getKindChecker();
    const checker2 = program.getKindChecker();
    expect(checker1).toBe(checker2);
  });

  it('getKindDiagnostics returns empty array for clean files', () => {
    const rootFile = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true, immutable: true } },
    });
    const program = createProgram([rootFile], config);

    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('getKindDiagnostics accepts a source file filter', () => {
    const rootFile = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const config = defineConfig({
      pureDir: { path: './src/pure', rules: { noConsole: true } },
    });
    const program = createProgram([rootFile], config);

    const mathFile = program.getSourceFiles()
      .find(sf => sf.fileName.includes('math.ts'))!;

    const diags = program.getKindDiagnostics(mathFile);
    expect(diags).toEqual([]);
  });

  it('empty config produces no diagnostics', () => {
    const rootFile = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const config = defineConfig({});
    const program = createProgram([rootFile], config);

    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });
});

describe('createProgramFromTSProgram', () => {
  it('wraps an existing ts.Program', () => {
    const rootFile = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const tsProgram = ts.createProgram([rootFile], { strict: true });
    const config = defineConfig({});

    const ksProgram = createProgramFromTSProgram(tsProgram, config);

    expect(ksProgram.getTSProgram()).toBe(tsProgram);
    expect(ksProgram.getSourceFiles()).toBe(tsProgram.getSourceFiles());
  });
});
