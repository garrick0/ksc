/**
 * Analysis module barrel — ports, compilation, and equation framework.
 *
 * Ports:
 *   AnalysisSpec<K, P>    — what an analysis definition provides
 *   CodegenTarget<K, P>   — what a codegen composition root provides
 *   Ctx / KindCtx<N>      — how equations interact with the AG tree
 *
 * Machinery:
 *   compile.ts    — compileAnalysis(Grammar, AnalysisSpec) → CompiledAnalyzer
 *   validate.ts   — spec validation (attr dep consistency)
 *   pivot.ts      — pivotToAttrCentric (equation reshaping)
 */

// Port interfaces
export type { AnalysisSpec, AttrDecl, SynAttr, InhAttr, CollectionAttr } from './types.js';
export type { CodegenTarget, GeneratedImports, ParamDef, ImportPaths } from './types.js';
export type { Ctx, KindCtx } from './ctx.js';

// Supporting types
export type { AttributeDepGraph } from './types.js';
export type { CompiledAnalyzer, CompiledAttrDef, GeneratedFile } from './types.js';
export type { CodeLiteral, AttrExpr } from './types.js';
export { code, isCodeLiteral } from './types.js';

// Validation
export type { ValidationDiagnostic } from './validate.js';

// Equation utilities
export type { EquationFn } from './equation-utils.js';
export { withDeps, collectDepsForAttr } from './equation-utils.js';

// Machinery
export { compileAnalysis, buildDepGraph, validateSpecConsistency } from './compile.js';
export { validateSpec } from './validate.js';
export { pivotToAttrCentric } from './pivot.js';
