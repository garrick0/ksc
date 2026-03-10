/**
 * Tests for the KindScript Checker — evaluator engine + dispatch.
 * Includes binder attribute tests (kindDefs, defLookup, caching).
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { frontend } from '../../specs/ts-ast/frontend/convert.js';
import { wireEvaluator } from '../../evaluator/engine.js';
import type { TypedAGNode } from '../../evaluator/types.js';
import { dispatchConfig } from '../../generated/ts-ast/kind-checking/dispatch.js';
import { analysisSpec } from '../../specs/ts-ast/kind-checking/spec.js';
import { grammar } from '../../specs/ts-ast/grammar/index.js';
import type { KSCAttrMap } from '../../generated/ts-ast/kind-checking/attr-types.js';
import {
  FIXTURES, buildAndEvaluate, findCU, findDNodeByKind,
  type Node,
} from '../helpers/fixtures.js';

const evaluator = wireEvaluator<string, KSCAttrMap>({
  grammar,
  spec: analysisSpec,
  dispatch: dispatchConfig,
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — kind-basic fixture (clean, no violations)', () => {
  it('produces 0 diagnostics', () => {
    const { diagnostics } = buildAndEvaluate('kind-basic');
    expect(diagnostics).toEqual([]);
  });

  it('binder still finds kind definitions', () => {
    const { allDefs } = buildAndEvaluate('kind-basic');
    const names = allDefs.map(d => d.name);
    expect(names).toContain('NoImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — kind-violations fixture', () => {
  it('detects violation in violating.ts', () => {
    const { diagnostics } = buildAndEvaluate('kind-violations');
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);

    const violation = diagnostics.find(d => d.fileName.includes('violating.ts'));
    expect(violation).toBeDefined();
    expect(violation!.kindName).toBe('NoImports');
    expect(violation!.property).toBe('noImports');
    expect(violation!.message).toContain('helper');
    expect(violation!.message).toContain('imported binding');
  });

  it('does not flag clean.ts', () => {
    const { diagnostics } = buildAndEvaluate('kind-violations');
    const cleanViolations = diagnostics.filter(d => d.fileName.includes('clean.ts'));
    expect(cleanViolations).toEqual([]);
  });

  it('does not flag unannotated functions', () => {
    const { diagnostics } = buildAndEvaluate('kind-violations');
    const helperViolations = diagnostics.filter(d => d.fileName.includes('helpers.ts'));
    expect(helperViolations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — individual attributes', () => {
  it('kindAnnotations finds NoImports on annotated declarations', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-violations');
    const violating = findCU(dnodeRoot, 'violating.ts')!;
    const varDecl = findDNodeByKind(violating, 'VariableDeclaration');
    expect(varDecl).toBeDefined();
    const annotations = varDecl!.attr('kindAnnotations');
    expect(annotations.length).toBeGreaterThan(0);
    expect(annotations[0].name).toBe('NoImports');
    expect(annotations[0].properties.noImports).toBe(true);
  });

  it('contextFor("noImports") is non-null inside annotated function body', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-violations');
    const violating = findCU(dnodeRoot, 'violating.ts')!;
    const arrowFn = findDNodeByKind(violating, 'ArrowFunction');
    expect(arrowFn).toBeDefined();
    const ctx = arrowFn!.attr('contextFor', 'noImports');
    expect(ctx).not.toBeNull();
    expect(ctx!.name).toBe('NoImports');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('checker — nodeCount (collection attribute)', () => {
  it('root nodeCount equals total number of nodes in the tree', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const rootCount = dnodeRoot.attr('nodeCount');
    expect(rootCount).toBeGreaterThan(0);

    // Verify by manual DFS count
    let manualCount = 0;
    const stack: Node[] = [dnodeRoot];
    while (stack.length > 0) {
      manualCount++;
      const d = stack.pop()!;
      stack.push(...d.children);
    }
    expect(rootCount).toBe(manualCount);
  });

  it('leaf nodes have nodeCount of 1', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');

    function findLeaf(d: Node): Node | undefined {
      if (d.children.length === 0) return d;
      for (const child of d.children) {
        const leaf = findLeaf(child);
        if (leaf) return leaf;
      }
      return undefined;
    }
    const leaf = findLeaf(dnodeRoot);
    expect(leaf).toBeDefined();
    expect(leaf!.attr('nodeCount')).toBe(1);
  });

  it('parent nodeCount >= child nodeCount + 1', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
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
// Binder attribute tests (merged from definitions.test.ts)
// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — kindDefs', () => {
  it('finds Kind<...> type aliases', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const allDefs = dnodeRoot.children.flatMap(cu => cu.attr('kindDefs'));
    const names = allDefs.map(d => d.name);
    expect(names).toContain('NoImports');
  });

  it('extracts properties from Kind type argument', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const allDefs = dnodeRoot.children.flatMap(cu => cu.attr('kindDefs'));
    const noImports = allDefs.find(d => d.name === 'NoImports');
    expect(noImports).toBeDefined();
    expect(noImports!.properties.noImports).toBe(true);
  });

  it('assigns unique IDs to definitions', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const allDefs = dnodeRoot.children.flatMap(cu => cu.attr('kindDefs'));
    const ids = allDefs.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not pick up non-Kind type aliases', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const allDefs = dnodeRoot.children.flatMap(cu => cu.attr('kindDefs'));
    const names = allDefs.map(d => d.name);
    expect(names).not.toContain('PropertySet');
  });
});

describe('binder attributes — kindDefs per file', () => {
  it('returns definitions for a compilation unit', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const kindsFile = findCU(dnodeRoot, 'kinds.ts');
    expect(kindsFile).toBeDefined();
    const defs = kindsFile!.attr('kindDefs');
    expect(defs.length).toBeGreaterThan(0);
    expect(defs[0].name).toBe('NoImports');
  });

  it('returns empty array for files with no kind definitions', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const mathFile = findCU(dnodeRoot, 'math.ts');
    expect(mathFile).toBeDefined();
    const defs = mathFile!.attr('kindDefs');
    expect(defs).toEqual([]);
  });
});

describe('binder attributes — defLookup', () => {
  it('any node can resolve a kind name', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const mathFile = findCU(dnodeRoot, 'math.ts')!;
    const resolver = mathFile.attr('defLookup');
    expect(resolver('NoImports')).toBeDefined();
    expect(resolver('NoImports')!.name).toBe('NoImports');
    expect(resolver('NoImports')!.properties.noImports).toBe(true);
  });

  it('returns undefined for unknown names', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const cu = dnodeRoot.children[0] as Node;
    const resolver = cu.attr('defLookup');
    expect(resolver('NonExistent')).toBeUndefined();
  });
});

describe('binder attributes — caching', () => {
  it('kindDefs returns the same array on repeated access', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const kindsFile = findCU(dnodeRoot, 'kinds.ts')!;
    const defs1 = kindsFile.attr('kindDefs');
    const defs2 = kindsFile.attr('kindDefs');
    expect(defs1).toBe(defs2);
  });

  it('defLookup returns the same function on repeated access', () => {
    const { dnodeRoot } = buildAndEvaluate('kind-basic');
    const cu = dnodeRoot.children[0] as Node;
    const lookup1 = cu.attr('defLookup');
    const lookup2 = cu.attr('defLookup');
    expect(lookup1).toBe(lookup2);
  });
});

describe('binder attributes — empty input', () => {
  it('returns empty results for files with no kinds', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const tsProgram = ts.createProgram([file], { strict: true, noEmit: true });
    const ksTree = frontend.convert(tsProgram);
    const dnodeRoot = evaluator.buildTree(ksTree.root);
    const allDefs = dnodeRoot.children.flatMap(cu => cu.attr('kindDefs'));
    expect(allDefs.length).toBe(0);
  });
});
