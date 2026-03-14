/**
 * ESLint-equiv Analysis Declaration — Adapter: AnalysisDecl<TSNodeKind>
 *
 * Codegen-time module: assembles attribute declarations for ESLint-equivalent
 * rules. This module loads equation functions — only imported by codegen targets.
 *
 * Phase 1 attributes (Group A — trivial syn):
 *   eqeqeqViolation          — syn: == and != usage
 *   noVarViolation            — syn: var declarations
 *   noDebuggerViolation       — syn: debugger statements
 *   noEmptyViolation          — syn: empty block statements
 *   noBitwiseViolation        — syn: bitwise operators
 *   noExplicitAnyViolation    — syn: any type annotations
 *
 * Phase 2 attributes (Group B — child inspection):
 *   noDupeKeysViolation       — syn: duplicate object literal keys
 *   noSelfCompareViolation    — syn: x === x self-comparisons
 *   maxParamsViolation        — syn: too many function parameters
 *   noEmptyInterfaceViolation — syn: empty interface declarations
 *   noDuplicateImportsViolation — syn: duplicate import module specifiers
 *
 * Phase 3 attributes (Group C — inherited):
 *   nestDepth                 — inh: control-flow nesting depth
 *   maxDepthViolation         — syn: nesting exceeds max-depth
 *
 * Phase 5 attributes (Group E — TS-specific):
 *   arrayTypeViolation        — syn: Array<T> instead of T[]
 *   typeDeclStyleViolation    — syn: type alias instead of interface
 *
 * Phase 6 attributes (more syn):
 *   noConsoleViolation        — syn: console.* calls
 *   noEvalViolation           — syn: eval() calls
 *   noNewWrappersViolation    — syn: new Boolean/Number/String
 *   noPlusPlusViolation       — syn: ++/-- operators
 *   noTemplateCurlyViolation  — syn: ${} in regular strings
 *   noCondAssignViolation     — syn: assignment in conditions
 *   noDuplicateCaseViolation  — syn: duplicate case labels
 *   noSelfAssignViolation     — syn: x = x self-assignments
 *   defaultCaseViolation      — syn: missing default case
 *   defaultCaseLastViolation  — syn: default case not last
 *   noUselessCatchViolation   — syn: catch that only rethrows
 *   noMultiAssignViolation    — syn: chained assignments
 *   yodaViolation             — syn: literal on left in comparison
 *   noEmptyFunctionViolation  — syn: empty function body
 *   useIsNanViolation         — syn: comparison with NaN
 *   noSparseArraysViolation   — syn: sparse array holes
 *   noEmptyPatternViolation   — syn: empty destructuring pattern
 *
 * Phase 7 attributes (more TS-specific):
 *   noNonNullAssertionViolation   — syn: non-null assertion (!)
 *   noNamespaceViolation          — syn: namespace/module declaration
 *   noRequireImportsViolation     — syn: require() calls
 *   noEmptyObjectTypeViolation    — syn: empty {} type literal
 *   typeAssertionStyleViolation   — syn: <T>x angle-bracket assertion
 *   noDuplicateEnumValuesViolation — syn: duplicate enum member values
 *   preferAsConstViolation        — syn: literal assertion instead of as const
 *
 * Phase 8 attributes (class structure):
 *   noDupeClassMembersViolation   — syn: duplicate class member names
 *   noUselessConstructorViolation — syn: empty or passthrough constructor
 *   noEmptyStaticBlockViolation   — syn: empty static {} block
 *
 * Scope attributes (AG showcase — inherited scope threading):
 *   shadowDepth                — inh: scope nesting level
 *   shadowEnv                  — inh: Map<name, depth> for all enclosing declarations
 *   noShadowViolation          — syn: variable shadowing outer scope name
 *
 * Control flow attributes:
 *   alwaysTerminates           — syn: statement always terminates execution
 *   noUnreachableViolation     — syn: code after terminating statement
 *   noFallthroughViolation     — syn: switch case falls through
 *
 * Complexity attributes:
 *   complexityThreshold        — inh: max cyclomatic complexity (default: 2)
 *   complexityViolation        — syn: function exceeds complexity threshold
 *
 * Gather:
 *   allEslintViolations       — syn: recursive gather of all violations
 *   violations                — syn: canonical root output grouped by ruleId
 */

import type { AnalysisDecl, AttrDecl } from '@ksc/behavior';
import { code } from '@ksc/behavior';
import type { TSNodeKind } from '@ksc/language-ts-ast/grammar/nodes.js';
import {
  // Group A
  eq_eqeqeqViolation_BinaryExpression,
  eq_noVarViolation_VariableDeclarationList,
  eq_noDebuggerViolation_DebuggerStatement,
  eq_noEmptyViolation_Block,
  eq_noBitwiseViolation_BinaryExpression,
  eq_noBitwiseViolation_PrefixUnaryExpression,
  eq_noExplicitAnyViolation_AnyKeyword,
  // Group B
  eq_noDupeKeysViolation_ObjectLiteralExpression,
  eq_noSelfCompareViolation_BinaryExpression,
  eq_maxParamsViolation_FunctionDeclaration,
  eq_maxParamsViolation_ArrowFunction,
  eq_maxParamsViolation_MethodDeclaration,
  eq_maxParamsViolation_FunctionExpression,
  eq_noEmptyInterfaceViolation_InterfaceDeclaration,
  eq_noDuplicateImportsViolation_CompilationUnit,
  // Group C
  eq_nestDepth_IfStatement,
  eq_nestDepth_controlFlow,
  eq_maxDepthViolation_controlFlow,
  // Group E
  eq_arrayTypeViolation_TypeReference,
  eq_typeDeclStyleViolation_TypeAliasDeclaration,
  // Phase 6
  eq_noConsoleViolation_CallExpression,
  eq_noEvalViolation_CallExpression,
  eq_noNewWrappersViolation_NewExpression,
  eq_noPlusPlusViolation_PrefixUnaryExpression,
  eq_noPlusPlusViolation_PostfixUnaryExpression,
  eq_noTemplateCurlyViolation_StringLiteral,
  eq_noCondAssignViolation_IfStatement,
  eq_noCondAssignViolation_WhileStatement,
  eq_noCondAssignViolation_DoStatement,
  eq_noCondAssignViolation_ForStatement,
  eq_noDuplicateCaseViolation_CaseBlock,
  eq_noSelfAssignViolation_BinaryExpression,
  eq_defaultCaseViolation_CaseBlock,
  eq_defaultCaseLastViolation_CaseBlock,
  eq_noUselessCatchViolation_TryStatement,
  eq_noMultiAssignViolation_BinaryExpression,
  eq_yodaViolation_BinaryExpression,
  eq_noEmptyFunctionViolation_FunctionDeclaration,
  eq_noEmptyFunctionViolation_ArrowFunction,
  eq_noEmptyFunctionViolation_MethodDeclaration,
  eq_noEmptyFunctionViolation_FunctionExpression,
  eq_useIsNanViolation_BinaryExpression,
  eq_noSparseArraysViolation_ArrayLiteralExpression,
  eq_noEmptyPatternViolation_ObjectBindingPattern,
  eq_noEmptyPatternViolation_ArrayBindingPattern,
  // Phase 7
  eq_noNonNullAssertionViolation_NonNullExpression,
  eq_noNamespaceViolation_ModuleDeclaration,
  eq_noRequireImportsViolation_CallExpression,
  eq_noEmptyObjectTypeViolation_TypeLiteral,
  eq_typeAssertionStyleViolation_TypeAssertionExpression,
  eq_noDuplicateEnumValuesViolation_EnumDeclaration,
  eq_preferAsConstViolation_AsExpression,
  eq_preferAsConstViolation_TypeAssertionExpression,
  // Phase 8
  eq_noDupeClassMembersViolation_ClassDeclaration,
  eq_noDupeClassMembersViolation_ClassExpression,
  eq_noUselessConstructorViolation_Constructor,
  eq_noEmptyStaticBlockViolation_ClassStaticBlockDeclaration,
  // Scope
  eq_shadowDepth_scopeCreator,
  eq_shadowEnv_blockLike,
  eq_shadowEnv_functionLike,
  eq_shadowEnv_catchClause,
  eq_shadowEnv_forLike,
  eq_noShadowViolation_VariableDeclaration,
  eq_noShadowViolation_Parameter,
  eq_noShadowViolation_FunctionDeclaration,
  eq_noShadowViolation_ClassDeclaration,
  // Control flow
  eq_alwaysTerminates_ReturnStatement,
  eq_alwaysTerminates_ThrowStatement,
  eq_alwaysTerminates_BreakStatement,
  eq_alwaysTerminates_ContinueStatement,
  eq_alwaysTerminates_Block,
  eq_alwaysTerminates_IfStatement,
  eq_noUnreachableViolation_Block,
  eq_noFallthroughViolation_CaseBlock,
  // Complexity
  eq_complexityViolation_FunctionDeclaration,
  eq_complexityViolation_ArrowFunction,
  eq_complexityViolation_FunctionExpression,
  eq_complexityViolation_MethodDeclaration,
  // Gather
  eq_allEslintViolations,
  eq_violations_Program,
  eq_violations_default,
} from './equations/index.js';

type TSKind = TSNodeKind;

// ═══════════════════════════════════════════════════════════════════════
// All attributes — function references, deps inferred via withDeps()
// ═══════════════════════════════════════════════════════════════════════

const allAttrs: AttrDecl<TSKind>[] = [
  {
    name: 'violations',
    direction: 'syn',
    type: 'Record<string, EslintEquivDiagnostic[]>',
    default: eq_violations_default,
    equations: {
      Program: eq_violations_Program,
    },
  },
  // ── Group A — trivial syn rules ──
  {
    name: 'eqeqeqViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      BinaryExpression: eq_eqeqeqViolation_BinaryExpression,
    },
  },
  {
    name: 'noVarViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      VariableDeclarationList: eq_noVarViolation_VariableDeclarationList,
    },
  },
  {
    name: 'noDebuggerViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      DebuggerStatement: eq_noDebuggerViolation_DebuggerStatement,
    },
  },
  {
    name: 'noEmptyViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      Block: eq_noEmptyViolation_Block,
    },
  },
  {
    name: 'noBitwiseViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      BinaryExpression: eq_noBitwiseViolation_BinaryExpression,
      PrefixUnaryExpression: eq_noBitwiseViolation_PrefixUnaryExpression,
    },
  },
  {
    name: 'noExplicitAnyViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      AnyKeyword: eq_noExplicitAnyViolation_AnyKeyword,
    },
  },

  // ── Group B — child inspection rules ──
  {
    name: 'noDupeKeysViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic[]',
    default: code('[]'),
    equations: {
      ObjectLiteralExpression: eq_noDupeKeysViolation_ObjectLiteralExpression,
    },
  },
  {
    name: 'noSelfCompareViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      BinaryExpression: eq_noSelfCompareViolation_BinaryExpression,
    },
  },
  {
    name: 'maxParamsThreshold',
    direction: 'inh',
    type: 'number',
    rootValue: 3,
    parentEquations: {},
  },
  {
    name: 'maxParamsViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      FunctionDeclaration: eq_maxParamsViolation_FunctionDeclaration,
      ArrowFunction: eq_maxParamsViolation_ArrowFunction,
      MethodDeclaration: eq_maxParamsViolation_MethodDeclaration,
      FunctionExpression: eq_maxParamsViolation_FunctionExpression,
    },
  },
  {
    name: 'noEmptyInterfaceViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      InterfaceDeclaration: eq_noEmptyInterfaceViolation_InterfaceDeclaration,
    },
  },
  {
    name: 'noDuplicateImportsViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic[]',
    default: code('[]'),
    equations: {
      CompilationUnit: eq_noDuplicateImportsViolation_CompilationUnit,
    },
  },

  // ── Group C — inherited + syn (depth) ──
  {
    name: 'nestDepth',
    direction: 'inh',
    type: 'number',
    rootValue: 0,
    parentEquations: {
      IfStatement: eq_nestDepth_IfStatement,
      ForStatement: eq_nestDepth_controlFlow,
      ForInStatement: eq_nestDepth_controlFlow,
      ForOfStatement: eq_nestDepth_controlFlow,
      WhileStatement: eq_nestDepth_controlFlow,
      DoStatement: eq_nestDepth_controlFlow,
      SwitchStatement: eq_nestDepth_controlFlow,
    },
  },
  {
    name: 'maxDepthThreshold',
    direction: 'inh',
    type: 'number',
    rootValue: 4,
    parentEquations: {},
  },
  {
    name: 'maxDepthViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      IfStatement: eq_maxDepthViolation_controlFlow,
      ForStatement: eq_maxDepthViolation_controlFlow,
      ForInStatement: eq_maxDepthViolation_controlFlow,
      ForOfStatement: eq_maxDepthViolation_controlFlow,
      WhileStatement: eq_maxDepthViolation_controlFlow,
      DoStatement: eq_maxDepthViolation_controlFlow,
      SwitchStatement: eq_maxDepthViolation_controlFlow,
    },
  },

  // ── Group E — TS-specific syn rules ──
  {
    name: 'arrayTypeViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      TypeReference: eq_arrayTypeViolation_TypeReference,
    },
  },
  {
    name: 'typeDeclStyleViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      TypeAliasDeclaration: eq_typeDeclStyleViolation_TypeAliasDeclaration,
    },
  },

  // ── Phase 6 — more syn rules ──
  {
    name: 'noConsoleViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      CallExpression: eq_noConsoleViolation_CallExpression,
    },
  },
  {
    name: 'noEvalViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      CallExpression: eq_noEvalViolation_CallExpression,
    },
  },
  {
    name: 'noNewWrappersViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      NewExpression: eq_noNewWrappersViolation_NewExpression,
    },
  },
  {
    name: 'noPlusPlusViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      PrefixUnaryExpression: eq_noPlusPlusViolation_PrefixUnaryExpression,
      PostfixUnaryExpression: eq_noPlusPlusViolation_PostfixUnaryExpression,
    },
  },
  {
    name: 'noTemplateCurlyViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      StringLiteral: eq_noTemplateCurlyViolation_StringLiteral,
    },
  },
  {
    name: 'noCondAssignViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      IfStatement: eq_noCondAssignViolation_IfStatement,
      WhileStatement: eq_noCondAssignViolation_WhileStatement,
      DoStatement: eq_noCondAssignViolation_DoStatement,
      ForStatement: eq_noCondAssignViolation_ForStatement,
    },
  },
  {
    name: 'noDuplicateCaseViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic[]',
    default: code('[]'),
    equations: {
      CaseBlock: eq_noDuplicateCaseViolation_CaseBlock,
    },
  },
  {
    name: 'noSelfAssignViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      BinaryExpression: eq_noSelfAssignViolation_BinaryExpression,
    },
  },
  {
    name: 'defaultCaseViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      CaseBlock: eq_defaultCaseViolation_CaseBlock,
    },
  },
  {
    name: 'defaultCaseLastViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      CaseBlock: eq_defaultCaseLastViolation_CaseBlock,
    },
  },
  {
    name: 'noUselessCatchViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      TryStatement: eq_noUselessCatchViolation_TryStatement,
    },
  },
  {
    name: 'noMultiAssignViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      BinaryExpression: eq_noMultiAssignViolation_BinaryExpression,
    },
  },
  {
    name: 'yodaViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      BinaryExpression: eq_yodaViolation_BinaryExpression,
    },
  },
  {
    name: 'noEmptyFunctionViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      FunctionDeclaration: eq_noEmptyFunctionViolation_FunctionDeclaration,
      ArrowFunction: eq_noEmptyFunctionViolation_ArrowFunction,
      MethodDeclaration: eq_noEmptyFunctionViolation_MethodDeclaration,
      FunctionExpression: eq_noEmptyFunctionViolation_FunctionExpression,
    },
  },
  {
    name: 'useIsNanViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      BinaryExpression: eq_useIsNanViolation_BinaryExpression,
    },
  },
  {
    name: 'noSparseArraysViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      ArrayLiteralExpression: eq_noSparseArraysViolation_ArrayLiteralExpression,
    },
  },
  {
    name: 'noEmptyPatternViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      ObjectBindingPattern: eq_noEmptyPatternViolation_ObjectBindingPattern,
      ArrayBindingPattern: eq_noEmptyPatternViolation_ArrayBindingPattern,
    },
  },

  // ── Phase 7 — more TS-specific syn rules ──
  {
    name: 'noNonNullAssertionViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      NonNullExpression: eq_noNonNullAssertionViolation_NonNullExpression,
    },
  },
  {
    name: 'noNamespaceViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      ModuleDeclaration: eq_noNamespaceViolation_ModuleDeclaration,
    },
  },
  {
    name: 'noRequireImportsViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      CallExpression: eq_noRequireImportsViolation_CallExpression,
    },
  },
  {
    name: 'noEmptyObjectTypeViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      TypeLiteral: eq_noEmptyObjectTypeViolation_TypeLiteral,
    },
  },
  {
    name: 'typeAssertionStyleViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      TypeAssertionExpression: eq_typeAssertionStyleViolation_TypeAssertionExpression,
    },
  },
  {
    name: 'noDuplicateEnumValuesViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic[]',
    default: code('[]'),
    equations: {
      EnumDeclaration: eq_noDuplicateEnumValuesViolation_EnumDeclaration,
    },
  },
  {
    name: 'preferAsConstViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      AsExpression: eq_preferAsConstViolation_AsExpression,
      TypeAssertionExpression: eq_preferAsConstViolation_TypeAssertionExpression,
    },
  },

  // ── Phase 8 — class structure rules ──
  {
    name: 'noDupeClassMembersViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic[]',
    default: code('[]'),
    equations: {
      ClassDeclaration: eq_noDupeClassMembersViolation_ClassDeclaration,
      ClassExpression: eq_noDupeClassMembersViolation_ClassExpression,
    },
  },
  {
    name: 'noUselessConstructorViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      Constructor: eq_noUselessConstructorViolation_Constructor,
    },
  },
  {
    name: 'noEmptyStaticBlockViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      ClassStaticBlockDeclaration: eq_noEmptyStaticBlockViolation_ClassStaticBlockDeclaration,
    },
  },

  // ── Scope — inherited scope threading (no-shadow) ──
  {
    name: 'shadowDepth',
    direction: 'inh',
    type: 'number',
    rootValue: 0,
    parentEquations: {
      CompilationUnit: eq_shadowDepth_scopeCreator,
      FunctionDeclaration: eq_shadowDepth_scopeCreator,
      ArrowFunction: eq_shadowDepth_scopeCreator,
      FunctionExpression: eq_shadowDepth_scopeCreator,
      MethodDeclaration: eq_shadowDepth_scopeCreator,
      Constructor: eq_shadowDepth_scopeCreator,
      Block: eq_shadowDepth_scopeCreator,
      CatchClause: eq_shadowDepth_scopeCreator,
      ForStatement: eq_shadowDepth_scopeCreator,
      ForInStatement: eq_shadowDepth_scopeCreator,
      ForOfStatement: eq_shadowDepth_scopeCreator,
    },
  },
  {
    name: 'shadowEnv',
    direction: 'inh',
    type: 'Map<string, number>',
    rootValue: code('new Map()'),
    parentEquations: {
      CompilationUnit: eq_shadowEnv_blockLike,
      Block: eq_shadowEnv_blockLike,
      FunctionDeclaration: eq_shadowEnv_functionLike,
      ArrowFunction: eq_shadowEnv_functionLike,
      FunctionExpression: eq_shadowEnv_functionLike,
      MethodDeclaration: eq_shadowEnv_functionLike,
      Constructor: eq_shadowEnv_functionLike,
      CatchClause: eq_shadowEnv_catchClause,
      ForStatement: eq_shadowEnv_forLike,
      ForInStatement: eq_shadowEnv_forLike,
      ForOfStatement: eq_shadowEnv_forLike,
    },
  },
  {
    name: 'noShadowViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      VariableDeclaration: eq_noShadowViolation_VariableDeclaration,
      Parameter: eq_noShadowViolation_Parameter,
      FunctionDeclaration: eq_noShadowViolation_FunctionDeclaration,
      ClassDeclaration: eq_noShadowViolation_ClassDeclaration,
    },
  },

  // ── Control flow — alwaysTerminates + no-unreachable + no-fallthrough ──
  {
    name: 'alwaysTerminates',
    direction: 'syn',
    type: 'boolean',
    default: false,
    equations: {
      ReturnStatement: eq_alwaysTerminates_ReturnStatement,
      ThrowStatement: eq_alwaysTerminates_ThrowStatement,
      BreakStatement: eq_alwaysTerminates_BreakStatement,
      ContinueStatement: eq_alwaysTerminates_ContinueStatement,
      Block: eq_alwaysTerminates_Block,
      IfStatement: eq_alwaysTerminates_IfStatement,
    },
  },
  {
    name: 'noUnreachableViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic[]',
    default: code('[]'),
    equations: {
      Block: eq_noUnreachableViolation_Block,
    },
  },
  {
    name: 'noFallthroughViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic[]',
    default: code('[]'),
    equations: {
      CaseBlock: eq_noFallthroughViolation_CaseBlock,
    },
  },

  // ── Complexity — syn per function ──
  {
    name: 'complexityThreshold',
    direction: 'inh',
    type: 'number',
    rootValue: 2,
    parentEquations: {},
  },
  {
    name: 'complexityViolation',
    direction: 'syn',
    type: 'EslintEquivDiagnostic | null',
    default: null,
    equations: {
      FunctionDeclaration: eq_complexityViolation_FunctionDeclaration,
      ArrowFunction: eq_complexityViolation_ArrowFunction,
      FunctionExpression: eq_complexityViolation_FunctionExpression,
      MethodDeclaration: eq_complexityViolation_MethodDeclaration,
    },
  },

  // ── Gather — recursive collect ──
  {
    name: 'allEslintViolations',
    direction: 'syn',
    type: 'EslintEquivDiagnostic[]',
    default: eq_allEslintViolations,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Analysis Declaration (codegen-time)
// ═══════════════════════════════════════════════════════════════════════

export const analysisDecl: AnalysisDecl<TSKind> = {
  attrs: allAttrs,
  typeImports: ({ specImportPath }) => {
    const typesPath = specImportPath.replace(/\/spec\.js$/, '/types.js');
    return [
      `import type { EslintEquivDiagnostic } from '${typesPath}';`,
    ];
  },
};
