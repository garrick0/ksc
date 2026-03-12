/**
 * Shared helpers for constructing EslintEquivDiagnostic objects.
 */

import type { EslintEquivDiagnostic } from '../types.js';
import type { KindCtx } from '@kindscript/core-evaluator';
import type { KSNode } from '../../../../grammar/grammar/ts-ast/index.js';

/** Construct a diagnostic for an ESLint-equiv rule violation. */
export function eslintDiag(
  ctx: KindCtx<KSNode>,
  ruleId: string,
  message: string,
  /** Override pos/end (e.g., to point to the operator token). */
  pos?: number,
  end?: number,
): EslintEquivDiagnostic {
  return {
    ruleId,
    node: ctx.node,
    message,
    pos: pos ?? ctx.node.pos,
    end: end ?? ctx.node.end,
    fileName: ctx.findFileName(),
  };
}
