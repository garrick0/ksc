/**
 * Mock analysis specification — minimal spec for testing the two-functor pipeline.
 *
 * Defines 1 attribute (nodeCount) and 0 properties.
 * This exercises the compileAnalysis functor without requiring
 * the full kind-checking machinery.
 */

import type { AnalysisSpec, AttrDecl } from '../../../analysis/types.js';
import { code } from '../../../analysis/types.js';

// ── Attributes ──────────────────────────────────────────────────────

const nodeCountAttr: AttrDecl = {
  name: 'nodeCount',
  direction: 'collection',
  type: 'number',
  init: 1,
  combine: code('(acc: number, contrib: number) => acc + contrib'),
};

// ── Analysis Spec ────────────────────────────────────────────────────

export const analysisSpec: AnalysisSpec = {
  attrs: [nodeCountAttr],
  projections: {
    definitions: () => [],
    diagnostics: () => [],
  },
  grammarConfig: {
    rootKind: 'MockProgram',
    fileNameField: 'fileName',
  },
  evaluatorSetup: {
    imports: ({ specImportPath }) => [
      `// Analysis spec — runtime access for projections`,
      `import { analysisSpec } from '${specImportPath}';`,
    ],
    evaluateBody: () => [
      `export interface EvaluationResult {`,
      `  getDepGraph(): AttributeDepGraph;`,
      `}`,
      ``,
      `export function evaluate(root: KSNode): EvaluationResult {`,
      `  const dnodeRoot = buildKSCTree(root);`,
      `  return { getDepGraph: () => KSC_STATIC_DEP_GRAPH };`,
      `}`,
      ``,
      `/** Build a KSCDNode tree for direct attribute inspection (used by tests). */`,
      `export function buildTree(root: KSNode): KSCDNode {`,
      `  return buildKSCTree(root);`,
      `}`,
    ],
  },
};
