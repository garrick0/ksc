/**
 * Barrel re-export for kind-checking equations.
 *
 * Re-exports everything from the three sub-modules so that existing
 * imports from `equations/index.js` continue to work unchanged.
 */

export { ASSIGNMENT_OPS, IO_MODULES, SIDE_EFFECT_EXPR_KINDS, getKindCtx, diag } from './predicates.js';
export { resetCounter, extractPropertiesFromTypeLiteral, tryExtractKindDef, getCounter } from './definitions.js';
export {
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
} from './attributes.js';
export {
  PROTOBUF_CHECKING_ENABLED,
  setProtobufCheckingEnabled,
  isProtobufModule,
  eq_protobufTypes_CompilationUnit,
  eq_protobufTypes_default,
  eq_protobufTypeEnv_root,
  eq_protobufViolation_PropertyAccessExpression,
  eq_protobufViolation_ElementAccessExpression,
  eq_protobufViolation_default,
  eq_allProtobufViolations,
} from './protobuf.js';
export type { ProtobufBinding } from './protobuf.js';
