/**
 * Tests that stamped fields (sym*, isDefinitionSite, resolvedFileName,
 * isExported, localCount, typeString, importModuleSpecifier) have
 * correct values on converted AST nodes.
 */
import { describe, it, expect } from 'vitest';
import type {
  KSNode, KSIdentifier, KSFunctionDeclaration, KSClassDeclaration,
  KSBlock, KSArrowFunction, KSVariableDeclaration,
} from '@ksc/language-ts-ast/grammar/index.js';
import { buildKSTree, findKSNodeCU, findNodes } from '../helpers/fixtures.js';

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — Identifier definition + sym flags', () => {
  it('isDefinitionSite, symIsFunction, symIsClass, symIsAlias on correct nodes', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];

    // Definition site
    const greetDef = idents.find(i => i.escapedText === 'greet' && i.isDefinitionSite);
    expect(greetDef).toBeDefined();
    expect(greetDef!.symIsFunction).toBe(true);

    // Reference is not a definition
    const helperRefs = idents.filter(i => i.escapedText === 'helper' && !i.isDefinitionSite);
    expect(helperRefs.length).toBeGreaterThanOrEqual(1);

    // Class
    const counterDef = idents.find(i => i.escapedText === 'Counter' && i.isDefinitionSite);
    expect(counterDef).toBeDefined();
    expect(counterDef!.symIsClass).toBe(true);

    // Import alias
    const helperImport = idents.find(i => i.escapedText === 'helper' && i.isDefinitionSite && i.symIsAlias);
    expect(helperImport).toBeDefined();
  });
});

describe('stamped fields — import resolution', () => {
  it('resolvedFileName, importModuleSpecifier, and resolvesToImport', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];

    const helperDef = idents.find(i => i.escapedText === 'helper' && i.isDefinitionSite && i.symIsAlias);
    expect(helperDef!.resolvedFileName).toContain('helper.ts');

    const helperRef = idents.find(i => i.escapedText === 'helper' && i.resolvesToImport);
    expect(helperRef).toBeDefined();
    expect(helperRef!.importModuleSpecifier).toBe('./helper');
  });
});

describe('stamped fields — depth behavior', () => {
  it('typeString non-empty at check depth, all sym* false and typeString empty at parse depth', () => {
    const checkTree = buildKSTree('stamped-fields', 'check');
    const checkCU = findKSNodeCU(checkTree.root, 'sample.ts')!;
    const checkIdents = findNodes(checkCU, n => n.kind === 'Identifier') as KSIdentifier[];
    const greetCheck = checkIdents.find(i => i.escapedText === 'greet' && i.isDefinitionSite);
    expect(greetCheck!.typeString).toBeTruthy();

    const parseTree = buildKSTree('stamped-fields', 'parse');
    const parseCU = findKSNodeCU(parseTree.root, 'sample.ts')!;
    const parseIdents = findNodes(parseCU, n => n.kind === 'Identifier') as KSIdentifier[];
    for (const ident of parseIdents) {
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
  it('exported function/class true, non-exported false', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;

    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.isExported).toBe(true);

    const classes = findNodes(cu, n => n.kind === 'ClassDeclaration') as KSClassDeclaration[];
    expect(classes[0].isExported).toBe(true);

    const varDecls = findNodes(cu, n => n.kind === 'VariableDeclaration') as KSVariableDeclaration[];
    const internal = varDecls.find(v => (v.name as KSIdentifier).escapedText === 'internal');
    expect(internal!.isExported).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — localCount', () => {
  it('function body has localCount > 0 at bind depth, 0 at parse depth', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.localCount).toBeGreaterThan(0);

    const parseTree = buildKSTree('stamped-fields', 'parse');
    const parseCU = findKSNodeCU(parseTree.root, 'sample.ts')!;
    const parseFuncs = findNodes(parseCU, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const parseGreet = parseFuncs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(parseGreet!.localCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — typeString', () => {
  it('non-empty at check depth, empty at parse and bind depth', () => {
    const checkTree = buildKSTree('stamped-fields', 'check');
    const checkCU = findKSNodeCU(checkTree.root, 'sample.ts')!;
    const checkFuncs = findNodes(checkCU, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const checkGreet = checkFuncs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(checkGreet!.typeString).toBeTruthy();

    for (const depth of ['parse', 'bind'] as const) {
      const tree = buildKSTree('stamped-fields', depth);
      const cu = findKSNodeCU(tree.root, 'sample.ts')!;
      const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
      const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
      expect(greet!.typeString).toBe('');
    }
  });
});
