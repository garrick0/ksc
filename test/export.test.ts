/**
 * Tests for grammar/export.ts — AST dashboard data extraction.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';
import { buildKSTree } from '../generated/ts-ast/grammar/convert.js';
import { extractASTData, type ASTNode, type ASTDashboardData } from '../grammar/export.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

const _treeCache = new Map();
function buildTree(fixtureDir: string) {
  if (_treeCache.has(fixtureDir)) return _treeCache.get(fixtureDir);
  const rootFiles = ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
  const program = ts.createProgram(rootFiles, { strict: true, noEmit: true });
  const result = buildKSTree(program, 'check');
  _treeCache.set(fixtureDir, result);
  return result;
}

describe('extractASTData', () => {
  it('returns version 2 data', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree);

    expect(data.version).toBe(2);
    expect(data.analysisDepth).toBe('parse');
  });

  it('respects analysisDepth parameter', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree, 'check');
    expect(data.analysisDepth).toBe('check');
  });

  it('produces files with expected structure', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree);

    expect(data.files.length).toBeGreaterThan(0);
    for (const file of data.files) {
      expect(file.fileName).toBeTruthy();
      expect(file.lineCount).toBeGreaterThan(0);
      expect(file.source).toBeTruthy();
      expect(file.ast).toBeDefined();
      expect(file.ast.kind).toBe('CompilationUnit');
    }
  });

  it('excludes declaration files', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree);

    for (const file of data.files) {
      expect(file.fileName).not.toMatch(/\.d\.ts$/);
    }
  });

  it('AST nodes have required fields', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree);
    const ast = data.files[0].ast;

    function checkNode(node: ASTNode) {
      expect(node.kind).toBeTruthy();
      expect(typeof node.pos).toBe('number');
      expect(typeof node.end).toBe('number');
      expect(typeof node.text).toBe('string');
      expect(Array.isArray(node.children)).toBe(true);
      for (const child of node.children) {
        checkNode(child);
      }
    }
    checkNode(ast);
  });

  it('truncates long text to 80 chars', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree);

    function checkTextLength(node: ASTNode) {
      expect(node.text.length).toBeLessThanOrEqual(80);
      for (const child of node.children) {
        checkTextLength(child);
      }
    }
    checkTextLength(data.files[0].ast);
  });

  it('includes schema info', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree);

    expect(data.schema).toBeDefined();
    expect(data.schema.fieldDefs).toBeDefined();
    expect(data.schema.sumTypes).toBeDefined();
    expect(Object.keys(data.schema.fieldDefs).length).toBeGreaterThan(0);
    expect(Object.keys(data.schema.sumTypes).length).toBeGreaterThan(0);
  });

  it('field entries map to valid child indices', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree);

    function checkFields(node: ASTNode) {
      if (node.fields) {
        for (const field of node.fields) {
          expect(field.name).toBeTruthy();
          for (const idx of field.indices) {
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(node.children.length);
          }
        }
      }
      for (const child of node.children) {
        checkFields(child);
      }
    }
    checkFields(data.files[0].ast);
  });

  it('props are scalar values (string, number, boolean)', () => {
    const tree = buildTree('kind-basic');
    const data = extractASTData(tree);

    function checkProps(node: ASTNode) {
      if (node.props) {
        for (const [, val] of Object.entries(node.props)) {
          expect(['string', 'number', 'boolean']).toContain(typeof val);
        }
      }
      for (const child of node.children) {
        checkProps(child);
      }
    }
    checkProps(data.files[0].ast);
  });
});
