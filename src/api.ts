/**
 * KindScript public API — lightweight entry point.
 *
 * This is the `kindscript` package root (`import ... from 'kindscript'`).
 * It exports only the lightweight phantom types and config utilities
 * that every user needs — zero heavyweight dependencies.
 *
 * @example Source code annotations
 * ```typescript
 * import type { Kind, PropertySet } from 'kindscript';
 *
 * type Pure = Kind<{ noIO: true; noMutation: true }>;
 * ```
 *
 * @example Config file
 * ```typescript
 * import { defineConfig } from 'kindscript';
 * export default defineConfig({ analysisDepth: 'check' });
 * ```
 *
 * For the programmatic API (createProgram, parseOnly),
 * import from `'kindscript/ts-kind-checking'` instead.
 */

// ── Phantom types for source code annotations ───────────────────────

/** The vocabulary of properties a kind can declare. */
export interface PropertySet {
  readonly noImports?: true;
  readonly noConsole?: true;
  readonly immutable?: true;
  readonly static?: true;
  readonly noSideEffects?: true;
  readonly noMutation?: true;
  readonly noIO?: true;
  readonly pure?: true;
}

/**
 * A phantom type that carries property information.
 *
 * Define a kind:
 *   type NoImports = Kind<{ noImports: true }>;
 *
 * Annotate a value:
 *   const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;
 */
export type Kind<R extends PropertySet> = { readonly __kind?: R };

// ── Config ──────────────────────────────────────────────────────────

/** How much TS analysis to perform during conversion. */
export type AnalysisDepth = 'parse' | 'bind' | 'check';

/** Valid AnalysisDepth values. */
const VALID_DEPTHS: readonly AnalysisDepth[] = ['parse', 'bind', 'check'];

/** Type guard for AnalysisDepth. */
export function isAnalysisDepth(value: unknown): value is AnalysisDepth {
  return typeof value === 'string' && VALID_DEPTHS.includes(value as AnalysisDepth);
}

/** Parse a string as AnalysisDepth, throwing a descriptive error on invalid input. */
export function parseAnalysisDepth(value: string): AnalysisDepth {
  if (isAnalysisDepth(value)) return value;
  throw new Error(`Invalid analysisDepth '${value}'. Must be 'parse', 'bind', or 'check'.`);
}

/** Compiler settings for KindScript. */
export interface KindScriptConfig {
  /** How much TS analysis to perform during conversion: parse, bind, or check. Default: 'check'. */
  readonly analysisDepth?: AnalysisDepth;
  /** Glob patterns for files to include. */
  readonly include?: readonly string[];
  /** Glob patterns for files to exclude. */
  readonly exclude?: readonly string[];
  /** Protobuf getter enforcement. When enabled, flags direct field access on protobuf messages. */
  readonly protobuf?: {
    /** Enable protobuf getter checking. Default: false. */
    readonly enabled?: boolean;
    /** Glob patterns for protobuf module specifiers. Default: ['*_pb', '*_grpc_web_pb']. */
    readonly modules?: readonly string[];
  };
}

/**
 * Identity function that provides type-safe autocompletion for configs.
 *
 *   export default defineConfig({ analysisDepth: 'check' });
 */
export function defineConfig(config: KindScriptConfig): KindScriptConfig {
  return config;
}
