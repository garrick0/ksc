/**
 * Tests for the KindScript Checker — AG spec for kind property enforcement.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../src/pipeline/convert.js';
import { createBinderSpec } from '../src/pipeline/binder.js';
import { createCheckerSpec } from '../src/pipeline/checker.js';
import { createGrammar } from '../libs/ag/src/grammar.js';
import { createSemantics } from '../libs/ag/src/semantics.js';
import { interpret } from '../libs/ag/src/interpret.js';
import { getChildren } from '../src/pipeline/node-defs.js';
import type { KindDefinition, CheckerDiagnostic } from '../src/pipeline/types.js';
import type { KSNode } from '../src/pipeline/ast.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function buildAndCheck(fixtureDir: string) {
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
  const semantics = createSemantics(grammar, [
    createBinderSpec(),
    createCheckerSpec(),
  ]);
  const results = interpret(semantics, ksTree.root);
  const allDefs = (results.get('ksc-binder') as KindDefinition[]) ?? [];
  const diagnostics = (results.get('ksc-checker') as CheckerDiagnostic[]) ?? [];
  return { ksTree, allDefs, diagnostics };
}

// ────────────────────────────────────────────────────────────────────────

describe('checker — SpecInput contract', () => {
  it('createCheckerSpec returns a valid SpecInput', () => {
    const spec = createCheckerSpec();
    expect(spec.name).toBe('ksc-checker');
    expect(spec.deps).toContain('ksc-binder');
    expect(typeof spec.project).toBe('function');
    expect(spec.declarations).toHaveProperty('valueImports');
    expect(spec.declarations).toHaveProperty('fileImports');
    expect(spec.declarations).toHaveProperty('localBindings');
    expect(spec.declarations).toHaveProperty('enclosingLocals');
    expect(spec.declarations).toHaveProperty('isReference');
    expect(spec.declarations).toHaveProperty('kindAnnotations');
    expect(spec.declarations).toHaveProperty('noImportsContext');
    expect(spec.declarations).toHaveProperty('importViolation');
    expect(spec.declarations).toHaveProperty('allViolations');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — kind-basic fixture (clean, no violations)', () => {
  it('produces 0 diagnostics', () => {
    const { diagnostics } = buildAndCheck('kind-basic');
    expect(diagnostics).toEqual([]);
  });

  it('binder still finds kind definitions', () => {
    const { allDefs } = buildAndCheck('kind-basic');
    const names = allDefs.map(d => d.name);
    expect(names).toContain('NoImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — kind-violations fixture', () => {
  it('detects violation in violating.ts', () => {
    const { diagnostics } = buildAndCheck('kind-violations');
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);

    const violation = diagnostics.find(d => d.fileName.includes('violating.ts'));
    expect(violation).toBeDefined();
    expect(violation!.kindName).toBe('NoImports');
    expect(violation!.property).toBe('noImports');
    expect(violation!.message).toContain('helper');
    expect(violation!.message).toContain('imported binding');
  });

  it('does not flag clean.ts', () => {
    const { diagnostics } = buildAndCheck('kind-violations');
    const cleanViolations = diagnostics.filter(d => d.fileName.includes('clean.ts'));
    expect(cleanViolations).toEqual([]);
  });

  it('does not flag unannotated functions', () => {
    const { diagnostics } = buildAndCheck('kind-violations');
    const helperViolations = diagnostics.filter(d => d.fileName.includes('helpers.ts'));
    expect(helperViolations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — individual attributes', () => {
  it('valueImports collects non-type-only imports', () => {
    const { ksTree } = buildAndCheck('kind-violations');
    const violating = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('violating.ts'),
    )!;
    const imports: Set<string> = (violating as any).valueImports;
    expect(imports.has('helper')).toBe(true);
  });

  it('valueImports skips type-only imports', () => {
    const { ksTree } = buildAndCheck('kind-basic');
    const mathFile = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('math.ts'),
    )!;
    const imports: Set<string> = (mathFile as any).valueImports;
    expect(imports.size).toBe(0);
  });

  it('fileImports propagates to descendants', () => {
    const { ksTree } = buildAndCheck('kind-violations');
    const violating = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('violating.ts'),
    )!;
    const deepNode = violating.children[violating.children.length - 1];
    const imports: Set<string> = (deepNode as any).fileImports;
    expect(imports.has('helper')).toBe(true);
  });

  it('localBindings collects parameters', () => {
    const { ksTree } = buildAndCheck('kind-violations');
    const violating = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('violating.ts'),
    )!;
    const stack: KSNode[] = [...violating.children];
    let arrowFn: KSNode | undefined;
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.kind === 'ArrowFunction') { arrowFn = n; break; }
      stack.push(...n.children);
    }
    expect(arrowFn).toBeDefined();
    const locals: Set<string> = (arrowFn as any).localBindings;
    expect(locals.has('a')).toBe(true);
    expect(locals.has('b')).toBe(true);
  });

  it('kindAnnotations finds NoImports on annotated declarations', () => {
    const { ksTree } = buildAndCheck('kind-violations');
    const violating = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('violating.ts'),
    )!;
    const stack: KSNode[] = [...violating.children];
    let varDecl: KSNode | undefined;
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.kind === 'VariableDeclaration') { varDecl = n; break; }
      stack.push(...n.children);
    }
    expect(varDecl).toBeDefined();
    const annotations: KindDefinition[] = (varDecl as any).kindAnnotations;
    expect(annotations.length).toBeGreaterThan(0);
    expect(annotations[0].name).toBe('NoImports');
    expect(annotations[0].properties.noImports).toBe(true);
  });

  it('noImportsContext is non-null inside annotated function body', () => {
    const { ksTree } = buildAndCheck('kind-violations');
    const violating = ksTree.root.compilationUnits.find(
      cu => cu.fileName.includes('violating.ts'),
    )!;
    const stack: KSNode[] = [...violating.children];
    let arrowFn: KSNode | undefined;
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.kind === 'ArrowFunction') { arrowFn = n; break; }
      stack.push(...n.children);
    }
    expect(arrowFn).toBeDefined();
    const ctx: KindDefinition | null = (arrowFn as any).noImportsContext;
    expect(ctx).not.toBeNull();
    expect(ctx!.name).toBe('NoImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — diagnostic position info', () => {
  it('diagnostics have valid pos/end/fileName', () => {
    const { diagnostics } = buildAndCheck('kind-violations');
    for (const d of diagnostics) {
      expect(d.pos).toBeGreaterThanOrEqual(0);
      expect(d.end).toBeGreaterThan(d.pos);
      expect(d.fileName).toBeTruthy();
      expect(d.node).toBeDefined();
    }
  });
});
