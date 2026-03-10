/**
 * Mock analysis specification — Adapter: AnalysisSpec<MockKind, MockProjections>
 *
 * Implements the AnalysisSpec port for the mock test analysis.
 * Defines 1 attribute (nodeCount) and 0 properties.
 * This exercises the compileAnalysis functor without requiring
 * the full kind-checking machinery.
 */

import type { AnalysisSpec, AttrDecl } from '../../../analysis/index.js';
import { code } from '../../../analysis/index.js';
import type { MockKind } from '../grammar/nodes.js';

// ── Attributes ──────────────────────────────────────────────────────

const nodeCountAttr: AttrDecl<MockKind> = {
  name: 'nodeCount',
  direction: 'collection',
  type: 'number',
  init: 1,
  combine: code('(acc: number, contrib: number) => acc + contrib'),
};

// ── Analysis Spec ────────────────────────────────────────────────────

/** Typed projection results for mock analysis. */
export type MockProjections = {
  definitions: never[];
  diagnostics: never[];
};

export const analysisSpec: AnalysisSpec<MockKind, MockProjections> = {
  attrs: [nodeCountAttr],
  projections: {
    definitions: () => [],
    diagnostics: () => [],
  },
};
