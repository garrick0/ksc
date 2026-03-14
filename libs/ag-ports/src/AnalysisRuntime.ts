import type { AttributeDepGraph } from '@ksc/grammar/index.js';
import type { DispatchConfig } from './DispatchConfig.js';

/**
 * Runtime artifact exported by a concrete analysis package.
 *
 * This is analysis-owned runtime data, not evaluator config.
 */
export interface AnalysisRuntime {
  dispatch: DispatchConfig;
  depGraph: AttributeDepGraph;
  setup?: () => void;
}
