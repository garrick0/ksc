import type { AnalysisRuntime } from '@ksc/ag-ports';
import { dispatchConfig } from './generated/dispatch.js';
import { depGraph } from './generated/dep-graph.js';

export const runtime: AnalysisRuntime = {
  dispatch: dispatchConfig,
  depGraph,
};
