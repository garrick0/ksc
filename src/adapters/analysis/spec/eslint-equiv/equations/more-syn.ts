/**
 * Phase 6 — Additional synthesized equations for eslint-equiv rules.
 *
 * These are single-node or child-inspection syn rules following the
 * established patterns from trivial-syn.ts and child-inspection.ts.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@kindscript/core-evaluator';
import type {
  KSNode,
  KSCallExpression,
  KSBinaryExpression,
  KSPrefixUnaryExpression,
  KSPostfixUnaryExpression,
  KSStringLiteral,
  KSBlock,
} from '../../../../grammar/grammar/ts-ast/index.js';
import { withDeps } from '@kindscript/core-codegen';
import { eslintDiag } from './helpers.js';

// ── no-console ──────────────────────────────────────────────────────

export const eq_noConsoleViolation_CallExpression = withDeps([],
  function eq_noConsoleViolation_CallExpression(
    ctx: KindCtx<KSCallExpression>,
  ): EslintEquivDiagnostic | null {
    const expr = ctx.node.expression;
    if (expr.kind !== 'PropertyAccessExpression') return null;
    const obj = (expr as any).expression;
    if (!obj || obj.kind !== 'Identifier') return null;
    if ((obj as any).escapedText !== 'console') return null;
    return eslintDiag(ctx as KindCtx<KSNode>, 'no-console',
      'Unexpected console statement.');
  },
);

// ── no-eval ─────────────────────────────────────────────────────────

export const eq_noEvalViolation_CallExpression = withDeps([],
  function eq_noEvalViolation_CallExpression(
    ctx: KindCtx<KSCallExpression>,
  ): EslintEquivDiagnostic | null {
    const expr = ctx.node.expression;
    if (expr.kind !== 'Identifier') return null;
    if ((expr as any).escapedText !== 'eval') return null;
    return eslintDiag(ctx as KindCtx<KSNode>, 'no-eval',
      'eval can be harmful.');
  },
);

// ── no-new-wrappers ─────────────────────────────────────────────────

const WRAPPER_TYPES = new Set(['Boolean', 'Number', 'String']);

export const eq_noNewWrappersViolation_NewExpression = withDeps([],
  function eq_noNewWrappersViolation_NewExpression(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic | null {
    const expr = (ctx.node as any).expression;
    if (!expr || expr.kind !== 'Identifier') return null;
    const name = expr.escapedText as string;
    if (!WRAPPER_TYPES.has(name)) return null;
    return eslintDiag(ctx as KindCtx<KSNode>, 'no-new-wrappers',
      `Do not use ${name} as a constructor.`);
  },
);

// ── no-plusplus ──────────────────────────────────────────────────────

export const eq_noPlusPlusViolation_PrefixUnaryExpression = withDeps([],
  function eq_noPlusPlusViolation_PrefixUnaryExpression(
    ctx: KindCtx<KSPrefixUnaryExpression>,
  ): EslintEquivDiagnostic | null {
    if (ctx.node.operator === '++' || ctx.node.operator === '--') {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-plusplus',
        `Unary operator '${ctx.node.operator}' used.`);
    }
    return null;
  },
);

export const eq_noPlusPlusViolation_PostfixUnaryExpression = withDeps([],
  function eq_noPlusPlusViolation_PostfixUnaryExpression(
    ctx: KindCtx<KSPostfixUnaryExpression>,
  ): EslintEquivDiagnostic | null {
    return eslintDiag(ctx as KindCtx<KSNode>, 'no-plusplus',
      `Unary operator '${ctx.node.operator}' used.`);
  },
);

// ── no-template-curly-in-string ─────────────────────────────────────

export const eq_noTemplateCurlyViolation_StringLiteral = withDeps([],
  function eq_noTemplateCurlyViolation_StringLiteral(
    ctx: KindCtx<KSStringLiteral>,
  ): EslintEquivDiagnostic | null {
    if (ctx.node.value.includes('${')) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-template-curly-in-string',
        'Unexpected template string expression.');
    }
    return null;
  },
);

// ── no-cond-assign ──────────────────────────────────────────────────

const ASSIGNMENT_OPS = new Set([
  'EqualsToken',
  'PlusEqualsToken', 'MinusEqualsToken',
  'AsteriskEqualsToken', 'SlashEqualsToken',
  'PercentEqualsToken',
  'AmpersandEqualsToken', 'BarEqualsToken', 'CaretEqualsToken',
  'LessThanLessThanEqualsToken',
  'GreaterThanGreaterThanEqualsToken',
  'GreaterThanGreaterThanGreaterThanEqualsToken',
  'AsteriskAsteriskEqualsToken',
  'BarBarEqualsToken', 'AmpersandAmpersandEqualsToken',
  'QuestionQuestionEqualsToken',
]);

function isAssignmentExpression(node: KSNode): boolean {
  if (node.kind !== 'BinaryExpression') return false;
  const opKind = (node as any).operatorToken?.kind as string | undefined;
  return !!opKind && ASSIGNMENT_OPS.has(opKind);
}

function checkCondAssign(ctx: Ctx, condFieldName: string): EslintEquivDiagnostic | null {
  const condChild = ctx.children.find(c => c.fieldName === condFieldName);
  if (condChild && isAssignmentExpression(condChild.node as KSNode)) {
    return eslintDiag(ctx as KindCtx<KSNode>, 'no-cond-assign',
      'Expected a conditional expression and instead saw an assignment.');
  }
  return null;
}

export const eq_noCondAssignViolation_IfStatement = withDeps([],
  function eq_noCondAssignViolation_IfStatement(ctx: Ctx): EslintEquivDiagnostic | null {
    return checkCondAssign(ctx, 'expression');
  },
);

export const eq_noCondAssignViolation_WhileStatement = withDeps([],
  function eq_noCondAssignViolation_WhileStatement(ctx: Ctx): EslintEquivDiagnostic | null {
    return checkCondAssign(ctx, 'expression');
  },
);

export const eq_noCondAssignViolation_DoStatement = withDeps([],
  function eq_noCondAssignViolation_DoStatement(ctx: Ctx): EslintEquivDiagnostic | null {
    return checkCondAssign(ctx, 'expression');
  },
);

export const eq_noCondAssignViolation_ForStatement = withDeps([],
  function eq_noCondAssignViolation_ForStatement(ctx: Ctx): EslintEquivDiagnostic | null {
    return checkCondAssign(ctx, 'condition');
  },
);

// ── no-duplicate-case ───────────────────────────────────────────────

function expressionText(node: KSNode): string {
  // Simple text extraction for case expressions
  if (node.kind === 'Identifier') return (node as any).escapedText ?? '';
  if (node.kind === 'StringLiteral') return `"${(node as any).value}"`;
  if (node.kind === 'NumericLiteral') return String((node as any).value);
  if (node.kind === 'TrueKeyword') return 'true';
  if (node.kind === 'FalseKeyword') return 'false';
  if (node.kind === 'NullKeyword') return 'null';
  // For complex expressions, use pos+end as a fingerprint
  return `__expr_${node.pos}_${node.end}`;
}

export const eq_noDuplicateCaseViolation_CaseBlock = withDeps([],
  function eq_noDuplicateCaseViolation_CaseBlock(
    ctx: Ctx,
  ): EslintEquivDiagnostic[] {
    const violations: EslintEquivDiagnostic[] = [];
    const seen = new Set<string>();

    for (const child of ctx.children) {
      if (child.node.kind !== 'CaseClause') continue;
      const exprChild = child.children.find(c => c.fieldName === 'expression');
      if (!exprChild) continue;

      const text = expressionText(exprChild.node as KSNode);
      if (seen.has(text)) {
        violations.push(eslintDiag(
          child as unknown as KindCtx<KSNode>, 'no-duplicate-case',
          'Duplicate case label.',
          child.node.pos, child.node.end,
        ));
      }
      seen.add(text);
    }

    return violations;
  },
);

// ── no-self-assign ──────────────────────────────────────────────────

/** Reuse structural equality from child-inspection.ts pattern */
function nodesStructurallyEqual(a: Ctx, b: Ctx): boolean {
  if (a.node.kind !== b.node.kind) return false;
  if (a.children.length !== b.children.length) return false;
  if (a.children.length === 0) {
    if (a.node.kind === 'Identifier') {
      return (a.node as any).escapedText === (b.node as any).escapedText;
    }
    if ('value' in a.node && 'value' in b.node) {
      return (a.node as any).value === (b.node as any).value;
    }
    return true;
  }
  return a.children.every((ac, i) => nodesStructurallyEqual(ac, b.children[i]));
}

export const eq_noSelfAssignViolation_BinaryExpression = withDeps([],
  function eq_noSelfAssignViolation_BinaryExpression(
    ctx: KindCtx<KSBinaryExpression>,
  ): EslintEquivDiagnostic | null {
    const opKind = ctx.node.operatorToken?.kind;
    if (opKind !== 'EqualsToken') return null;

    const leftChild = ctx.children.find(c => c.fieldName === 'left');
    const rightChild = ctx.children.find(c => c.fieldName === 'right');
    if (!leftChild || !rightChild) return null;

    if (nodesStructurallyEqual(leftChild, rightChild)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-self-assign',
        "'x' is assigned to itself.");
    }
    return null;
  },
);

// ── default-case ────────────────────────────────────────────────────

export const eq_defaultCaseViolation_CaseBlock = withDeps([],
  function eq_defaultCaseViolation_CaseBlock(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const hasDefault = ctx.children.some(c => c.node.kind === 'DefaultClause');
    if (!hasDefault) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'default-case',
        'Expected a default case.');
    }
    return null;
  },
);

// ── default-case-last ───────────────────────────────────────────────

export const eq_defaultCaseLastViolation_CaseBlock = withDeps([],
  function eq_defaultCaseLastViolation_CaseBlock(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const clauseChildren = ctx.children.filter(
      c => c.node.kind === 'CaseClause' || c.node.kind === 'DefaultClause',
    );
    if (clauseChildren.length === 0) return null;

    const defaultIdx = clauseChildren.findIndex(c => c.node.kind === 'DefaultClause');
    if (defaultIdx === -1) return null; // no default → not this rule's concern
    if (defaultIdx === clauseChildren.length - 1) return null; // already last

    return eslintDiag(
      clauseChildren[defaultIdx] as unknown as KindCtx<KSNode>,
      'default-case-last',
      'Default clause should be the last clause.',
    );
  },
);

// ── no-useless-catch ────────────────────────────────────────────────

/** Check if a CatchClause node only rethrows its parameter. */
function isUselessCatch(catchNode: any): boolean {
  const varDecl = catchNode.variableDeclaration;
  if (!varDecl) return false;

  const paramName = varDecl.name;
  if (!paramName || paramName.kind !== 'Identifier') return false;
  const catchVarName = paramName.escapedText as string;

  const block = catchNode.block;
  if (!block) return false;

  const stmts = block.statements as any[] | undefined;
  if (!stmts || stmts.length !== 1) return false;

  const stmt = stmts[0];
  if (stmt.kind !== 'ThrowStatement') return false;

  const throwExpr = stmt.expression;
  if (!throwExpr || throwExpr.kind !== 'Identifier') return false;
  return throwExpr.escapedText === catchVarName;
}

export const eq_noUselessCatchViolation_TryStatement = withDeps([],
  function eq_noUselessCatchViolation_TryStatement(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    // ESLint reports no-useless-catch on the CatchClause but positioned
    // at the catch keyword. We report on the TryStatement to match ESLint's line.
    const catchClause = (ctx.node as any).catchClause;
    if (!catchClause) return null;

    if (isUselessCatch(catchClause)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-useless-catch',
        'Unnecessary catch clause.');
    }
    return null;
  },
);

// ── no-multi-assign ─────────────────────────────────────────────────

export const eq_noMultiAssignViolation_BinaryExpression = withDeps([],
  function eq_noMultiAssignViolation_BinaryExpression(
    ctx: KindCtx<KSBinaryExpression>,
  ): EslintEquivDiagnostic | null {
    const opKind = ctx.node.operatorToken?.kind;
    if (opKind !== 'EqualsToken') return null;

    // Check if right-hand side is also an assignment
    if (isAssignmentExpression(ctx.node.right as KSNode)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-multi-assign',
        'Unexpected chained assignment.');
    }
    return null;
  },
);

// ── yoda ────────────────────────────────────────────────────────────

const COMPARISON_OPS = new Set([
  'EqualsEqualsToken', 'EqualsEqualsEqualsToken',
  'ExclamationEqualsToken', 'ExclamationEqualsEqualsToken',
  'GreaterThanToken', 'LessThanToken',
  'GreaterThanEqualsToken', 'LessThanEqualsToken',
]);

const LITERAL_KINDS = new Set([
  'StringLiteral', 'NumericLiteral', 'TrueKeyword', 'FalseKeyword',
  'NullKeyword', 'BigIntLiteral',
]);

export const eq_yodaViolation_BinaryExpression = withDeps([],
  function eq_yodaViolation_BinaryExpression(
    ctx: KindCtx<KSBinaryExpression>,
  ): EslintEquivDiagnostic | null {
    const opKind = ctx.node.operatorToken?.kind;
    if (!opKind || !COMPARISON_OPS.has(opKind)) return null;

    // Yoda: literal on the left
    if (LITERAL_KINDS.has(ctx.node.left.kind)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'yoda',
        'Expected literal to be on the right side of comparison.');
    }
    return null;
  },
);

// ── no-empty-function ───────────────────────────────────────────────

function hasEmptyBody(ctx: Ctx): boolean {
  const bodyChild = ctx.children.find(c => c.fieldName === 'body');
  if (!bodyChild) return false;
  if (bodyChild.node.kind !== 'Block') return false;
  const stmts = (bodyChild.node as any).statements as any[] | undefined;
  return !stmts || stmts.length === 0;
}

export const eq_noEmptyFunctionViolation_FunctionDeclaration = withDeps([],
  function eq_noEmptyFunctionViolation_FunctionDeclaration(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    if (hasEmptyBody(ctx)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty-function',
        'Unexpected empty function.');
    }
    return null;
  },
);

export const eq_noEmptyFunctionViolation_ArrowFunction = withDeps([],
  function eq_noEmptyFunctionViolation_ArrowFunction(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    if (hasEmptyBody(ctx)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty-function',
        'Unexpected empty arrow function.');
    }
    return null;
  },
);

export const eq_noEmptyFunctionViolation_MethodDeclaration = withDeps([],
  function eq_noEmptyFunctionViolation_MethodDeclaration(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    if (hasEmptyBody(ctx)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty-function',
        'Unexpected empty method.');
    }
    return null;
  },
);

export const eq_noEmptyFunctionViolation_FunctionExpression = withDeps([],
  function eq_noEmptyFunctionViolation_FunctionExpression(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    if (hasEmptyBody(ctx)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty-function',
        'Unexpected empty function.');
    }
    return null;
  },
);

// ── use-isnan ───────────────────────────────────────────────────────

export const eq_useIsNanViolation_BinaryExpression = withDeps([],
  function eq_useIsNanViolation_BinaryExpression(
    ctx: KindCtx<KSBinaryExpression>,
  ): EslintEquivDiagnostic | null {
    const opKind = ctx.node.operatorToken?.kind;
    if (!opKind || !COMPARISON_OPS.has(opKind)) return null;

    const leftIsNaN = ctx.node.left.kind === 'Identifier'
      && (ctx.node.left as any).escapedText === 'NaN';
    const rightIsNaN = ctx.node.right.kind === 'Identifier'
      && (ctx.node.right as any).escapedText === 'NaN';

    if (leftIsNaN || rightIsNaN) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'use-isnan',
        'Use the isNaN function to compare with NaN.');
    }
    return null;
  },
);

// ── no-sparse-arrays ────────────────────────────────────────────────

export const eq_noSparseArraysViolation_ArrayLiteralExpression = withDeps([],
  function eq_noSparseArraysViolation_ArrayLiteralExpression(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const elements = (ctx.node as any).elements as any[] | undefined;
    if (!elements) return null;
    const hasSparse = elements.some((el: any) => el.kind === 'OmittedExpression');
    if (hasSparse) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-sparse-arrays',
        'Unexpected comma in middle of array.');
    }
    return null;
  },
);

// ── no-empty-pattern ────────────────────────────────────────────────

export const eq_noEmptyPatternViolation_ObjectBindingPattern = withDeps([],
  function eq_noEmptyPatternViolation_ObjectBindingPattern(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const elements = (ctx.node as any).elements as any[] | undefined;
    if (!elements || elements.length === 0) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty-pattern',
        'Unexpected empty object pattern.');
    }
    return null;
  },
);

export const eq_noEmptyPatternViolation_ArrayBindingPattern = withDeps([],
  function eq_noEmptyPatternViolation_ArrayBindingPattern(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    const elements = (ctx.node as any).elements as any[] | undefined;
    if (!elements || elements.length === 0) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty-pattern',
        'Unexpected empty array pattern.');
    }
    return null;
  },
);
