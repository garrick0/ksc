/**
 * KindScript configuration types and defineConfig helper.
 *
 * Users define architectural constraints in a kindscript.config.ts file:
 *
 *   import { defineConfig } from 'kindscript';
 *   export default defineConfig({
 *     domain: { path: './src/domain', rules: { pure: true, noIO: true } },
 *   });
 */

// ── Rule vocabulary ──

export interface RuleSet {
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
  readonly noDependency?: Array<[string, string]>;
  readonly noTransitiveDependency?: Array<[string, string]>;
  readonly noCycles?: string[];
  readonly noSiblingDependency?: true;

  // Structural
  readonly exhaustive?: true;
  readonly scope?: 'folder' | 'file';
}

// ── Config entry types ──

/** A single file or directory target with optional rules. */
export interface TargetEntry {
  readonly path: string;
  readonly rules?: RuleSet;
}

/** A composite target grouping multiple members with optional relational rules. */
export interface CompositeEntry {
  readonly members: Record<string, TargetEntry>;
  readonly rules?: RuleSet;
}

export type ConfigEntry = TargetEntry | CompositeEntry;

/** Top-level config: a record of named entries. */
export type KindScriptConfig = Record<string, ConfigEntry>;

// ── Type guard ──

export function isCompositeEntry(entry: ConfigEntry): entry is CompositeEntry {
  return 'members' in entry;
}

// ── defineConfig ──

/**
 * Identity function that provides type-safe autocompletion for configs.
 *
 *   export default defineConfig({ ... });
 */
export function defineConfig(config: KindScriptConfig): KindScriptConfig {
  return config;
}
