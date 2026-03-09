/**
 * Field extraction overrides — TypeScript-specific data.
 *
 * Maps [nodeKind][fieldName] → expression string for convert.ts generation.
 * Only needed where TS stores data in a fundamentally different format
 * than our AST schema (numeric enums, computed flags, symbol info, etc.).
 *
 * Uses type-safe DSL builders to construct expressions, with compile-time
 * validation that all referenced helper names exist in convert-helpers.ts.
 */

import type * as Helpers from './convert-helpers.js';
import type { FieldExtractorConfig } from '../../../grammar/field-extractors.js';
import { statefulCallBuilders, pureCallBuilders, mapLookupBuilders } from '../../../grammar/extractor-dsl.js';

// ── Type-safe helper name declarations ──────────────────────────────
// `satisfies` validates every name is an actual export of convert-helpers.ts.

const STATEFUL_FN_NAMES = [
  'hasSymFlag', 'isImportReference', 'getResolvedFileName',
  'getLocalCount', 'getTypeString', 'getResolvedModulePath', 'getImportModuleSpecifier',
] as const satisfies readonly (keyof typeof Helpers)[];

const PURE_FN_NAMES = [
  'checkIsDefinitionSite', 'isNodeExported', 'extractJSDocComment', 'getDeclarationKind',
] as const satisfies readonly (keyof typeof Helpers)[];

const MAP_NAMES = [
  'prefixUnaryOperatorMap', 'postfixUnaryOperatorMap',
  'typeOperatorMap', 'heritageTokenMap', 'metaPropertyKeywordMap',
] as const satisfies readonly (keyof typeof Helpers)[];

// ── Expression builders ─────────────────────────────────────────────

const sfn = statefulCallBuilders(STATEFUL_FN_NAMES);
const pfn = pureCallBuilders(PURE_FN_NAMES);
const m = mapLookupBuilders(MAP_NAMES);

// ── Static extractor mappings ───────────────────────────────────────

/** Base field extractors: operator/token maps, identifier symbol flags, etc. */
export const BASE_EXTRACTORS: Record<string, Record<string, string>> = {
  // Operator/token maps (TS stores as numeric SyntaxKind, we decode to string)
  PrefixUnaryExpression: { operator: m.prefixUnaryOperatorMap('n.operator') },
  PostfixUnaryExpression: { operator: m.postfixUnaryOperatorMap('n.operator') },
  TypeOperator: { operator: m.typeOperatorMap('n.operator') },
  HeritageClause: { token: m.heritageTokenMap('n.token') },
  MetaProperty: { keywordToken: m.metaPropertyKeywordMap('n.keywordToken') },

  // Computed from NodeFlags (no direct TS property)
  VariableDeclarationList: { declarationKind: pfn.getDeclarationKind('n.flags') },

  // Identifier: import resolution + all symbol flags
  Identifier: {
    resolvesToImport: sfn.isImportReference('node'),
    isDefinitionSite: pfn.checkIsDefinitionSite('node'),
    resolvedFileName: sfn.getResolvedFileName('node'),
    symIsVariable: sfn.hasSymFlag('node', 'ts.SymbolFlags.Variable'),
    symIsFunctionScopedVariable: sfn.hasSymFlag('node', 'ts.SymbolFlags.FunctionScopedVariable'),
    symIsBlockScopedVariable: sfn.hasSymFlag('node', 'ts.SymbolFlags.BlockScopedVariable'),
    symIsFunction: sfn.hasSymFlag('node', 'ts.SymbolFlags.Function'),
    symIsClass: sfn.hasSymFlag('node', 'ts.SymbolFlags.Class'),
    symIsInterface: sfn.hasSymFlag('node', 'ts.SymbolFlags.Interface'),
    symIsTypeAlias: sfn.hasSymFlag('node', 'ts.SymbolFlags.TypeAlias'),
    symIsAlias: sfn.hasSymFlag('node', 'ts.SymbolFlags.Alias'),
    symIsProperty: sfn.hasSymFlag('node', 'ts.SymbolFlags.Property'),
    symIsMethod: sfn.hasSymFlag('node', 'ts.SymbolFlags.Method'),
    symIsEnum: sfn.hasSymFlag('node', 'ts.SymbolFlags.Enum'),
    symIsEnumMember: sfn.hasSymFlag('node', 'ts.SymbolFlags.EnumMember'),
    symIsNamespace: sfn.hasSymFlag('node', 'ts.SymbolFlags.NamespaceModule'),
    symIsExportValue: sfn.hasSymFlag('node', 'ts.SymbolFlags.ExportValue'),
    symIsType: sfn.hasSymFlag('node', 'ts.SymbolFlags.Type'),
    symIsValue: sfn.hasSymFlag('node', 'ts.SymbolFlags.Value'),
    importModuleSpecifier: sfn.getImportModuleSpecifier('node'),
  },

  // ImportDeclaration: resolved module path
  ImportDeclaration: { resolvedModulePath: sfn.getResolvedModulePath('node as any') },
};

// ── Kind lists ──────────────────────────────────────────────────────

/** Declaration node kinds that get an isExported extractor. */
export const EXPORTED_DECLARATION_KINDS = [
  'VariableStatement', 'VariableDeclaration', 'FunctionDeclaration',
  'ClassDeclaration', 'InterfaceDeclaration', 'TypeAliasDeclaration',
  'EnumDeclaration', 'ModuleDeclaration', 'MethodDeclaration', 'PropertyDeclaration',
] as const;

/** Scope container node kinds that get a localCount extractor. */
export const SCOPE_CONTAINER_KINDS = [
  'Block', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunction',
  'ModuleBlock', 'CaseClause', 'DefaultClause',
  'ForStatement', 'ForInStatement', 'ForOfStatement', 'Constructor',
] as const;

// ── Metadata ────────────────────────────────────────────────────────

/** Kinds to skip in convert.ts (KSC-only nodes, not from TS AST). */
export const SKIP_CONVERT = new Set(['Program', 'CompilationUnit']);

/** SyntaxKind numeric overrides for kinds where TS doesn't expose a named enum value. */
export const SYNTAX_KIND_OVERRIDES: Record<string, number> = {
  JSDocCommentTextToken: 82,
};

// ── Full extractor config ───────────────────────────────────────────

/** Assembled config for spec.ts — all extraction rules in one place. */
export const EXTRACTOR_CONFIG: FieldExtractorConfig = {
  base: BASE_EXTRACTORS,
  kindRules: [
    { kinds: EXPORTED_DECLARATION_KINDS, fieldName: 'isExported', expression: pfn.isNodeExported('node') },
    { kinds: SCOPE_CONTAINER_KINDS, fieldName: 'localCount', expression: sfn.getLocalCount('node') },
  ],
  autoDetectFields: [
    { fieldName: 'typeString', expression: sfn.getTypeString('node') },
  ],
};
