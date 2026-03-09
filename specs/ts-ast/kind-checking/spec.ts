/**
 * KSC Analysis Specification — Kind Checking over TypeScript AST
 *
 * Assembles the full AnalysisSpec (8 attributes) from:
 *   equations.ts   — equation functions for runtime evaluation
 *   types.ts       — domain vocabulary
 *
 * Attribute layout:
 *   kindDefs        — syn: kind definitions from TypeAliasDeclarations
 *   defEnv          — inh: definition environment (propagated from root)
 *   defLookup       — syn: closure for name-based definition lookup
 *   kindAnnotations — syn: kind annotations on VariableDeclarations
 *   contextFor(p)   — inh, parameterized: active kind context per property
 *   violationFor(p) — syn, parameterized: violation check per property
 *   allViolations   — syn: all violation diagnostics (recursive gather)
 *   nodeCount       — collection: total node count
 */

import type { AnalysisSpec, AttrDecl } from '../../../analysis/types.js';
import { code } from '../../../analysis/types.js';
import type { Ctx } from '../../../analysis/ctx.js';
import type { KindDefinition, Diagnostic } from './types.js';
import {
  projectDefinitions,
  eq_kindDefs_CompilationUnit,
  eq_kindDefs_default,
  eq_defEnv_root,
  eq_defLookup,
  eq_kindAnnotations_VariableDeclaration,
  eq_kindAnnotations_default,
  eq_contextOverride,
  eq_violationFor_Identifier,
  eq_violationFor_PropertyAccessExpression,
  eq_violationFor_VariableDeclarationList,
  eq_violationFor_CallExpression,
  eq_violationFor_ExpressionStatement,
  eq_violationFor_BinaryExpression,
  eq_violationFor_PrefixUnaryExpression,
  eq_violationFor_PostfixUnaryExpression,
  eq_violationFor_DeleteExpression,
  eq_allViolations,
} from './equations.js';

// ═══════════════════════════════════════════════════════════════════════
// All 8 attributes — function references, deps inferred via withDeps()
// ═══════════════════════════════════════════════════════════════════════

const allAttrs: AttrDecl[] = [
  // ── Structural attrs ──
  {
    name: 'kindDefs',
    direction: 'syn',
    type: 'KindDefinition[]',
    default: eq_kindDefs_default,
    equations: { CompilationUnit: eq_kindDefs_CompilationUnit },
  },
  {
    name: 'defEnv',
    direction: 'inh',
    type: 'Map<string, KindDefinition>',
    rootValue: eq_defEnv_root,
  },
  {
    name: 'defLookup',
    direction: 'syn',
    type: '(name: string) => KindDefinition | undefined',
    default: eq_defLookup,
  },
  {
    name: 'kindAnnotations',
    direction: 'syn',
    type: 'KindDefinition[]',
    default: eq_kindAnnotations_default,
    equations: { VariableDeclaration: eq_kindAnnotations_VariableDeclaration },
  },

  // ── Parameterized attrs ──
  {
    name: 'contextFor',
    direction: 'inh',
    type: 'KindDefinition | null',
    parameter: { name: 'property', type: 'string' },
    rootValue: null,
    parentEquations: { VariableDeclaration: eq_contextOverride },
  },
  {
    name: 'violationFor',
    direction: 'syn',
    type: 'Diagnostic | null',
    parameter: { name: 'property', type: 'string' },
    default: null,
    equations: {
      Identifier: eq_violationFor_Identifier,
      PropertyAccessExpression: eq_violationFor_PropertyAccessExpression,
      VariableDeclarationList: eq_violationFor_VariableDeclarationList,
      CallExpression: eq_violationFor_CallExpression,
      ExpressionStatement: eq_violationFor_ExpressionStatement,
      BinaryExpression: eq_violationFor_BinaryExpression,
      PrefixUnaryExpression: eq_violationFor_PrefixUnaryExpression,
      PostfixUnaryExpression: eq_violationFor_PostfixUnaryExpression,
      DeleteExpression: eq_violationFor_DeleteExpression,
    },
  },

  // ── Aggregate attrs ──
  {
    name: 'allViolations',
    direction: 'syn',
    type: 'Diagnostic[]',
    default: eq_allViolations,
  },
  {
    name: 'nodeCount',
    direction: 'collection',
    type: 'number',
    init: 1,
    combine: code('(acc: number, contrib: number) => acc + contrib'),
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Analysis Spec
// ═══════════════════════════════════════════════════════════════════════

export const analysisSpec: AnalysisSpec = {
  attrs: allAttrs,
  projections: {
    definitions: projectDefinitions,
    diagnostics: (root: Ctx): Diagnostic[] => root.attr('allViolations'),
  },
  grammarConfig: {
    rootKind: 'CompilationUnit',
    fileNameField: 'fileName',
  },
  evaluatorSetup: {
    imports: ({ specImportPath }) => {
      const specTypesPath = specImportPath.replace(/\/spec\.js$/, '/types.js');
      const equationsPath = specImportPath.replace(/\/spec\.js$/, '/equations.js');
      return [
        `// Domain type imports`,
        `import type { KindDefinition, Diagnostic } from '${specTypesPath}';`,
        ``,
        `import { resetCounter } from '${equationsPath}';`,
        ``,
        `// Analysis spec — runtime access for projections`,
        `import { analysisSpec } from '${specImportPath}';`,
      ];
    },
    attrTypesImports: ({ specImportPath }) => {
      const specTypesPath = specImportPath.replace(/\/spec\.js$/, '/types.js');
      return [
        `import type { KindDefinition, Diagnostic } from '${specTypesPath}';`,
      ];
    },
    evaluateBody: () => [
      `export interface EvaluationResult {`,
      `  definitions: KindDefinition[];`,
      `  diagnostics: Diagnostic[];`,
      `  getDepGraph(): AttributeDepGraph;`,
      `}`,
      ``,
      `export function evaluate(root: KSNode): EvaluationResult {`,
      `  resetCounter();`,
      `  const dnodeRoot = buildKSCTree(root);`,
      `  const definitions = analysisSpec.projections.definitions(dnodeRoot) as KindDefinition[];`,
      `  const diagnostics = analysisSpec.projections.diagnostics(dnodeRoot) as Diagnostic[];`,
      `  return { definitions, diagnostics, getDepGraph: () => KSC_STATIC_DEP_GRAPH };`,
      `}`,
      ``,
      `/** Build a KSCDNode tree for direct attribute inspection (used by tests). */`,
      `export function buildTree(root: KSNode): KSCDNode {`,
      `  resetCounter();`,
      `  return buildKSCTree(root);`,
      `}`,
    ],
  },
};
