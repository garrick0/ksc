/**
 * Tests for the three-object architecture, validation, and dep analysis.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../src/pipeline/convert.js';
import { getChildren } from '../src/pipeline/node-defs.js';
import { createBinderSpec } from '../src/pipeline/binder.js';
import { createCheckerSpec } from '../src/pipeline/checker.js';
import { createGrammar } from '../libs/ag/src/grammar.js';
import { createSemantics } from '../libs/ag/src/semantics.js';
import { interpret } from '../libs/ag/src/interpret.js';
import { compile } from '../libs/ag/src/compile.js';
import { analyzeDeps } from '../libs/ag/src/analyze.js';
import type { SpecInput } from '../libs/ag/src/spec.js';
import type { KSNode } from '../src/pipeline/ast.js';
import type { KindDefinition, CheckerDiagnostic } from '../src/pipeline/types.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function makeTree(fixtureDir: string) {
  const files = ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
  const tsProgram = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    rootDir: path.join(FIXTURES, fixtureDir),
  });
  return buildKSTree(tsProgram);
}

// ────────────────────────────────────────────────────────────────────────

describe('Semantics + interpret — basic evaluation', () => {
  it('evaluate works with a single spec', () => {
    const grammar = createGrammar(getChildren);
    const ksTree = makeTree('kind-basic');
    const semantics = createSemantics(grammar, [createBinderSpec()]);
    const results = interpret(semantics, ksTree.root);
    const result = results.get('ksc-binder') as KindDefinition[];

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    const names = result!.map((d: KindDefinition) => d.name);
    expect(names).toContain('NoImports');
  });

  it('evaluateAll evaluates specs in dependency order', () => {
    const grammar = createGrammar(getChildren);
    const ksTree = makeTree('kind-violations');
    const semantics = createSemantics(grammar, [
      createBinderSpec(),
      createCheckerSpec(),
    ]);
    const results = interpret(semantics, ksTree.root);

    const defs = results.get('ksc-binder') as KindDefinition[];
    const diags = results.get('ksc-checker') as CheckerDiagnostic[];
    expect(defs.length).toBeGreaterThan(0);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].message).toContain('imported binding');
  });

  it('works with reversed spec order', () => {
    const grammar = createGrammar(getChildren);
    const ksTree = makeTree('kind-violations');
    // Checker first, binder second — should still work due to topo sort
    const semantics = createSemantics(grammar, [
      createCheckerSpec(),
      createBinderSpec(),
    ]);
    const results = interpret(semantics, ksTree.root);

    const diags = results.get('ksc-checker') as CheckerDiagnostic[];
    expect(diags.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('Semantics — validation', () => {
  it('detects duplicate attribute names across specs', () => {
    const grammar = createGrammar<{ kind: string; children: any[] }>(n => n.children ?? []);

    const spec1: SpecInput<any> = {
      name: 'spec-a',
      declarations: { sharedAttr: { direction: 'syn' } },
      equations: { sharedAttr: () => 1 },
    };
    const spec2: SpecInput<any> = {
      name: 'spec-b',
      declarations: { sharedAttr: { direction: 'syn' } },
      equations: { sharedAttr: () => 2 },
    };

    expect(() => createSemantics(grammar, [spec1, spec2])).toThrow(
      /Duplicate attribute 'sharedAttr'/,
    );
  });

  it('detects circular spec dependencies', () => {
    const grammar = createGrammar<{ kind: string; children: any[] }>(n => n.children ?? []);

    const specA: SpecInput<any> = {
      name: 'a',
      declarations: { x: { direction: 'syn' } },
      equations: { x: () => 1 },
      deps: ['b'],
    };
    const specB: SpecInput<any> = {
      name: 'b',
      declarations: { y: { direction: 'syn' } },
      equations: { y: () => 2 },
      deps: ['a'],
    };

    expect(() => createSemantics(grammar, [specA, specB])).toThrow(
      /Circular dependency/,
    );
  });

  it('detects unknown dependencies', () => {
    const grammar = createGrammar<{ kind: string; children: any[] }>(n => n.children ?? []);

    const spec: SpecInput<any> = {
      name: 'lonely',
      declarations: { x: { direction: 'syn' } },
      equations: { x: () => 1 },
      deps: ['nonexistent'],
    };

    expect(() => createSemantics(grammar, [spec])).toThrow(
      /Unknown dependency: 'nonexistent'/,
    );
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('Semantics — inspectable', () => {
  it('exposes declarations and order', () => {
    const grammar = createGrammar(getChildren);
    const semantics = createSemantics(grammar, [
      createBinderSpec(),
      createCheckerSpec(),
    ]);

    expect(semantics.declarations.size).toBe(12);
    expect(semantics.declarations.has('kindDefs')).toBe(true);
    expect(semantics.declarations.has('importViolation')).toBe(true);
    expect(semantics.order.length).toBe(12);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('analyzeDeps — synthetic example', () => {
  it('discovers dependencies between attributes', () => {
    type N = { kind: string; children: N[]; value?: number };
    const getKids = (n: N) => n.children;

    const compiled = new Map<string, any>();
    compiled.set('base', compile<N>('base', { direction: 'syn' }, (n: N) => (n as any).value ?? 0));
    compiled.set('derived', compile<N>('derived', { direction: 'syn' }, (n: N) => (n as any).base * 2));

    const root: N = { kind: 'Root', children: [
      { kind: 'Leaf', children: [], value: 5 },
    ]};

    const result = analyzeDeps(getKids, compiled, root);

    expect(result.deps.has('base')).toBe(true);
    expect(result.deps.has('derived')).toBe(true);
    // derived reads base
    expect(result.deps.get('derived')!.has('base')).toBe(true);
    // base doesn't read derived
    expect(result.deps.get('base')!.has('derived')).toBe(false);
    // No cycles
    expect(result.cycles).toEqual([]);
    // Order: base before derived
    expect(result.order.indexOf('base')).toBeLessThan(result.order.indexOf('derived'));
  });

  it('detects attribute-level cycles', () => {
    type N = { kind: string; children: N[] };
    const getKids = (n: N) => n.children;

    const compiled = new Map<string, any>();
    compiled.set('a', compile<N>('a', { direction: 'syn' }, (n: N) => ((n as any).b ?? 0) + 1));
    compiled.set('b', compile<N>('b', { direction: 'syn' }, (n: N) => ((n as any).a ?? 0) + 1));

    const root: N = { kind: 'Root', children: [] };

    const result = analyzeDeps(getKids, compiled, root);

    // Should detect a cycle
    expect(result.cycles.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('analyzeDeps — real KSC specs', () => {
  it('analyzes binder + checker dependencies on a real tree', () => {
    const ksTree = makeTree('kind-basic');
    const grammar = createGrammar(getChildren);
    const semantics = createSemantics(grammar, [
      createBinderSpec(),
      createCheckerSpec(),
    ]);

    const result = analyzeDeps(
      getChildren,
      semantics.compiled,
      ksTree.root,
    );

    // Should have all 12 attributes
    expect(result.deps.size).toBe(12);

    // Check some known dependencies
    expect(result.deps.has('defLookup')).toBe(true);
    expect(result.deps.has('importViolation')).toBe(true);
    expect(result.deps.has('allViolations')).toBe(true);

    // importViolation should depend on several attributes
    const ivDeps = result.deps.get('importViolation')!;
    expect(ivDeps.size).toBeGreaterThan(0);

    // No cycles in the real specs
    expect(result.cycles).toEqual([]);

    // Should have a valid evaluation order
    expect(result.order.length).toBe(12);
  });
});
