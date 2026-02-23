/**
 * KindScript public API.
 *
 * Compiler entry points:
 *   import { createProgram, defineConfig } from 'kindscript';
 */

// Compiler
export { createProgram, createProgramFromTSProgram } from './program.js';

// Config
export { defineConfig, isCompositeEntry } from './config.js';
export type {
  KindScriptConfig,
  ConfigEntry,
  TargetEntry,
  CompositeEntry,
  RuleSet,
} from './config.js';

// Types
export type {
  KSProgram,
  KindSymbol,
  PropertySpec,
  KSDiagnostic,
  KSChecker,
  ComputedPropertySpec,
  PropertyViolation,
} from './types.js';
export { KSErrorCode } from './types.js';

// Dashboard export
export { exportDashboardData } from './export.js';
export type { DashboardExportData, ExportOptions } from './export.js';
