/**
 * Group A — Trivial synthesized equations for eslint-equiv rules.
 *
 * Each equation checks a single node kind for a simple structural violation.
 * Dependencies are always [] (no other attributes needed).
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@kindscript/core-evaluator';
import type {
  KSBinaryExpression,
  KSVariableDeclarationList,
  KSNode,
  KSBlock,
  KSPrefixUnaryExpression,
} from '../../../../grammar/grammar/ts-ast/index.js';
import { withDeps } from '@kindscript/core-codegen';
import { eslintDiag } from './helpers.js';

// ── Bitwise operator token kinds ──
const BITWISE_BINARY_OPS = new Set([
  'AmpersandToken',          // &
  'BarToken',                // |
  'CaretToken',              // ^
  'LessThanLessThanToken',   // <<
  'GreaterThanGreaterThanToken',        // >>
  'GreaterThanGreaterThanGreaterThanToken', // >>>
]);

// ── eqeqeq ──────────────────────────────────────────────────────────

export const eq_eqeqeqViolation_BinaryExpression = withDeps([],
  function eq_eqeqeqViolation_BinaryExpression(
    ctx: KindCtx<KSBinaryExpression>,
  ): EslintEquivDiagnostic | null {
    const opKind = ctx.node.operatorToken?.kind;
    if (opKind === 'EqualsEqualsToken') {
      return eslintDiag(ctx as KindCtx<KSNode>, 'eqeqeq',
        "Expected '===' and instead saw '=='.",
        ctx.node.operatorToken.pos, ctx.node.operatorToken.end);
    }
    if (opKind === 'ExclamationEqualsToken') {
      return eslintDiag(ctx as KindCtx<KSNode>, 'eqeqeq',
        "Expected '!==' and instead saw '!='.",
        ctx.node.operatorToken.pos, ctx.node.operatorToken.end);
    }
    return null;
  },
);

// ── no-var ───────────────────────────────────────────────────────────

export const eq_noVarViolation_VariableDeclarationList = withDeps([],
  function eq_noVarViolation_VariableDeclarationList(
    ctx: KindCtx<KSVariableDeclarationList>,
  ): EslintEquivDiagnostic | null {
    if (ctx.node.declarationKind === 'var') {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-var',
        'Unexpected var, use let or const instead.');
    }
    return null;
  },
);

// ── no-debugger ──────────────────────────────────────────────────────

export const eq_noDebuggerViolation_DebuggerStatement = withDeps([],
  function eq_noDebuggerViolation_DebuggerStatement(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    return eslintDiag(ctx as KindCtx<KSNode>, 'no-debugger',
      "Unexpected 'debugger' statement.");
  },
);

// ── no-empty ─────────────────────────────────────────────────────────

export const eq_noEmptyViolation_Block = withDeps([],
  function eq_noEmptyViolation_Block(
    ctx: KindCtx<KSBlock>,
  ): EslintEquivDiagnostic | null {
    if (ctx.node.statements && ctx.node.statements.length === 0) {
      // Allow empty catch blocks (ESLint's allowEmptyCatch default is false,
      // but we skip catch blocks to avoid edge-case divergence for now)
      if (ctx.parentIs('CatchClause')) return null;
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-empty',
        'Empty block statement.');
    }
    return null;
  },
);

// ── no-bitwise ───────────────────────────────────────────────────────

export const eq_noBitwiseViolation_BinaryExpression = withDeps([],
  function eq_noBitwiseViolation_BinaryExpression(
    ctx: KindCtx<KSBinaryExpression>,
  ): EslintEquivDiagnostic | null {
    const opKind = ctx.node.operatorToken?.kind;
    if (opKind && BITWISE_BINARY_OPS.has(opKind)) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-bitwise',
        `Unexpected use of '${opTokenText(opKind)}'.`,
        ctx.node.operatorToken.pos, ctx.node.operatorToken.end);
    }
    return null;
  },
);

export const eq_noBitwiseViolation_PrefixUnaryExpression = withDeps([],
  function eq_noBitwiseViolation_PrefixUnaryExpression(
    ctx: KindCtx<KSPrefixUnaryExpression>,
  ): EslintEquivDiagnostic | null {
    if (ctx.node.operator === '~') {
      return eslintDiag(ctx as KindCtx<KSNode>, 'no-bitwise',
        "Unexpected use of '~'.");
    }
    return null;
  },
);

// ── no-explicit-any ──────────────────────────────────────────────────

export const eq_noExplicitAnyViolation_AnyKeyword = withDeps([],
  function eq_noExplicitAnyViolation_AnyKeyword(
    ctx: Ctx,
  ): EslintEquivDiagnostic | null {
    return eslintDiag(ctx as KindCtx<KSNode>, '@typescript-eslint/no-explicit-any',
      'Unexpected any. Specify a different type.');
  },
);

// ── helpers ──────────────────────────────────────────────────────────

function opTokenText(opKind: string): string {
  const map: Record<string, string> = {
    AmpersandToken: '&',
    BarToken: '|',
    CaretToken: '^',
    LessThanLessThanToken: '<<',
    GreaterThanGreaterThanToken: '>>',
    GreaterThanGreaterThanGreaterThanToken: '>>>',
  };
  return map[opKind] ?? opKind;
}
