/**
 * Domain types for the eslint-equiv analysis adapter.
 *
 * Defines the diagnostic shape for ESLint-equivalent attribute grammar rules.
 */

import type { KSNode } from '@ksc/language-ts-ast/grammar/index.js';

/** A diagnostic produced by an eslint-equiv rule. */
export interface EslintEquivDiagnostic {
  /** The ESLint rule ID (e.g., 'eqeqeq', 'no-var'). */
  ruleId: string;
  /** The AST node where the violation occurs. */
  node: KSNode;
  /** Human-readable description. */
  message: string;
  /** Start byte offset in source file. */
  pos: number;
  /** End byte offset in source file. */
  end: number;
  /** Source file path. */
  fileName: string;
}
