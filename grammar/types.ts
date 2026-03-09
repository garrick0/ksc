/**
 * Grammar types for the two-functor specialization architecture.
 *
 * Defines GrammarSpec (input to Functor 1) and CompiledGrammar (output).
 */

import type { NodeEntry, SumTypeEntry } from './builder.js';

// ═══════════════════════════════════════════════════════════════════════
// Shared
// ═══════════════════════════════════════════════════════════════════════

export interface GeneratedFile {
  path: string;
  content: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Functor 1: Grammar Compilation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Spec-owned convert.ts generator function.
 *
 * The spec closes over all convert-specific data (fieldExtractors,
 * skipConvert, syntaxKindOverrides) and produces the complete convert.ts
 * content. No arguments needed — the spec has everything.
 */
export type ConvertGenerator = () => string;

export interface GrammarSpec {
  nodes: ReadonlyMap<string, NodeEntry>;
  sumTypes: ReadonlyMap<string, SumTypeEntry>;
  /** Spec-owned convert.ts generator — provides full frontend-specific conversion code. */
  convertGenerator?: ConvertGenerator;
}

export interface CompiledGrammar {
  files: GeneratedFile[];
  kinds: ReadonlySet<string>;
  hasKind(kind: string): boolean;
}
