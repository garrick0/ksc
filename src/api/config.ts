/**
 * KindScript compiler configuration.
 *
 * The config file holds compiler settings only (like tsconfig.json).
 * Kind definitions live in source code as types.
 *
 *   import { defineConfig } from 'kindscript';
 *   export default defineConfig({ strict: true });
 */

// ── Config type ──

/** Compiler settings for KindScript. */
export interface KindScriptConfig {
  /** Glob patterns of files to include. */
  readonly include?: string[];
  /** Glob patterns of files to exclude. */
  readonly exclude?: string[];
  /** Whether unannotated exports produce warnings. */
  readonly strict?: boolean;
}

// ── defineConfig ──

/**
 * Identity function that provides type-safe autocompletion for configs.
 *
 *   export default defineConfig({ strict: true });
 */
export function defineConfig(config: KindScriptConfig): KindScriptConfig {
  return config;
}
