import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram, createProgramFromTSProgram } from '../src/program.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('createProgram', () => {
  it('creates a KSProgram from root files', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile], {
      strict: true,
      noEmit: true,
    });

    expect(program).toBeDefined();
    expect(program.getTSProgram).toBeTypeOf('function');
    expect(program.getSourceFiles).toBeTypeOf('function');
    expect(program.getCompilerOptions).toBeTypeOf('function');
    expect(program.getTSTypeChecker).toBeTypeOf('function');
    expect(program.getKindSymbolTable).toBeTypeOf('function');
    expect(program.getKindChecker).toBeTypeOf('function');
    expect(program.getKindDiagnostics).toBeTypeOf('function');
  });

  it('delegates scan/parse to TypeScript — source files are available', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile], {
      strict: true,
      noEmit: true,
    });

    const sourceFiles = program.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    // The root file should be among the source files
    const contextFile = sourceFiles.find(sf =>
      sf.fileName.includes('context.ts'),
    );
    expect(contextFile).toBeDefined();
  });

  it('TypeScript produces a valid AST with type alias declarations', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile], {
      strict: true,
      noEmit: true,
    });

    const contextFile = program
      .getSourceFiles()
      .find(sf => sf.fileName.includes('context.ts'))!;

    // Find type alias declarations
    const typeAliases = contextFile.statements.filter(
      ts.isTypeAliasDeclaration,
    );

    // Should have: KSDir, PropertySpec, Kind, DomainLayer, InfraLayer
    const names = typeAliases.map(ta => ta.name.text);
    expect(names).toContain('DomainLayer');
    expect(names).toContain('InfraLayer');
    expect(names).toContain('Kind');
  });

  it('TypeScript produces variable declarations with type annotations', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile], {
      strict: true,
      noEmit: true,
    });

    const contextFile = program
      .getSourceFiles()
      .find(sf => sf.fileName.includes('context.ts'))!;

    // Find variable declarations
    const varStmts = contextFile.statements.filter(ts.isVariableStatement);
    const decls = varStmts.flatMap(vs =>
      Array.from(vs.declarationList.declarations),
    );

    const declNames = decls.map(d =>
      ts.isIdentifier(d.name) ? d.name.text : '',
    );
    expect(declNames).toContain('domain');
    expect(declNames).toContain('infrastructure');
  });

  it('TypeChecker resolves types with __ks marker', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile], {
      strict: true,
      noEmit: true,
    });

    const checker = program.getTSTypeChecker();
    const contextFile = program
      .getSourceFiles()
      .find(sf => sf.fileName.includes('context.ts'))!;

    // Find DomainLayer type alias
    const domainAlias = contextFile.statements.find(
      stmt =>
        ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'DomainLayer',
    ) as ts.TypeAliasDeclaration;

    expect(domainAlias).toBeDefined();

    const symbol = checker.getSymbolAtLocation(domainAlias.name);
    expect(symbol).toBeDefined();

    const type = checker.getDeclaredTypeOfSymbol(symbol!);
    // The type should have a __ks property (phantom marker)
    const ksProperty = type.getProperty('__ks');
    expect(ksProperty).toBeDefined();
  });

  it('returns a populated KindSymbolTable', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile]);

    const table = program.getKindSymbolTable();
    expect(table).toBeInstanceOf(WeakMap);

    // Verify the binder populated the table with Kind definitions
    const checker = program.getTSTypeChecker();
    const contextFile = program
      .getSourceFiles()
      .find(sf => sf.fileName.includes('context.ts'))!;
    const domainAlias = contextFile.statements.find(
      stmt =>
        ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'DomainLayer',
    ) as ts.TypeAliasDeclaration;
    const symbol = checker.getSymbolAtLocation(domainAlias.name)!;
    const kindSym = table.get(symbol);
    expect(kindSym).toBeDefined();
    expect(kindSym!.role).toBe('definition');
  });

  it('lazily creates the checker', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile]);

    // Getting the checker multiple times returns the same instance
    const checker1 = program.getKindChecker();
    const checker2 = program.getKindChecker();
    expect(checker1).toBe(checker2);
  });

  it('getKindDiagnostics returns empty array from stub checker', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile]);

    const diags = program.getKindDiagnostics();
    expect(diags).toEqual([]);
  });

  it('getKindDiagnostics accepts a source file filter', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const program = createProgram([rootFile]);

    const contextFile = program
      .getSourceFiles()
      .find(sf => sf.fileName.includes('context.ts'))!;

    const diags = program.getKindDiagnostics(contextFile);
    expect(diags).toEqual([]);
  });
});

describe('createProgramFromTSProgram', () => {
  it('wraps an existing ts.Program', () => {
    const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
    const tsProgram = ts.createProgram([rootFile], { strict: true });

    const ksProgram = createProgramFromTSProgram(tsProgram);

    // Should return the same ts.Program
    expect(ksProgram.getTSProgram()).toBe(tsProgram);
    expect(ksProgram.getSourceFiles()).toBe(tsProgram.getSourceFiles());
  });
});
