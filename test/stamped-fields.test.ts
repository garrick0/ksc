/**
 * Tests that stamped fields (sym*, isDefinitionSite, resolvedFileName,
 * isExported, localCount, typeString, importModuleSpecifier) have
 * correct values on converted AST nodes.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../generated/ts-ast/grammar/convert.js';
import type {
  KSNode, KSIdentifier, KSFunctionDeclaration, KSClassDeclaration,
  KSBlock, KSArrowFunction, KSVariableDeclaration,
} from '../generated/ts-ast/grammar/index.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

const _treeCache = new Map();
function buildTree(fixtureDir: string, depth: 'parse' | 'bind' | 'check' = 'check') {
  const key = `${fixtureDir}:${depth}`;
  if (_treeCache.has(key)) return _treeCache.get(key);
  const files = ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
  const tsProgram = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    rootDir: path.join(FIXTURES, fixtureDir),
  });
  const result = buildKSTree(tsProgram, depth);
  _treeCache.set(key, result);
  return result;
}

/** DFS find all nodes matching a predicate. */
function findNodes(root: KSNode, predicate: (n: KSNode) => boolean): KSNode[] {
  const results: KSNode[] = [];
  const stack: KSNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (predicate(node)) results.push(node);
    if (node.children) stack.push(...node.children);
  }
  return results;
}

function findCU(root: KSNode, fileSubstr: string): KSNode | undefined {
  return (root as any).compilationUnits?.find(
    (cu: any) => cu.fileName?.includes(fileSubstr),
  );
}

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — Identifier', () => {
  it('isDefinitionSite is true on function declaration names', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const greetDef = idents.find(i => i.escapedText === 'greet' && i.isDefinitionSite);
    expect(greetDef).toBeDefined();
  });

  it('isDefinitionSite is false on identifier references', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    // 'helper' used as a call — not a definition site
    const helperRefs = idents.filter(i => i.escapedText === 'helper' && !i.isDefinitionSite);
    expect(helperRefs.length).toBeGreaterThanOrEqual(1);
  });

  it('symIsFunction is true for function declaration identifiers', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const greetDef = idents.find(i => i.escapedText === 'greet' && i.isDefinitionSite);
    expect(greetDef!.symIsFunction).toBe(true);
  });

  it('symIsClass is true for class declaration identifiers', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const counterDef = idents.find(i => i.escapedText === 'Counter' && i.isDefinitionSite);
    expect(counterDef).toBeDefined();
    expect(counterDef!.symIsClass).toBe(true);
  });

  it('symIsAlias is true for import identifiers', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const helperImport = idents.find(i => i.escapedText === 'helper' && i.isDefinitionSite && i.symIsAlias);
    expect(helperImport).toBeDefined();
  });

  it('resolvedFileName is non-empty for import aliases', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const helperDef = idents.find(i => i.escapedText === 'helper' && i.isDefinitionSite && i.symIsAlias);
    expect(helperDef!.resolvedFileName).toContain('helper.ts');
  });

  it('importModuleSpecifier is set for import bindings', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    // The helper reference used inside the function (not the import definition site)
    const helperRef = idents.find(i => i.escapedText === 'helper' && i.resolvesToImport);
    expect(helperRef).toBeDefined();
    expect(helperRef!.importModuleSpecifier).toBe('./helper');
  });

  it('typeString is non-empty at check depth', () => {
    const tree = buildTree('stamped-fields', 'check');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const greetDef = idents.find(i => i.escapedText === 'greet' && i.isDefinitionSite);
    expect(greetDef!.typeString).toBeTruthy();
  });

  it('all sym* flags are false at parse depth', () => {
    const tree = buildTree('stamped-fields', 'parse');
    const cu = findCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    for (const ident of idents) {
      expect(ident.symIsFunction).toBe(false);
      expect(ident.symIsClass).toBe(false);
      expect(ident.symIsAlias).toBe(false);
      expect(ident.symIsVariable).toBe(false);
      expect(ident.resolvesToImport).toBe(false);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — isExported', () => {
  it('exported function has isExported = true', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet).toBeDefined();
    expect(greet!.isExported).toBe(true);
  });

  it('exported class has isExported = true', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const classes = findNodes(cu, n => n.kind === 'ClassDeclaration') as KSClassDeclaration[];
    expect(classes.length).toBeGreaterThanOrEqual(1);
    expect(classes[0].isExported).toBe(true);
  });

  it('non-exported arrow function variable has isExported = false', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const varDecls = findNodes(cu, n => n.kind === 'VariableDeclaration') as KSVariableDeclaration[];
    const internal = varDecls.find(v => (v.name as KSIdentifier).escapedText === 'internal');
    expect(internal).toBeDefined();
    expect(internal!.isExported).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — localCount', () => {
  it('function body block has localCount > 0', () => {
    const tree = buildTree('stamped-fields');
    const cu = findCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet).toBeDefined();
    expect(greet!.localCount).toBeGreaterThan(0);
  });

  it('localCount is 0 at parse depth', () => {
    const tree = buildTree('stamped-fields', 'parse');
    const cu = findCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.localCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — typeString', () => {
  it('function declaration has non-empty typeString at check depth', () => {
    const tree = buildTree('stamped-fields', 'check');
    const cu = findCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.typeString).toBeTruthy();
  });

  it('typeString is empty at parse depth', () => {
    const tree = buildTree('stamped-fields', 'parse');
    const cu = findCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.typeString).toBe('');
  });

  it('typeString is empty at bind depth', () => {
    const tree = buildTree('stamped-fields', 'bind');
    const cu = findCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.typeString).toBe('');
  });
});
