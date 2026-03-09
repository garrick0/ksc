/**
 * Analysis module — spec interfaces, compilation, and equation framework.
 *
 * Structure:
 *   types.ts      — spec interfaces (AnalysisSpec, AttrDecl discriminated union, etc.) + generic AG types
 *   compile.ts    — Functor 2: compileAnalysis(AnalysisSpec) → CompiledAnalyzer
 *   validate.ts   — spec validation (attr dep consistency)
 *   ctx.ts        — Ctx interface (equation contract)
 *
 * Note: Domain types live in the spec that defines them
 * (e.g., specs/ts-ast/kind-checking/types.ts).
 */

// Generic AG types
export type { AttributeDepGraph } from './types.js';

// Spec interfaces
export type { AnalysisSpec, AttrDecl, SynAttr, InhAttr, CollectionAttr, GrammarConfig, EvaluatorSetup } from './types.js';
export type { CompiledAnalyzer, CompiledAttrDef } from './types.js';
export type { CodeLiteral, AttrExpr } from './types.js';
export { code, isCodeLiteral, withDeps, collectDepsForAttr } from './types.js';

// Compilation
export { compileAnalysis } from './compile.js';

// Validation
export { validateSpec } from './validate.js';

// Equation context interface
export type { Ctx } from './ctx.js';
