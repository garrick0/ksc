/**
 * Tests for the KindScript Checker — evaluator engine + dispatch.
 * Includes binder attribute tests (kindDefs, defLookup, caching).
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildTSTree, tsToAstTranslatorAdapter } from '../compose.js';
import {
  FIXTURES, buildAndEvaluate, findCU, findDNodeByKind,
  type Node,
} from '../helpers/fixtures.js';

// ────────────────────────────────────────────────────────────────────────

describe('checker — kind-basic fixture', () => {
  it('finds kind definitions and produces 0 diagnostics', () => {
    const { diagnostics, allDefs } = buildAndEvaluate('kind-basic');
    expect(diagnostics).toEqual([]);
    expect(allDefs.map(d => d.name)).toContain('NoImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — kind-violations fixture', () => {
  it('detects violation in violating.ts, clean.ts and helpers.ts are clean', () => {
    const { diagnostics } = buildAndEvaluate('kind-violations');
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);

    const violation = diagnostics.find(d => d.fileName.includes('violating.ts'));
    expect(violation).toBeDefined();
    expect(violation!.kindName).toBe('NoImports');
    expect(violation!.property).toBe('noImports');
    expect(violation!.message).toContain('helper');

    expect(diagnostics.filter(d => d.fileName.includes('clean.ts'))).toEqual([]);
    expect(diagnostics.filter(d => d.fileName.includes('helpers.ts'))).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — individual attributes', () => {
  it('kindAnnotations + contextFor work on annotated functions', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-violations');
    const violating = findCU(dnodeRoot, 'violating.ts')!;

    const varDecl = findDNodeByKind(violating, 'VariableDeclaration');
    expect(varDecl).toBeDefined();
    const annotations = varDecl!.attr('kindAnnotations');
    expect(annotations.length).toBeGreaterThan(0);
    expect(annotations[0].name).toBe('NoImports');
    expect(annotations[0].properties.noImports).toBe(true);

    const arrowFn = findDNodeByKind(violating, 'ArrowFunction');
    expect(arrowFn).toBeDefined();
    const ctx = arrowFn!.attr('contextFor', 'noImports');
    expect(ctx).not.toBeNull();
    expect(ctx!.name).toBe('NoImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — nodeCount (collection attribute)', () => {
  it('root count equals DFS total, leaves have 1, parent >= child + 1', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const rootCount = dnodeRoot.attr('nodeCount');
    expect(rootCount).toBeGreaterThan(0);

    let manualCount = 0;
    const stack: Node[] = [dnodeRoot];
    while (stack.length > 0) {
      manualCount++;
      const d = stack.pop()!;
      stack.push(...d.children);
    }
    expect(rootCount).toBe(manualCount);

    function findLeaf(d: Node): Node | undefined {
      if (d.children.length === 0) return d;
      for (const child of d.children) {
        const leaf = findLeaf(child);
        if (leaf) return leaf;
      }
      return undefined;
    }
    expect(findLeaf(dnodeRoot)!.attr('nodeCount')).toBe(1);

    const cu = dnodeRoot.children[0];
    expect(dnodeRoot.attr('nodeCount')).toBeGreaterThanOrEqual(cu.attr('nodeCount') + 1);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — diagnostic position info', () => {
  it('diagnostics have valid pos/end/fileName', () => {
    const { diagnostics } = buildAndEvaluate('kind-violations');
    for (const d of diagnostics) {
      expect(d.pos).toBeGreaterThanOrEqual(0);
      expect(d.end).toBeGreaterThan(d.pos);
      expect(d.fileName).toBeTruthy();
      expect(d.node).toBeDefined();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — kindDefs', () => {
  it('finds Kind<...> type aliases with properties, unique IDs, excludes non-Kind aliases', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const allDefs = dnodeRoot.children.flatMap(cu => cu.attr('kindDefs'));
    const names = allDefs.map(d => d.name);
    expect(names).toContain('NoImports');
    expect(names).not.toContain('PropertySet');

    const noImports = allDefs.find(d => d.name === 'NoImports');
    expect(noImports!.properties.noImports).toBe(true);

    const ids = allDefs.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('binder attributes — kindDefs per file + defLookup', () => {
  it('kinds.ts has defs, math.ts has none, defLookup resolves across files', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');

    const kindsFile = findCU(dnodeRoot, 'kinds.ts')!;
    expect(kindsFile.attr('kindDefs').length).toBeGreaterThan(0);
    expect(kindsFile.attr('kindDefs')[0].name).toBe('NoImports');

    const mathFile = findCU(dnodeRoot, 'math.ts')!;
    expect(mathFile.attr('kindDefs')).toEqual([]);

    const resolver = mathFile.attr('defLookup');
    expect(resolver('NoImports')!.name).toBe('NoImports');
    expect(resolver('NoImports')!.properties.noImports).toBe(true);
    expect(resolver('NonExistent')).toBeUndefined();
  });
});

describe('binder attributes — caching', () => {
  it('kindDefs and defLookup return same references on repeated access', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const kindsFile = findCU(dnodeRoot, 'kinds.ts')!;
    expect(kindsFile.attr('kindDefs')).toBe(kindsFile.attr('kindDefs'));

    const cu = dnodeRoot.children[0] as Node;
    expect(cu.attr('defLookup')).toBe(cu.attr('defLookup'));
  });
});

describe('binder attributes — empty input', () => {
  it('returns empty results for files with no kinds', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const tsProgram = ts.createProgram([file], { strict: true, noEmit: true });
    const ksTree = tsToAstTranslatorAdapter.convert(tsProgram);
    const dnodeRoot = buildTSTree(ksTree.root);
    expect(dnodeRoot.children.flatMap(cu => cu.attr('kindDefs')).length).toBe(0);
  });
});
