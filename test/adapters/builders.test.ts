/**
 * Tests for the generic createNode builder function.
 */
import { describe, it, expect } from 'vitest';
import { createNode, getChildren } from '../../specs/ts-ast/grammar/index.js';

describe('createNode', () => {
  describe('leaf nodes', () => {
    it('creates a valid leaf node', () => {
      const token = createNode('EqualsToken');
      expect(token.kind).toBe('EqualsToken');
      expect(token.pos).toBe(0);
      expect(token.end).toBe(0);
      expect(token.text).toBe('');
      expect(token.children).toEqual([]);
    });

    it('creates another leaf node', () => {
      const token = createNode('PlusToken');
      expect(token.kind).toBe('PlusToken');
      expect(token.children).toEqual([]);
    });
  });

  describe('simple nodes', () => {
    it('creates Identifier with escapedText', () => {
      const id = createNode('Identifier', { escapedText: 'foo' });
      expect(id.kind).toBe('Identifier');
      expect(id.escapedText).toBe('foo');
      expect(id.children).toEqual([]);
    });

    it('creates Identifier with no args (all defaults)', () => {
      const id = createNode('Identifier');
      expect(id.kind).toBe('Identifier');
      expect(id.escapedText).toBe('');
    });

    it('creates StringLiteral', () => {
      const lit = createNode('StringLiteral', { value: 'hello' });
      expect(lit.kind).toBe('StringLiteral');
      expect(lit.value).toBe('hello');
    });

    it('creates NumericLiteral', () => {
      const lit = createNode('NumericLiteral', { value: '42' });
      expect(lit.kind).toBe('NumericLiteral');
      expect(lit.value).toBe('42');
    });
  });

  describe('complex nodes with children', () => {
    it('computes children correctly for IfStatement', () => {
      const cond = createNode('Identifier', { escapedText: 'x' });
      const then = createNode('Block');
      const ifStmt = createNode('IfStatement', {
        expression: cond,
        thenStatement: then,
      });

      expect(ifStmt.kind).toBe('IfStatement');
      expect(ifStmt.expression).toBe(cond);
      expect(ifStmt.thenStatement).toBe(then);
      expect(ifStmt.elseStatement).toBeUndefined();
      expect(ifStmt.children).toEqual([cond, then]);
    });

    it('includes elseStatement in children when present', () => {
      const cond = createNode('Identifier', { escapedText: 'y' });
      const then = createNode('Block');
      const elseBlock = createNode('Block');
      const ifStmt = createNode('IfStatement', {
        expression: cond,
        thenStatement: then,
        elseStatement: elseBlock,
      });

      expect(ifStmt.elseStatement).toBe(elseBlock);
      expect(ifStmt.children).toEqual([cond, then, elseBlock]);
    });

    it('creates Block with statements', () => {
      const stmt1 = createNode('ReturnStatement');
      const stmt2 = createNode('ExpressionStatement', {
        expression: createNode('Identifier', { escapedText: 'x' }),
      });
      const block = createNode('Block', { statements: [stmt1, stmt2] });

      expect(block.kind).toBe('Block');
      expect(block.statements).toEqual([stmt1, stmt2]);
      expect(block.children).toEqual([stmt1, stmt2]);
    });

    it('creates BinaryExpression', () => {
      const left = createNode('NumericLiteral', { value: '1' });
      const op = createNode('PlusToken');
      const right = createNode('NumericLiteral', { value: '2' });
      const expr = createNode('BinaryExpression', {
        left,
        operatorToken: op,
        right,
      });

      expect(expr.kind).toBe('BinaryExpression');
      expect(expr.left).toBe(left);
      expect(expr.operatorToken).toBe(op);
      expect(expr.right).toBe(right);
      expect(expr.children).toEqual([left, op, right]);
    });

    it('creates CallExpression with arguments', () => {
      const fn = createNode('Identifier', { escapedText: 'console' });
      const arg = createNode('StringLiteral', { value: 'hello' });
      const call = createNode('CallExpression', {
        expression: fn,
        arguments: [arg],
      });

      expect(call.kind).toBe('CallExpression');
      expect(call.expression).toBe(fn);
      expect(call.arguments).toEqual([arg]);
      expect(call.typeArguments).toEqual([]);
      expect(call.children).toContain(fn);
      expect(call.children).toContain(arg);
    });
  });

  describe('declaration builders', () => {
    it('creates FunctionDeclaration', () => {
      const name = createNode('Identifier', { escapedText: 'add' });
      const paramA = createNode('Parameter', {
        name: createNode('Identifier', { escapedText: 'a' }),
      });
      const body = createNode('Block', {
        statements: [createNode('ReturnStatement', {
          expression: createNode('Identifier', { escapedText: 'a' }),
        })],
      });

      const fn = createNode('FunctionDeclaration', {
        name,
        parameters: [paramA],
        body,
      });

      expect(fn.kind).toBe('FunctionDeclaration');
      expect(fn.name).toBe(name);
      expect(fn.parameters).toEqual([paramA]);
      expect(fn.body).toBe(body);
      expect(fn.children).toContain(name);
      expect(fn.children).toContain(paramA);
      expect(fn.children).toContain(body);
    });

    it('creates VariableStatement with const', () => {
      const decl = createNode('VariableDeclaration', {
        name: createNode('Identifier', { escapedText: 'x' }),
        initializer: createNode('NumericLiteral', { value: '42' }),
      });
      const declList = createNode('VariableDeclarationList', {
        declarations: [decl],
        declarationKind: 'const',
      });
      const stmt = createNode('VariableStatement', { declarationList: declList });

      expect(stmt.kind).toBe('VariableStatement');
      expect(declList.declarationKind).toBe('const');
      expect(declList.declarations).toEqual([decl]);
    });

    it('creates ClassDeclaration with members', () => {
      const name = createNode('Identifier', { escapedText: 'MyClass' });
      const prop = createNode('PropertyDeclaration', {
        name: createNode('Identifier', { escapedText: 'x' }),
      });
      const method = createNode('MethodDeclaration', {
        name: createNode('Identifier', { escapedText: 'doStuff' }),
      });

      const cls = createNode('ClassDeclaration', {
        name,
        members: [prop, method],
      });

      expect(cls.kind).toBe('ClassDeclaration');
      expect(cls.name).toBe(name);
      expect(cls.members).toEqual([prop, method]);
    });

    it('creates ImportDeclaration', () => {
      const spec = createNode('ImportSpecifier', {
        name: createNode('Identifier', { escapedText: 'foo' }),
      });
      const namedImports = createNode('NamedImports', { elements: [spec] });
      const clause = createNode('ImportClause', { namedBindings: namedImports });
      const decl = createNode('ImportDeclaration', {
        importClause: clause,
        moduleSpecifier: createNode('StringLiteral', { value: './foo' }),
      });

      expect(decl.kind).toBe('ImportDeclaration');
      expect(decl.importClause).toBe(clause);
    });
  });

  describe('heritage and type references', () => {
    it('creates HeritageClause', () => {
      const baseExpr = createNode('ExpressionWithTypeArguments', {
        expression: createNode('Identifier', { escapedText: 'Base' }),
      });
      const heritage = createNode('HeritageClause', {
        token: 'extends',
        types: [baseExpr],
      });

      expect(heritage.kind).toBe('HeritageClause');
      expect(heritage.token).toBe('extends');
      expect(heritage.types).toEqual([baseExpr]);
    });

    it('creates TypeReference', () => {
      const ref = createNode('TypeReference', {
        typeName: createNode('Identifier', { escapedText: 'Promise' }),
        typeArguments: [],
      });
      expect(ref.kind).toBe('TypeReference');
      expect((ref.typeName as any).escapedText).toBe('Promise');
    });
  });

  describe('arrow functions', () => {
    it('creates ArrowFunction with expression body', () => {
      const body = createNode('Identifier', { escapedText: 'x' });
      const arrow = createNode('ArrowFunction', {
        equalsGreaterThanToken: createNode('EqualsGreaterThanToken'),
        body,
        parameters: [createNode('Parameter', {
          name: createNode('Identifier', { escapedText: 'x' }),
        })],
      });

      expect(arrow.kind).toBe('ArrowFunction');
      expect(arrow.body).toBe(body);
      expect(arrow.children).toContain(body);
    });
  });

  describe('program and compilation unit', () => {
    it('creates Program wrapping compilation units', () => {
      const cu = createNode('CompilationUnit', {
        fileName: 'test.ts',
        sourceText: 'const x = 1;',
      });
      const prog = createNode('Program', { compilationUnits: [cu] });

      expect(prog.kind).toBe('Program');
      expect(prog.compilationUnits).toEqual([cu]);
      expect(prog.children).toEqual([cu]);
    });
  });

  describe('getChildren compatibility', () => {
    it('getChildren returns same nodes as children array for builder-created nodes', () => {
      const cond = createNode('Identifier', { escapedText: 'x' });
      const then = createNode('Block', {
        statements: [createNode('ReturnStatement')],
      });
      const ifStmt = createNode('IfStatement', {
        expression: cond,
        thenStatement: then,
      });

      const schemaChildren = getChildren(ifStmt);
      expect(schemaChildren).toEqual(ifStmt.children);
    });
  });
});
