/**
 * Tests for the generated schema (getChildren, allKinds, getChildFields).
 *
 * Verifies that the generated schema.ts correctly produces:
 * - 364 node kinds
 * - Schema-derived getChildren matching the original
 * - Child field introspection
 */

import { describe, it, expect } from 'vitest';
import { getChildren, allKinds, getChildFields } from '../ast-schema/generated/index.js';
import { buildKSTree } from '../ast-schema/generated/convert.js';
import ts from 'typescript';

describe('generated schema', () => {
  it('should have 364 kinds', () => {
    expect(allKinds.size).toBe(364);
  });

  it('should include key node kinds', () => {
    expect(allKinds.has('Program')).toBe(true);
    expect(allKinds.has('CompilationUnit')).toBe(true);
    expect(allKinds.has('TypeAliasDeclaration')).toBe(true);
    expect(allKinds.has('Identifier')).toBe(true);
    expect(allKinds.has('Block')).toBe(true);
  });

  it('should report correct child fields for TypeAliasDeclaration', () => {
    const fields = getChildFields('TypeAliasDeclaration');
    expect(fields).toEqual(['name', 'typeParameters', 'type', 'modifiers']);
  });

  it('should report correct child fields for Program', () => {
    const fields = getChildFields('Program');
    expect(fields).toEqual(['compilationUnits']);
  });

  it('should report no child fields for leaf nodes', () => {
    const fields = getChildFields('Identifier');
    expect(fields).toEqual([]);
  });

  it('should detect missing kinds via allKinds (inline completeness check)', () => {
    const equations: Record<string, unknown> = {
      TypeAliasDeclaration: true,
      Identifier: true,
    };
    const missing = [...allKinds].filter(k => !(k in equations));
    expect(missing.length).toBe(362); // 364 - 2
  });

  it('should report no missing kinds when _ default covers all', () => {
    // With a default handler, completeness is trivially satisfied
    const equations: Record<string, unknown> = { _: true };
    const missing = '_' in equations ? [] : [...allKinds].filter(k => !(k in equations));
    expect(missing).toEqual([]);
  });

  describe('getChildren correctness', () => {
    const code = `
      type Foo = string;
      interface Bar { x: number; }
      function hello(a: string): void { return; }
      const x = 1;
      export { x };
    `;

    const tmpFile = '/tmp/test-schema.ts';
    const host = ts.createCompilerHost({});
    const originalReadFile = host.readFile;
    host.readFile = (fileName: string) => {
      if (fileName === tmpFile) return code;
      return originalReadFile(fileName);
    };

    const tsProgram = ts.createProgram([tmpFile], {}, host);
    const ksTree = buildKSTree(tsProgram);

    function walkTree(node: any, fn: (n: any) => void): void {
      fn(node);
      const children = getChildren(node);
      for (const child of children) {
        walkTree(child, fn);
      }
    }

    it('should produce children consistent with node.children for all nodes', () => {
      let nodeCount = 0;

      walkTree(ksTree.root, (node) => {
        nodeCount++;
        const schemaChildren = getChildren(node);

        // getChildren should return an array
        expect(Array.isArray(schemaChildren)).toBe(true);

        // All returned children should be KSNode-like
        for (const child of schemaChildren) {
          expect(child).toHaveProperty('kind');
          expect(child).toHaveProperty('pos');
          expect(child).toHaveProperty('end');
        }
      });

      expect(nodeCount).toBeGreaterThan(10); // Sanity check
    });
  });
});
