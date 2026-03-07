/**
 * Domain types for KindScript AG specs.
 *
 * Merges the public Kind API (PropertySet, Kind<>) with the internal
 * domain types (KindDefinition, CheckerDiagnostic, AttributeDepGraph)
 * produced/consumed by the binder and checker specs.
 */

import type { KSNode, KSTypeAliasDeclaration } from '../ast-schema/generated/index.js';

// ── PropertySet / Kind ──

/** The vocabulary of properties a kind can declare. */
export interface PropertySet {
  readonly noImports?: true;
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
  properties: PropertySet;
  /** The KSC AST node for this definition. */
  node: KSTypeAliasDeclaration;
}

// ── Checker Diagnostics ──

/**
 * A diagnostic produced by the checker when a kind property is violated.
 */
export interface CheckerDiagnostic {
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

// ── Attribute Dep Graph ──

/** Attribute dependency graph data for visualization. */
export interface AttributeDepGraph {
  /** All attribute names. */
  attributes: string[];
  /** Edges: [source, target] means source depends on target. */
  edges: [string, string][];
  /** Evaluation order (topological). */
  order: string[];
  /** Which spec each attribute belongs to. */
  specOwnership: Record<string, string>;
  /** Declaration metadata per attribute. */
  declarations: Record<string, { direction: string }>;
}
