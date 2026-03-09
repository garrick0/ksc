/**
 * Grammar module — schema builder DSL, compilation, verification, and data export.
 *
 * Structure:
 *   builder.ts  — schema builder API (createGrammarBuilder, field helpers)
 *   compile.ts  — Functor 1: compileGrammar(GrammarSpec) → CompiledGrammar
 *   export.ts   — dashboard-friendly AST data extraction
 *   types.ts    — GrammarSpec, CompiledGrammar, GeneratedFile
 */

// Builder DSL
export { createGrammarBuilder, child, optChild, list, prop } from './builder.js';
export type { GrammarBuilder, NodeEntry, SumTypeEntry, FieldDesc, ChildField, OptChildField, ListField, PropField } from './builder.js';

// Compilation
export { compileGrammar } from './compile.js';

// Types
export type { GrammarSpec, CompiledGrammar, GeneratedFile, ConvertGenerator } from './types.js';

// Convert codegen helpers (for spec-owned convert generators)
export { buildConverterEntries, emitConverterRegistrations, getConvertFieldExpr, validateFieldExpressions } from './convert-codegen.js';
export type { ConvertGeneratorInput, ConverterEntry, ExprValidationDiagnostic } from './convert-codegen.js';

// Convert skeleton (shared TS-frontend infrastructure template)
export { emitConvertPreamble, emitConvertPostamble } from './convert-skeleton.js';
export type { ConvertSkeletonConfig } from './convert-skeleton.js';

// Field extractor assembly
export { assembleFieldExtractors } from './field-extractors.js';
export type { FieldExtractorConfig } from './field-extractors.js';

// Type-safe extractor DSL
export { statefulCallBuilders, pureCallBuilders, mapLookupBuilders } from './extractor-dsl.js';

// Dashboard export
export { extractASTData } from './export.js';
export type { ASTDashboardData, ASTNode, ASTFieldEntry, ASTSchemaInfo } from './export.js';
