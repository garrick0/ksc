/**
 * TypeScript AST translator helpers — language-specific functions for convert.ts.
 *
 * All functions that depend on the TypeScript checker/depth state take a
 * ConvertContext as their first parameter, keeping them pure and independently
 * testable. Pure helpers and constants are exported directly.
 *
 * All functions that depend on the TypeScript compiler API live here, keeping
 * the grammar machinery fully generic.
 */

import ts from 'typescript';
import type { AnalysisDepth } from '../../../../api.js';

export type { AnalysisDepth };

// ── Context ──────────────────────────────────────────────────────────

/**
 * Depth-narrowed context types. The checker availability is linked to depth:
 *   - parse: no checker (syntax only)
 *   - bind: checker available (symbol resolution, no type queries)
 *   - check: checker available (full type resolution)
 *
 * Discriminated union on `depth` — narrowing on depth automatically narrows checker.
 */
export interface ParseContext {
  readonly checker: undefined;
  readonly depth: 'parse';
}

export interface BindContext {
  readonly checker: ts.TypeChecker;
  readonly depth: 'bind';
}

export interface CheckContext {
  readonly checker: ts.TypeChecker;
  readonly depth: 'check';
}

/** Immutable context created once per buildKSTree call. */
export type ConvertContext = ParseContext | BindContext | CheckContext;

/** Context with a checker available (bind or check depth). */
export type CheckerContext = BindContext | CheckContext;

// ── Symbol helpers (stateful — need checker) ─────────────────────────

export function hasSymFlag(ctx: ConvertContext, node: ts.Node, flag: ts.SymbolFlags): boolean {
  if (ctx.depth === 'parse') return false;
  const sym = ctx.checker.getSymbolAtLocation(node);
  return sym ? !!(sym.flags & flag) : false;
}

export function getResolvedFileName(ctx: ConvertContext, node: ts.Node): string {
  if (ctx.depth === 'parse' || !ts.isIdentifier(node)) return '';
  const sym = ctx.checker.getSymbolAtLocation(node);
  if (!sym || !(sym.flags & ts.SymbolFlags.Alias)) return '';
  try {
    const resolved = ctx.checker.getAliasedSymbol(sym);
    const decl = resolved.declarations?.[0];
    return decl ? decl.getSourceFile().fileName : '';
  } catch { return ''; }
}

export function getLocalCount(ctx: ConvertContext, node: ts.Node): number {
  if (ctx.depth === 'parse') return 0;
  return (node as any).locals?.size ?? 0;
}

// ── Checker-level helpers (stateful — need checker + depth) ──────────

export function getTypeString(ctx: ConvertContext, node: ts.Node): string {
  if (ctx.depth !== 'check') return '';
  try {
    const type = ctx.checker.getTypeAtLocation(node);
    return ctx.checker.typeToString(type);
  } catch { return ''; }
}

export function getResolvedModulePath(ctx: ConvertContext, node: ts.ImportDeclaration): string {
  if (ctx.depth !== 'check') return '';
  const spec = node.moduleSpecifier;
  if (!ts.isStringLiteral(spec)) return '';
  const sym = ctx.checker.getSymbolAtLocation(spec);
  if (!sym) return '';
  const decls = sym.declarations;
  if (!decls || decls.length === 0) return '';
  return decls[0].getSourceFile().fileName;
}

export function getImportModuleSpecifier(ctx: ConvertContext, node: ts.Node): string {
  if (ctx.depth === 'parse' || !ts.isIdentifier(node)) return '';
  const sym = ctx.checker.getSymbolAtLocation(node);
  if (!sym || !(sym.flags & ts.SymbolFlags.Alias)) return '';
  const decls = sym.declarations;
  if (!decls || decls.length === 0) return '';
  const decl = decls[0];
  // Walk up to the ImportDeclaration
  let current: ts.Node = decl;
  while (current && !ts.isImportDeclaration(current)) {
    current = current.parent;
  }
  if (!current || !ts.isImportDeclaration(current)) return '';
  const spec = current.moduleSpecifier;
  return ts.isStringLiteral(spec) ? spec.text : '';
}

// ── Import resolution (stateful — needs checker) ─────────────────────

export function isImportReference(ctx: ConvertContext, node: ts.Node): boolean {
  if (ctx.depth === 'parse' || !ts.isIdentifier(node)) return false;
  const sym = ctx.checker.getSymbolAtLocation(node);
  if (!sym) return false;
  if (!(sym.flags & ts.SymbolFlags.Alias)) return false;
  // Verify it's a value-position reference (not type-only, not a definition site)
  const parent = node.parent;
  if (!parent) return false;
  // Skip declaration sites (import specifiers, import clause names, etc.)
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false;
  // Skip type-only positions
  if (ts.isTypeReferenceNode(parent) && parent.typeName === node) return false;
  if (ts.isTypeQueryNode(parent)) return false;
  // Skip definition sites
  if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
  if (ts.isParameter(parent) && parent.name === node) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return false;
  if (ts.isFunctionExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isBindingElement(parent) && parent.name === node) return false;
  if (ts.isPropertySignature(parent) && parent.name === node) return false;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return false;
  return true;
}

// ── Pure helpers (no state) ──────────────────────────────────────────

export function checkIsDefinitionSite(node: ts.Node): boolean {
  if (!ts.isIdentifier(node)) return false;
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isClassDeclaration(parent) && parent.name === node) return true;
  if (ts.isInterfaceDeclaration(parent) && parent.name === node) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;
  if (ts.isEnumDeclaration(parent) && parent.name === node) return true;
  if (ts.isEnumMember(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodSignature(parent) && parent.name === node) return true;
  if (ts.isGetAccessorDeclaration(parent) && parent.name === node) return true;
  if (ts.isSetAccessorDeclaration(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) && (parent.name === node || parent.propertyName === node)) return true;
  if (ts.isImportClause(parent)) return true;
  if (ts.isNamespaceImport(parent)) return true;
  if (ts.isExportSpecifier(parent)) return true;
  if (ts.isBindingElement(parent) && parent.name === node) return true;
  if (ts.isFunctionExpression(parent) && parent.name === node) return true;
  return false;
}

export function isNodeExported(node: ts.Node): boolean {
  const mods = (node as any).modifiers;
  if (mods) {
    for (let i = 0; i < mods.length; i++) {
      if (mods[i].kind === ts.SyntaxKind.ExportKeyword) return true;
    }
  }
  if (node.parent && ts.isExportAssignment(node.parent)) return true;
  return false;
}

// ── JSDoc comment extraction ─────────────────────────────────────────

export function extractJSDocComment(n: any): string {
  if (!n.comment) return '';
  if (typeof n.comment === 'string') return n.comment;
  return '';
}

// ── Operator maps ────────────────────────────────────────────────────

export const prefixUnaryOperatorMap: Record<number, string> = {
  [ts.SyntaxKind.PlusToken]: '+',
  [ts.SyntaxKind.MinusToken]: '-',
  [ts.SyntaxKind.TildeToken]: '~',
  [ts.SyntaxKind.ExclamationToken]: '!',
  [ts.SyntaxKind.PlusPlusToken]: '++',
  [ts.SyntaxKind.MinusMinusToken]: '--',
};

export const postfixUnaryOperatorMap: Record<number, string> = {
  [ts.SyntaxKind.PlusPlusToken]: '++',
  [ts.SyntaxKind.MinusMinusToken]: '--',
};

export const typeOperatorMap: Record<number, string> = {
  [ts.SyntaxKind.KeyOfKeyword]: 'keyof',
  [ts.SyntaxKind.UniqueKeyword]: 'unique',
  [ts.SyntaxKind.ReadonlyKeyword]: 'readonly',
};

export const heritageTokenMap: Record<number, string> = {
  [ts.SyntaxKind.ExtendsKeyword]: 'extends',
  [ts.SyntaxKind.ImplementsKeyword]: 'implements',
};

export const metaPropertyKeywordMap: Record<number, string> = {
  [ts.SyntaxKind.NewKeyword]: 'new',
  [ts.SyntaxKind.ImportKeyword]: 'import',
};

// ── Declaration kind helper ──────────────────────────────────────────

export function getDeclarationKind(flags: number): 'var' | 'let' | 'const' | 'using' | 'await using' {
  if (flags & ts.NodeFlags.Const) return 'const';
  if (flags & ts.NodeFlags.Let) return 'let';
  if (flags & ts.NodeFlags.AwaitUsing) return 'await using';
  if (flags & ts.NodeFlags.Using) return 'using';
  return 'var';
}
