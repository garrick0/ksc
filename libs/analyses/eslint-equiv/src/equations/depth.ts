/**
 * Group C — Inherited + synthesized equations for max-depth.
 *
 * nestDepth (inh): nesting depth propagated downward, incremented at
 * control-flow block boundaries.
 *
 * maxDepthViolation (syn): fires on control-flow nodes when depth exceeds MAX.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx, Ctx } from '@ksc/evaluation/domain/evaluator-index.js';
import type { KSNode } from '@ksc/language-ts-ast/grammar/index.js';
import { withDeps } from '@ksc/behavior';
import { eslintDiag } from './helpers.js';

// MAX_DEPTH is now an inh attribute 'maxDepthThreshold' (default: 4)

// ── nestDepth (inherited) ───────────────────────────────────────────

/**
 * Parent equation for nestDepth — shared across all control-flow node kinds.
 *
 * Receives the CHILD's ctx. Checks fieldName to decide whether to increment.
 * Returns undefined for copy-down (non-body children like conditions).
 *
 * Special handling for else-if: IfStatement's elseStatement that is directly
 * another IfStatement does NOT increment (ESLint counts else-if as same level).
 */

/** Field names that represent the "body" of control-flow statements. */
const BODY_FIELDS = new Set([
  'thenStatement', 'elseStatement', 'statement', 'caseBlock',
  'tryBlock', 'finallyBlock',
]);

export const eq_nestDepth_IfStatement = withDeps([],
  function eq_nestDepth_IfStatement(ctx: Ctx): number | undefined {
    const field = ctx.fieldName;
    if (field === 'thenStatement') {
      return (ctx.parent!.attr('nestDepth') as number) + 1;
    }
    if (field === 'elseStatement') {
      // else-if: don't increment — ESLint treats it as same depth
      if (ctx.node.kind === 'IfStatement') {
        return undefined; // copy-down
      }
      return (ctx.parent!.attr('nestDepth') as number) + 1;
    }
    return undefined;
  },
);

export const eq_nestDepth_controlFlow = withDeps([],
  function eq_nestDepth_controlFlow(ctx: Ctx): number | undefined {
    if (ctx.fieldName && BODY_FIELDS.has(ctx.fieldName)) {
      return (ctx.parent!.attr('nestDepth') as number) + 1;
    }
    return undefined;
  },
);

// ── maxDepthViolation (synthesized) ─────────────────────────────────

/**
 * Check if this control-flow node introduces nesting beyond MAX_DEPTH.
 *
 * nestDepth at this node is the depth SET by its parent. The body
 * introduced by this node would be at nestDepth + 1. ESLint reports
 * when the body depth exceeds MAX_DEPTH, i.e., nestDepth >= MAX_DEPTH.
 */
export const eq_maxDepthViolation_controlFlow = withDeps(['nestDepth', 'maxDepthThreshold'],
  function eq_maxDepthViolation_controlFlow(ctx: Ctx): EslintEquivDiagnostic | null {
    const depth = ctx.attr('nestDepth') as number;
    const threshold = ctx.attr('maxDepthThreshold') as number;
    if (depth >= threshold) {
      return eslintDiag(ctx as KindCtx<KSNode>, 'max-depth',
        `Blocks are nested too deeply (${depth + 1}).`);
    }
    return null;
  },
);
