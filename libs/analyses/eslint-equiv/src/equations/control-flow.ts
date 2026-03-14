/**
 * Control-flow equations — syn alwaysTerminates, noUnreachableViolation,
 * noFallthroughViolation.
 *
 * alwaysTerminates (syn): true if execution never proceeds past this node.
 * noUnreachableViolation (syn): fires on Block for statements after a
 *   terminating statement.
 * noFallthroughViolation (syn): fires on CaseBlock for non-empty cases that
 *   fall through to the next case.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@ksc/evaluation/domain/evaluator-index.js';
import type { KSNode } from '@ksc/language-ts-ast/grammar/index.js';
import { withDeps } from '@ksc/behavior';
import { eslintDiag } from './helpers.js';

// ── alwaysTerminates (synthesized) ───────────────────────────────────

export const eq_alwaysTerminates_ReturnStatement = withDeps([],
  function eq_alwaysTerminates_ReturnStatement(_ctx: Ctx): boolean {
    return true;
  },
);

export const eq_alwaysTerminates_ThrowStatement = withDeps([],
  function eq_alwaysTerminates_ThrowStatement(_ctx: Ctx): boolean {
    return true;
  },
);

export const eq_alwaysTerminates_BreakStatement = withDeps([],
  function eq_alwaysTerminates_BreakStatement(_ctx: Ctx): boolean {
    return true;
  },
);

export const eq_alwaysTerminates_ContinueStatement = withDeps([],
  function eq_alwaysTerminates_ContinueStatement(_ctx: Ctx): boolean {
    return true;
  },
);

export const eq_alwaysTerminates_Block = withDeps([],
  function eq_alwaysTerminates_Block(ctx: Ctx): boolean {
    const stmts = ctx.children.filter(c => c.fieldName === 'statements');
    return stmts.some(s => s.attr('alwaysTerminates') as boolean);
  },
);

export const eq_alwaysTerminates_IfStatement = withDeps([],
  function eq_alwaysTerminates_IfStatement(ctx: Ctx): boolean {
    const thenChild = ctx.children.find(c => c.fieldName === 'thenStatement');
    const elseChild = ctx.children.find(c => c.fieldName === 'elseStatement');
    if (!thenChild) return false;
    const thenTerminates = thenChild.attr('alwaysTerminates') as boolean;
    const elseTerminates = elseChild
      ? (elseChild.attr('alwaysTerminates') as boolean)
      : false;
    return thenTerminates && elseTerminates;
  },
);

// ── noUnreachableViolation (synthesized) ─────────────────────────────

export const eq_noUnreachableViolation_Block = withDeps(['alwaysTerminates'],
  function eq_noUnreachableViolation_Block(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic[] {
    const stmts = ctx.children.filter(c => c.fieldName === 'statements');
    const violations: EslintEquivDiagnostic[] = [];
    let terminated = false;

    for (const stmt of stmts) {
      if (terminated) {
        violations.push(eslintDiag(
          ctx as KindCtx<KSNode>, 'no-unreachable',
          'Unreachable code.',
          stmt.node.pos, stmt.node.end,
        ));
      }
      if (stmt.attr('alwaysTerminates') as boolean) {
        terminated = true;
      }
    }

    return violations;
  },
);

// ── noFallthroughViolation (synthesized) ─────────────────────────────

/**
 * Check if a case clause's statements always terminate (break/return/throw/
 * continue, or an if-else where both branches terminate, etc.).
 */
function caseTerminates(stmts: readonly { attr(name: string): unknown }[]): boolean {
  return stmts.some(s => s.attr('alwaysTerminates') as boolean);
}

export const eq_noFallthroughViolation_CaseBlock = withDeps(['alwaysTerminates'],
  function eq_noFallthroughViolation_CaseBlock(
    ctx: KindCtx<KSNode>,
  ): EslintEquivDiagnostic[] {
    const clauses = ctx.children.filter(c => c.fieldName === 'clauses');
    const violations: EslintEquivDiagnostic[] = [];

    for (let i = 0; i < clauses.length - 1; i++) {
      const clause = clauses[i];
      const stmts = clause.children.filter(c => c.fieldName === 'statements');

      // Empty cases (stacked cases) are OK — skip
      if (stmts.length === 0) continue;

      // Non-empty case that doesn't terminate → falls through
      if (!caseTerminates(stmts)) {
        const nextClause = clauses[i + 1];
        violations.push(eslintDiag(
          ctx as KindCtx<KSNode>, 'no-fallthrough',
          "Expected a 'break' statement before 'case'.",
          nextClause.node.pos, nextClause.node.end,
        ));
      }
    }

    return violations;
  },
);
