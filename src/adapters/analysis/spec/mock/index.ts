/**
 * Adapter barrel: mock analysis.
 *
 * Re-exports the adapter's public surface for test consumers.
 */

// Analysis declaration + projections (both from spec.ts — lightweight)
export { analysisDecl, analysisProjections } from './spec.js';
export type { MockProjections } from './spec.js';

// Generated artifacts
export { dispatchConfig } from './generated/dispatch.js';
export { depGraph } from './generated/dep-graph.js';
export type { KSCAttrMap as MockAttrMap } from './generated/attr-types.js';

// Grammar dependency — explicit coupling to mock grammar (see ADR-001)
export { grammar } from '../../../grammar/grammar/mock/index.js';
export type { MockKind, KSNode, KindToNode } from '../../../grammar/grammar/mock/index.js';
