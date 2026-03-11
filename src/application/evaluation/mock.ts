/**
 * Evaluation wiring: Mock analysis — EvaluationTarget for testing.
 *
 * Symmetric with mockTarget in codegen-targets.ts.
 * Provides a reusable EvaluationTarget<MockKind, MockProjections> for tests
 * that need a fully-wired mock evaluator.
 */

// Concrete adapters
import { grammar } from '../../adapters/grammar/grammar/mock/index.js';
import { analysisProjections, dispatchConfig, depGraph } from '../../adapters/analysis/spec/mock/index.js';
import type { MockProjections, MockAttrMap } from '../../adapters/analysis/spec/mock/index.js';

// Generic machinery
import { createEvaluatorFromTarget } from '@kindscript/core-evaluator';
import type { EvaluationTarget } from '@kindscript/core-evaluator';
import type { MockKind } from '../../adapters/grammar/grammar/mock/nodes.js';

// ── Mock evaluation target ──────────────────────────────────────────

export const mockEvalTarget: EvaluationTarget<MockKind, MockAttrMap, MockProjections> = {
  grammar,
  dispatch: dispatchConfig,
  projections: analysisProjections,
  depGraph,
};

// ── Pre-wired evaluator (convenience) ───────────────────────────────

export const mockEvaluator = createEvaluatorFromTarget(mockEvalTarget);
