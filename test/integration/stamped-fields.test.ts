/**
 * Tests that stamped fields (sym*, isDefinitionSite, resolvedFileName,
 * isExported, localCount, typeString, importModuleSpecifier) have
 * correct values on converted AST nodes.
 */
import { describe, it, expect } from 'vitest';
import type {
  KSNode, KSIdentifier, KSFunctionDeclaration, KSClassDeclaration,
  KSBlock, KSArrowFunction, KSVariableDeclaration,
} from '../../src/adapters/grammar/grammar/ts-ast/index.js';
import { buildKSTree, findKSNodeCU, findNodes } from '../helpers/fixtures.js';

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — Identifier', () => {
  it('isDefinitionSite is true on function declaration names', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const greetDef = idents.find(i => i.escapedText === 'greet' && i.isDefinitionSite);
    expect(greetDef).toBeDefined();
  });

  it('isDefinitionSite is false on identifier references', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    // 'helper' used as a call — not a definition site
    const helperRefs = idents.filter(i => i.escapedText === 'helper' && !i.isDefinitionSite);
    expect(helperRefs.length).toBeGreaterThanOrEqual(1);
  });

  it('symIsFunction is true for function declaration identifiers', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const greetDef = idents.find(i => i.escapedText === 'greet' && i.isDefinitionSite);
    expect(greetDef!.symIsFunction).toBe(true);
  });

  it('symIsClass is true for class declaration identifiers', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const counterDef = idents.find(i => i.escapedText === 'Counter' && i.isDefinitionSite);
    expect(counterDef).toBeDefined();
    expect(counterDef!.symIsClass).toBe(true);
  });

  it('symIsAlias is true for import identifiers', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const helperImport = idents.find(i => i.escapedText === 'helper' && i.isDefinitionSite && i.symIsAlias);
    expect(helperImport).toBeDefined();
  });

  it('resolvedFileName is non-empty for import aliases', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const helperDef = idents.find(i => i.escapedText === 'helper' && i.isDefinitionSite && i.symIsAlias);
    expect(helperDef!.resolvedFileName).toContain('helper.ts');
  });

  it('importModuleSpecifier is set for import bindings', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    // The helper reference used inside the function (not the import definition site)
    const helperRef = idents.find(i => i.escapedText === 'helper' && i.resolvesToImport);
    expect(helperRef).toBeDefined();
    expect(helperRef!.importModuleSpecifier).toBe('./helper');
  });

  it('typeString is non-empty at check depth', () => {
    const tree = buildKSTree('stamped-fields', 'check');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const idents = findNodes(cu, n => n.kind === 'Identifier') as KSIdentifier[];
    const greetDef = idents.find(i => i.escapedText === 'greet' && i.isDefinitionSite);
    expect(greetDef!.typeString).toBeTruthy();
  });

  it('all sym* flags are false at parse depth', () => {
    const tree = buildKSTree('stamped-fields', 'parse');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
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
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet).toBeDefined();
    expect(greet!.isExported).toBe(true);
  });

  it('exported class has isExported = true', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const classes = findNodes(cu, n => n.kind === 'ClassDeclaration') as KSClassDeclaration[];
    expect(classes.length).toBeGreaterThanOrEqual(1);
    expect(classes[0].isExported).toBe(true);
  });

  it('non-exported arrow function variable has isExported = false', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const varDecls = findNodes(cu, n => n.kind === 'VariableDeclaration') as KSVariableDeclaration[];
    const internal = varDecls.find(v => (v.name as KSIdentifier).escapedText === 'internal');
    expect(internal).toBeDefined();
    expect(internal!.isExported).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — localCount', () => {
  it('function body block has localCount > 0', () => {
    const tree = buildKSTree('stamped-fields');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet).toBeDefined();
    expect(greet!.localCount).toBeGreaterThan(0);
  });

  it('localCount is 0 at parse depth', () => {
    const tree = buildKSTree('stamped-fields', 'parse');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.localCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────

describe('stamped fields — typeString', () => {
  it('function declaration has non-empty typeString at check depth', () => {
    const tree = buildKSTree('stamped-fields', 'check');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.typeString).toBeTruthy();
  });

  it('typeString is empty at parse depth', () => {
    const tree = buildKSTree('stamped-fields', 'parse');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.typeString).toBe('');
  });

  it('typeString is empty at bind depth', () => {
    const tree = buildKSTree('stamped-fields', 'bind');
    const cu = findKSNodeCU(tree.root, 'sample.ts')!;
    const funcs = findNodes(cu, n => n.kind === 'FunctionDeclaration') as KSFunctionDeclaration[];
    const greet = funcs.find(f => f.name && (f.name as KSIdentifier).escapedText === 'greet');
    expect(greet!.typeString).toBe('');
  });
});
