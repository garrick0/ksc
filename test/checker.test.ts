/**
 * Tests for the KindScript Checker — compiled evaluator.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../generated/ts-ast/grammar/convert.js';
import { evaluate, buildTree, KSCDNode } from '../generated/ts-ast/kind-checking/evaluator.js';
import type { Diagnostic } from '../specs/ts-ast/kind-checking/types.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

const _buildCache = new Map();
function buildAndCheck(fixtureDir: string) {
  if (_buildCache.has(fixtureDir)) return _buildCache.get(fixtureDir);
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
  const result = { ksTree, dnodeRoot, allDefs, diagnostics };
  _buildCache.set(fixtureDir, result);
  return result;
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

  it('contextFor("noImports") is non-null inside annotated function body', () => {
    const { dnodeRoot } = buildAndCheck('kind-violations');
    const violating = findCU(dnodeRoot, 'violating.ts')!;
    const arrowFn = findDNodeByKind(violating, 'ArrowFunction');
    expect(arrowFn).toBeDefined();
    const ctx = arrowFn!.contextFor('noImports');
    expect(ctx).not.toBeNull();
    expect(ctx!.name).toBe('NoImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — nodeCount (collection attribute)', () => {
  it('root nodeCount equals total number of nodes in the tree', () => {
    const { dnodeRoot } = buildAndCheck('kind-basic');
    const rootCount = dnodeRoot.nodeCount();
    expect(rootCount).toBeGreaterThan(0);

    // Verify by manual DFS count
    let manualCount = 0;
    const stack: KSCDNode[] = [dnodeRoot];
    while (stack.length > 0) {
      manualCount++;
      const d = stack.pop()!;
      stack.push(...d.children as KSCDNode[]);
    }
    expect(rootCount).toBe(manualCount);
  });

  it('leaf nodes have nodeCount of 1', () => {
    const { dnodeRoot } = buildAndCheck('kind-basic');

    function findLeaf(d: KSCDNode): KSCDNode | undefined {
      if (d.children.length === 0) return d;
      for (const child of d.children as KSCDNode[]) {
        const leaf = findLeaf(child);
        if (leaf) return leaf;
      }
      return undefined;
    }
    const leaf = findLeaf(dnodeRoot);
    expect(leaf).toBeDefined();
    expect(leaf!.nodeCount()).toBe(1);
  });

  it('parent nodeCount >= child nodeCount + 1', () => {
    const { dnodeRoot } = buildAndCheck('kind-basic');
    const cu = dnodeRoot.children[0] as KSCDNode;
    expect(dnodeRoot.nodeCount()).toBeGreaterThanOrEqual(cu.nodeCount() + 1);
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
