/**
 * Unit tests for convert-helpers.ts — TS-specific extractor functions.
 *
 * Tests individual helper functions independently without full codegen.
 * Stateful helpers take a ConvertContext — no module init/teardown needed.
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import {
  type ConvertContext,
  hasSymFlag,
  checkIsDefinitionSite,
  isNodeExported,
  getLocalCount,
  getTypeString,
  isImportReference,
  extractJSDocComment,
  getDeclarationKind,
  getResolvedFileName,
  getImportModuleSpecifier,
  prefixUnaryOperatorMap,
  postfixUnaryOperatorMap,
  typeOperatorMap,
  heritageTokenMap,
  metaPropertyKeywordMap,
} from '../../specs/ts-ast/frontend/helpers.js';

// ── Test infrastructure ──────────────────────────────────────────────

function createProgram(code: string, fileName = '/tmp/test-helpers.ts'): {
  program: ts.Program;
  sf: ts.SourceFile;
  checker: ts.TypeChecker;
} {
  const host = ts.createCompilerHost({});
  const origReadFile = host.readFile;
  host.readFile = (fn: string) => fn === fileName ? code : origReadFile(fn);

  const program = ts.createProgram([fileName], { target: ts.ScriptTarget.Latest }, host);
  const sf = program.getSourceFile(fileName)!;
  const checker = program.getTypeChecker();
  return { program, sf, checker };
}

function findNodes(sf: ts.SourceFile, predicate: (node: ts.Node) => boolean): ts.Node[] {
  const results: ts.Node[] = [];
  function walk(node: ts.Node): void {
    if (predicate(node)) results.push(node);
    ts.forEachChild(node, walk);
  }
  walk(sf);
  return results;
}

function checkCtx(checker: ts.TypeChecker): ConvertContext {
  return { checker, depth: 'check' };
}

function bindCtx(checker: ts.TypeChecker): ConvertContext {
  return { checker, depth: 'bind' };
}

const NO_CHECKER: ConvertContext = { checker: undefined, depth: 'parse' };

// ── extractJSDocComment ─────────────────────────────────────────────

describe('extractJSDocComment', () => {
  it('returns empty for undefined comment', () => {
    expect(extractJSDocComment({})).toBe('');
  });

  it('returns string comment', () => {
    expect(extractJSDocComment({ comment: 'hello world' })).toBe('hello world');
  });

  it('returns empty for non-string comment', () => {
    expect(extractJSDocComment({ comment: ['not', 'a', 'string'] })).toBe('');
  });
});

// ── getDeclarationKind ──────────────────────────────────────────────

describe('getDeclarationKind', () => {
  it('returns const for Const flag', () => {
    expect(getDeclarationKind(ts.NodeFlags.Const)).toBe('const');
  });

  it('returns let for Let flag', () => {
    expect(getDeclarationKind(ts.NodeFlags.Let)).toBe('let');
  });

  it('returns var for no flags', () => {
    expect(getDeclarationKind(0)).toBe('var');
  });
});

// ── Operator maps ───────────────────────────────────────────────────

describe('operator maps', () => {
  it('prefixUnaryOperatorMap has expected entries', () => {
    expect(prefixUnaryOperatorMap[ts.SyntaxKind.PlusToken]).toBe('+');
    expect(prefixUnaryOperatorMap[ts.SyntaxKind.MinusToken]).toBe('-');
    expect(prefixUnaryOperatorMap[ts.SyntaxKind.ExclamationToken]).toBe('!');
    expect(prefixUnaryOperatorMap[ts.SyntaxKind.TildeToken]).toBe('~');
    expect(prefixUnaryOperatorMap[ts.SyntaxKind.PlusPlusToken]).toBe('++');
    expect(prefixUnaryOperatorMap[ts.SyntaxKind.MinusMinusToken]).toBe('--');
  });

  it('postfixUnaryOperatorMap has expected entries', () => {
    expect(postfixUnaryOperatorMap[ts.SyntaxKind.PlusPlusToken]).toBe('++');
    expect(postfixUnaryOperatorMap[ts.SyntaxKind.MinusMinusToken]).toBe('--');
  });

  it('typeOperatorMap has expected entries', () => {
    expect(typeOperatorMap[ts.SyntaxKind.KeyOfKeyword]).toBe('keyof');
    expect(typeOperatorMap[ts.SyntaxKind.UniqueKeyword]).toBe('unique');
    expect(typeOperatorMap[ts.SyntaxKind.ReadonlyKeyword]).toBe('readonly');
  });

  it('heritageTokenMap has expected entries', () => {
    expect(heritageTokenMap[ts.SyntaxKind.ExtendsKeyword]).toBe('extends');
    expect(heritageTokenMap[ts.SyntaxKind.ImplementsKeyword]).toBe('implements');
  });

  it('metaPropertyKeywordMap has expected entries', () => {
    expect(metaPropertyKeywordMap[ts.SyntaxKind.NewKeyword]).toBe('new');
    expect(metaPropertyKeywordMap[ts.SyntaxKind.ImportKeyword]).toBe('import');
  });
});

// ── checkIsDefinitionSite ───────────────────────────────────────────

describe('checkIsDefinitionSite', () => {
  it('returns true for variable declaration name', () => {
    const { sf } = createProgram('const myVar = 1;');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'myVar');
    expect(identifiers).toHaveLength(1);
    expect(checkIsDefinitionSite(identifiers[0])).toBe(true);
  });

  it('returns true for function declaration name', () => {
    const { sf } = createProgram('function myFn() {}');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'myFn');
    expect(identifiers).toHaveLength(1);
    expect(checkIsDefinitionSite(identifiers[0])).toBe(true);
  });

  it('returns false for reference use', () => {
    const { sf } = createProgram('const x = 1;\nconsole.log(x);');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'x');
    // First is definition, second is reference
    expect(identifiers.length).toBeGreaterThanOrEqual(2);
    expect(checkIsDefinitionSite(identifiers[0])).toBe(true);
    expect(checkIsDefinitionSite(identifiers[1])).toBe(false);
  });

  it('returns true for class declaration name', () => {
    const { sf } = createProgram('class MyClass {}');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'MyClass');
    expect(identifiers).toHaveLength(1);
    expect(checkIsDefinitionSite(identifiers[0])).toBe(true);
  });

  it('returns true for parameter name', () => {
    const { sf } = createProgram('function f(param: string) {}');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'param');
    expect(identifiers).toHaveLength(1);
    expect(checkIsDefinitionSite(identifiers[0])).toBe(true);
  });

  it('returns false for non-identifier', () => {
    const { sf } = createProgram('const x = 1;');
    const numLiterals = findNodes(sf, n => ts.isNumericLiteral(n));
    expect(numLiterals.length).toBeGreaterThan(0);
    expect(checkIsDefinitionSite(numLiterals[0])).toBe(false);
  });
});

// ── isNodeExported ──────────────────────────────────────────────────

describe('isNodeExported', () => {
  it('returns true for exported function', () => {
    const { sf } = createProgram('export function myFn() {}');
    const funcDecls = findNodes(sf, ts.isFunctionDeclaration);
    expect(funcDecls).toHaveLength(1);
    expect(isNodeExported(funcDecls[0])).toBe(true);
  });

  it('returns false for non-exported function', () => {
    const { sf } = createProgram('function myFn() {}');
    const funcDecls = findNodes(sf, ts.isFunctionDeclaration);
    expect(funcDecls).toHaveLength(1);
    expect(isNodeExported(funcDecls[0])).toBe(false);
  });

  it('returns true for exported class', () => {
    const { sf } = createProgram('export class MyClass {}');
    const classDecls = findNodes(sf, ts.isClassDeclaration);
    expect(classDecls).toHaveLength(1);
    expect(isNodeExported(classDecls[0])).toBe(true);
  });
});

// ── hasSymFlag (requires checker via context) ───────────────────────

describe('hasSymFlag', () => {
  it('returns true for function symbol', () => {
    const { sf, checker } = createProgram('function myFn() {}');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'myFn');
    expect(identifiers).toHaveLength(1);
    expect(hasSymFlag(checkCtx(checker), identifiers[0], ts.SymbolFlags.Function)).toBe(true);
  });

  it('returns false without checker', () => {
    const { sf } = createProgram('function myFn() {}');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'myFn');
    expect(identifiers).toHaveLength(1);
    expect(hasSymFlag(NO_CHECKER, identifiers[0], ts.SymbolFlags.Function)).toBe(false);
  });
});

// ── getLocalCount (requires checker via context) ────────────────────

describe('getLocalCount', () => {
  it('returns local count for function with variables', () => {
    const { sf, checker } = createProgram('function f() { const a = 1; const b = 2; }');
    // locals map lives on the function declaration, not the block
    const funcDecls = findNodes(sf, ts.isFunctionDeclaration);
    expect(funcDecls).toHaveLength(1);
    expect(getLocalCount(checkCtx(checker), funcDecls[0])).toBeGreaterThanOrEqual(2);
  });

  it('returns 0 without checker', () => {
    const { sf } = createProgram('function f() { const a = 1; }');
    const funcDecls = findNodes(sf, ts.isFunctionDeclaration);
    expect(funcDecls).toHaveLength(1);
    expect(getLocalCount(NO_CHECKER, funcDecls[0])).toBe(0);
  });
});

// ── getTypeString (requires checker at check depth) ─────────────────

describe('getTypeString', () => {
  it('returns type string at check depth', () => {
    const { sf, checker } = createProgram('const x = 42;');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'x');
    expect(identifiers).toHaveLength(1);
    const typeStr = getTypeString(checkCtx(checker), identifiers[0]);
    expect(typeStr).toBeTruthy();
  });

  it('returns empty at bind depth', () => {
    const { sf, checker } = createProgram('const x = 42;');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'x');
    expect(getTypeString(bindCtx(checker), identifiers[0])).toBe('');
  });

  it('returns empty without checker', () => {
    const { sf } = createProgram('const x = 42;');
    const identifiers = findNodes(sf, n => ts.isIdentifier(n) && n.text === 'x');
    expect(getTypeString(NO_CHECKER, identifiers[0])).toBe('');
  });
});
