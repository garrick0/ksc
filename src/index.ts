/**
 * KindScript public API.
 *
 * Define kinds as types, annotate values, check with the compiler:
 *
 *   import type { Kind, PropertySet } from 'kindscript';
 *   import { createProgram } from 'kindscript';
 */

// Compiler
export { createProgram, createProgramFromTSProgram } from './program.js';

// Parse-only (no binder/checker)
export { parseOnly } from './pipeline/parse.js';

// Config (compiler settings only)
export { defineConfig } from './api/config.js';
export type { KindScriptConfig } from './api/config.js';

// Kind type API (for users defining kinds in source code)
export type { Kind, PropertySet } from '../ksc-behavior/index.js';

// Types
export type { KSProgramInterface } from './pipeline/types.js';
export type { KindDefinition, CheckerDiagnostic } from '../ksc-behavior/index.js';

// AST export (dashboard-friendly data from KS tree)
export { extractASTData } from '../ast-schema/export.js';
export type { ASTDashboardData, ASTNode } from '../ast-schema/export.js';
