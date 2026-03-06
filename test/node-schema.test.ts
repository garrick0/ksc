/**
 * Tests for schema-first node definitions (ag-schema).
 *
 * Verifies that the generated node-defs.ts correctly produces:
 * - 360 node definitions
 * - Schema-derived getChildren matching the hand-written version
 * - Runtime introspection (childFields, propFields)
 * - Completeness checking
 */

import { describe, it, expect } from 'vitest';
import { ksNodeSchema, allNodeDefs, getChildren as schemaGetChildren } from '../src/pipeline/node-defs.js';
import { getChildren as manualGetChildren } from '../src/pipeline/ast.js';
import { buildKSTree } from '../src/pipeline/convert.js';
import ts from 'typescript';

describe('ag-schema node definitions', () => {
  it('should have 360 node definitions', () => {
    expect(allNodeDefs.length).toBe(360);
  });

  it('should have 360 kinds in schema', () => {
    expect(ksNodeSchema.kinds.size).toBe(360);
  });

  it('should include key node kinds', () => {
    expect(ksNodeSchema.kinds.has('Program')).toBe(true);
    expect(ksNodeSchema.kinds.has('CompilationUnit')).toBe(true);
    expect(ksNodeSchema.kinds.has('TypeAliasDeclaration')).toBe(true);
    expect(ksNodeSchema.kinds.has('Identifier')).toBe(true);
    expect(ksNodeSchema.kinds.has('Block')).toBe(true);
  });

  it('should report correct child fields for TypeAliasDeclaration', () => {
    const fields = ksNodeSchema.getChildFields('TypeAliasDeclaration');
    expect(fields).toEqual(['name', 'typeParameters', 'type', 'modifiers']);
  });

  it('should report correct child fields for Program', () => {
    const fields = ksNodeSchema.getChildFields('Program');
    expect(fields).toEqual(['compilationUnits']);
  });

  it('should report no child fields for leaf nodes', () => {
    const fields = ksNodeSchema.getChildFields('Identifier');
    expect(fields).toEqual([]);
  });

  it('should report missing kinds for incomplete equations', () => {
    const missing = ksNodeSchema.checkCompleteness({
      'TypeAliasDeclaration': true,
      'Identifier': true,
    });
    expect(missing.length).toBe(358); // 360 - 2
  });

  it('should report no missing kinds when _ default is present', () => {
    const missing = ksNodeSchema.checkCompleteness({ _: true });
    expect(missing).toEqual([]);
  });

  describe('getChildren equivalence', () => {
    // Build a real KSC tree to test getChildren equivalence
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
      const children = manualGetChildren(node);
      for (const child of children) {
        walkTree(child, fn);
      }
    }

    it('should produce the same children as manual getChildren for all nodes', () => {
      let nodeCount = 0;
      let matchCount = 0;

      walkTree(ksTree.root, (node) => {
        nodeCount++;
        const manual = manualGetChildren(node);
        const schema = schemaGetChildren(node);

        // Compare by reference
        if (manual.length === schema.length && manual.every((m, i) => m === schema[i])) {
          matchCount++;
        } else {
          // Log first mismatch for debugging
          if (matchCount === nodeCount - 1) {
            console.log(`Mismatch at node kind=${node.kind}:`);
            console.log(`  manual children: ${manual.length} [${manual.map((c: any) => c.kind).join(', ')}]`);
            console.log(`  schema children: ${schema.length} [${schema.map((c: any) => c.kind).join(', ')}]`);
          }
        }
      });

      // All nodes should match
      expect(matchCount).toBe(nodeCount);
      expect(nodeCount).toBeGreaterThan(10); // Sanity check
    });
  });
});
