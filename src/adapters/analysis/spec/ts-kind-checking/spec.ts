/**
 * KSC Analysis Declaration — Adapter: AnalysisDecl<TSNodeKind>
 *
 * Codegen-time module: assembles the attribute declarations (12 attrs)
 * from equation functions. This module loads equation functions, pivot
 * machinery, and withDeps — it is only imported by codegen targets.
 *
 * Runtime projections live in projections.ts (lightweight, no equations).
 *
 * Attribute layout:
 *   kindDefs               — syn: kind definitions from TypeAliasDeclarations
 *   defEnv                 — inh: definition environment (propagated from root)
 *   defLookup              — syn: closure for name-based definition lookup
 *   kindAnnotations        — syn: kind annotations on VariableDeclarations
 *   contextFor(p)          — inh, parameterized: active kind context per property
 *   violationFor(p)        — syn, parameterized: violation check per property
 *   allViolations          — syn: all violation diagnostics (recursive gather)
 *   nodeCount              — collection: total node count
 *   protobufTypes          — syn: protobuf type names from imports (CompilationUnit)
 *   protobufTypeEnv        — inh: set of all protobuf type names (broadcast)
 *   protobufViolation      — syn: violation for direct protobuf field access
 *   allProtobufViolations  — syn: recursive gather of protobuf violations
 *
 * Per-kind equation overrides are organized production-centric in equations.ts
 * and pivoted into attr-centric format here via pivotToAttrCentric().
 */

import type { AnalysisDecl, AttrDecl } from '@kindscript/core-codegen';
import { code } from '@kindscript/core-codegen';
import { pivotToAttrCentric } from '@kindscript/core-codegen';
import type { TSNodeKind } from '../../../grammar/grammar/ts-ast/nodes.js';
import type { ProtobufBinding } from './equations/protobuf.js';
import {
  eq_kindDefs_default,
  eq_defEnv_root,
  eq_defLookup,
  eq_kindAnnotations_default,
  eq_allViolations,
  // Protobuf equations
  eq_protobufTypes_default,
  eq_protobufTypeEnv_root,
  eq_protobufViolation_default,
  eq_allProtobufViolations,
  eq_protobufTypes_CompilationUnit,
  eq_protobufViolation_PropertyAccessExpression,
  eq_protobufViolation_ElementAccessExpression,
  // Per-kind equation objects (production-centric)
  CompilationUnitEquations,
  VariableDeclarationEquations,
  IdentifierEquations,
  PropertyAccessExpressionEquations,
  VariableDeclarationListEquations,
  CallExpressionEquations,
  ExpressionStatementEquations,
  BinaryExpressionEquations,
  PrefixUnaryExpressionEquations,
  PostfixUnaryExpressionEquations,
  DeleteExpressionEquations,
} from './equations/index.js';

type TSKind = TSNodeKind;

// ═══════════════════════════════════════════════════════════════════════
// Pivot production-centric overrides → attr-centric
// ═══════════════════════════════════════════════════════════════════════

const pivoted = pivotToAttrCentric<TSKind>({
  CompilationUnit: { ...CompilationUnitEquations, protobufTypes: eq_protobufTypes_CompilationUnit },
  VariableDeclaration: VariableDeclarationEquations,
  Identifier: IdentifierEquations,
  PropertyAccessExpression: { ...PropertyAccessExpressionEquations, protobufViolation: eq_protobufViolation_PropertyAccessExpression },
  ElementAccessExpression: { protobufViolation: eq_protobufViolation_ElementAccessExpression },
  VariableDeclarationList: VariableDeclarationListEquations,
  CallExpression: CallExpressionEquations,
  ExpressionStatement: ExpressionStatementEquations,
  BinaryExpression: BinaryExpressionEquations,
  PrefixUnaryExpression: PrefixUnaryExpressionEquations,
  PostfixUnaryExpression: PostfixUnaryExpressionEquations,
  DeleteExpression: DeleteExpressionEquations,
});

// ═══════════════════════════════════════════════════════════════════════
// All 12 attributes — function references, deps inferred via withDeps()
// ═══════════════════════════════════════════════════════════════════════

const allAttrs: AttrDecl<TSKind>[] = [
  // ── Structural attrs ──
  {
    name: 'kindDefs',
    direction: 'syn',
    type: 'KindDefinition[]',
    default: eq_kindDefs_default,
    equations: pivoted.kindDefs,
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
    equations: pivoted.kindAnnotations,
  },

  // ── Parameterized attrs ──
  {
    name: 'contextFor',
    direction: 'inh',
    type: 'KindDefinition | null',
    parameter: { name: 'property', type: 'string' },
    rootValue: null,
    parentEquations: pivoted.contextFor,
  },
  {
    name: 'violationFor',
    direction: 'syn',
    type: 'Diagnostic | null',
    parameter: { name: 'property', type: 'string' },
    default: null,
    equations: pivoted.violationFor,
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

  // ── Protobuf getter enforcement attrs ──
  {
    name: 'protobufTypes',
    direction: 'syn',
    type: 'Map<string, ProtobufBinding>',
    default: eq_protobufTypes_default,
    equations: pivoted.protobufTypes,
  },
  {
    name: 'protobufTypeEnv',
    direction: 'inh',
    type: 'Set<string>',
    rootValue: eq_protobufTypeEnv_root,
  },
  {
    name: 'protobufViolation',
    direction: 'syn',
    type: 'Diagnostic | null',
    default: eq_protobufViolation_default,
    equations: pivoted.protobufViolation,
  },
  {
    name: 'allProtobufViolations',
    direction: 'syn',
    type: 'Diagnostic[]',
    default: eq_allProtobufViolations,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Analysis Declaration (codegen-time)
// ═══════════════════════════════════════════════════════════════════════

export const analysisDecl: AnalysisDecl<TSKind> = {
  attrs: allAttrs,
  typeImports: ({ specImportPath }) => {
    const specTypesPath = specImportPath.replace(/\/spec\.js$/, '/types.js');
    const protobufPath = specImportPath.replace(/\/spec\.js$/, '/equations/protobuf.js');
    return [
      `import type { KindDefinition, Diagnostic } from '${specTypesPath}';`,
      `import type { ProtobufBinding } from '${protobufPath}';`,
    ];
  },
};
