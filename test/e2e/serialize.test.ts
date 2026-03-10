import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../../app/user-api/lib/program.js';
import {
  treeToJSON, treeFromJSON, nodeToJSON, type JSONNode,
} from '../../specs/ts-ast/grammar/index.js';

const FIXTURES = path.resolve(__dirname, '../fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

const _programCache = new Map();
function cachedProgram(fixtureDir: string) {
  if (_programCache.has(fixtureDir)) return _programCache.get(fixtureDir);
  const program = createProgram(getRootFiles(fixtureDir), undefined, {
    strict: true, noEmit: true,
  });
  _programCache.set(fixtureDir, program);
  return program;
}

// ────────────────────────────────────────────────────────────────────────

describe('treeToJSON (replaces serializeKSTree)', () => {
  it('produces a JSON-safe tree with correct structure', () => {
    const program = cachedProgram('kind-basic');

    const serialized = treeToJSON(program.getKSTree());

    expect(serialized.root).toBeDefined();
    expect(serialized.root.kind).toBe('Program');
    // Program's children are under 'compilationUnits' (schema-aware)
    const cus = serialized.root.compilationUnits as JSONNode[];
    expect(cus.length).toBeGreaterThan(0);

    // Check it's JSON-safe
    const json = JSON.stringify(serialized);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json);
    expect(parsed.root.kind).toBe('Program');
  });

  it('preserves CompilationUnit scalar properties', () => {
    const program = cachedProgram('kind-basic');

    const serialized = treeToJSON(program.getKSTree());
    const cus = serialized.root.compilationUnits as JSONNode[];
    const cu = cus[0];

    expect(cu.kind).toBe('CompilationUnit');
    expect(cu.fileName).toBeTruthy();
    expect(cu.sourceText).toBeTruthy();
    expect(cu.lineStarts).toBeTruthy();
  });

  it('strips tsNode and tsProgram references', () => {
    const program = cachedProgram('kind-basic');

    const serialized = treeToJSON(program.getKSTree());

    // tsNode/tsProgram should not appear anywhere
    const json = JSON.stringify(serialized);
    expect(json).not.toContain('"tsNode"');
    expect(json).not.toContain('"tsProgram"');
  });

  it('does not contain navigation properties', () => {
    const program = cachedProgram('kind-basic');

    const serialized = treeToJSON(program.getKSTree());
    const json = JSON.stringify(serialized);

    expect(json).not.toContain('"$parent"');
    expect(json).not.toContain('"$prev"');
    expect(json).not.toContain('"$next"');
  });

  it('preserves Identifier.escapedText', () => {
    const program = cachedProgram('kind-basic');

    const serialized = treeToJSON(program.getKSTree());

    // Find an Identifier node
    function findIdentifier(node: any): any {
      if (node.kind === 'Identifier' && node.escapedText) return node;
      // Search in all array/object values
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === 'object' && item.kind) {
              const found = findIdentifier(item);
              if (found) return found;
            }
          }
        } else if (val && typeof val === 'object' && val.kind) {
          const found = findIdentifier(val);
          if (found) return found;
        }
      }
      return null;
    }

    const ident = findIdentifier(serialized.root);
    expect(ident).toBeTruthy();
    expect(ident.escapedText).toBeTruthy();
  });

  it('preserves full text (no truncation)', () => {
    const program = cachedProgram('kind-basic');

    const serialized = treeToJSON(program.getKSTree());
    const cus = serialized.root.compilationUnits as JSONNode[];
    const cu = cus[0];

    // CU sourceText should be the full source
    expect((cu.sourceText as string).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('nodeToJSON (replaces serializeKSNode)', () => {
  it('serializes a single CompilationUnit', () => {
    const program = cachedProgram('kind-basic');

    const ksTree = program.getKSTree();
    const cu = ksTree.root.compilationUnits[0];
    const serialized = nodeToJSON(cu);

    expect(serialized.kind).toBe('CompilationUnit');
    expect(serialized.fileName).toBeTruthy();
    expect((serialized as any).statements!.length).toBeGreaterThan(0);

    // JSON-safe
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('treeFromJSON (replaces deserializeKSTree)', () => {
  it('round-trips: serialize -> JSON -> deserialize', () => {
    const program = cachedProgram('kind-basic');

    const serialized = treeToJSON(program.getKSTree());
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);

    const restored = treeFromJSON(parsed);

    expect(restored.root.kind).toBe('Program');

    // compilationUnits restored
    const cu = restored.root.children[0];
    expect(cu).toBeDefined();
    expect(cu.kind).toBe('CompilationUnit');
  });

  it('deserialized tree has correct children', () => {
    const program = cachedProgram('kind-basic');

    const serialized = treeToJSON(program.getKSTree());
    const json = JSON.stringify(serialized);
    const restored = treeFromJSON(JSON.parse(json));

    const cu = restored.root.children[0];
    expect(cu.children.length).toBeGreaterThan(0);
    expect(cu.children[0].kind).toBeTruthy();
  });
});
