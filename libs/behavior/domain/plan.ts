import type { Grammar, AttributeDepGraph } from '@ksc/grammar';
import type { AnalysisDecl, AttrDecl } from '../domain/ports.js';

/**
 * Behavior Plan (IR) — In-memory representation of a compiled AG.
 *
 * This object contains all the resolved metadata, topological order,
 * and pivoted equation maps needed to execute an analysis.
 */
export interface BehaviorPlan {
  readonly grammar: Grammar;
  readonly decl: AnalysisDecl;
  readonly allAttrs: AttrDecl[];
  readonly depGraph: AttributeDepGraph;
}
