/**
 * @ksc/ag — Attribute grammar library for TypeScript.
 *
 * Three-object architecture:
 *   Grammar    — pure tree structure (the functor)
 *   Semantics  — merged, validated algebra (sealed)
 *   interpret() — the evaluator (folds algebra over structure)
 */

// Core types
export type { StampedNode, AttributeDef, AttributeMap } from './types.js';

// Declaration types (the domain layer)
export type { AttrDecl, SynDecl, InhDecl, CircularDecl, ParamSynDecl, CollectionDecl, ProductionEquations } from './decl.js';

// Spec input (user-facing specification)
export type { SpecInput } from './spec.js';

// Grammar (pure structure)
export { createGrammar } from './grammar.js';
export type { Grammar } from './grammar.js';

// Semantics (merged, validated algebra)
export { createSemantics } from './semantics.js';
export type { Semantics, SealedSpec } from './semantics.js';

// Interpreter (the evaluator)
export { interpret } from './interpret.js';

// Compilation (decl + eq -> AttributeDef)
export { compile } from './compile.js';

// Low-level primitives (for advanced use / custom orchestration)
export { installLazy, stampTree } from './stamp.js';
export { applyAttributes } from './apply.js';

// Dependency analysis
export { analyzeDeps } from './analyze.js';
export type { DepGraph, AnalysisResult } from './analyze.js';

// Serialization
export { serializeTree, deserializeTree } from './serialize.js';
export type { SerializeOptions } from './serialize.js';
