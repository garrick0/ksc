/**
 * Equation barrel — re-exports all equation functions for the eslint-equiv analysis.
 */

// Group A — trivial syn
export {
  eq_eqeqeqViolation_BinaryExpression,
  eq_noVarViolation_VariableDeclarationList,
  eq_noDebuggerViolation_DebuggerStatement,
  eq_noEmptyViolation_Block,
  eq_noBitwiseViolation_BinaryExpression,
  eq_noBitwiseViolation_PrefixUnaryExpression,
  eq_noExplicitAnyViolation_AnyKeyword,
} from './trivial-syn.js';

// Group B — child inspection
export {
  eq_noDupeKeysViolation_ObjectLiteralExpression,
  eq_noSelfCompareViolation_BinaryExpression,
  eq_maxParamsViolation_FunctionDeclaration,
  eq_maxParamsViolation_ArrowFunction,
  eq_maxParamsViolation_MethodDeclaration,
  eq_maxParamsViolation_FunctionExpression,
  eq_noEmptyInterfaceViolation_InterfaceDeclaration,
  eq_noDuplicateImportsViolation_CompilationUnit,
} from './child-inspection.js';

// Group C — inherited + syn (depth)
export {
  eq_nestDepth_IfStatement,
  eq_nestDepth_controlFlow,
  eq_maxDepthViolation_controlFlow,
} from './depth.js';

// Group E — TS-specific syn
export {
  eq_arrayTypeViolation_TypeReference,
  eq_typeDeclStyleViolation_TypeAliasDeclaration,
} from './ts-style.js';

// Phase 6 — more syn rules
export {
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
} from './more-syn.js';

// Phase 7 — more TS-specific syn rules
export {
  eq_noNonNullAssertionViolation_NonNullExpression,
  eq_noNamespaceViolation_ModuleDeclaration,
  eq_noRequireImportsViolation_CallExpression,
  eq_noEmptyObjectTypeViolation_TypeLiteral,
  eq_typeAssertionStyleViolation_TypeAssertionExpression,
  eq_noDuplicateEnumValuesViolation_EnumDeclaration,
  eq_preferAsConstViolation_AsExpression,
  eq_preferAsConstViolation_TypeAssertionExpression,
} from './more-ts-style.js';

// Phase 8 — class structure rules
export {
  eq_noDupeClassMembersViolation_ClassDeclaration,
  eq_noDupeClassMembersViolation_ClassExpression,
  eq_noUselessConstructorViolation_Constructor,
  eq_noEmptyStaticBlockViolation_ClassStaticBlockDeclaration,
} from './class-rules.js';

// Scope — inherited + syn (no-shadow)
export {
  eq_shadowDepth_scopeCreator,
  eq_shadowEnv_blockLike,
  eq_shadowEnv_functionLike,
  eq_shadowEnv_catchClause,
  eq_shadowEnv_forLike,
  eq_noShadowViolation_VariableDeclaration,
  eq_noShadowViolation_Parameter,
  eq_noShadowViolation_FunctionDeclaration,
  eq_noShadowViolation_ClassDeclaration,
} from './scope.js';

// Control flow — syn (no-unreachable, no-fallthrough)
export {
  eq_alwaysTerminates_ReturnStatement,
  eq_alwaysTerminates_ThrowStatement,
  eq_alwaysTerminates_BreakStatement,
  eq_alwaysTerminates_ContinueStatement,
  eq_alwaysTerminates_Block,
  eq_alwaysTerminates_IfStatement,
  eq_noUnreachableViolation_Block,
  eq_noFallthroughViolation_CaseBlock,
} from './control-flow.js';

// Complexity — syn per function
export {
  eq_complexityViolation_FunctionDeclaration,
  eq_complexityViolation_ArrowFunction,
  eq_complexityViolation_FunctionExpression,
  eq_complexityViolation_MethodDeclaration,
} from './complexity.js';

// Gather
export {
  eq_allEslintViolations,
  eq_violations_Program,
  eq_violations_default,
} from './gather.js';
