import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../src/pipeline/convert.js';
import { createBinderSpec } from '../src/pipeline/binder.js';
import { createGrammar } from '../libs/ag/src/grammar.js';
import { createSemantics } from '../libs/ag/src/semantics.js';
import { interpret } from '../libs/ag/src/interpret.js';
import { getChildren } from '../src/pipeline/ast.js';
import type { KSCompilationUnit } from '../src/pipeline/ast.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function createKSTree(fixtureDir: string) {
  const files = ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
  const tsProgram = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    rootDir: path.join(FIXTURES, fixtureDir),
  });
  const ksTree = buildKSTree(tsProgram);
  const grammar = createGrammar(getChildren);
  const semantics = createSemantics(grammar, [createBinderSpec()]);
  interpret(semantics, ksTree.root);
  return ksTree;
}

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — kindDefs', () => {
  it('finds Kind<...> type aliases', () => {
    const ksTree = createKSTree('kind-basic');

    const allDefs = ksTree.root.compilationUnits.flatMap(cu => (cu as any).kindDefs);
    const names = allDefs.map((d: any) => d.name);
    expect(names).toContain('NoImports');
  });

  it('extracts properties from Kind type argument', () => {
    const ksTree = createKSTree('kind-basic');

    const allDefs = ksTree.root.compilationUnits.flatMap(cu => (cu as any).kindDefs);
    const noImports = allDefs.find((d: any) => d.name === 'NoImports');
    expect(noImports).toBeDefined();
    expect(noImports!.properties.noImports).toBe(true);
  });

  it('assigns unique IDs to definitions', () => {
    const ksTree = createKSTree('kind-basic');

    const allDefs = ksTree.root.compilationUnits.flatMap(cu => (cu as any).kindDefs);
    const ids = allDefs.map((d: any) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not pick up non-Kind type aliases', () => {
    const ksTree = createKSTree('kind-basic');

    const allDefs = ksTree.root.compilationUnits.flatMap(cu => (cu as any).kindDefs);
    const names = allDefs.map((d: any) => d.name);
    expect(names).not.toContain('PropertySet');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — kindDefs per file', () => {
  it('returns definitions for a compilation unit', () => {
    const ksTree = createKSTree('kind-basic');

    const kindsFile = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('kinds.ts'),
    );
    expect(kindsFile).toBeDefined();

    const defs = (kindsFile as any).kindDefs;
    expect(defs.length).toBeGreaterThan(0);
    expect(defs[0].name).toBe('NoImports');
  });

  it('returns empty array for files with no kind definitions', () => {
    const ksTree = createKSTree('kind-basic');

    const mathFile = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('math.ts'),
    );
    expect(mathFile).toBeDefined();

    const defs = (mathFile as any).kindDefs;
    expect(defs).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — defLookup', () => {
  it('any node can resolve a kind name', () => {
    const ksTree = createKSTree('kind-basic');

    const mathFile = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('math.ts'),
    )!;
    const resolver = (mathFile as any).defLookup;
    expect(resolver('NoImports')).toBeDefined();
    expect(resolver('NoImports')!.name).toBe('NoImports');
    expect(resolver('NoImports')!.properties.noImports).toBe(true);
  });

  it('returns undefined for unknown names', () => {
    const ksTree = createKSTree('kind-basic');

    const cu = ksTree.root.compilationUnits[0];
    const resolver = (cu as any).defLookup;
    expect(resolver('NonExistent')).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — caching', () => {
  it('kindDefs returns the same array on repeated access', () => {
    const ksTree = createKSTree('kind-basic');

    const kindsFile = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('kinds.ts'),
    )!;

    const defs1 = (kindsFile as any).kindDefs;
    const defs2 = (kindsFile as any).kindDefs;
    expect(defs1).toBe(defs2);
  });

  it('defLookup returns the same function on repeated access', () => {
    const ksTree = createKSTree('kind-basic');

    const cu = ksTree.root.compilationUnits[0];
    const lookup1 = (cu as any).defLookup;
    const lookup2 = (cu as any).defLookup;
    expect(lookup1).toBe(lookup2);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — empty input', () => {
  it('returns empty results for files with no kinds', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const tsProgram = ts.createProgram([file], { strict: true, noEmit: true });
    const ksTree = buildKSTree(tsProgram);
    const grammar = createGrammar(getChildren);
    const semantics = createSemantics(grammar, [createBinderSpec()]);
    interpret(semantics, ksTree.root);

    const allDefs = ksTree.root.compilationUnits.flatMap(cu => (cu as any).kindDefs);
    expect(allDefs.length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder spec — SpecInput contract', () => {
  it('createBinderSpec returns a valid SpecInput', () => {
    const spec = createBinderSpec();
    expect(spec.name).toBe('ksc-binder');
    expect(typeof spec.project).toBe('function');
    expect(spec.declarations).toHaveProperty('kindDefs');
    expect(spec.declarations).toHaveProperty('defLookup');
  });

  it('project extracts all kind definitions', () => {
    const files = ts.sys.readDirectory(
      path.join(FIXTURES, 'kind-basic', 'src'),
      ['.ts'],
    );
    const tsProgram = ts.createProgram(files, { strict: true, noEmit: true });
    const ksTree = buildKSTree(tsProgram);
    const grammar = createGrammar(getChildren);
    const semantics = createSemantics(grammar, [createBinderSpec()]);
    const results = interpret(semantics, ksTree.root);
    const result = results.get('ksc-binder');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    const names = (result as any[]).map((d: any) => d.name);
    expect(names).toContain('NoImports');
  });
});
