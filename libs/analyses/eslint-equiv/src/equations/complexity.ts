/**
 * Complexity equations — syn complexityViolation per function.
 *
 * Counts cyclomatic complexity within a function body (stopping at nested
 * function boundaries). Reports when complexity exceeds threshold.
 *
 * complexityThreshold is an inh attribute (default: 2) for configuration.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@ksc/evaluation/domain/evaluator-index.js';
import type { KSNode, KSBinaryExpression } from '@ksc/language-ts-ast/grammar/index.js';
import { withDeps } from '@ksc/behavior';
import { eslintDiag } from './helpers.js';

/** Node kinds that contribute +1 to cyclomatic complexity. */
const BRANCH_KINDS = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoStatement',
  'CatchClause',
  'ConditionalExpression',
]);

/** Logical operators that contribute +1 each. */
const LOGICAL_OPS = new Set([
  'AmpersandAmpersandToken',  // &&
  'BarBarToken',               // ||
  'QuestionQuestionToken',     // ??
]);

/** Node kinds that represent nested function boundaries (stop recursion). */
const FUNCTION_BOUNDARY_KINDS = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunction',
  'MethodDeclaration',
  'Constructor',
]);

/** Recursively count branch points in a subtree, stopping at function boundaries. */
function countBranchPoints(ctx: Ctx): number {
  let count = 0;

  if (BRANCH_KINDS.has(ctx.node.kind)) {
    count += 1;
  }

  // CaseClause contributes +1 (not DefaultClause)
  if (ctx.node.kind === 'CaseClause') {
    count += 1;
  }

  // Logical operators in BinaryExpression contribute +1 each
  if (ctx.node.kind === 'BinaryExpression') {
    const opKind = (ctx.node as unknown as KSBinaryExpression).operatorToken?.kind;
    if (opKind && LOGICAL_OPS.has(opKind)) {
      count += 1;
    }
  }

  // Recurse into children, stopping at function boundaries
  for (const child of ctx.children) {
    if (FUNCTION_BOUNDARY_KINDS.has(child.node.kind)) continue;
    count += countBranchPoints(child);
  }

  return count;
}

/** Check cyclomatic complexity for a function-like node. */
function checkComplexity(ctx: Ctx): EslintEquivDiagnostic | null {
  const threshold = ctx.attr('complexityThreshold') as number;

  const bodyChild = ctx.children.find(c => c.fieldName === 'body');
  if (!bodyChild) return null;

  const complexity = 1 + countBranchPoints(bodyChild);

  if (complexity > threshold) {
    return eslintDiag(ctx as KindCtx<KSNode>, 'complexity',
      `Function has a complexity of ${complexity}. Maximum allowed is ${threshold}.`);
  }

  return null;
}

export const eq_complexityViolation_FunctionDeclaration = withDeps(['complexityThreshold'],
  function eq_complexityViolation_FunctionDeclaration(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkComplexity(ctx);
  },
);

export const eq_complexityViolation_ArrowFunction = withDeps(['complexityThreshold'],
  function eq_complexityViolation_ArrowFunction(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkComplexity(ctx);
  },
);

export const eq_complexityViolation_FunctionExpression = withDeps(['complexityThreshold'],
  function eq_complexityViolation_FunctionExpression(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkComplexity(ctx);
  },
);

export const eq_complexityViolation_MethodDeclaration = withDeps(['complexityThreshold'],
  function eq_complexityViolation_MethodDeclaration(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    return checkComplexity(ctx);
  },
);
