/**
 * Internal compiler type definitions for KindScript.
 *
 * These types are used by the binder, checker, and program.
 */

import type ts from 'typescript';

// ── PropertySpec (runtime representation) ──

/**
 * Runtime representation of declared rules, extracted from the config.
 */
export interface PropertySpec {
  // Intrinsic
  pure?: true;
  noIO?: true;
  noImports?: true;
  noMutation?: true;
  noConsole?: true;
  immutable?: true;
  static?: true;
  noSideEffects?: true;
  maxFanOut?: number;

  // Relational
  noDependency?: Array<[string, string]>;
  noTransitiveDependency?: Array<[string, string]>;
  noCycles?: string[];
  noSiblingDependency?: true;

  // Structural
  exhaustive?: true;
  scope?: 'folder' | 'file';

  // Index signature for dynamic property access
  [key: string]: unknown;
}

// ── KindSymbol ──

/**
 * Each config entry becomes a KindSymbol for the checker.
 */
export interface KindSymbol {
  /** Unique identifier (e.g., "sym-0"). */
  id: string;

  /** The config entry name. */
  name: string;

  /** The rules this entry declares. */
  declaredProperties: PropertySpec;

  /** Child members (composite entries only). */
  members?: Map<string, KindSymbol>;

  /** Filesystem path for file/directory targets. */
  path?: string;

  /** What kind of target this is. */
  valueKind: 'file' | 'directory' | 'composite';
}

// ── Computed properties (checker output) ──

export interface PropertyViolation {
  property: string;
  node: ts.Node;
  message: string;
}

export interface ComputedPropertySpec {
  pure: boolean;
  noIO: boolean;
  noImports: boolean;
  noMutation: boolean;
  noConsole: boolean;
  immutable: boolean;
  static: boolean;
  noSideEffects: boolean;
  fanOut: number;
  violations: PropertyViolation[];
}

// ── Diagnostics ──

export interface KSDiagnostic {
  file: ts.SourceFile;
  start: number;
  length: number;
  messageText: string;
  category: ts.DiagnosticCategory;
  code: number;
  /** The property that was violated (e.g., "noConsole", "immutable"). */
  property?: string;
}

/** KindScript error codes start at 70001. */
export const enum KSErrorCode {
  NoDependency = 70001,
  NoTransitiveDependency = 70002,
  Pure = 70003,
  NoCycles = 70004,
  Scope = 70005,
  Exhaustive = 70006,
  NoIO = 70007,
  NoImports = 70008,
  NoConsole = 70009,
  Immutable = 70010,
  Static = 70011,
  NoSideEffects = 70012,
  NoMutation = 70013,
  MaxFanOut = 70014,
  NoSiblingDependency = 70015,
}

// ── Checker interface ──

export interface KSChecker {
  checkSourceFile(sourceFile: ts.SourceFile): KSDiagnostic[];
  checkProgram(): KSDiagnostic[];
}

// ── Program interface ──

export interface KSProgram {
  // Delegated to TypeScript
  getTSProgram(): ts.Program;
  getSourceFiles(): readonly ts.SourceFile[];
  getCompilerOptions(): ts.CompilerOptions;
  getTSTypeChecker(): ts.TypeChecker;

  // KindScript-specific
  getAllKindSymbols(): KindSymbol[];
  getKindChecker(): KSChecker;
  getKindDiagnostics(sourceFile?: ts.SourceFile): KSDiagnostic[];
}
