/**
 * Tests for generated node builder / factory functions.
 */
import { describe, it, expect } from 'vitest';
import {
  createIdentifier,
  createIfStatement,
  createBlock,
  createExpressionStatement,
  createBinaryExpression,
  createCallExpression,
  createStringLiteral,
  createNumericLiteral,
  createFunctionDeclaration,
  createVariableStatement,
  createVariableDeclarationList,
  createVariableDeclaration,
  createReturnStatement,
  createTypeReference,
  createParameter,
  createPropertyAccessExpression,
  createArrowFunction,
  createEqualsGreaterThanToken,
  createEqualsToken,
  createPlusToken,
  createClassDeclaration,
  createMethodDeclaration,
  createPropertyDeclaration,
  createHeritageClause,
  createExpressionWithTypeArguments,
  createImportDeclaration,
  createImportClause,
  createNamedImports,
  createImportSpecifier,
  createProgram,
  createCompilationUnit,
} from '../generated/ts-ast/grammar/builders.js';
import { getChildren } from '../generated/ts-ast/grammar/index.js';

describe('Node Builders', () => {
  describe('leaf nodes', () => {
    it('createEqualsToken produces valid leaf', () => {
      const token = createEqualsToken();
      expect(token.kind).toBe('EqualsToken');
      expect(token.pos).toBe(0);
      expect(token.end).toBe(0);
      expect(token.text).toBe('');
      expect(token.children).toEqual([]);
    });

    it('createPlusToken produces valid leaf', () => {
      const token = createPlusToken();
      expect(token.kind).toBe('PlusToken');
      expect(token.children).toEqual([]);
    });
  });

  describe('simple nodes', () => {
    it('createIdentifier with escapedText', () => {
      const id = createIdentifier({ escapedText: 'foo' });
      expect(id.kind).toBe('Identifier');
      expect(id.escapedText).toBe('foo');
      expect(id.children).toEqual([]);
    });

    it('createIdentifier with no args (all optional)', () => {
      const id = createIdentifier();
      expect(id.kind).toBe('Identifier');
      expect(id.escapedText).toBe('');
    });

    it('createStringLiteral', () => {
      const lit = createStringLiteral({ value: 'hello' });
      expect(lit.kind).toBe('StringLiteral');
      expect(lit.value).toBe('hello');
    });

    it('createNumericLiteral', () => {
      const lit = createNumericLiteral({ value: '42' });
      expect(lit.kind).toBe('NumericLiteral');
      expect(lit.value).toBe('42');
    });
  });

  describe('complex nodes with children', () => {
    it('createIfStatement computes children correctly', () => {
      const cond = createIdentifier({ escapedText: 'x' });
      const then = createBlock();
      const ifStmt = createIfStatement({
        expression: cond,
        thenStatement: then,
      });

      expect(ifStmt.kind).toBe('IfStatement');
      expect(ifStmt.expression).toBe(cond);
      expect(ifStmt.thenStatement).toBe(then);
      expect(ifStmt.elseStatement).toBeUndefined();
      expect(ifStmt.children).toEqual([cond, then]);
    });

    it('createIfStatement with else includes it in children', () => {
      const cond = createIdentifier({ escapedText: 'y' });
      const then = createBlock();
      const elseBlock = createBlock();
      const ifStmt = createIfStatement({
        expression: cond,
        thenStatement: then,
        elseStatement: elseBlock,
      });

      expect(ifStmt.elseStatement).toBe(elseBlock);
      expect(ifStmt.children).toEqual([cond, then, elseBlock]);
    });

    it('createBlock with statements', () => {
      const stmt1 = createReturnStatement();
      const stmt2 = createExpressionStatement({
        expression: createIdentifier({ escapedText: 'x' }),
      });
      const block = createBlock({ statements: [stmt1, stmt2] });

      expect(block.kind).toBe('Block');
      expect(block.statements).toEqual([stmt1, stmt2]);
      expect(block.children).toEqual([stmt1, stmt2]);
    });

    it('createBinaryExpression', () => {
      const left = createNumericLiteral({ value: '1' });
      const op = createPlusToken();
      const right = createNumericLiteral({ value: '2' });
      const expr = createBinaryExpression({
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

    it('createCallExpression with arguments', () => {
      const fn = createIdentifier({ escapedText: 'console' });
      const arg = createStringLiteral({ value: 'hello' });
      const call = createCallExpression({
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
    it('createFunctionDeclaration', () => {
      const name = createIdentifier({ escapedText: 'add' });
      const paramA = createParameter({
        name: createIdentifier({ escapedText: 'a' }),
      });
      const body = createBlock({
        statements: [createReturnStatement({
          expression: createIdentifier({ escapedText: 'a' }),
        })],
      });

      const fn = createFunctionDeclaration({
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

    it('createVariableStatement with const', () => {
      const decl = createVariableDeclaration({
        name: createIdentifier({ escapedText: 'x' }),
        initializer: createNumericLiteral({ value: '42' }),
      });
      const declList = createVariableDeclarationList({
        declarations: [decl],
        declarationKind: 'const',
      });
      const stmt = createVariableStatement({ declarationList: declList });

      expect(stmt.kind).toBe('VariableStatement');
      expect(declList.declarationKind).toBe('const');
      expect(declList.declarations).toEqual([decl]);
    });

    it('createClassDeclaration with members', () => {
      const name = createIdentifier({ escapedText: 'MyClass' });
      const prop = createPropertyDeclaration({
        name: createIdentifier({ escapedText: 'x' }),
      });
      const method = createMethodDeclaration({
        name: createIdentifier({ escapedText: 'doStuff' }),
      });

      const cls = createClassDeclaration({
        name,
        members: [prop, method],
      });

      expect(cls.kind).toBe('ClassDeclaration');
      expect(cls.name).toBe(name);
      expect(cls.members).toEqual([prop, method]);
    });

    it('createImportDeclaration', () => {
      const spec = createImportSpecifier({
        name: createIdentifier({ escapedText: 'foo' }),
      });
      const namedImports = createNamedImports({ elements: [spec] });
      const clause = createImportClause({ namedBindings: namedImports });
      const decl = createImportDeclaration({
        importClause: clause,
        moduleSpecifier: createStringLiteral({ value: './foo' }),
      });

      expect(decl.kind).toBe('ImportDeclaration');
      expect(decl.importClause).toBe(clause);
    });
  });

  describe('heritage and type references', () => {
    it('createHeritageClause', () => {
      const baseExpr = createExpressionWithTypeArguments({
        expression: createIdentifier({ escapedText: 'Base' }),
      });
      const heritage = createHeritageClause({
        token: 'extends',
        types: [baseExpr],
      });

      expect(heritage.kind).toBe('HeritageClause');
      expect(heritage.token).toBe('extends');
      expect(heritage.types).toEqual([baseExpr]);
    });

    it('createTypeReference', () => {
      const ref = createTypeReference({
        typeName: createIdentifier({ escapedText: 'Promise' }),
        typeArguments: [],
      });
      expect(ref.kind).toBe('TypeReference');
      expect((ref.typeName as any).escapedText).toBe('Promise');
    });
  });

  describe('arrow functions', () => {
    it('createArrowFunction with expression body', () => {
      const body = createIdentifier({ escapedText: 'x' });
      const arrow = createArrowFunction({
        equalsGreaterThanToken: createEqualsGreaterThanToken(),
        body,
        parameters: [createParameter({
          name: createIdentifier({ escapedText: 'x' }),
        })],
      });

      expect(arrow.kind).toBe('ArrowFunction');
      expect(arrow.body).toBe(body);
      expect(arrow.children).toContain(body);
    });
  });

  describe('program and compilation unit', () => {
    it('createProgram wraps compilation units', () => {
      const cu = createCompilationUnit({
        fileName: 'test.ts',
        sourceText: 'const x = 1;',
      });
      const prog = createProgram({ compilationUnits: [cu] });

      expect(prog.kind).toBe('Program');
      expect(prog.compilationUnits).toEqual([cu]);
      expect(prog.children).toEqual([cu]);
    });
  });

  describe('getChildren compatibility', () => {
    it('getChildren returns same nodes as children array for builder-created nodes', () => {
      const cond = createIdentifier({ escapedText: 'x' });
      const then = createBlock({
        statements: [createReturnStatement()],
      });
      const ifStmt = createIfStatement({
        expression: cond,
        thenStatement: then,
      });

      const schemaChildren = getChildren(ifStmt);
      expect(schemaChildren).toEqual(ifStmt.children);
    });
  });
});
