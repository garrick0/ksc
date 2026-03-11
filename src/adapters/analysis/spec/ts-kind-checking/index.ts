/**
 * Adapter barrel: ts-kind-checking analysis.
 *
 * Re-exports the adapter's public surface:
 *   - Domain types (KindDefinition, Diagnostic, etc.)
 *   - Runtime projections (AnalysisProjections)
 *   - Generated dispatch + dep graph (insulates consumers from generated/ internals)
 *
 * Codegen-time declarations (AnalysisDecl from spec.ts) are NOT re-exported here —
 * codegen targets import spec.ts directly.
 */

// Domain types
export type { KindDefinition, Diagnostic, KSCProjections } from './types.js';
export { PROPERTY_KEYS } from './types.js';

// Runtime projections
export { analysisProjections } from './projections.js';

// Generated artifacts (stable re-exports — insulate from generated/ path)
export { dispatchConfig } from './generated/dispatch.js';
export { depGraph } from './generated/dep-graph.js';
export type { KSCAttrMap } from './generated/attr-types.js';
