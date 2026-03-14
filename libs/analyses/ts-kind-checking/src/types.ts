/**
 * Kind-checking vocabulary types.
 *
 * All domain types specific to the kind-checking analysis:
 *   KindDefinition — a kind definition found in source code
 *   Diagnostic — a violation diagnostic
 *   PROPERTY_KEYS — runtime property name validation
 *
 * Kind<R> and PropertySet are re-exported from @ksc/kinds.
 */

import type { PropertySet } from '@ksc/kinds';
export type { Kind, PropertySet } from '@ksc/kinds';

// Grammar dependency — concrete node types (see ADR-001)
import type { KSTypeAliasDeclaration, KSNode } from '@ksc/language-ts-ast/grammar/index.js';

// ── Kind Definitions ──

/**
 * A kind definition found in source code.
 * Produced from `type X = Kind<{ ... }>` declarations.
 */
export interface KindDefinition {
  /** Unique identifier (e.g., "kdef-0"). */
  id: string;
  /** The type alias name (e.g., "Pure"). */
  name: string;
  /** The properties extracted from the Kind<...> type argument. */
  properties: Record<string, boolean | undefined>;
  /** The AST node for this definition (always a TypeAliasDeclaration). */
  node: KSTypeAliasDeclaration;
}

// ── Checker Diagnostics ──

/**
 * A diagnostic produced by the checker when a kind property is violated.
 */
export interface Diagnostic {
  /** The AST node where the violation occurs. */
  node: KSNode;
  /** Human-readable description. */
  message: string;
  /** Name of the kind that was violated. */
  kindName: string;
  /** The specific property that was violated. */
  property: string;
  /** Position info. */
  pos: number;
  end: number;
  fileName: string;
}

// ── Property Vocabulary ──

/** Runtime set of valid property names, derived from PropertySet keys. */
export const PROPERTY_KEYS: ReadonlySet<string> = new Set<keyof PropertySet>([
  'noImports', 'noConsole', 'immutable', 'static',
  'noSideEffects', 'noMutation', 'noIO', 'pure',
]);
