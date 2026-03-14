/**
 * Codegen domain barrel — port contracts and codegen types.
 */

// ── Port interfaces ──

export type {
  AnalysisDecl,
  AttrDecl,
  SynAttr,
  InhAttr,
  CollectionAttr,
  ParamDef,
  ImportPaths,
  CodeLiteral,
  AttrExpr,
  AttrDirection,
  EquationFn,
  EquationMap,
  TypedEquationMap,
} from './ports.js';

export { code, isCodeLiteral } from './ports.js';

// ── Codegen types ──

export type {
  CodegenTarget,
  GeneratedImports,
  CompiledAnalyzer,
  CompiledAttrDef,
  GeneratedFile,
} from './types.js';
