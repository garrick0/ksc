/**
 * @ksc/ag — Attribute grammar library for TypeScript.
 *
 * Three-object architecture:
 *   Grammar    — pure tree structure (the functor)
 *   Semantics  — merged, validated algebra (sealed)
 *   interpret() — the evaluator (folds algebra over structure)
 */

// Declaration types and spec input (the domain layer)
export type {
  AttrDecl, SynDecl, InhDecl, CircularDecl, ParamSynDecl, CollectionDecl,
  ProductionEquations, SpecInput,
} from './spec.js';

// Grammar (pure structure)
export { createGrammar } from './grammar.js';
export type { Grammar } from './grammar.js';

// Semantics (merged, validated algebra)
export { createSemantics } from './semantics.js';
export type { Semantics, SealedSpec } from './semantics.js';

// Compilation (decl + eq -> AttributeDef) and lazy caching
export { compile, installLazy } from './compile.js';
export type { AttributeDef, AttributeMap } from './compile.js';

// Interpreter (the evaluator) and tree primitives
export { interpret, stampTree, applyAttributes } from './interpret.js';
export type { StampedNode } from './interpret.js';

// Dependency analysis
export { analyzeDeps } from './analyze.js';
export type { DepGraph, AnalysisResult } from './analyze.js';

// Serialization
export { serializeTree, deserializeTree } from './serialize.js';
export type { SerializeOptions } from './serialize.js';
