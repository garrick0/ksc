/**
 * Domain types for the eslint-equiv analysis adapter.
 *
 * Defines the diagnostic shape and projection interface for ESLint-equivalent
 * attribute grammar rules.
 */

import type { KSNode } from '../../../grammar/grammar/ts-ast/index.js';

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

/** Typed projection results — violations grouped by ESLint rule ID. */
export type EslintEquivProjections = {
  violations: Record<string, EslintEquivDiagnostic[]>;
  [key: string]: unknown;
};
