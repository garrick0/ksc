/**
 * Mock analysis specification — Adapter: AnalysisDecl<MockKind>
 *
 * Implements the codegen-time analysis port for the mock test analysis.
 * Defines 1 attribute (nodeCount) and 0 properties.
 * This exercises the compileAnalysis functor without requiring
 * the full kind-checking machinery.
 *
 */

import type { AnalysisDecl, AttrDecl } from '@ksc/behavior';
import { code } from '@ksc/behavior';
import type { MockKind } from '@ksc/language-mock/grammar/nodes.js';

// ── Attributes ──────────────────────────────────────────────────────

const nodeCountAttr: AttrDecl<MockKind> = {
  name: 'nodeCount',
  direction: 'collection',
  type: 'number',
  init: 1,
  combine: code('(acc, contrib) => acc + contrib'),
};

const definitionsAttr: AttrDecl<MockKind> = {
  name: 'definitions',
  direction: 'syn',
  type: 'never[]',
  default: code('[]'),
};

const diagnosticsAttr: AttrDecl<MockKind> = {
  name: 'diagnostics',
  direction: 'syn',
  type: 'never[]',
  default: code('[]'),
};

// ── Analysis Declaration (codegen-time) ─────────────────────────────

export const analysisDecl: AnalysisDecl<MockKind> = {
  attrs: [definitionsAttr, diagnosticsAttr, nodeCountAttr],
};
