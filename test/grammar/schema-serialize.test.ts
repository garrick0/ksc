/**
 * Tests for schema-aware AST serialization.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from 'ksc/ts-kind-checking';
import {
  nodeToJSON,
  nodeFromJSON,
  treeToJSON,
  treeFromJSON,
  createNode,
} from '@ksc/language-ts-ast/grammar/index.js';
import type { JSONNode } from '@ksc/language-ts-ast/grammar/index.js';
import type { KSNode, KSIdentifier, KSIfStatement } from '@ksc/language-ts-ast/grammar/index.js';

const FIXTURES = path.resolve(__dirname, '../fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

// ────────────────────────────────────────────────────────────────────────

describe('nodeToJSON', () => {
  it('serializes a leaf node with scalar props', () => {
    const id = createNode('Identifier', { escapedText: 'foo' });
    const json = nodeToJSON(id);
    expect(json.kind).toBe('Identifier');
    expect(json.escapedText).toBe('foo');
    expect(json.pos).toBe(0);
    expect(json.end).toBe(0);
  });

  it('serializes a complex node with child + list fields', () => {
    const cond = createNode('Identifier', { escapedText: 'x' });
    const stmt1 = createNode('ReturnStatement');
    const stmt2 = createNode('ExpressionStatement', {
      expression: createNode('Identifier', { escapedText: 'y' }),
    });
    const block = createNode('Block', { statements: [stmt1, stmt2] });
    const ifStmt = createNode('IfStatement', { expression: cond, thenStatement: block });

    const json = nodeToJSON(ifStmt);
    expect(json.kind).toBe('IfStatement');
    expect((json.expression as JSONNode).kind).toBe('Identifier');
    expect((json.thenStatement as JSONNode).kind).toBe('Block');
    const stmts = (json.thenStatement as JSONNode).statements as JSONNode[];
    expect(stmts.length).toBe(2);
    expect(json.elseStatement).toBeUndefined();
  });

  it('omits empty lists and default-valued props', () => {
    const block = createNode('Block');
    const json = nodeToJSON(block);
    expect(json.statements).toBeUndefined();

    const id = createNode('Identifier'); // escapedText defaults to ''
    const idJson = nodeToJSON(id);
    expect(idJson.escapedText).toBeUndefined();
  });

  it('produces JSON-safe output (no circular refs)', () => {
    const tree = createNode('Program', {
      compilationUnits: [createNode('CompilationUnit', {
        fileName: 'test.ts',
        sourceText: 'const x = 1;',
      })],
    });
    const json = nodeToJSON(tree);
    const str = JSON.stringify(json);
    expect(str).toBeTruthy();
    const parsed = JSON.parse(str);
    expect(parsed.kind).toBe('Program');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('nodeFromJSON', () => {
  it('deserializes a leaf node with defaults for missing fields', () => {
    const json: JSONNode = { kind: 'Identifier', pos: 10, end: 13, text: 'foo', escapedText: 'foo' };
    const node = nodeFromJSON(json) as KSIdentifier;
    expect(node.kind).toBe('Identifier');
    expect(node.escapedText).toBe('foo');
    expect(node.pos).toBe(10);
    expect(node.children).toEqual([]);

    // Missing fields get defaults
    const minimal: JSONNode = { kind: 'Identifier', pos: 0, end: 0 };
    const minNode = nodeFromJSON(minimal) as KSIdentifier;
    expect(minNode.escapedText).toBe('');
  });

  it('deserializes a complex node and reconstructs children array', () => {
    const json: JSONNode = {
      kind: 'IfStatement',
      pos: 0,
      end: 50,
      expression: { kind: 'Identifier', pos: 4, end: 5, escapedText: 'x' },
      thenStatement: { kind: 'Block', pos: 7, end: 50 },
    };
    const node = nodeFromJSON(json) as KSIfStatement;
    expect(node.kind).toBe('IfStatement');
    expect(node.expression.kind).toBe('Identifier');
    expect(node.thenStatement.kind).toBe('Block');
    expect(node.elseStatement).toBeUndefined();
    expect(node.children.length).toBe(2);
    expect(node.children[0]).toBe(node.expression);
  });

  it('deserializes list fields', () => {
    const json: JSONNode = {
      kind: 'Block',
      pos: 0,
      end: 30,
      statements: [
        { kind: 'ReturnStatement', pos: 2, end: 10 },
        { kind: 'ReturnStatement', pos: 12, end: 20 },
      ],
    };
    const node = nodeFromJSON(json);
    expect((node as any).statements.length).toBe(2);
    expect(node.children.length).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('round-trip: nodeToJSON → nodeFromJSON', () => {
  it('round-trips a complex nested structure through JSON.stringify/parse', () => {
    const fn = createNode('FunctionDeclaration', {
      name: createNode('Identifier', { escapedText: 'add' }),
      parameters: [
        createNode('Parameter', { name: createNode('Identifier', { escapedText: 'a' }) }),
        createNode('Parameter', { name: createNode('Identifier', { escapedText: 'b' }) }),
      ],
      body: createNode('Block', {
        statements: [createNode('ReturnStatement', {
          expression: createNode('BinaryExpression', {
            left: createNode('Identifier', { escapedText: 'a' }),
            operatorToken: createNode('PlusToken'),
            right: createNode('Identifier', { escapedText: 'b' }),
          }),
        })],
      }),
    });

    const json = nodeToJSON(fn);
    const restored = nodeFromJSON(JSON.parse(JSON.stringify(json)));

    expect(restored.kind).toBe('FunctionDeclaration');
    const r = restored as any;
    expect(r.name.escapedText).toBe('add');
    expect(r.parameters.length).toBe(2);
    expect(r.body.statements[0].expression.kind).toBe('BinaryExpression');
    expect(r.children.length).toBeGreaterThan(0);
  });

  it('round-trips a VariableStatement with declarationKind', () => {
    const stmt = createNode('VariableStatement', {
      declarationList: createNode('VariableDeclarationList', {
        declarations: [createNode('VariableDeclaration', {
          name: createNode('Identifier', { escapedText: 'x' }),
          initializer: createNode('NumericLiteral', { value: '1' }),
        })],
        declarationKind: 'const',
      }),
    });

    const json = nodeToJSON(stmt);
    expect((json.declarationList as JSONNode).declarationKind).toBe('const');

    const restored = nodeFromJSON(JSON.parse(JSON.stringify(json)));
    expect((restored as any).declarationList.declarationKind).toBe('const');
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('treeToJSON / treeFromJSON', () => {
  it('round-trips a synthetic tree', () => {
    const tree = {
      root: createNode('Program', {
        compilationUnits: [createNode('CompilationUnit', {
          fileName: 'test.ts',
          sourceText: 'const x = 1;',
        })],
      }),
    };

    const json = treeToJSON(tree);
    expect(json.root.kind).toBe('Program');

    const restored = treeFromJSON(JSON.parse(JSON.stringify(json)));
    expect(restored.root.kind).toBe('Program');
    expect((restored.root as any).compilationUnits.length).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('real AST round-trip', () => {
  it('round-trips a parsed AST through JSON', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });
    const ksTree = program.getKSTree();
    const json = treeToJSON(ksTree);
    const str = JSON.stringify(json);
    const restored = treeFromJSON(JSON.parse(str));

    expect(restored.root.kind).toBe('Program');
    expect(restored.root.children.length).toBeGreaterThan(0);
    const cu = (restored.root as any).compilationUnits[0];
    expect(cu.kind).toBe('CompilationUnit');
    expect(cu.fileName).toBeTruthy();
  });

  it('preserves typed fields and node structure through round-trip', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });
    const ksTree = program.getKSTree();
    const restored = treeFromJSON(JSON.parse(JSON.stringify(treeToJSON(ksTree))));

    const stack: KSNode[] = [restored.root];
    let nodeCount = 0;
    const kindsFound = new Set<string>();
    while (stack.length > 0) {
      const n = stack.pop()!;
      nodeCount++;
      expect(typeof n.kind).toBe('string');
      expect(Array.isArray(n.children)).toBe(true);
      kindsFound.add(n.kind);
      stack.push(...n.children);
    }
    expect(nodeCount).toBeGreaterThan(20);
    expect(kindsFound.size).toBeGreaterThan(5);
  });

  it('preserves Identifier.escapedText', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });
    const ksTree = program.getKSTree();
    const restored = treeFromJSON(JSON.parse(JSON.stringify(treeToJSON(ksTree))));

    function findIdentifier(node: KSNode): KSIdentifier | null {
      if (node.kind === 'Identifier' && (node as KSIdentifier).escapedText) {
        return node as KSIdentifier;
      }
      for (const child of node.children) {
        const found = findIdentifier(child);
        if (found) return found;
      }
      return null;
    }

    const ident = findIdentifier(restored.root);
    expect(ident).toBeTruthy();
    expect(ident!.escapedText).toBeTruthy();
  });

  it('does not include circular refs or AG props in JSON output', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });
    const ksTree = program.getKSTree();
    const str = JSON.stringify(treeToJSON(ksTree));

    expect(str).not.toContain('"$parent"');
    expect(str).not.toContain('"$prev"');
    expect(str).not.toContain('"$next"');
    expect(str).not.toContain('"$root"');
    expect(str).not.toContain('"$agAttrs"');
  });
});
