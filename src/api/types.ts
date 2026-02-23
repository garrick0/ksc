/**
 * User-facing type definitions for KindScript.
 *
 * These types are imported by users in their context.ts files:
 *   import { Kind, KSFile, KSDir, PropertySpec } from 'kindscript';
 */

// ── Path utility types ──

type ExtractFilename<P extends string> = P extends `${string}/${infer F}` ? F : P;
type ExtractExtension<P extends string> = P extends `${string}.${infer E}` ? `.${E}` : '';
type ExtractDirname<P extends string> = P extends `${string}/${infer N}` ? N : P;

// ── Value types ──

/**
 * Represents a source file. Path is a string literal carried as a phantom
 * parameter; filename and extension are computed by TS template literal types.
 */
export type KSFile<Path extends string = string> = {
  readonly path: Path;
  readonly filename: ExtractFilename<Path>;
  readonly extension: ExtractExtension<Path>;
  readonly __ks?: true;
};

/**
 * Represents a directory. A directory is a node whose children are files
 * and subdirectories.
 */
export type KSDir<Path extends string = string> = {
  readonly path: Path;
  readonly name: ExtractDirname<Path>;
  readonly __ks?: true;
};

// ── Property vocabulary ──

/**
 * Describes what properties a kind requires. Parameterized by Members so
 * relational properties can reference member names with type safety.
 *
 * Three categories:
 * - Intrinsic — properties of the value itself (pure, noIO, noImports, etc.)
 * - Relational — properties between members (noDependency, noCycles, etc.)
 * - Structural — shape constraints on the value's scope (exhaustive, scope)
 */
export type PropertySpec<Members = {}> = {
  // Intrinsic (evaluated per-value by walking the AST)
  readonly pure?: true;
  readonly noIO?: true;
  readonly noImports?: true;
  readonly noMutation?: true;
  readonly noConsole?: true;
  readonly immutable?: true;
  readonly static?: true;
  readonly noSideEffects?: true;
  readonly maxFanOut?: number;

  // Relational (evaluated between members via the import graph)
  readonly noDependency?: ReadonlyArray<
    readonly [keyof Members & string, keyof Members & string]
  >;
  readonly noTransitiveDependency?: ReadonlyArray<
    readonly [keyof Members & string, keyof Members & string]
  >;
  readonly noCycles?: ReadonlyArray<keyof Members & string>;
  readonly noSiblingDependency?: true;

  // Structural
  readonly exhaustive?: true;
  readonly scope?: 'folder' | 'file';
};

// ── The Kind wrapper ──

/**
 * Takes a base TS type and a phantom property spec. Resolves structurally
 * to Base. The conditional on _Properties extracts member names from Base
 * when it's an object type, giving relational properties keyof checking.
 */
export type Kind<
  Base = unknown,
  _Properties extends PropertySpec<
    Base extends Record<string, unknown> ? Base : {}
  > = {},
> = Base & {
  readonly __ks?: true;
};
