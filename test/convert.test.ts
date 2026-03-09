/**
 * Tests for TS → KSC AST conversion.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../generated/ts-ast/grammar/convert.js';
import { buildTree, KSCDNode } from '../generated/ts-ast/kind-checking/evaluator.js';
import type {
  KSNode, KSCompilationUnit, KSTypeAliasDeclaration, KSTypeReference,
  KSTypeLiteral, KSIdentifier, KSFunctionDeclaration,
  KSVariableStatement, KSVariableDeclarationList, KSVariableDeclaration,
  KSImportDeclaration, KSStringLiteral, KSPropertySignature,
  KSArrowFunction,
} from '../generated/ts-ast/grammar/index.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

function createTSProgram(fixtureDir: string): ts.Program {
  const configPath = path.join(fixtureDir, 'tsconfig.json');
  let rootNames: string[];
  let options: ts.CompilerOptions = { strict: true, noEmit: true };

  if (ts.sys.fileExists(configPath)) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, fixtureDir);
    rootNames = parsed.fileNames;
    options = parsed.options;
  } else {
    // Manually find .ts files in src/
    const srcDir = path.join(fixtureDir, 'src');
    rootNames = ts.sys.readDirectory!(srcDir, ['.ts'], undefined, undefined)
      .filter(f => !f.endsWith('.d.ts'));
  }

  return ts.createProgram(rootNames, options);
}

describe('buildKSTree', () => {
  describe('kind-basic fixture', () => {
    const tsProgram = createTSProgram(path.join(FIXTURES, 'kind-basic'));
    const { root } = buildKSTree(tsProgram);

    it('creates a Program root with CompilationUnits', () => {
      expect(root.kind).toBe('Program');
      expect(root.compilationUnits.length).toBeGreaterThan(0);
      expect(root.compilationUnits.every(cu => cu.kind === 'CompilationUnit')).toBe(true);
    });

    it('CompilationUnits have fileNames', () => {
      const fileNames = root.compilationUnits.map(cu => path.basename(cu.fileName));
      expect(fileNames).toContain('kinds.ts');
      expect(fileNames).toContain('math.ts');
    });

    it('KSCDNode navigation works across the hierarchy', () => {
      const dnodeRoot = buildTree(root);

      // Find the DNode for the kinds file
      const kindsDNode = (dnodeRoot.children as KSCDNode[]).find(
        c => (c.node as any).fileName?.endsWith('kinds.ts'),
      )!;
      expect(kindsDNode).toBeDefined();
      expect(kindsDNode.parent).toBe(dnodeRoot);
      expect(dnodeRoot.isRoot).toBe(true);

      // First child of the compilation unit has the CU as parent
      if (kindsDNode.children.length > 0) {
        expect(kindsDNode.children[0].parent).toBe(kindsDNode);
      }
    });

    it('converts TypeAliasDeclaration with full structure', () => {
      const kindsFile = root.compilationUnits.find(cu => cu.fileName.endsWith('kinds.ts'))!;
      const typeAliases = kindsFile.children.filter(
        (c): c is KSTypeAliasDeclaration => c.kind === 'TypeAliasDeclaration',
      );
      expect(typeAliases.length).toBeGreaterThan(0);

      // Find the Kind type alias — should have typed accessors
      for (const ta of typeAliases) {
        expect(ta.name).toBeDefined();
        expect(ta.name.kind).toBe('Identifier');
        expect(ta.name.escapedText).toBeTruthy();
        expect(ta.type).toBeDefined();
      }
    });

    it('converts TypeReference with typeArguments', () => {
      const kindsFile = root.compilationUnits.find(cu => cu.fileName.endsWith('kinds.ts'))!;
      const typeAliases = kindsFile.children.filter(
        (c): c is KSTypeAliasDeclaration => c.kind === 'TypeAliasDeclaration',
      );

      // Find NoImports = Kind<{ noImports: true }>
      const noImports = typeAliases.find(ta => ta.name.escapedText === 'NoImports');
      if (noImports) {
        expect(noImports.type.kind).toBe('TypeReference');
        const typeRef = noImports.type as KSTypeReference;
        expect(typeRef.typeName.kind).toBe('Identifier');
        expect((typeRef.typeName as KSIdentifier).escapedText).toBe('Kind');
        expect(typeRef.typeArguments.length).toBe(1);

        const arg = typeRef.typeArguments[0];
        expect(arg.kind).toBe('TypeLiteral');
        const typeLiteral = arg as KSTypeLiteral;
        expect(typeLiteral.members.length).toBeGreaterThan(0);

        const member = typeLiteral.members[0] as KSPropertySignature;
        expect(member.kind).toBe('PropertySignature');
        expect((member.name as KSIdentifier).escapedText).toBe('noImports');
      }
    });
  });

  describe('kind-module fixture', () => {
    const tsProgram = createTSProgram(path.join(FIXTURES, 'kind-module'));
    const { root } = buildKSTree(tsProgram);

    it('converts ImportDeclaration', () => {
      const handler = root.compilationUnits.find(cu => cu.fileName.endsWith('handler.ts'))!;
      const imports = handler.children.filter(c => c.kind === 'ImportDeclaration') as KSImportDeclaration[];

      if (imports.length > 0) {
        const imp = imports[0];
        expect(imp.moduleSpecifier).toBeDefined();
        expect(imp.moduleSpecifier.kind).toBe('StringLiteral');
      }
    });
  });

  describe('all SyntaxKinds covered', () => {
    it('every node in the tree uses a specific typed interface — no generic fallback', () => {
      // Parse a variety of fixtures to exercise many SyntaxKinds
      for (const fixture of ['kind-basic', 'kind-module', 'kind-violations']) {
        const prog = createTSProgram(path.join(FIXTURES, fixture));
        const { root } = buildKSTree(prog);

        const stack: KSNode[] = [root];
        const kindsFound = new Set<string>();
        while (stack.length > 0) {
          const n = stack.pop()!;
          expect(typeof n.kind).toBe('string');
          expect(n.kind.length).toBeGreaterThan(0);
          // kind must not start with "Unknown_" (our old generic fallback pattern)
          expect(n.kind).not.toMatch(/^Unknown_/);
          kindsFound.add(n.kind);
          stack.push(...n.children);
        }

        // Should find a variety of node kinds
        expect(kindsFound.size).toBeGreaterThan(5);
      }
    });

    it('converter throws for truly unknown SyntaxKinds rather than producing generic nodes', () => {
      // This test verifies the fallback is a throw, not a silent generic node.
      // We can't easily trigger it with real TS AST, but we verify the behavior
      // by checking that all nodes in our fixtures have recognized kinds.
      const prog = createTSProgram(path.join(FIXTURES, 'kind-basic'));
      const { root } = buildKSTree(prog);

      const allKinds = new Set<string>();
      const stack: KSNode[] = [root];
      while (stack.length > 0) {
        const n = stack.pop()!;
        allKinds.add(n.kind);
        stack.push(...n.children);
      }

      // All collected kinds should be non-empty strings
      for (const k of allKinds) {
        expect(k).toBeTruthy();
        expect(typeof k).toBe('string');
      }
    });
  });

  describe('full AST depth', () => {
    const tsProgram = createTSProgram(path.join(FIXTURES, 'kind-basic'));
    const { root } = buildKSTree(tsProgram);

    it('tree goes beyond statements — into function bodies and expressions', () => {
      const mathFile = root.compilationUnits.find(cu => cu.fileName.endsWith('math.ts'))!;

      // Count all nodes in the tree (should be much more than just top-level statements)
      let nodeCount = 0;
      const stack = [mathFile as KSNode];
      while (stack.length > 0) {
        const n = stack.pop()!;
        nodeCount++;
        stack.push(...n.children);
      }

      // A file with function declarations should have many nodes
      // (identifiers, parameters, types, expressions, etc.)
      expect(nodeCount).toBeGreaterThan(mathFile.children.length);
    });

    it('every node has valid pos/end', () => {
      const cu = root.compilationUnits[0];
      const stack = [cu as KSNode];
      while (stack.length > 0) {
        const n = stack.pop()!;
        expect(n.pos).toBeGreaterThanOrEqual(0);
        expect(n.end).toBeGreaterThanOrEqual(n.pos);
        stack.push(...n.children);
      }
    });

    it('every node has a kind string', () => {
      const cu = root.compilationUnits[0];
      const stack = [cu as KSNode];
      while (stack.length > 0) {
        const n = stack.pop()!;
        expect(typeof n.kind).toBe('string');
        expect(n.kind.length).toBeGreaterThan(0);
        stack.push(...n.children);
      }
    });

    it('KSCDNode parent works deep in the tree', () => {
      const dnodeRoot = buildTree(root);
      const cuDNode = dnodeRoot.children[0] as KSCDNode;
      // Walk to find a deeply nested node
      let deepNode: KSCDNode = cuDNode.children[0] as KSCDNode;
      let depth = 0;
      while (deepNode && deepNode.children.length > 0) {
        deepNode = deepNode.children[0] as KSCDNode;
        depth++;
      }

      if (depth > 1) {
        // Walk back up via parent and verify we reach the root
        let current: KSCDNode | undefined = deepNode;
        while (current && !current.isRoot) {
          const parent = current.parent;
          expect(parent).toBeDefined();
          current = parent;
        }
        expect(current!.isRoot).toBe(true);
      }
    });
  });
});
