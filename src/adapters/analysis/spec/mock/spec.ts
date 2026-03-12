/**
 * Mock analysis specification — Adapter: AnalysisDecl<MockKind> + AnalysisProjections<MockProjections>
 *
 * Implements the analysis ports for the mock test analysis.
 * Defines 1 attribute (nodeCount) and 0 properties.
 * This exercises the compileAnalysis functor without requiring
 * the full kind-checking machinery.
 *
 * Since this module has no heavy imports, it exports both the codegen-time
 * analysisDecl and the runtime analysisProjections.
 */

import type { AnalysisDecl, AttrDecl } from '@kindscript/core-codegen';
import { code } from '@kindscript/core-codegen';
import type { AnalysisProjections } from '@kindscript/core-evaluator';
import type { MockKind } from '../../../grammar/grammar/mock/nodes.js';

// ── Attributes ──────────────────────────────────────────────────────

const nodeCountAttr: AttrDecl<MockKind> = {
  name: 'nodeCount',
  direction: 'collection',
  type: 'number',
  init: 1,
  combine: code('(acc: number, contrib: number) => acc + contrib'),
};

// ── Analysis Declaration (codegen-time) ─────────────────────────────

export const analysisDecl: AnalysisDecl<MockKind> = {
  attrs: [nodeCountAttr],
};

// ── Analysis Projections (runtime) ──────────────────────────────────

/** Typed projection results for mock analysis. */
export type MockProjections = {
  definitions: never[];
  diagnostics: never[];
};

/** Attr map type for mock analysis (mirrors generated attr-types.ts). */
type MockAttrMapInternal = { nodeCount: number };

export const analysisProjections: AnalysisProjections<MockAttrMapInternal, MockProjections> = {
  projections: {
    definitions: () => [],
    diagnostics: () => [],
  },
};
