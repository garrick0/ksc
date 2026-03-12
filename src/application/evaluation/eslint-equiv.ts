/**
 * Evaluation wiring: ESLint-equiv — pre-composed evaluator.
 *
 * Constructs an EvaluationTarget from concrete adapters, then creates
 * the evaluator from it. Symmetric with ts-kind-checking.ts.
 *
 * Imports projections from the lightweight projections module (not spec.ts)
 * to avoid loading equation functions and codegen machinery at runtime.
 */

// Concrete adapters
import { grammar } from '../../adapters/grammar/grammar/ts-ast/index.js';
import { analysisProjections, type EslintEquivAttrMap } from '../../adapters/analysis/spec/eslint-equiv/projections.js';
import { dispatchConfig } from '../../adapters/analysis/spec/eslint-equiv/generated/dispatch.js';
import { depGraph } from '../../adapters/analysis/spec/eslint-equiv/generated/dep-graph.js';
import type { EslintEquivProjections } from '../../adapters/analysis/spec/eslint-equiv/types.js';

// Generic machinery
import { createEvaluatorFromTarget } from '@kindscript/core-evaluator';
import type { EvaluationTarget } from '@kindscript/core-evaluator';
import type { TSNodeKind } from '../../adapters/grammar/grammar/ts-ast/nodes.js';

// ── Evaluation target (runtime counterpart to eslintEquivTarget) ──

export const eslintEquivEvalTarget: EvaluationTarget<TSNodeKind, EslintEquivAttrMap, EslintEquivProjections> = {
  grammar,
  dispatch: dispatchConfig,
  projections: analysisProjections,
  depGraph,
};

// ── Wire evaluator (singleton) ──────────────────────────────────────

export const evaluator = createEvaluatorFromTarget(eslintEquivEvalTarget);
