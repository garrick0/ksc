/**
 * Tests for AST dashboard data extraction.
 */
import { describe, it, expect } from 'vitest';
import { extractASTData } from '@ksc/language-ts-ast/extraction/index.js';
import type { SerializedNode } from '@ksc/grammar/index.js';
import { buildKSTree } from '../helpers/fixtures.js';

describe('extractASTData', () => {
  it('returns version 2 data with correct structure', () => {
    const tree = buildKSTree('kind-basic');
    const data = extractASTData(tree);

    expect(data.version).toBe(2);
    expect(data.analysisDepth).toBe('parse');
    expect(data.files.length).toBeGreaterThan(0);
    for (const file of data.files) {
      expect(file.fileName).toBeTruthy();
      expect(file.lineCount).toBeGreaterThan(0);
      expect(file.ast.kind).toBe('CompilationUnit');
      expect(file.fileName).not.toMatch(/\.d\.ts$/);
    }
  });

  it('AST nodes have required fields with truncated text', () => {
    const tree = buildKSTree('kind-basic');
    const data = extractASTData(tree);

    function checkNode(node: SerializedNode) {
      expect(node.kind).toBeTruthy();
      expect(typeof node.pos).toBe('number');
      expect(typeof node.end).toBe('number');
      expect(node.text.length).toBeLessThanOrEqual(80);
      for (const child of node.children) checkNode(child);
    }
    checkNode(data.files[0].ast);
  });

  it('includes schema info', () => {
    const tree = buildKSTree('kind-basic');
    const data = extractASTData(tree);

    expect(Object.keys(data.schema.fieldDefs).length).toBeGreaterThan(0);
    expect(Object.keys(data.schema.sumTypes).length).toBeGreaterThan(0);
  });

  it('field entries map to valid child indices', () => {
    const tree = buildKSTree('kind-basic');
    const data = extractASTData(tree);

    function checkFields(node: SerializedNode) {
      if (node.fields) {
        for (const field of node.fields) {
          expect(field.name).toBeTruthy();
          for (const idx of field.indices) {
            expect(idx).toBeLessThan(node.children.length);
          }
        }
      }
      for (const child of node.children) checkFields(child);
    }
    checkFields(data.files[0].ast);
  });

  it('props are scalar values', () => {
    const tree = buildKSTree('kind-basic');
    const data = extractASTData(tree);

    function checkProps(node: SerializedNode) {
      if (node.props) {
        for (const [, val] of Object.entries(node.props)) {
          expect(['string', 'number', 'boolean']).toContain(typeof val);
        }
      }
      for (const child of node.children) checkProps(child);
    }
    checkProps(data.files[0].ast);
  });
});
