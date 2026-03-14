/**
 * Tests for the grammar schema (getChildren, allKinds, fieldDefs).
 */
import { describe, it, expect } from 'vitest';
import { getChildren, allKinds, fieldDefs } from '@ksc/language-ts-ast/grammar/index.js';
import { tsToAstTranslatorAdapter } from '../compose.js';
import ts from 'typescript';
import os from 'node:os';
import path from 'node:path';

describe('generated schema', () => {
  it('includes key node kinds with correct field introspection', () => {
    expect(allKinds.has('Program')).toBe(true);
    expect(allKinds.has('CompilationUnit')).toBe(true);
    expect(allKinds.has('TypeAliasDeclaration')).toBe(true);
    expect(allKinds.has('Identifier')).toBe(true);

    const defs = fieldDefs['TypeAliasDeclaration'];
    const childFields = defs.filter(f => f.tag !== 'prop').map(f => f.name);
    expect(childFields).toEqual(['name', 'typeParameters', 'type', 'modifiers']);

    const progDefs = fieldDefs['Program'];
    const progChildFields = progDefs.filter(f => f.tag !== 'prop').map(f => f.name);
    expect(progChildFields).toEqual(['compilationUnits']);
  });

  describe('getChildren correctness', () => {
    const code = `
      type Foo = string;
      interface Bar { x: number; }
      function hello(a: string): void { return; }
      const x = 1;
      export { x };
    `;

    const tmpFile = path.join(os.tmpdir(), 'test-schema.ts');
    const host = ts.createCompilerHost({});
    const originalReadFile = host.readFile;
    host.readFile = (fileName: string) => {
      if (fileName === tmpFile) return code;
      return originalReadFile(fileName);
    };

    const tsProgram = ts.createProgram([tmpFile], {}, host);
    const ksTree = tsToAstTranslatorAdapter.convert(tsProgram);

    function walkTree(node: any, fn: (n: any) => void): void {
      fn(node);
      const children = getChildren(node);
      for (const child of children) {
        walkTree(child, fn);
      }
    }

    it('produces children consistent with node.children for all nodes', () => {
      let nodeCount = 0;

      walkTree(ksTree.root, (node) => {
        nodeCount++;
        const schemaChildren = getChildren(node);
        expect(Array.isArray(schemaChildren)).toBe(true);
        for (const child of schemaChildren) {
          expect(child).toHaveProperty('kind');
          expect(child).toHaveProperty('pos');
          expect(child).toHaveProperty('end');
        }
      });

      expect(nodeCount).toBeGreaterThan(10);
    });
  });
});
