import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../ast-schema/generated/convert.js';
import { buildTree, KSCDNode } from '../ksc-generated/evaluator.js';
import type { KindDefinition } from '../ksc-behavior/types.js';

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
  const dnodeRoot = buildTree(ksTree.root);
  return { ksTree, dnodeRoot };
}

/** Find a CU DNode by filename substring. */
function findCU(dnodeRoot: KSCDNode, fileSubstr: string): KSCDNode | undefined {
  return (dnodeRoot.children as KSCDNode[]).find(
    cu => (cu.node as any).fileName?.includes(fileSubstr),
  );
}

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — kindDefs', () => {
  it('finds Kind<...> type aliases', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const allDefs = (dnodeRoot.children as KSCDNode[]).flatMap(
      cu => cu.kindDefs(),
    );
    const names = allDefs.map(d => d.name);
    expect(names).toContain('NoImports');
  });

  it('extracts properties from Kind type argument', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const allDefs = (dnodeRoot.children as KSCDNode[]).flatMap(
      cu => cu.kindDefs(),
    );
    const noImports = allDefs.find(d => d.name === 'NoImports');
    expect(noImports).toBeDefined();
    expect(noImports!.properties.noImports).toBe(true);
  });

  it('assigns unique IDs to definitions', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const allDefs = (dnodeRoot.children as KSCDNode[]).flatMap(
      cu => cu.kindDefs(),
    );
    const ids = allDefs.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not pick up non-Kind type aliases', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const allDefs = (dnodeRoot.children as KSCDNode[]).flatMap(
      cu => cu.kindDefs(),
    );
    const names = allDefs.map(d => d.name);
    expect(names).not.toContain('PropertySet');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — kindDefs per file', () => {
  it('returns definitions for a compilation unit', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const kindsFile = findCU(dnodeRoot, 'kinds.ts');
    expect(kindsFile).toBeDefined();

    const defs = kindsFile!.kindDefs();
    expect(defs.length).toBeGreaterThan(0);
    expect(defs[0].name).toBe('NoImports');
  });

  it('returns empty array for files with no kind definitions', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const mathFile = findCU(dnodeRoot, 'math.ts');
    expect(mathFile).toBeDefined();

    const defs = mathFile!.kindDefs();
    expect(defs).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — defLookup', () => {
  it('any node can resolve a kind name', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const mathFile = findCU(dnodeRoot, 'math.ts')!;
    const resolver = mathFile.defLookup();
    expect(resolver('NoImports')).toBeDefined();
    expect(resolver('NoImports')!.name).toBe('NoImports');
    expect(resolver('NoImports')!.properties.noImports).toBe(true);
  });

  it('returns undefined for unknown names', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const cu = dnodeRoot.children[0] as KSCDNode;
    const resolver = cu.defLookup();
    expect(resolver('NonExistent')).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — caching', () => {
  it('kindDefs returns the same array on repeated access', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const kindsFile = findCU(dnodeRoot, 'kinds.ts')!;

    const defs1 = kindsFile.kindDefs();
    const defs2 = kindsFile.kindDefs();
    expect(defs1).toBe(defs2);
  });

  it('defLookup returns the same function on repeated access', () => {
    const { dnodeRoot } = createKSTree('kind-basic');

    const cu = dnodeRoot.children[0] as KSCDNode;
    const lookup1 = cu.defLookup();
    const lookup2 = cu.defLookup();
    expect(lookup1).toBe(lookup2);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('binder attributes — empty input', () => {
  it('returns empty results for files with no kinds', () => {
    const file = path.join(FIXTURES, 'checker-clean', 'src', 'pure', 'math.ts');
    const tsProgram = ts.createProgram([file], { strict: true, noEmit: true });
    const ksTree = buildKSTree(tsProgram);
    const dnodeRoot = buildTree(ksTree.root);

    const allDefs = (dnodeRoot.children as KSCDNode[]).flatMap(
      cu => cu.kindDefs(),
    );
    expect(allDefs.length).toBe(0);
  });
});
