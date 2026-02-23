/**
 * KindScript public API.
 *
 * Compiler entry points:
 *   import { createProgram } from 'kindscript';
 *
 * User-facing types:
 *   import { Kind, KSFile, KSDir, PropertySpec, ks } from 'kindscript';
 */

// Compiler
export { createProgram, createProgramFromTSProgram } from './program.js';

// Types
export type {
  KSProgram,
  KindSymbolTable,
  KindSymbol,
  PropertySpec as InternalPropertySpec,
  KSDiagnostic,
  KSChecker,
  ComputedPropertySpec,
  PropertyViolation,
} from './types.js';
export { KSErrorCode } from './types.js';

// User-facing API
export type { Kind, KSFile, KSDir, PropertySpec } from './api/index.js';
export { ks } from './api/index.js';
