/**
 * Internal compiler type definitions for KindScript.
 */

import type { PropertySet } from '../api/kinds.js';
import type { KSNode, KSTypeAliasDeclaration, KSCompilationUnit } from './ast.js';
import type { KSTree } from './convert.js';

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

// ── Program interface ──

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

export interface KSProgramInterface {
  getRootFileNames(): string[];
  getCompilationUnits(): KSCompilationUnit[];
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): CheckerDiagnostic[];
  getKSTree(): KSTree;
  getAttributeDepGraph(): AttributeDepGraph;
}
