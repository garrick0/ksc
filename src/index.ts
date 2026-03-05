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

// Config (compiler settings only)
export { defineConfig } from './api/config.js';
export type { KindScriptConfig } from './api/config.js';

// Kind type API (for users defining kinds in source code)
export type { Kind, PropertySet } from './api/kinds.js';

// Types
export type {
  KSProgramInterface,
  KindDefinition,
  CheckerDiagnostic,
} from './pipeline/types.js';

// Binder
export { createBinderSpec } from './pipeline/binder.js';

// Checker
export { createCheckerSpec } from './pipeline/checker.js';

// Dashboard export
export { exportDashboardData } from './dashboard/export.js';
export type { DashboardExportData, ExportOptions } from './dashboard/export.js';
