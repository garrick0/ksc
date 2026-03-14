/**
 * Attribute dependency graph — pure data interface shared by codegen and evaluation.
 *
 * Codegen computes this from the analysis spec; evaluation consumes the
 * serialized form from generated/dep-graph.ts for visualization.
 */

/** Attribute dependency graph data for visualization. */
export interface AttributeDepGraph {
  /** All attribute names. */
  attributes: string[];
  /** Edges: [source, target] means source depends on target. */
  edges: [string, string][];
  /** Evaluation order (topological). */
  order: string[];
  /** Declaration metadata per attribute. */
  declarations: Record<string, { direction: string }>;
}
