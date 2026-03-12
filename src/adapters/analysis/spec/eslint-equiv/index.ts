/**
 * Adapter barrel: eslint-equiv analysis.
 *
 * Re-exports the adapter's public surface:
 *   - Domain types (EslintEquivDiagnostic, EslintEquivProjections)
 *   - Runtime projections (AnalysisProjections)
 *   - Generated dispatch + dep graph
 *
 * Codegen-time declarations (AnalysisDecl from spec.ts) are NOT re-exported —
 * codegen targets import spec.ts directly.
 */

// Domain types
export type { EslintEquivDiagnostic, EslintEquivProjections } from './types.js';

// Runtime projections + attr map alias
export { analysisProjections } from './projections.js';
export type { EslintEquivAttrMap } from './projections.js';

// Generated artifacts (stable re-exports — insulate from generated/ path)
export { dispatchConfig } from './generated/dispatch.js';
export { depGraph } from './generated/dep-graph.js';

// Grammar dependency — explicit coupling to TS AST grammar (see ADR-001)
export { grammar } from '../../../grammar/grammar/ts-ast/index.js';
export type {
  TSNodeKind,
  KSNode,
  KindToNode,
} from '../../../grammar/grammar/ts-ast/index.js';
