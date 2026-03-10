/**
 * KindScript public API.
 *
 * @example Basic usage
 * ```typescript
 * import { createProgram } from 'kindscript';
 *
 * const program = createProgram(['src/index.ts'], undefined, {
 *   strict: true,
 *   noEmit: true,
 * });
 *
 * const defs = program.getKindDefinitions();
 * const diags = program.getDiagnostics();
 * console.log(`${defs.length} kinds, ${diags.length} violations`);
 * ```
 *
 * @example With config
 * ```typescript
 * import { createProgram, defineConfig } from 'kindscript';
 *
 * const config = defineConfig({ analysisDepth: 'check' });
 * const program = createProgram(rootFiles, config);
 * ```
 *
 * @example Dashboard data export
 * ```typescript
 * import { createProgram, extractASTData } from 'kindscript';
 *
 * const program = createProgram(rootFiles);
 * const data = extractASTData(program.getKSTree(), 'check');
 * // data is a serializable ASTDashboardData object
 * ```
 */

/**
 * Create a KindScript program from file paths.
 * Parses, binds, and checks the files, returning definitions and diagnostics.
 */
export { createProgram, createProgramFromTSProgram } from './lib/program.js';

/** Parse-only pipeline — converts TS AST to KS AST without analysis. */
export { parseOnly } from './lib/parse.js';

/**
 * Identity function providing type-safe autocompletion for config files.
 *
 * @example
 * ```typescript
 * // ksc.config.ts
 * import { defineConfig } from 'kindscript';
 * export default defineConfig({ analysisDepth: 'check' });
 * ```
 */
export { defineConfig } from './lib/config.js';

/** Compiler settings: include/exclude globs, strict mode, analysis depth. */
export type { KindScriptConfig } from './lib/config.js';

/**
 * Phantom type for declaring kind definitions in source code.
 *
 * @example
 * ```typescript
 * import type { Kind } from 'kindscript';
 * type Pure = Kind<{ noIO: true; noMutation: true }>;
 * ```
 */
export type { Kind, PropertySet } from '../../specs/ts-ast/kind-checking/types.js';

/** The program interface returned by createProgram. */
export type { KSProgramInterface } from './lib/types.js';

/** A kind definition found in source code (name + properties + AST node). */
export type { KindDefinition } from '../../specs/ts-ast/kind-checking/types.js';

/** A violation diagnostic (violation message + source location). */
export type { Diagnostic } from '../../specs/ts-ast/kind-checking/types.js';


/**
 * Extract dashboard-friendly AST data from a KS tree.
 * Returns a serializable object with file info, AST nodes, and schema metadata.
 */
export { extractASTData } from './lib/export.js';

/** Dashboard data types. */
export type { ASTDashboardData, ASTNode } from './lib/export.js';
