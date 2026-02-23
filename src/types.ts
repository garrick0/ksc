/**
 * Internal compiler type definitions for KindScript.
 *
 * These types are used by the binder, checker, and program — not by end users.
 */

import type ts from 'typescript';

// ── PropertySpec (runtime representation) ──

/**
 * Runtime representation of a Kind's declared properties, extracted from
 * the type arguments of Kind<Base, Properties> during binding.
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
 * Each Kind-related symbol gets a KindSymbol entry in the KindSymbolTable.
 * Mirrors TypeScript's symbolLinks[] side-table pattern.
 */
export interface KindSymbol {
  /** Back-reference to the TypeScript symbol. */
  tsSymbol: ts.Symbol;

  /** The type alias or variable name. */
  name: string;

  /** Is this a Kind type definition or a kind-annotated value? */
  role: 'definition' | 'value';

  /** The properties this Kind declares. */
  declaredProperties: PropertySpec;

  /** The Base in Kind<Base, Props>. */
  baseType: ts.Type;

  /** Child members (if base type is an object with Kind-typed properties). */
  members?: Map<string, KindSymbol>;

  /** Link to the Kind definition this value is annotated with (values only). */
  kindDefinition?: KindSymbol;

  /** Filesystem path from ks.file() or ks.dir() (values only). */
  path?: string;

  /** What kind of value this is. */
  valueKind: 'function' | 'file' | 'directory' | 'composite';
}

// ── KindSymbolTable ──

/**
 * A WeakMap keyed on ts.Symbol objects. Extends symbols with KindScript
 * metadata without mutating TypeScript's own data structures.
 */
export type KindSymbolTable = WeakMap<ts.Symbol, KindSymbol>;

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
  getKindSymbolTable(): KindSymbolTable;
  getKindChecker(): KSChecker;
  getKindDiagnostics(sourceFile?: ts.SourceFile): KSDiagnostic[];
}
