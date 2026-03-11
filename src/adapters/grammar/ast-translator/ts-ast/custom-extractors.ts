/**
 * Per-kind custom field extractors for the TS → KS AST converter.
 *
 * Maps [nodeKind][fieldName] → extractor function.
 * Fields not listed here are handled generically from the schema.
 */

import ts from 'typescript';
import type { KSNode } from '../../grammar/ts-ast/index.js';
import {
  hasSymFlag, checkIsDefinitionSite, isImportReference,
  getResolvedFileName, getResolvedModulePath, getImportModuleSpecifier,
  getDeclarationKind,
  prefixUnaryOperatorMap, postfixUnaryOperatorMap,
  typeOperatorMap, heritageTokenMap, metaPropertyKeywordMap,
  type ConvertContext,
} from './helpers.js';

export type FieldExtractorFn = (ctx: ConvertContext, n: Record<string, unknown>, node: ts.Node, children: KSNode[]) => unknown;

export const CUSTOM_EXTRACTORS: Record<string, Record<string, FieldExtractorFn>> = {
  Identifier: {
    resolvesToImport: (ctx, _n, node) => isImportReference(ctx, node),
    isDefinitionSite: (_ctx, _n, node) => checkIsDefinitionSite(node),
    resolvedFileName: (ctx, _n, node) => getResolvedFileName(ctx, node),
    symIsVariable: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Variable),
    symIsFunctionScopedVariable: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.FunctionScopedVariable),
    symIsBlockScopedVariable: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.BlockScopedVariable),
    symIsFunction: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Function),
    symIsClass: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Class),
    symIsInterface: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Interface),
    symIsTypeAlias: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.TypeAlias),
    symIsAlias: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Alias),
    symIsProperty: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Property),
    symIsMethod: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Method),
    symIsEnum: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Enum),
    symIsEnumMember: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.EnumMember),
    symIsNamespace: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.NamespaceModule),
    symIsExportValue: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.ExportValue),
    symIsType: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Type),
    symIsValue: (ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Value),
    importModuleSpecifier: (ctx, _n, node) => getImportModuleSpecifier(ctx, node),
  },
  ImportDeclaration: {
    resolvedModulePath: (ctx, _n, node) => getResolvedModulePath(ctx, node as unknown as ts.ImportDeclaration),
  },
  PrefixUnaryExpression: { operator: (_ctx, n) => prefixUnaryOperatorMap[n.operator as number] },
  PostfixUnaryExpression: { operator: (_ctx, n) => postfixUnaryOperatorMap[n.operator as number] },
  TypeOperator: { operator: (_ctx, n) => typeOperatorMap[n.operator as number] },
  HeritageClause: { token: (_ctx, n) => heritageTokenMap[n.token as number] },
  MetaProperty: { keywordToken: (_ctx, n) => metaPropertyKeywordMap[n.keywordToken as number] },
  VariableDeclarationList: { declarationKind: (_ctx, n) => getDeclarationKind(n.flags as number) },
};
