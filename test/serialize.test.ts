import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../src/program.js';
import { serializeKSTree, serializeKSNode, deserializeKSTree } from '../src/pipeline/serialize.js';
import { exportDashboardData } from '../src/dashboard/export.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

// ────────────────────────────────────────────────────────────────────────

describe('serializeKSTree', () => {
  it('produces a JSON-safe tree with correct structure', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const serialized = serializeKSTree(program.getKSTree());

    expect(serialized.root).toBeDefined();
    expect(serialized.root.kind).toBe('Program');
    expect(serialized.root.children.length).toBeGreaterThan(0);

    // Check it's JSON-safe
    const json = JSON.stringify(serialized);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json);
    expect(parsed.root.kind).toBe('Program');
  });

  it('preserves CompilationUnit scalar properties', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const serialized = serializeKSTree(program.getKSTree());
    const cu = serialized.root.children[0];

    expect(cu.kind).toBe('CompilationUnit');
    expect(cu.fileName).toBeTruthy();
    expect(cu.sourceText).toBeTruthy();
    expect(cu.lineStarts).toBeTruthy();
  });

  it('strips tsNode and tsProgram references', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const serialized = serializeKSTree(program.getKSTree());

    // tsNode/tsProgram should not appear anywhere
    const json = JSON.stringify(serialized);
    expect(json).not.toContain('"tsNode"');
    expect(json).not.toContain('"tsProgram"');
  });

  it('strips AG navigation properties', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const serialized = serializeKSTree(program.getKSTree());
    const json = JSON.stringify(serialized);

    expect(json).not.toContain('"$parent"');
    expect(json).not.toContain('"$prev"');
    expect(json).not.toContain('"$next"');
  });

  it('preserves Identifier.escapedText', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const serialized = serializeKSTree(program.getKSTree());

    // Find an Identifier node
    function findIdentifier(node: any): any {
      if (node.kind === 'Identifier' && node.escapedText) return node;
      for (const child of node.children ?? []) {
        const found = findIdentifier(child);
        if (found) return found;
      }
      return null;
    }

    const ident = findIdentifier(serialized.root);
    expect(ident).toBeTruthy();
    expect(ident.escapedText).toBeTruthy();
  });

  it('preserves full text (no truncation)', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const serialized = serializeKSTree(program.getKSTree());
    const cu = serialized.root.children[0];

    // CU text should be the full source
    expect(cu.sourceText!.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('serializeKSNode', () => {
  it('serializes a single CompilationUnit', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const ksTree = program.getKSTree();
    const cu = ksTree.root.compilationUnits[0];
    const serialized = serializeKSNode(cu);

    expect(serialized.kind).toBe('CompilationUnit');
    expect(serialized.fileName).toBeTruthy();
    expect(serialized.children.length).toBeGreaterThan(0);

    // JSON-safe
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('deserializeKSTree', () => {
  it('round-trips: serialize → JSON → deserialize', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const serialized = serializeKSTree(program.getKSTree());
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);

    const restored = deserializeKSTree(parsed);

    expect(restored.root.kind).toBe('Program');
    expect((restored.root as any).$root).toBe(true);

    // compilationUnits is excluded from serialization; children holds CUs
    const cu = (restored.root as any).children[0];
    expect(cu).toBeDefined();
    expect((cu as any).$parent).toBe(restored.root);
  });

  it('deserialized tree has correct children', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const serialized = serializeKSTree(program.getKSTree());
    const json = JSON.stringify(serialized);
    const restored = deserializeKSTree(JSON.parse(json));

    const cu = (restored.root as any).children[0];
    expect(cu.children.length).toBeGreaterThan(0);
    expect((cu.children[0] as any).$parent).toBe(cu);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('dashboard export includes ksAst', () => {
  it('ksAst is present when includeSource is true', () => {
    // exportDashboardData imported at top
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const data = exportDashboardData(program, { includeSource: true });
    const sf = data.parse.sourceFiles[0];

    expect(sf.ksAst).toBeDefined();
    expect(sf.ksAst.kind).toBe('CompilationUnit');
    expect(sf.ksAst.children.length).toBeGreaterThan(0);
  });

  it('ksAst is absent when includeSource is false', () => {
    // exportDashboardData imported at top
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const data = exportDashboardData(program);
    const sf = data.parse.sourceFiles[0];

    expect(sf.ksAst).toBeUndefined();
  });

  it('ksAst includes AG attributes when includeAttributes is true', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const data = exportDashboardData(program, { includeSource: true, includeAttributes: true });
    const sf = data.parse.sourceFiles[0];

    expect(sf.ksAst).toBeDefined();

    // Walk ksAst to find a node that has kindDefs attribute
    function findAttr(node: any, key: string): any {
      if (node[key] !== undefined && node[key] !== null) return node;
      for (const child of node.children ?? []) {
        const found = findAttr(child, key);
        if (found) return found;
      }
      return null;
    }

    // kind-basic fixture defines a kind, so kindDefs should be present
    const nodeWithKindDefs = findAttr(sf.ksAst, 'kindDefs');
    expect(nodeWithKindDefs).toBeTruthy();
    expect(Array.isArray(nodeWithKindDefs.kindDefs)).toBe(true);
    expect(nodeWithKindDefs.kindDefs.length).toBeGreaterThan(0);
  });

  it('ksAst excludes AG attributes when includeAttributes is false', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });

    const data = exportDashboardData(program, { includeSource: true });
    const sf = data.parse.sourceFiles[0];

    expect(sf.ksAst).toBeDefined();

    // Walk ksAst — no node should have kindDefs
    const json = JSON.stringify(sf.ksAst);
    expect(json).not.toContain('"kindDefs"');
  });
});
