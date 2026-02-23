import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../src/program.js';
import type { KindSymbol } from '../src/types.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

/** Helper: get a named symbol's KindSymbol from the table. */
function getKindSymbol(
  program: ReturnType<typeof createProgram>,
  name: string,
): KindSymbol | undefined {
  const checker = program.getTSTypeChecker();
  const table = program.getKindSymbolTable();

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    for (const stmt of sf.statements) {
      // Check type aliases
      if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === name) {
        const symbol = checker.getSymbolAtLocation(stmt.name);
        if (symbol) return table.get(symbol);
      }
      // Check variable declarations
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === name) {
            const symbol = checker.getSymbolAtLocation(decl.name);
            if (symbol) return table.get(symbol);
          }
        }
      }
    }
  }
  return undefined;
}

/** Helper: collect all KindSymbol names from the table. */
function getAllKindSymbolNames(
  program: ReturnType<typeof createProgram>,
): string[] {
  const checker = program.getTSTypeChecker();
  const table = program.getKindSymbolTable();
  const names: string[] = [];

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    for (const stmt of sf.statements) {
      if (ts.isTypeAliasDeclaration(stmt)) {
        const symbol = checker.getSymbolAtLocation(stmt.name);
        if (symbol && table.has(symbol)) {
          names.push(stmt.name.text);
        }
      }
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const symbol = checker.getSymbolAtLocation(decl.name);
            if (symbol && table.has(symbol)) {
              names.push(decl.name.text);
            }
          }
        }
      }
    }
  }

  return names;
}

// ────────────────────────────────────────────────────────────────────────

describe('binder — basic Kind definitions', () => {
  const rootFile = path.join(FIXTURES, 'basic', 'context.ts');
  const program = createProgram([rootFile], { strict: true });

  it('detects Kind type alias definitions', () => {
    const domainLayer = getKindSymbol(program, 'DomainLayer');
    expect(domainLayer).toBeDefined();
    expect(domainLayer!.role).toBe('definition');
    expect(domainLayer!.name).toBe('DomainLayer');
  });

  it('extracts PropertySpec from Kind definitions', () => {
    const domainLayer = getKindSymbol(program, 'DomainLayer');
    expect(domainLayer!.declaredProperties).toEqual({
      pure: true,
      noIO: true,
    });
  });

  it('handles Kind definitions with empty PropertySpec', () => {
    const infraLayer = getKindSymbol(program, 'InfraLayer');
    expect(infraLayer).toBeDefined();
    expect(infraLayer!.role).toBe('definition');
    expect(infraLayer!.declaredProperties).toEqual({});
  });

  it('detects kind-annotated values', () => {
    const domain = getKindSymbol(program, 'domain');
    expect(domain).toBeDefined();
    expect(domain!.role).toBe('value');
    expect(domain!.name).toBe('domain');
  });

  it('extracts path from ks.dir() calls', () => {
    const domain = getKindSymbol(program, 'domain');
    expect(domain!.valueKind).toBe('directory');
    expect(domain!.path).toBe('./src/domain');
  });

  it('links value to its Kind definition', () => {
    const domain = getKindSymbol(program, 'domain');
    expect(domain!.kindDefinition).toBeDefined();
    expect(domain!.kindDefinition!.name).toBe('DomainLayer');
  });

  it('value inherits declared properties from its Kind definition', () => {
    const domain = getKindSymbol(program, 'domain');
    expect(domain!.declaredProperties).toEqual({
      pure: true,
      noIO: true,
    });
  });

  it('value with empty-property Kind has empty declaredProperties', () => {
    const infra = getKindSymbol(program, 'infrastructure');
    expect(infra!.declaredProperties).toEqual({});
    expect(infra!.valueKind).toBe('directory');
    expect(infra!.path).toBe('./src/infrastructure');
  });

  it('detects all Kind-related symbols (definitions + values)', () => {
    const names = getAllKindSymbolNames(program);
    // Definitions: KSDir (has __ks), Kind (has __ks), DomainLayer, InfraLayer
    // Values: domain, infrastructure
    expect(names).toContain('DomainLayer');
    expect(names).toContain('InfraLayer');
    expect(names).toContain('domain');
    expect(names).toContain('infrastructure');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder — composite kinds', () => {
  const rootFile = path.join(FIXTURES, 'composite', 'context.ts');
  const program = createProgram([rootFile], { strict: true });

  it('detects composite Kind definition', () => {
    const cleanArch = getKindSymbol(program, 'CleanArch');
    expect(cleanArch).toBeDefined();
    expect(cleanArch!.role).toBe('definition');
  });

  it('extracts relational properties: noDependency', () => {
    const cleanArch = getKindSymbol(program, 'CleanArch');
    expect(cleanArch!.declaredProperties.noDependency).toEqual([
      ['domain', 'infrastructure'],
      ['domain', 'application'],
    ]);
  });

  it('extracts relational properties: noCycles', () => {
    const cleanArch = getKindSymbol(program, 'CleanArch');
    expect(cleanArch!.declaredProperties.noCycles).toEqual([
      'domain',
      'infrastructure',
      'application',
    ]);
  });

  it('resolves composite definition members', () => {
    const cleanArch = getKindSymbol(program, 'CleanArch');
    expect(cleanArch!.members).toBeDefined();
    expect(cleanArch!.members!.size).toBe(3);

    const memberNames = [...cleanArch!.members!.keys()];
    expect(memberNames).toContain('domain');
    expect(memberNames).toContain('infrastructure');
    expect(memberNames).toContain('application');
  });

  it('definition members carry their Kind properties', () => {
    const cleanArch = getKindSymbol(program, 'CleanArch');
    const domainMember = cleanArch!.members!.get('domain')!;
    expect(domainMember.declaredProperties).toEqual({
      pure: true,
      noIO: true,
    });

    const infraMember = cleanArch!.members!.get('infrastructure')!;
    expect(infraMember.declaredProperties).toEqual({});

    const appMember = cleanArch!.members!.get('application')!;
    expect(appMember.declaredProperties).toEqual({
      noConsole: true,
    });
  });

  it('detects composite value', () => {
    const app = getKindSymbol(program, 'app');
    expect(app).toBeDefined();
    expect(app!.role).toBe('value');
    expect(app!.valueKind).toBe('composite');
  });

  it('composite value links to CleanArch definition', () => {
    const app = getKindSymbol(program, 'app');
    expect(app!.kindDefinition).toBeDefined();
    expect(app!.kindDefinition!.name).toBe('CleanArch');
  });

  it('composite value has members with paths', () => {
    const app = getKindSymbol(program, 'app');
    expect(app!.members).toBeDefined();
    expect(app!.members!.size).toBe(3);

    const domain = app!.members!.get('domain')!;
    expect(domain.role).toBe('value');
    expect(domain.valueKind).toBe('directory');
    expect(domain.path).toBe('./src/domain');

    const infra = app!.members!.get('infrastructure')!;
    expect(infra.valueKind).toBe('directory');
    expect(infra.path).toBe('./src/infrastructure');

    const appMember = app!.members!.get('application')!;
    expect(appMember.valueKind).toBe('directory');
    expect(appMember.path).toBe('./src/application');
  });

  it('composite value members inherit declared properties', () => {
    const app = getKindSymbol(program, 'app');
    const domain = app!.members!.get('domain')!;
    expect(domain.declaredProperties).toEqual({
      pure: true,
      noIO: true,
    });

    const infra = app!.members!.get('infrastructure')!;
    expect(infra.declaredProperties).toEqual({});
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder — inline kinds', () => {
  const rootFile = path.join(FIXTURES, 'inline', 'context.ts');
  const program = createProgram([rootFile], { strict: true });

  it('extracts properties from inline Kind<KSDir, { ... }>', () => {
    const config = getKindSymbol(program, 'config');
    expect(config).toBeDefined();
    expect(config!.role).toBe('value');
    expect(config!.declaredProperties).toEqual({
      immutable: true,
      static: true,
    });
  });

  it('inline Kind on function type', () => {
    const handler = getKindSymbol(program, 'handler');
    expect(handler).toBeDefined();
    expect(handler!.role).toBe('value');
    expect(handler!.valueKind).toBe('function');
    expect(handler!.declaredProperties).toEqual({
      noIO: true,
    });
  });

  it('inline Kind on file type', () => {
    const utils = getKindSymbol(program, 'utils');
    expect(utils).toBeDefined();
    expect(utils!.valueKind).toBe('file');
    expect(utils!.path).toBe('./src/utils.ts');
    expect(utils!.declaredProperties).toEqual({
      pure: true,
      noSideEffects: true,
    });
  });

  it('inline Kind with maxFanOut numeric property', () => {
    const dir = getKindSymbol(program, 'maxFanOutDir');
    expect(dir).toBeDefined();
    expect(dir!.declaredProperties.maxFanOut).toBe(5);
  });

  it('inline Kind with scope string property', () => {
    const dir = getKindSymbol(program, 'scopedDir');
    expect(dir).toBeDefined();
    expect(dir!.declaredProperties.scope).toBe('folder');
  });

  it('inline kinds have no kindDefinition link', () => {
    const config = getKindSymbol(program, 'config');
    expect(config!.kindDefinition).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder — alias chains', () => {
  const rootFile = path.join(FIXTURES, 'alias-chain', 'context.ts');
  const program = createProgram([rootFile], { strict: true });

  it('detects Kind definition through alias chain', () => {
    const pureDomain = getKindSymbol(program, 'PureDomain');
    expect(pureDomain).toBeDefined();
    expect(pureDomain!.role).toBe('definition');
    expect(pureDomain!.declaredProperties).toEqual({
      pure: true,
      noIO: true,
    });
  });

  it('alias of a Kind is also detected', () => {
    const myDomain = getKindSymbol(program, 'MyDomain');
    expect(myDomain).toBeDefined();
    expect(myDomain!.role).toBe('definition');
  });

  it('alias chain preserves properties', () => {
    const myDomain = getKindSymbol(program, 'MyDomain');
    expect(myDomain!.declaredProperties).toEqual({
      pure: true,
      noIO: true,
    });
  });

  it('value annotated with alias resolves correctly', () => {
    const domain = getKindSymbol(program, 'domain');
    expect(domain).toBeDefined();
    expect(domain!.role).toBe('value');
    expect(domain!.valueKind).toBe('directory');
    expect(domain!.path).toBe('./src/domain');
    expect(domain!.declaredProperties).toEqual({
      pure: true,
      noIO: true,
    });
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder — function values', () => {
  const rootFile = path.join(FIXTURES, 'functions', 'context.ts');
  const program = createProgram([rootFile], { strict: true });

  it('detects function kind with named type alias', () => {
    const calc = getKindSymbol(program, 'calculateTotal');
    expect(calc).toBeDefined();
    expect(calc!.role).toBe('value');
    expect(calc!.valueKind).toBe('function');
    expect(calc!.declaredProperties).toEqual({
      pure: true,
      noIO: true,
    });
  });

  it('detects function kind with inline annotation', () => {
    const greet = getKindSymbol(program, 'greet');
    expect(greet).toBeDefined();
    expect(greet!.role).toBe('value');
    expect(greet!.valueKind).toBe('function');
    expect(greet!.declaredProperties).toEqual({
      pure: true,
    });
  });
});
