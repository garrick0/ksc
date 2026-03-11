/**
 * Evaluation wiring: TS AST kind-checking — pre-composed evaluator + translator.
 *
 * Single source of truth for the concrete adapter wiring that the
 * TS kind-checking evaluation pipeline needs.
 *
 * Constructs an EvaluationTarget (the runtime counterpart to CodegenTarget)
 * from concrete adapters, then creates the evaluator from it.
 *
 * Imports projections from the lightweight projections module (not spec.ts)
 * to avoid loading equation functions and pivot machinery at runtime.
 */

// Concrete adapters
import { tsToAstTranslatorAdapter } from '../../adapters/grammar/ast-translator/ts-ast/convert.js';
import { grammar } from '../../adapters/grammar/grammar/ts-ast/index.js';
import { analysisProjections, dispatchConfig, depGraph } from '../../adapters/analysis/spec/ts-kind-checking/index.js';
import type { KSCProjections, KSCAttrMap } from '../../adapters/analysis/spec/ts-kind-checking/index.js';

// Generic machinery
import { createEvaluatorFromTarget } from '@kindscript/core-evaluator';
import type { EvaluationTarget } from '@kindscript/core-evaluator';
import type { TSNodeKind } from '../../adapters/grammar/grammar/ts-ast/nodes.js';

// ── Evaluation target (runtime counterpart to tsKindCheckingTarget) ──

export const tsKindCheckingEvalTarget: EvaluationTarget<TSNodeKind, KSCAttrMap, KSCProjections> = {
  grammar,
  dispatch: dispatchConfig,
  projections: analysisProjections,
  depGraph,
};

// ── Wire evaluator (singleton) ──────────────────────────────────────

export const evaluator = createEvaluatorFromTarget(tsKindCheckingEvalTarget);

// ── Re-exports for use case modules ─────────────────────────────────

export { tsToAstTranslatorAdapter, depGraph };
