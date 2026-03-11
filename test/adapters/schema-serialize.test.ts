/**
 * Tests for schema-aware AST serialization (generated serialize.ts).
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from '../../src/application/index.js';
import {
  nodeToJSON,
  nodeFromJSON,
  treeToJSON,
  treeFromJSON,
  createNode,
} from '../../src/adapters/grammar/grammar/ts-ast/index.js';
import type { JSONNode } from '../../src/adapters/grammar/grammar/ts-ast/index.js';
import type { KSNode, KSIdentifier, KSIfStatement } from '../../src/adapters/grammar/grammar/ts-ast/index.js';

const FIXTURES = path.resolve(__dirname, '../fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

// ────────────────────────────────────────────────────────────────────────

describe('nodeToJSON', () => {
  it('serializes a leaf node', () => {
    const id = createNode('Identifier', { escapedText: 'foo' });
    const json = nodeToJSON(id);
    expect(json.kind).toBe('Identifier');
    expect(json.escapedText).toBe('foo');
    expect(json.pos).toBe(0);
    expect(json.end).toBe(0);
    // text is '' so should be omitted
    expect(json.text).toBeUndefined();
  });

  it('serializes a complex node with children', () => {
    const cond = createNode('Identifier', { escapedText: 'x' });
    const then = createNode('Block');
    const ifStmt = createNode('IfStatement', { expression: cond, thenStatement: then });

    const json = nodeToJSON(ifStmt);
    expect(json.kind).toBe('IfStatement');
    expect((json.expression as JSONNode).kind).toBe('Identifier');
    expect((json.expression as JSONNode).escapedText).toBe('x');
    expect((json.thenStatement as JSONNode).kind).toBe('Block');
    expect(json.elseStatement).toBeUndefined(); // optional, not present
  });

  it('serializes list fields', () => {
    const stmt1 = createNode('ReturnStatement');
    const stmt2 = createNode('ExpressionStatement', {
      expression: createNode('Identifier', { escapedText: 'y' }),
    });
    const block = createNode('Block', { statements: [stmt1, stmt2] });

    const json = nodeToJSON(block);
    expect(json.kind).toBe('Block');
    expect(Array.isArray(json.statements)).toBe(true);
    const stmts = json.statements as JSONNode[];
    expect(stmts.length).toBe(2);
    expect(stmts[0].kind).toBe('ReturnStatement');
    expect(stmts[1].kind).toBe('ExpressionStatement');
  });

  it('omits empty lists', () => {
    const block = createNode('Block');
    const json = nodeToJSON(block);
    expect(json.statements).toBeUndefined();
  });

  it('preserves prop fields', () => {
    const lit = createNode('StringLiteral', { value: 'hello' });
    const json = nodeToJSON(lit);
    expect(json.value).toBe('hello');
  });

  it('omits default-valued prop fields (false, empty string)', () => {
    const id = createNode('Identifier'); // escapedText defaults to ''
    const json = nodeToJSON(id);
    expect(json.escapedText).toBeUndefined(); // '' is omitted
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
  it('deserializes a leaf node', () => {
    const json: JSONNode = { kind: 'Identifier', pos: 10, end: 13, text: 'foo', escapedText: 'foo' };
    const node = nodeFromJSON(json) as KSIdentifier;
    expect(node.kind).toBe('Identifier');
    expect(node.escapedText).toBe('foo');
    expect(node.pos).toBe(10);
    expect(node.end).toBe(13);
    expect(node.text).toBe('foo');
    expect(node.children).toEqual([]);
  });

  it('deserializes a complex node with children array reconstructed', () => {
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
    expect((node.expression as KSIdentifier).escapedText).toBe('x');
    expect(node.thenStatement.kind).toBe('Block');
    expect(node.elseStatement).toBeUndefined();

    // children should contain expression and thenStatement
    expect(node.children.length).toBe(2);
    expect(node.children[0]).toBe(node.expression);
    expect(node.children[1]).toBe(node.thenStatement);
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
    expect(node.kind).toBe('Block');
    expect((node as any).statements.length).toBe(2);
    expect(node.children.length).toBe(2);
  });

  it('defaults missing prop fields', () => {
    const json: JSONNode = { kind: 'Identifier', pos: 0, end: 0 };
    const node = nodeFromJSON(json) as KSIdentifier;
    expect(node.escapedText).toBe('');
  });

  it('defaults missing list fields to empty array', () => {
    const json: JSONNode = { kind: 'Block', pos: 0, end: 0 };
    const node = nodeFromJSON(json);
    expect((node as any).statements).toEqual([]);
    expect(node.children).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('round-trip: nodeToJSON → nodeFromJSON', () => {
  it('round-trips a simple node', () => {
    const original = createNode('Identifier', { escapedText: 'myVar' });
    const json = nodeToJSON(original);
    const restored = nodeFromJSON(json) as KSIdentifier;
    expect(restored.kind).toBe(original.kind);
    expect(restored.escapedText).toBe(original.escapedText);
  });

  it('round-trips a complex nested structure', () => {
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
    const jsonStr = JSON.stringify(json);
    const parsed = JSON.parse(jsonStr);
    const restored = nodeFromJSON(parsed);

    expect(restored.kind).toBe('FunctionDeclaration');
    const r = restored as any;
    expect(r.name.escapedText).toBe('add');
    expect(r.parameters.length).toBe(2);
    expect(r.parameters[0].name.escapedText).toBe('a');
    expect(r.parameters[1].name.escapedText).toBe('b');
    expect(r.body.statements.length).toBe(1);
    expect(r.body.statements[0].kind).toBe('ReturnStatement');
    expect(r.body.statements[0].expression.kind).toBe('BinaryExpression');

    // Children must be reconstructed
    expect(r.children.length).toBeGreaterThan(0);
    expect(r.body.children.length).toBe(1);
  });

  it('round-trips through JSON.stringify/parse', () => {
    const block = createNode('Block', {
      statements: [
        createNode('ExpressionStatement', {
          expression: createNode('BinaryExpression', {
            left: createNode('NumericLiteral', { value: '1' }),
            operatorToken: createNode('PlusToken'),
            right: createNode('NumericLiteral', { value: '2' }),
          }),
        }),
      ],
    });

    const json = JSON.parse(JSON.stringify(nodeToJSON(block)));
    const restored = nodeFromJSON(json);
    const s = (restored as any).statements[0];
    expect(s.expression.left.value).toBe('1');
    expect(s.expression.right.value).toBe('2');
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

    const jsonStr = JSON.stringify(json);
    const parsed = JSON.parse(jsonStr);
    const restored = treeFromJSON(parsed);

    expect(restored.root.kind).toBe('Program');
    expect((restored.root as any).compilationUnits).toBeDefined();
    expect((restored.root as any).compilationUnits.length).toBe(1);
    expect((restored.root as any).compilationUnits[0].kind).toBe('CompilationUnit');
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

    // JSON-safe
    const str = JSON.stringify(json);
    expect(str.length).toBeGreaterThan(100);

    // Round-trip
    const parsed = JSON.parse(str);
    const restored = treeFromJSON(parsed);
    expect(restored.root.kind).toBe('Program');
    expect(restored.root.children.length).toBeGreaterThan(0);

    // compilationUnits reconstructed
    const cu = (restored.root as any).compilationUnits[0];
    expect(cu).toBeDefined();
    expect(cu.kind).toBe('CompilationUnit');
    expect(cu.fileName).toBeTruthy();
  });

  it('preserves typed fields through round-trip', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });
    const ksTree = program.getKSTree();
    const json = treeToJSON(ksTree);
    const str = JSON.stringify(json);
    const restored = treeFromJSON(JSON.parse(str));

    // Walk and verify every node has kind + children
    const stack: KSNode[] = [restored.root];
    let nodeCount = 0;
    const kindsFound = new Set<string>();
    while (stack.length > 0) {
      const n = stack.pop()!;
      nodeCount++;
      expect(typeof n.kind).toBe('string');
      expect(n.kind.length).toBeGreaterThan(0);
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
    const json = treeToJSON(ksTree);
    const restored = treeFromJSON(JSON.parse(JSON.stringify(json)));

    // Find an Identifier with escapedText
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
    const json = treeToJSON(ksTree);
    const str = JSON.stringify(json);

    expect(str).not.toContain('"$parent"');
    expect(str).not.toContain('"$prev"');
    expect(str).not.toContain('"$next"');
    expect(str).not.toContain('"$root"');
    expect(str).not.toContain('"$agAttrs"');
  });

  it('uses typed fields instead of children for most nodes', () => {
    const program = createProgram(getRootFiles('kind-basic'), undefined, {
      strict: true, noEmit: true,
    });
    const ksTree = program.getKSTree();
    const json = treeToJSON(ksTree);

    // Most nodes use typed fields (expression, statements, name, etc.)
    // CompilationUnit now uses 'statements' as its named child field
    const cu = (json.root as any).compilationUnits[0];
    expect(cu.statements).toBeDefined(); // CompilationUnit uses statements field
    expect(cu.fileName).toBeTruthy();  // props are still present

    // A TypeAliasDeclaration uses typed fields, no children key
    const typeAlias = cu.statements.find((c: any) => c.kind === 'TypeAliasDeclaration');
    if (typeAlias) {
      expect(typeAlias.name).toBeDefined();
      expect(typeAlias.name.kind).toBe('Identifier');
      expect(typeAlias.children).toBeUndefined(); // not a props-only node
    }
  });
});
