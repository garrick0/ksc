/**
 * Mock evaluator wiring — verifies the evaluator engine works with
 * the mock spec (a second grammar+analysis beyond ts-ast).
 *
 * Uses the shared mockEvalTarget + mockEvaluator from the evaluation
 * wiring module (symmetric with mockTarget in codegen-targets.ts).
 */
import { describe, it, expect } from 'vitest';
import { mockEvaluator as evaluator } from '../../src/application/evaluation/mock.js';
import { createNode } from '../../src/adapters/grammar/grammar/mock/index.js';

// ── Build a mock AST ─────────────────────────────────────────────────

function makeMockTree() {
  const lit1 = createNode('MockLiteral');
  const lit2 = createNode('MockLiteral');
  const binExpr = createNode('MockBinaryExpression', {
    left: lit1, right: lit2, operator: '+',
  });
  const exprStmt = createNode('MockExpressionStatement', {
    expression: binExpr,
  });
  const letStmt = createNode('MockLetStatement', {
    name: 'x', initializer: lit1,
  });
  const root = createNode('MockProgram', {
    statements: [exprStmt, letStmt],
  });
  return { root, exprStmt, binExpr, lit1, lit2, letStmt };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('mock evaluator wiring', () => {
  it('evaluates nodeCount correctly', () => {
    const { root } = makeMockTree();
    const tree = evaluator.buildTree(root);
    const count = tree.attr('nodeCount');

    // Root(1) + ExprStmt(1) + BinExpr(1) + Lit(1) + Lit(1) + LetStmt(1) + Lit(1) = 7
    expect(count).toBe(7);
  });

  it('leaf nodes have nodeCount of 1', () => {
    const { root } = makeMockTree();
    const tree = evaluator.buildTree(root);

    // Walk to a leaf: root → exprStmt → binExpr → left (lit1)
    const exprStmt = tree.children[0];
    const binExpr = exprStmt.children[0];
    const leaf = binExpr.children[0];

    expect(leaf.children.length).toBe(0);
    expect(leaf.attr('nodeCount')).toBe(1);
  });

  it('inner node count = 1 + sum of children', () => {
    const { root } = makeMockTree();
    const tree = evaluator.buildTree(root);

    // binExpr has 2 literal children → nodeCount = 1 + 1 + 1 = 3
    const binExpr = tree.children[0].children[0];
    expect(binExpr.attr('nodeCount')).toBe(3);
  });

  it('evaluate() returns projections', () => {
    const { root } = makeMockTree();
    const result = evaluator.evaluate(root);
    // Mock spec has definitions: () => [] and diagnostics: () => []
    expect(result.definitions).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('evaluate returns projection results without depGraph', () => {
    const { root } = makeMockTree();
    const result = evaluator.evaluate(root);
    // depGraph is no longer part of evaluate() — it's computed at the composition root
    expect(result).not.toHaveProperty('getDepGraph');
  });
});
