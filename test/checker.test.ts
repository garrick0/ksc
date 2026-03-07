/**
 * Tests for the KindScript Checker — compiled evaluator.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../ast-schema/generated/convert.js';
import { evaluate, buildTree, KSCDNode } from '../ksc-generated/evaluator.js';
import type { KindDefinition, CheckerDiagnostic } from '../ksc-behavior/types.js';

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
  const { definitions: allDefs, diagnostics } = evaluate(ksTree.root);
  const dnodeRoot = buildTree(ksTree.root);
  return { ksTree, dnodeRoot, allDefs, diagnostics };
}

/** Find a CU DNode by filename substring. */
function findCU(dnodeRoot: KSCDNode, fileSubstr: string): KSCDNode | undefined {
  return (dnodeRoot.children as KSCDNode[]).find(
    cu => (cu.node as any).fileName?.includes(fileSubstr),
  );
}

/** DFS to find first KSCDNode whose raw node has given kind. */
function findDNodeByKind(root: KSCDNode, kind: string): KSCDNode | undefined {
  const stack: KSCDNode[] = [...root.children as KSCDNode[]];
  while (stack.length > 0) {
    const d = stack.pop()!;
    if (d.node.kind === kind) return d;
    stack.push(...d.children as KSCDNode[]);
  }
  return undefined;
}

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
  it('kindAnnotations finds NoImports on annotated declarations', () => {
    const { dnodeRoot } = buildAndCheck('kind-violations');
    const violating = findCU(dnodeRoot, 'violating.ts')!;
    const varDecl = findDNodeByKind(violating, 'VariableDeclaration');
    expect(varDecl).toBeDefined();
    const annotations = varDecl!.kindAnnotations();
    expect(annotations.length).toBeGreaterThan(0);
    expect(annotations[0].name).toBe('NoImports');
    expect(annotations[0].properties.noImports).toBe(true);
  });

  it('noImportsContext is non-null inside annotated function body', () => {
    const { dnodeRoot } = buildAndCheck('kind-violations');
    const violating = findCU(dnodeRoot, 'violating.ts')!;
    const arrowFn = findDNodeByKind(violating, 'ArrowFunction');
    expect(arrowFn).toBeDefined();
    const ctx = arrowFn!.noImportsContext();
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
