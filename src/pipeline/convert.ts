/**
 * TS → KSC AST conversion layer.
 *
 * Walks the entire TypeScript AST and produces a KSC mirror.
 * This is one of only two modules (with program.ts) that imports typescript.
 *
 * Architecture:
 * - convertNode() is the central dispatch
 * - specificConverters registry maps SyntaxKind → typed converter
 * - ALL SyntaxKinds have specific converters — no generic fallback
 * - Children are always collected via ts.forEachChild first
 * - A WeakMap<ts.Node, KSNode> maps TS nodes to KS nodes for identity matching
 */

import ts from 'typescript';
import type {
  KSNode,
  KSNodeBase,
  KSProgram,
  KSCompilationUnit,
  KSTypeAliasDeclaration,
  KSInterfaceDeclaration,
  KSFunctionDeclaration,
  KSClassDeclaration,
  KSEnumDeclaration,
  KSVariableStatement,
  KSVariableDeclarationList,
  KSVariableDeclaration,
  KSImportDeclaration,
  KSImportClause,
  KSNamedImports,
  KSImportSpecifier,
  KSNamespaceImport,
  KSExportDeclaration,
  KSExportAssignment,
  KSBlock,
  KSExpressionStatement,
  KSReturnStatement,
  KSIfStatement,
  KSForStatement,
  KSForOfStatement,
  KSForInStatement,
  KSWhileStatement,
  KSDoStatement,
  KSSwitchStatement,
  KSThrowStatement,
  KSTryStatement,
  KSCallExpression,
  KSPropertyAccessExpression,
  KSElementAccessExpression,
  KSBinaryExpression,
  KSPrefixUnaryExpression,
  KSPostfixUnaryExpression,
  KSArrowFunction,
  KSFunctionExpression,
  KSObjectLiteralExpression,
  KSArrayLiteralExpression,
  KSTemplateExpression,
  KSConditionalExpression,
  KSNewExpression,
  KSAwaitExpression,
  KSSpreadElement,
  KSAsExpression,
  KSParenthesizedExpression,
  KSTypeReferenceNode,
  KSTypeLiteralNode,
  KSUnionType,
  KSIntersectionType,
  KSFunctionType,
  KSArrayType,
  KSTupleType,
  KSLiteralType,
  KSConditionalType,
  KSMappedType,
  KSIndexedAccessType,
  KSTypeQuery,
  KSIdentifier,
  KSStringLiteral,
  KSNumericLiteral,
  KSNoSubstitutionTemplateLiteral,
  KSPropertySignature,
  KSPropertyDeclaration,
  KSMethodDeclaration,
  KSConstructorDeclaration,
  KSGetAccessorDeclaration,
  KSSetAccessorDeclaration,
  KSParameterNode,
  KSTypeParameterNode,
  KSPropertyAssignment,
  KSShorthandPropertyAssignment,
  KSComputedPropertyName,
  KSHeritageClause,
  KSCatchClause,
  KSCaseBlock,
  KSCaseClause,
  KSDefaultClause,
  KSEnumMember,
  KSUnknown,
  KSEndOfFileToken,
  KSSingleLineCommentTrivia,
  KSMultiLineCommentTrivia,
  KSNewLineTrivia,
  KSWhitespaceTrivia,
  KSShebangTrivia,
  KSConflictMarkerTrivia,
  KSNonTextFileMarkerTrivia,
  KSJsxTextAllWhiteSpaces,
  KSOpenBraceToken,
  KSCloseBraceToken,
  KSOpenParenToken,
  KSCloseParenToken,
  KSOpenBracketToken,
  KSCloseBracketToken,
  KSDotToken,
  KSDotDotDotToken,
  KSSemicolonToken,
  KSCommaToken,
  KSQuestionDotToken,
  KSLessThanToken,
  KSLessThanSlashToken,
  KSGreaterThanToken,
  KSLessThanEqualsToken,
  KSGreaterThanEqualsToken,
  KSEqualsEqualsToken,
  KSExclamationEqualsToken,
  KSEqualsEqualsEqualsToken,
  KSExclamationEqualsEqualsToken,
  KSEqualsGreaterThanToken,
  KSPlusToken,
  KSMinusToken,
  KSAsteriskToken,
  KSAsteriskAsteriskToken,
  KSSlashToken,
  KSPercentToken,
  KSPlusPlusToken,
  KSMinusMinusToken,
  KSLessThanLessThanToken,
  KSGreaterThanGreaterThanToken,
  KSGreaterThanGreaterThanGreaterThanToken,
  KSAmpersandToken,
  KSBarToken,
  KSCaretToken,
  KSExclamationToken,
  KSTildeToken,
  KSAmpersandAmpersandToken,
  KSBarBarToken,
  KSQuestionToken,
  KSColonToken,
  KSAtToken,
  KSQuestionQuestionToken,
  KSBacktickToken,
  KSHashToken,
  KSEqualsToken,
  KSPlusEqualsToken,
  KSMinusEqualsToken,
  KSAsteriskEqualsToken,
  KSAsteriskAsteriskEqualsToken,
  KSSlashEqualsToken,
  KSPercentEqualsToken,
  KSLessThanLessThanEqualsToken,
  KSGreaterThanGreaterThanEqualsToken,
  KSGreaterThanGreaterThanGreaterThanEqualsToken,
  KSAmpersandEqualsToken,
  KSBarEqualsToken,
  KSBarBarEqualsToken,
  KSAmpersandAmpersandEqualsToken,
  KSQuestionQuestionEqualsToken,
  KSCaretEqualsToken,
  KSJSDocCommentTextToken,
  KSBreakKeyword,
  KSCaseKeyword,
  KSCatchKeyword,
  KSClassKeyword,
  KSConstKeyword,
  KSContinueKeyword,
  KSDebuggerKeyword,
  KSDefaultKeyword,
  KSDeleteKeyword,
  KSDoKeyword,
  KSElseKeyword,
  KSEnumKeyword,
  KSExportKeyword,
  KSExtendsKeyword,
  KSFalseKeyword,
  KSFinallyKeyword,
  KSForKeyword,
  KSFunctionKeyword,
  KSIfKeyword,
  KSImportKeyword,
  KSInKeyword,
  KSInstanceOfKeyword,
  KSNewKeyword,
  KSNullKeyword,
  KSReturnKeyword,
  KSSuperKeyword,
  KSSwitchKeyword,
  KSThisKeyword,
  KSThrowKeyword,
  KSTrueKeyword,
  KSTryKeyword,
  KSTypeOfKeyword,
  KSVarKeyword,
  KSVoidKeyword,
  KSWhileKeyword,
  KSWithKeyword,
  KSImplementsKeyword,
  KSInterfaceKeyword,
  KSLetKeyword,
  KSPackageKeyword,
  KSPrivateKeyword,
  KSProtectedKeyword,
  KSPublicKeyword,
  KSStaticKeyword,
  KSYieldKeyword,
  KSAbstractKeyword,
  KSAccessorKeyword,
  KSAsKeyword,
  KSAssertsKeyword,
  KSAssertKeyword,
  KSAnyKeyword,
  KSAsyncKeyword,
  KSAwaitKeyword,
  KSBooleanKeyword,
  KSConstructorKeyword,
  KSDeclareKeyword,
  KSGetKeyword,
  KSInferKeyword,
  KSIntrinsicKeyword,
  KSIsKeyword,
  KSKeyOfKeyword,
  KSModuleKeyword,
  KSNamespaceKeyword,
  KSNeverKeyword,
  KSOutKeyword,
  KSReadonlyKeyword,
  KSRequireKeyword,
  KSNumberKeyword,
  KSObjectKeyword,
  KSSatisfiesKeyword,
  KSSetKeyword,
  KSStringKeyword,
  KSSymbolKeyword,
  KSTypeKeyword,
  KSUndefinedKeyword,
  KSUniqueKeyword,
  KSUnknownKeyword,
  KSUsingKeyword,
  KSFromKeyword,
  KSGlobalKeyword,
  KSBigIntKeyword,
  KSOverrideKeyword,
  KSOfKeyword,
  KSDeferKeyword,
  KSJSDocAllType,
  KSJSDocUnknownType,
  KSJSDocNamepathType,
  KSJSDoc,
  KSJSDocText,
  KSJSDocSignature,
  KSJSDocLink,
  KSJSDocLinkCode,
  KSJSDocLinkPlain,
  KSJSDocTag,
  KSJSDocAugmentsTag,
  KSJSDocImplementsTag,
  KSJSDocAuthorTag,
  KSJSDocDeprecatedTag,
  KSJSDocClassTag,
  KSJSDocPublicTag,
  KSJSDocPrivateTag,
  KSJSDocProtectedTag,
  KSJSDocReadonlyTag,
  KSJSDocOverrideTag,
  KSJSDocCallbackTag,
  KSJSDocOverloadTag,
  KSJSDocEnumTag,
  KSJSDocParameterTag,
  KSJSDocReturnTag,
  KSJSDocThisTag,
  KSJSDocTypeTag,
  KSJSDocTemplateTag,
  KSJSDocTypedefTag,
  KSJSDocSeeTag,
  KSJSDocPropertyTag,
  KSJSDocThrowsTag,
  KSJSDocSatisfiesTag,
  KSJSDocImportTag,
  KSSyntaxList,
  KSNotEmittedStatement,
  KSNotEmittedTypeElement,
  KSSyntheticExpression,
  KSSyntheticReferenceExpression,
  KSBundle,
  KSImportTypeAssertionContainer,
  KSBigIntLiteral,
  KSRegularExpressionLiteral,
  KSTemplateHead,
  KSTemplateMiddle,
  KSTemplateTail,
  KSJsxText,
  KSPrivateIdentifier,
  KSQualifiedName,
  KSDecorator,
  KSMethodSignature,
  KSClassStaticBlockDeclaration,
  KSCallSignature,
  KSConstructSignature,
  KSIndexSignature,
  KSTypePredicate,
  KSConstructorType,
  KSOptionalType,
  KSRestType,
  KSInferType,
  KSParenthesizedType,
  KSThisType,
  KSTypeOperator,
  KSNamedTupleMember,
  KSTemplateLiteralType,
  KSTemplateLiteralTypeSpan,
  KSImportType,
  KSObjectBindingPattern,
  KSArrayBindingPattern,
  KSBindingElement,
  KSTaggedTemplateExpression,
  KSTypeAssertionExpression,
  KSDeleteExpression,
  KSTypeOfExpression,
  KSVoidExpression,
  KSYieldExpression,
  KSClassExpression,
  KSOmittedExpression,
  KSExpressionWithTypeArguments,
  KSNonNullExpression,
  KSMetaProperty,
  KSSatisfiesExpression,
  KSTemplateSpan,
  KSSemicolonClassElement,
  KSEmptyStatement,
  KSContinueStatement,
  KSBreakStatement,
  KSWithStatement,
  KSLabeledStatement,
  KSDebuggerStatement,
  KSModuleDeclaration,
  KSModuleBlock,
  KSNamespaceExportDeclaration,
  KSImportEqualsDeclaration,
  KSNamedExports,
  KSNamespaceExport,
  KSExportSpecifier,
  KSExternalModuleReference,
  KSJsxElement,
  KSJsxSelfClosingElement,
  KSJsxOpeningElement,
  KSJsxClosingElement,
  KSJsxFragment,
  KSJsxOpeningFragment,
  KSJsxClosingFragment,
  KSJsxAttribute,
  KSJsxAttributes,
  KSJsxSpreadAttribute,
  KSJsxExpression,
  KSJsxNamespacedName,
  KSImportAttributes,
  KSImportAttribute,
  KSSpreadAssignment,
  KSJSDocTypeExpression,
  KSJSDocNameReference,
  KSJSDocMemberName,
  KSJSDocNullableType,
  KSJSDocNonNullableType,
  KSJSDocOptionalType,
  KSJSDocFunctionType,
  KSJSDocVariadicType,
  KSJSDocTypeLiteral,
  KSPartiallyEmittedExpression,
  KSCommaListExpression,
  KSMissingDeclaration,
} from './ast.js';
import { getChildren } from './ast.js';

// ═══════════════════════════════════════════════════════════════════════
// TS → KS identity map (replaces tsNode back-references)
// ═══════════════════════════════════════════════════════════════════════

const tsToKs = new WeakMap<ts.Node, KSNode>();

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

export interface KSTree {
  root: KSProgram;
}

/**
 * Convert a TypeScript program into a KSC AST with AG tree structure.
 */
export function buildKSTree(tsProgram: ts.Program): KSTree {
  const compilationUnits: KSCompilationUnit[] = [];

  for (const sf of tsProgram.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    compilationUnits.push(convertSourceFile(sf));
  }

  const root: KSProgram = {
    kind: 'Program',
    compilationUnits,
    pos: 0,
    end: 0,
    text: '',
    children: compilationUnits,
  };

  return { root };
}

// ═══════════════════════════════════════════════════════════════════════
// SourceFile → CompilationUnit
// ═══════════════════════════════════════════════════════════════════════

function convertSourceFile(sf: ts.SourceFile): KSCompilationUnit {
  const children: KSNode[] = [];
  ts.forEachChild(sf, (child) => {
    children.push(convertNode(child, sf));
  });

  const cu: KSCompilationUnit = {
    kind: 'CompilationUnit',
    fileName: sf.fileName,
    isDeclarationFile: sf.isDeclarationFile,
    sourceText: sf.getFullText(),
    lineStarts: sf.getLineStarts(),
    pos: sf.getStart(),
    end: sf.getEnd(),
    text: '',  // Full source text is in sourceText
    children,
  };
  tsToKs.set(sf, cu);
  return cu;
}

// ═══════════════════════════════════════════════════════════════════════
// Central dispatch
// ═══════════════════════════════════════════════════════════════════════

type SpecificConverter = (
  node: ts.Node,
  sf: ts.SourceFile,
  children: KSNode[],
  pos: number,
  end: number,
  text: string,
) => KSNode;

/**
 * Convert any ts.Node to a KSNode.
 */
function convertNode(node: ts.Node, sf: ts.SourceFile): KSNode {
  // Collect children first (ts.forEachChild order)
  const children: KSNode[] = [];
  ts.forEachChild(node, (child) => {
    children.push(convertNode(child, sf));
  });

  const pos = node.getStart(sf);
  const end = node.getEnd();
  let text: string;
  try {
    text = node.getText(sf);
  } catch {
    text = '';
  }

  // Dispatch to specific converter
  const converter = specificConverters[node.kind];
  if (converter) {
    const ksNode = converter(node, sf, children, pos, end, text);
    tsToKs.set(node, ksNode);
    return ksNode;
  }

  // No generic fallback — all SyntaxKinds have specific converters
  throw new Error(`Unhandled SyntaxKind: ${ts.SyntaxKind[node.kind] ?? node.kind}`);
}

// ═══════════════════════════════════════════════════════════════════════
// Helper: find converted child by ts.Node identity
// ═══════════════════════════════════════════════════════════════════════

function findChild(children: KSNode[], tsTarget: ts.Node | undefined): KSNode | undefined {
  if (!tsTarget) return undefined;
  return tsToKs.get(tsTarget);
}

function findChildAs<T extends KSNode>(children: KSNode[], tsTarget: ts.Node | undefined): T | undefined {
  return findChild(children, tsTarget) as T | undefined;
}

function findChildrenOf(children: KSNode[], tsTargets: ts.NodeArray<ts.Node> | undefined): KSNode[] {
  if (!tsTargets) return [];
  return tsTargets.map((t) => tsToKs.get(t)!).filter(Boolean);
}

function extractModifiers(children: KSNode[], node: { modifiers?: ts.NodeArray<ts.ModifierLike> }): KSNode[] {
  if (!node.modifiers) return [];
  return findChildrenOf(children, node.modifiers);
}

// ═══════════════════════════════════════════════════════════════════════
// Specific converters
// ═══════════════════════════════════════════════════════════════════════

const specificConverters: Partial<Record<ts.SyntaxKind, SpecificConverter>> = {};

function register(kind: ts.SyntaxKind, converter: SpecificConverter) {
  specificConverters[kind] = converter;
}

// ── Declarations ──

register(ts.SyntaxKind.TypeAliasDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypeAliasDeclaration;
  return {
    kind: 'TypeAliasDeclaration',
    name: findChildAs<KSIdentifier>(children, n.name)!,
    typeParameters: findChildrenOf(children, n.typeParameters),
    type: findChild(children, n.type)!,
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSTypeAliasDeclaration;
});

register(ts.SyntaxKind.InterfaceDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.InterfaceDeclaration;
  return {
    kind: 'InterfaceDeclaration',
    name: findChildAs<KSIdentifier>(children, n.name)!,
    typeParameters: findChildrenOf(children, n.typeParameters),
    members: findChildrenOf(children, n.members),
    heritageClauses: findChildrenOf(children, n.heritageClauses),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSInterfaceDeclaration;
});

register(ts.SyntaxKind.FunctionDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.FunctionDeclaration;
  return {
    kind: 'FunctionDeclaration',
    name: findChildAs<KSIdentifier>(children, n.name),
    typeParameters: findChildrenOf(children, n.typeParameters),
    parameters: findChildrenOf(children, n.parameters),
    type: findChild(children, n.type),
    body: findChild(children, n.body),
    modifiers: extractModifiers(children, n),
    asteriskToken: findChild(children, n.asteriskToken),
    pos, end, text, children,
  } satisfies KSFunctionDeclaration;
});

register(ts.SyntaxKind.ClassDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.ClassDeclaration;
  return {
    kind: 'ClassDeclaration',
    name: findChildAs<KSIdentifier>(children, n.name),
    typeParameters: findChildrenOf(children, n.typeParameters),
    members: findChildrenOf(children, n.members),
    heritageClauses: findChildrenOf(children, n.heritageClauses),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSClassDeclaration;
});

register(ts.SyntaxKind.EnumDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.EnumDeclaration;
  return {
    kind: 'EnumDeclaration',
    name: findChildAs<KSIdentifier>(children, n.name)!,
    members: findChildrenOf(children, n.members),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSEnumDeclaration;
});

register(ts.SyntaxKind.VariableStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.VariableStatement;
  return {
    kind: 'VariableStatement',
    declarationList: findChild(children, n.declarationList) as KSVariableDeclarationList,
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSVariableStatement;
});

register(ts.SyntaxKind.VariableDeclarationList, (node, sf, children, pos, end, text) => {
  const n = node as ts.VariableDeclarationList;
  return {
    kind: 'VariableDeclarationList',
    declarations: findChildrenOf(children, n.declarations) as KSVariableDeclaration[],
    isConst: !!(n.flags & ts.NodeFlags.Const),
    isLet: !!(n.flags & ts.NodeFlags.Let),
    pos, end, text, children,
  } satisfies KSVariableDeclarationList;
});

register(ts.SyntaxKind.VariableDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.VariableDeclaration;
  return {
    kind: 'VariableDeclaration',
    name: findChild(children, n.name)!,
    type: findChild(children, n.type),
    initializer: findChild(children, n.initializer),
    pos, end, text, children,
  } satisfies KSVariableDeclaration;
});

// ── Imports / Exports ──

register(ts.SyntaxKind.ImportDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.ImportDeclaration;
  return {
    kind: 'ImportDeclaration',
    importClause: findChild(children, n.importClause),
    moduleSpecifier: findChild(children, n.moduleSpecifier)!,
    pos, end, text, children,
  } satisfies KSImportDeclaration;
});

register(ts.SyntaxKind.ImportClause, (node, sf, children, pos, end, text) => {
  const n = node as ts.ImportClause;
  return {
    kind: 'ImportClause',
    isTypeOnly: n.isTypeOnly,
    name: findChildAs<KSIdentifier>(children, n.name),
    namedBindings: findChild(children, n.namedBindings),
    pos, end, text, children,
  } satisfies KSImportClause;
});

register(ts.SyntaxKind.NamedImports, (node, sf, children, pos, end, text) => {
  const n = node as ts.NamedImports;
  return {
    kind: 'NamedImports',
    elements: findChildrenOf(children, n.elements),
    pos, end, text, children,
  } satisfies KSNamedImports;
});

register(ts.SyntaxKind.ImportSpecifier, (node, sf, children, pos, end, text) => {
  const n = node as ts.ImportSpecifier;
  return {
    kind: 'ImportSpecifier',
    isTypeOnly: n.isTypeOnly,
    name: findChildAs<KSIdentifier>(children, n.name)!,
    propertyName: findChildAs<KSIdentifier>(children, n.propertyName),
    pos, end, text, children,
  } satisfies KSImportSpecifier;
});

register(ts.SyntaxKind.NamespaceImport, (node, sf, children, pos, end, text) => {
  const n = node as ts.NamespaceImport;
  return {
    kind: 'NamespaceImport',
    name: findChildAs<KSIdentifier>(children, n.name)!,
    pos, end, text, children,
  } satisfies KSNamespaceImport;
});

register(ts.SyntaxKind.ExportDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.ExportDeclaration;
  return {
    kind: 'ExportDeclaration',
    isTypeOnly: n.isTypeOnly,
    exportClause: findChild(children, n.exportClause),
    moduleSpecifier: findChild(children, n.moduleSpecifier),
    pos, end, text, children,
  } satisfies KSExportDeclaration;
});

register(ts.SyntaxKind.ExportAssignment, (node, sf, children, pos, end, text) => {
  const n = node as ts.ExportAssignment;
  return {
    kind: 'ExportAssignment',
    expression: findChild(children, n.expression)!,
    isExportEquals: !!n.isExportEquals,
    pos, end, text, children,
  } satisfies KSExportAssignment;
});

// ── Statements ──

register(ts.SyntaxKind.Block, (node, sf, children, pos, end, text) => {
  const n = node as ts.Block;
  return {
    kind: 'Block',
    statements: findChildrenOf(children, n.statements),
    pos, end, text, children,
  } satisfies KSBlock;
});

register(ts.SyntaxKind.ExpressionStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.ExpressionStatement;
  return {
    kind: 'ExpressionStatement',
    expression: findChild(children, n.expression)!,
    pos, end, text, children,
  } satisfies KSExpressionStatement;
});

register(ts.SyntaxKind.ReturnStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.ReturnStatement;
  return {
    kind: 'ReturnStatement',
    expression: findChild(children, n.expression),
    pos, end, text, children,
  } satisfies KSReturnStatement;
});

register(ts.SyntaxKind.IfStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.IfStatement;
  return {
    kind: 'IfStatement',
    expression: findChild(children, n.expression)!,
    thenStatement: findChild(children, n.thenStatement)!,
    elseStatement: findChild(children, n.elseStatement),
    pos, end, text, children,
  } satisfies KSIfStatement;
});

register(ts.SyntaxKind.ForStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.ForStatement;
  return {
    kind: 'ForStatement',
    initializer: findChild(children, n.initializer),
    condition: findChild(children, n.condition),
    incrementor: findChild(children, n.incrementor),
    statement: findChild(children, n.statement)!,
    pos, end, text, children,
  } satisfies KSForStatement;
});

register(ts.SyntaxKind.ForOfStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.ForOfStatement;
  return {
    kind: 'ForOfStatement',
    initializer: findChild(children, n.initializer)!,
    expression: findChild(children, n.expression)!,
    statement: findChild(children, n.statement)!,
    pos, end, text, children,
  } satisfies KSForOfStatement;
});

register(ts.SyntaxKind.ForInStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.ForInStatement;
  return {
    kind: 'ForInStatement',
    initializer: findChild(children, n.initializer)!,
    expression: findChild(children, n.expression)!,
    statement: findChild(children, n.statement)!,
    pos, end, text, children,
  } satisfies KSForInStatement;
});

register(ts.SyntaxKind.WhileStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.WhileStatement;
  return {
    kind: 'WhileStatement',
    expression: findChild(children, n.expression)!,
    statement: findChild(children, n.statement)!,
    pos, end, text, children,
  } satisfies KSWhileStatement;
});

register(ts.SyntaxKind.DoStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.DoStatement;
  return {
    kind: 'DoStatement',
    expression: findChild(children, n.expression)!,
    statement: findChild(children, n.statement)!,
    pos, end, text, children,
  } satisfies KSDoStatement;
});

register(ts.SyntaxKind.SwitchStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.SwitchStatement;
  return {
    kind: 'SwitchStatement',
    expression: findChild(children, n.expression)!,
    caseBlock: findChild(children, n.caseBlock)!,
    pos, end, text, children,
  } satisfies KSSwitchStatement;
});

register(ts.SyntaxKind.ThrowStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.ThrowStatement;
  return {
    kind: 'ThrowStatement',
    expression: findChild(children, n.expression)!,
    pos, end, text, children,
  } satisfies KSThrowStatement;
});

register(ts.SyntaxKind.TryStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.TryStatement;
  return {
    kind: 'TryStatement',
    tryBlock: findChild(children, n.tryBlock)!,
    catchClause: findChild(children, n.catchClause),
    finallyBlock: findChild(children, n.finallyBlock),
    pos, end, text, children,
  } satisfies KSTryStatement;
});

// ── Expressions ──

register(ts.SyntaxKind.CallExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.CallExpression;
  return {
    kind: 'CallExpression',
    expression: findChild(children, n.expression)!,
    typeArguments: findChildrenOf(children, n.typeArguments),
    arguments: findChildrenOf(children, n.arguments),
    pos, end, text, children,
  } satisfies KSCallExpression;
});

register(ts.SyntaxKind.PropertyAccessExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.PropertyAccessExpression;
  return {
    kind: 'PropertyAccessExpression',
    expression: findChild(children, n.expression)!,
    name: findChildAs<KSIdentifier>(children, n.name)!,
    pos, end, text, children,
  } satisfies KSPropertyAccessExpression;
});

register(ts.SyntaxKind.ElementAccessExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.ElementAccessExpression;
  return {
    kind: 'ElementAccessExpression',
    expression: findChild(children, n.expression)!,
    argumentExpression: findChild(children, n.argumentExpression)!,
    pos, end, text, children,
  } satisfies KSElementAccessExpression;
});

register(ts.SyntaxKind.BinaryExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.BinaryExpression;
  return {
    kind: 'BinaryExpression',
    left: findChild(children, n.left)!,
    operatorToken: findChild(children, n.operatorToken)!,
    right: findChild(children, n.right)!,
    pos, end, text, children,
  } satisfies KSBinaryExpression;
});

register(ts.SyntaxKind.PrefixUnaryExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.PrefixUnaryExpression;
  return {
    kind: 'PrefixUnaryExpression',
    operand: findChild(children, n.operand)!,
    operator: n.operator,
    pos, end, text, children,
  } satisfies KSPrefixUnaryExpression;
});

register(ts.SyntaxKind.PostfixUnaryExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.PostfixUnaryExpression;
  return {
    kind: 'PostfixUnaryExpression',
    operand: findChild(children, n.operand)!,
    operator: n.operator,
    pos, end, text, children,
  } satisfies KSPostfixUnaryExpression;
});

register(ts.SyntaxKind.ArrowFunction, (node, sf, children, pos, end, text) => {
  const n = node as ts.ArrowFunction;
  return {
    kind: 'ArrowFunction',
    typeParameters: findChildrenOf(children, n.typeParameters),
    parameters: findChildrenOf(children, n.parameters),
    type: findChild(children, n.type),
    body: findChild(children, n.body)!,
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSArrowFunction;
});

register(ts.SyntaxKind.FunctionExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.FunctionExpression;
  return {
    kind: 'FunctionExpression',
    name: findChildAs<KSIdentifier>(children, n.name),
    typeParameters: findChildrenOf(children, n.typeParameters),
    parameters: findChildrenOf(children, n.parameters),
    type: findChild(children, n.type),
    body: findChild(children, n.body)!,
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSFunctionExpression;
});

register(ts.SyntaxKind.ObjectLiteralExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.ObjectLiteralExpression;
  return {
    kind: 'ObjectLiteralExpression',
    properties: findChildrenOf(children, n.properties),
    pos, end, text, children,
  } satisfies KSObjectLiteralExpression;
});

register(ts.SyntaxKind.ArrayLiteralExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.ArrayLiteralExpression;
  return {
    kind: 'ArrayLiteralExpression',
    elements: findChildrenOf(children, n.elements),
    pos, end, text, children,
  } satisfies KSArrayLiteralExpression;
});

register(ts.SyntaxKind.TemplateExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.TemplateExpression;
  return {
    kind: 'TemplateExpression',
    head: findChild(children, n.head)!,
    templateSpans: findChildrenOf(children, n.templateSpans),
    pos, end, text, children,
  } satisfies KSTemplateExpression;
});

register(ts.SyntaxKind.ConditionalExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.ConditionalExpression;
  return {
    kind: 'ConditionalExpression',
    condition: findChild(children, n.condition)!,
    whenTrue: findChild(children, n.whenTrue)!,
    whenFalse: findChild(children, n.whenFalse)!,
    pos, end, text, children,
  } satisfies KSConditionalExpression;
});

register(ts.SyntaxKind.NewExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.NewExpression;
  return {
    kind: 'NewExpression',
    expression: findChild(children, n.expression)!,
    typeArguments: findChildrenOf(children, n.typeArguments),
    arguments: n.arguments ? findChildrenOf(children, n.arguments) : [],
    pos, end, text, children,
  } satisfies KSNewExpression;
});

register(ts.SyntaxKind.AwaitExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.AwaitExpression;
  return {
    kind: 'AwaitExpression',
    expression: findChild(children, n.expression)!,
    pos, end, text, children,
  } satisfies KSAwaitExpression;
});

register(ts.SyntaxKind.SpreadElement, (node, sf, children, pos, end, text) => {
  const n = node as ts.SpreadElement;
  return {
    kind: 'SpreadElement',
    expression: findChild(children, n.expression)!,
    pos, end, text, children,
  } satisfies KSSpreadElement;
});

register(ts.SyntaxKind.AsExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.AsExpression;
  return {
    kind: 'AsExpression',
    expression: findChild(children, n.expression)!,
    type: findChild(children, n.type)!,
    pos, end, text, children,
  } satisfies KSAsExpression;
});

register(ts.SyntaxKind.ParenthesizedExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.ParenthesizedExpression;
  return {
    kind: 'ParenthesizedExpression',
    expression: findChild(children, n.expression)!,
    pos, end, text, children,
  } satisfies KSParenthesizedExpression;
});

// ── Type nodes ──

register(ts.SyntaxKind.TypeReference, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypeReferenceNode;
  return {
    kind: 'TypeReference',
    typeName: findChild(children, n.typeName)!,
    typeArguments: findChildrenOf(children, n.typeArguments),
    pos, end, text, children,
  } satisfies KSTypeReferenceNode;
});

register(ts.SyntaxKind.TypeLiteral, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypeLiteralNode;
  return {
    kind: 'TypeLiteral',
    members: findChildrenOf(children, n.members),
    pos, end, text, children,
  } satisfies KSTypeLiteralNode;
});

register(ts.SyntaxKind.UnionType, (node, sf, children, pos, end, text) => {
  const n = node as ts.UnionTypeNode;
  return {
    kind: 'UnionType',
    types: findChildrenOf(children, n.types),
    pos, end, text, children,
  } satisfies KSUnionType;
});

register(ts.SyntaxKind.IntersectionType, (node, sf, children, pos, end, text) => {
  const n = node as ts.IntersectionTypeNode;
  return {
    kind: 'IntersectionType',
    types: findChildrenOf(children, n.types),
    pos, end, text, children,
  } satisfies KSIntersectionType;
});

register(ts.SyntaxKind.FunctionType, (node, sf, children, pos, end, text) => {
  const n = node as ts.FunctionTypeNode;
  return {
    kind: 'FunctionType',
    typeParameters: findChildrenOf(children, n.typeParameters),
    parameters: findChildrenOf(children, n.parameters),
    type: findChild(children, n.type)!,
    pos, end, text, children,
  } satisfies KSFunctionType;
});

register(ts.SyntaxKind.ArrayType, (node, sf, children, pos, end, text) => {
  const n = node as ts.ArrayTypeNode;
  return {
    kind: 'ArrayType',
    elementType: findChild(children, n.elementType)!,
    pos, end, text, children,
  } satisfies KSArrayType;
});

register(ts.SyntaxKind.TupleType, (node, sf, children, pos, end, text) => {
  const n = node as ts.TupleTypeNode;
  return {
    kind: 'TupleType',
    elements: findChildrenOf(children, n.elements),
    pos, end, text, children,
  } satisfies KSTupleType;
});

register(ts.SyntaxKind.LiteralType, (node, sf, children, pos, end, text) => {
  const n = node as ts.LiteralTypeNode;
  return {
    kind: 'LiteralType',
    literal: findChild(children, n.literal)!,
    pos, end, text, children,
  } satisfies KSLiteralType;
});

register(ts.SyntaxKind.ConditionalType, (node, sf, children, pos, end, text) => {
  const n = node as ts.ConditionalTypeNode;
  return {
    kind: 'ConditionalType',
    checkType: findChild(children, n.checkType)!,
    extendsType: findChild(children, n.extendsType)!,
    trueType: findChild(children, n.trueType)!,
    falseType: findChild(children, n.falseType)!,
    pos, end, text, children,
  } satisfies KSConditionalType;
});

register(ts.SyntaxKind.MappedType, (node, sf, children, pos, end, text) => {
  const n = node as ts.MappedTypeNode;
  return {
    kind: 'MappedType',
    typeParameter: findChild(children, n.typeParameter)!,
    nameType: findChild(children, n.nameType),
    type: findChild(children, n.type),
    pos, end, text, children,
  } satisfies KSMappedType;
});

register(ts.SyntaxKind.IndexedAccessType, (node, sf, children, pos, end, text) => {
  const n = node as ts.IndexedAccessTypeNode;
  return {
    kind: 'IndexedAccessType',
    objectType: findChild(children, n.objectType)!,
    indexType: findChild(children, n.indexType)!,
    pos, end, text, children,
  } satisfies KSIndexedAccessType;
});

register(ts.SyntaxKind.TypeQuery, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypeQueryNode;
  return {
    kind: 'TypeQuery',
    exprName: findChild(children, n.exprName)!,
    pos, end, text, children,
  } satisfies KSTypeQuery;
});

// ── Identifiers & Literals ──

register(ts.SyntaxKind.Identifier, (node, sf, children, pos, end, text) => {
  const n = node as ts.Identifier;
  return {
    kind: 'Identifier',
    escapedText: n.text,
    pos, end, text, children,
  } satisfies KSIdentifier;
});

register(ts.SyntaxKind.StringLiteral, (node, sf, children, pos, end, text) => {
  const n = node as ts.StringLiteral;
  return {
    kind: 'StringLiteral',
    value: n.text,
    pos, end, text, children,
  } satisfies KSStringLiteral;
});

register(ts.SyntaxKind.NumericLiteral, (node, sf, children, pos, end, text) => {
  const n = node as ts.NumericLiteral;
  return {
    kind: 'NumericLiteral',
    value: n.text,
    pos, end, text, children,
  } satisfies KSNumericLiteral;
});

register(ts.SyntaxKind.NoSubstitutionTemplateLiteral, (node, sf, children, pos, end, text) => {
  const n = node as ts.NoSubstitutionTemplateLiteral;
  return {
    kind: 'NoSubstitutionTemplateLiteral',
    value: n.text,
    pos, end, text, children,
  } satisfies KSNoSubstitutionTemplateLiteral;
});

// ── Members ──

register(ts.SyntaxKind.PropertySignature, (node, sf, children, pos, end, text) => {
  const n = node as ts.PropertySignature;
  return {
    kind: 'PropertySignature',
    name: findChild(children, n.name)!,
    type: findChild(children, n.type),
    questionToken: findChild(children, n.questionToken),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSPropertySignature;
});

register(ts.SyntaxKind.PropertyDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.PropertyDeclaration;
  return {
    kind: 'PropertyDeclaration',
    name: findChild(children, n.name)!,
    type: findChild(children, n.type),
    initializer: findChild(children, n.initializer),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSPropertyDeclaration;
});

register(ts.SyntaxKind.MethodDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.MethodDeclaration;
  return {
    kind: 'MethodDeclaration',
    name: findChild(children, n.name)!,
    typeParameters: findChildrenOf(children, n.typeParameters),
    parameters: findChildrenOf(children, n.parameters),
    type: findChild(children, n.type),
    body: findChild(children, n.body),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSMethodDeclaration;
});

register(ts.SyntaxKind.Constructor, (node, sf, children, pos, end, text) => {
  const n = node as ts.ConstructorDeclaration;
  return {
    kind: 'Constructor',
    parameters: findChildrenOf(children, n.parameters),
    body: findChild(children, n.body),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSConstructorDeclaration;
});

register(ts.SyntaxKind.GetAccessor, (node, sf, children, pos, end, text) => {
  const n = node as ts.GetAccessorDeclaration;
  return {
    kind: 'GetAccessor',
    name: findChild(children, n.name)!,
    parameters: findChildrenOf(children, n.parameters),
    type: findChild(children, n.type),
    body: findChild(children, n.body),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSGetAccessorDeclaration;
});

register(ts.SyntaxKind.SetAccessor, (node, sf, children, pos, end, text) => {
  const n = node as ts.SetAccessorDeclaration;
  return {
    kind: 'SetAccessor',
    name: findChild(children, n.name)!,
    parameters: findChildrenOf(children, n.parameters),
    body: findChild(children, n.body),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSSetAccessorDeclaration;
});

register(ts.SyntaxKind.Parameter, (node, sf, children, pos, end, text) => {
  const n = node as ts.ParameterDeclaration;
  return {
    kind: 'Parameter',
    name: findChild(children, n.name)!,
    type: findChild(children, n.type),
    initializer: findChild(children, n.initializer),
    dotDotDotToken: findChild(children, n.dotDotDotToken),
    questionToken: findChild(children, n.questionToken),
    modifiers: extractModifiers(children, n),
    pos, end, text, children,
  } satisfies KSParameterNode;
});

register(ts.SyntaxKind.TypeParameter, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypeParameterDeclaration;
  return {
    kind: 'TypeParameter',
    name: findChildAs<KSIdentifier>(children, n.name)!,
    constraint: findChild(children, n.constraint),
    default: findChild(children, n.default),
    pos, end, text, children,
  } satisfies KSTypeParameterNode;
});

// ── Structural ──

register(ts.SyntaxKind.PropertyAssignment, (node, sf, children, pos, end, text) => {
  const n = node as ts.PropertyAssignment;
  return {
    kind: 'PropertyAssignment',
    name: findChild(children, n.name)!,
    initializer: findChild(children, n.initializer)!,
    pos, end, text, children,
  } satisfies KSPropertyAssignment;
});

register(ts.SyntaxKind.ShorthandPropertyAssignment, (node, sf, children, pos, end, text) => {
  const n = node as ts.ShorthandPropertyAssignment;
  return {
    kind: 'ShorthandPropertyAssignment',
    name: findChildAs<KSIdentifier>(children, n.name)!,
    pos, end, text, children,
  } satisfies KSShorthandPropertyAssignment;
});

register(ts.SyntaxKind.ComputedPropertyName, (node, sf, children, pos, end, text) => {
  const n = node as ts.ComputedPropertyName;
  return {
    kind: 'ComputedPropertyName',
    expression: findChild(children, n.expression)!,
    pos, end, text, children,
  } satisfies KSComputedPropertyName;
});

register(ts.SyntaxKind.HeritageClause, (node, sf, children, pos, end, text) => {
  const n = node as ts.HeritageClause;
  return {
    kind: 'HeritageClause',
    token: n.token,
    types: findChildrenOf(children, n.types),
    pos, end, text, children,
  } satisfies KSHeritageClause;
});

register(ts.SyntaxKind.CatchClause, (node, sf, children, pos, end, text) => {
  const n = node as ts.CatchClause;
  return {
    kind: 'CatchClause',
    variableDeclaration: findChild(children, n.variableDeclaration),
    block: findChild(children, n.block)!,
    pos, end, text, children,
  } satisfies KSCatchClause;
});

register(ts.SyntaxKind.CaseBlock, (node, sf, children, pos, end, text) => {
  const n = node as ts.CaseBlock;
  return {
    kind: 'CaseBlock',
    clauses: findChildrenOf(children, n.clauses),
    pos, end, text, children,
  } satisfies KSCaseBlock;
});

register(ts.SyntaxKind.CaseClause, (node, sf, children, pos, end, text) => {
  const n = node as ts.CaseClause;
  return {
    kind: 'CaseClause',
    expression: findChild(children, n.expression)!,
    statements: findChildrenOf(children, n.statements),
    pos, end, text, children,
  } satisfies KSCaseClause;
});

register(ts.SyntaxKind.DefaultClause, (node, sf, children, pos, end, text) => {
  const n = node as ts.DefaultClause;
  return {
    kind: 'DefaultClause',
    statements: findChildrenOf(children, n.statements),
    pos, end, text, children,
  } satisfies KSDefaultClause;
});

register(ts.SyntaxKind.EnumMember, (node, sf, children, pos, end, text) => {
  const n = node as ts.EnumMember;
  return {
    kind: 'EnumMember',
    name: findChild(children, n.name)!,
    initializer: findChild(children, n.initializer),
    pos, end, text, children,
  } satisfies KSEnumMember;
});

// ═══════════════════════════════════════════════════════════════════════
// Generated leaf node converters
// ═══════════════════════════════════════════════════════════════════════

register(ts.SyntaxKind.Unknown, (node, sf, children, pos, end, text) => ({
  kind: 'Unknown' as const, pos, end, text, children,
} as KSUnknown));

register(ts.SyntaxKind.EndOfFileToken, (node, sf, children, pos, end, text) => ({
  kind: 'EndOfFileToken' as const, pos, end, text, children,
} as KSEndOfFileToken));

register(ts.SyntaxKind.SingleLineCommentTrivia, (node, sf, children, pos, end, text) => ({
  kind: 'SingleLineCommentTrivia' as const, pos, end, text, children,
} as KSSingleLineCommentTrivia));

register(ts.SyntaxKind.MultiLineCommentTrivia, (node, sf, children, pos, end, text) => ({
  kind: 'MultiLineCommentTrivia' as const, pos, end, text, children,
} as KSMultiLineCommentTrivia));

register(ts.SyntaxKind.NewLineTrivia, (node, sf, children, pos, end, text) => ({
  kind: 'NewLineTrivia' as const, pos, end, text, children,
} as KSNewLineTrivia));

register(ts.SyntaxKind.WhitespaceTrivia, (node, sf, children, pos, end, text) => ({
  kind: 'WhitespaceTrivia' as const, pos, end, text, children,
} as KSWhitespaceTrivia));

register(ts.SyntaxKind.ShebangTrivia, (node, sf, children, pos, end, text) => ({
  kind: 'ShebangTrivia' as const, pos, end, text, children,
} as KSShebangTrivia));

register(ts.SyntaxKind.ConflictMarkerTrivia, (node, sf, children, pos, end, text) => ({
  kind: 'ConflictMarkerTrivia' as const, pos, end, text, children,
} as KSConflictMarkerTrivia));

register(ts.SyntaxKind.NonTextFileMarkerTrivia, (node, sf, children, pos, end, text) => ({
  kind: 'NonTextFileMarkerTrivia' as const, pos, end, text, children,
} as KSNonTextFileMarkerTrivia));

register(ts.SyntaxKind.JsxTextAllWhiteSpaces, (node, sf, children, pos, end, text) => ({
  kind: 'JsxTextAllWhiteSpaces' as const, pos, end, text, children,
} as KSJsxTextAllWhiteSpaces));

register(ts.SyntaxKind.OpenBraceToken, (node, sf, children, pos, end, text) => ({
  kind: 'OpenBraceToken' as const, pos, end, text, children,
} as KSOpenBraceToken));

register(ts.SyntaxKind.CloseBraceToken, (node, sf, children, pos, end, text) => ({
  kind: 'CloseBraceToken' as const, pos, end, text, children,
} as KSCloseBraceToken));

register(ts.SyntaxKind.OpenParenToken, (node, sf, children, pos, end, text) => ({
  kind: 'OpenParenToken' as const, pos, end, text, children,
} as KSOpenParenToken));

register(ts.SyntaxKind.CloseParenToken, (node, sf, children, pos, end, text) => ({
  kind: 'CloseParenToken' as const, pos, end, text, children,
} as KSCloseParenToken));

register(ts.SyntaxKind.OpenBracketToken, (node, sf, children, pos, end, text) => ({
  kind: 'OpenBracketToken' as const, pos, end, text, children,
} as KSOpenBracketToken));

register(ts.SyntaxKind.CloseBracketToken, (node, sf, children, pos, end, text) => ({
  kind: 'CloseBracketToken' as const, pos, end, text, children,
} as KSCloseBracketToken));

register(ts.SyntaxKind.DotToken, (node, sf, children, pos, end, text) => ({
  kind: 'DotToken' as const, pos, end, text, children,
} as KSDotToken));

register(ts.SyntaxKind.DotDotDotToken, (node, sf, children, pos, end, text) => ({
  kind: 'DotDotDotToken' as const, pos, end, text, children,
} as KSDotDotDotToken));

register(ts.SyntaxKind.SemicolonToken, (node, sf, children, pos, end, text) => ({
  kind: 'SemicolonToken' as const, pos, end, text, children,
} as KSSemicolonToken));

register(ts.SyntaxKind.CommaToken, (node, sf, children, pos, end, text) => ({
  kind: 'CommaToken' as const, pos, end, text, children,
} as KSCommaToken));

register(ts.SyntaxKind.QuestionDotToken, (node, sf, children, pos, end, text) => ({
  kind: 'QuestionDotToken' as const, pos, end, text, children,
} as KSQuestionDotToken));

register(ts.SyntaxKind.LessThanToken, (node, sf, children, pos, end, text) => ({
  kind: 'LessThanToken' as const, pos, end, text, children,
} as KSLessThanToken));

register(ts.SyntaxKind.LessThanSlashToken, (node, sf, children, pos, end, text) => ({
  kind: 'LessThanSlashToken' as const, pos, end, text, children,
} as KSLessThanSlashToken));

register(ts.SyntaxKind.GreaterThanToken, (node, sf, children, pos, end, text) => ({
  kind: 'GreaterThanToken' as const, pos, end, text, children,
} as KSGreaterThanToken));

register(ts.SyntaxKind.LessThanEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'LessThanEqualsToken' as const, pos, end, text, children,
} as KSLessThanEqualsToken));

register(ts.SyntaxKind.GreaterThanEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'GreaterThanEqualsToken' as const, pos, end, text, children,
} as KSGreaterThanEqualsToken));

register(ts.SyntaxKind.EqualsEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'EqualsEqualsToken' as const, pos, end, text, children,
} as KSEqualsEqualsToken));

register(ts.SyntaxKind.ExclamationEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'ExclamationEqualsToken' as const, pos, end, text, children,
} as KSExclamationEqualsToken));

register(ts.SyntaxKind.EqualsEqualsEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'EqualsEqualsEqualsToken' as const, pos, end, text, children,
} as KSEqualsEqualsEqualsToken));

register(ts.SyntaxKind.ExclamationEqualsEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'ExclamationEqualsEqualsToken' as const, pos, end, text, children,
} as KSExclamationEqualsEqualsToken));

register(ts.SyntaxKind.EqualsGreaterThanToken, (node, sf, children, pos, end, text) => ({
  kind: 'EqualsGreaterThanToken' as const, pos, end, text, children,
} as KSEqualsGreaterThanToken));

register(ts.SyntaxKind.PlusToken, (node, sf, children, pos, end, text) => ({
  kind: 'PlusToken' as const, pos, end, text, children,
} as KSPlusToken));

register(ts.SyntaxKind.MinusToken, (node, sf, children, pos, end, text) => ({
  kind: 'MinusToken' as const, pos, end, text, children,
} as KSMinusToken));

register(ts.SyntaxKind.AsteriskToken, (node, sf, children, pos, end, text) => ({
  kind: 'AsteriskToken' as const, pos, end, text, children,
} as KSAsteriskToken));

register(ts.SyntaxKind.AsteriskAsteriskToken, (node, sf, children, pos, end, text) => ({
  kind: 'AsteriskAsteriskToken' as const, pos, end, text, children,
} as KSAsteriskAsteriskToken));

register(ts.SyntaxKind.SlashToken, (node, sf, children, pos, end, text) => ({
  kind: 'SlashToken' as const, pos, end, text, children,
} as KSSlashToken));

register(ts.SyntaxKind.PercentToken, (node, sf, children, pos, end, text) => ({
  kind: 'PercentToken' as const, pos, end, text, children,
} as KSPercentToken));

register(ts.SyntaxKind.PlusPlusToken, (node, sf, children, pos, end, text) => ({
  kind: 'PlusPlusToken' as const, pos, end, text, children,
} as KSPlusPlusToken));

register(ts.SyntaxKind.MinusMinusToken, (node, sf, children, pos, end, text) => ({
  kind: 'MinusMinusToken' as const, pos, end, text, children,
} as KSMinusMinusToken));

register(ts.SyntaxKind.LessThanLessThanToken, (node, sf, children, pos, end, text) => ({
  kind: 'LessThanLessThanToken' as const, pos, end, text, children,
} as KSLessThanLessThanToken));

register(ts.SyntaxKind.GreaterThanGreaterThanToken, (node, sf, children, pos, end, text) => ({
  kind: 'GreaterThanGreaterThanToken' as const, pos, end, text, children,
} as KSGreaterThanGreaterThanToken));

register(ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, (node, sf, children, pos, end, text) => ({
  kind: 'GreaterThanGreaterThanGreaterThanToken' as const, pos, end, text, children,
} as KSGreaterThanGreaterThanGreaterThanToken));

register(ts.SyntaxKind.AmpersandToken, (node, sf, children, pos, end, text) => ({
  kind: 'AmpersandToken' as const, pos, end, text, children,
} as KSAmpersandToken));

register(ts.SyntaxKind.BarToken, (node, sf, children, pos, end, text) => ({
  kind: 'BarToken' as const, pos, end, text, children,
} as KSBarToken));

register(ts.SyntaxKind.CaretToken, (node, sf, children, pos, end, text) => ({
  kind: 'CaretToken' as const, pos, end, text, children,
} as KSCaretToken));

register(ts.SyntaxKind.ExclamationToken, (node, sf, children, pos, end, text) => ({
  kind: 'ExclamationToken' as const, pos, end, text, children,
} as KSExclamationToken));

register(ts.SyntaxKind.TildeToken, (node, sf, children, pos, end, text) => ({
  kind: 'TildeToken' as const, pos, end, text, children,
} as KSTildeToken));

register(ts.SyntaxKind.AmpersandAmpersandToken, (node, sf, children, pos, end, text) => ({
  kind: 'AmpersandAmpersandToken' as const, pos, end, text, children,
} as KSAmpersandAmpersandToken));

register(ts.SyntaxKind.BarBarToken, (node, sf, children, pos, end, text) => ({
  kind: 'BarBarToken' as const, pos, end, text, children,
} as KSBarBarToken));

register(ts.SyntaxKind.QuestionToken, (node, sf, children, pos, end, text) => ({
  kind: 'QuestionToken' as const, pos, end, text, children,
} as KSQuestionToken));

register(ts.SyntaxKind.ColonToken, (node, sf, children, pos, end, text) => ({
  kind: 'ColonToken' as const, pos, end, text, children,
} as KSColonToken));

register(ts.SyntaxKind.AtToken, (node, sf, children, pos, end, text) => ({
  kind: 'AtToken' as const, pos, end, text, children,
} as KSAtToken));

register(ts.SyntaxKind.QuestionQuestionToken, (node, sf, children, pos, end, text) => ({
  kind: 'QuestionQuestionToken' as const, pos, end, text, children,
} as KSQuestionQuestionToken));

register(ts.SyntaxKind.BacktickToken, (node, sf, children, pos, end, text) => ({
  kind: 'BacktickToken' as const, pos, end, text, children,
} as KSBacktickToken));

register(ts.SyntaxKind.HashToken, (node, sf, children, pos, end, text) => ({
  kind: 'HashToken' as const, pos, end, text, children,
} as KSHashToken));

register(ts.SyntaxKind.EqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'EqualsToken' as const, pos, end, text, children,
} as KSEqualsToken));

register(ts.SyntaxKind.PlusEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'PlusEqualsToken' as const, pos, end, text, children,
} as KSPlusEqualsToken));

register(ts.SyntaxKind.MinusEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'MinusEqualsToken' as const, pos, end, text, children,
} as KSMinusEqualsToken));

register(ts.SyntaxKind.AsteriskEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'AsteriskEqualsToken' as const, pos, end, text, children,
} as KSAsteriskEqualsToken));

register(ts.SyntaxKind.AsteriskAsteriskEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'AsteriskAsteriskEqualsToken' as const, pos, end, text, children,
} as KSAsteriskAsteriskEqualsToken));

register(ts.SyntaxKind.SlashEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'SlashEqualsToken' as const, pos, end, text, children,
} as KSSlashEqualsToken));

register(ts.SyntaxKind.PercentEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'PercentEqualsToken' as const, pos, end, text, children,
} as KSPercentEqualsToken));

register(ts.SyntaxKind.LessThanLessThanEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'LessThanLessThanEqualsToken' as const, pos, end, text, children,
} as KSLessThanLessThanEqualsToken));

register(ts.SyntaxKind.GreaterThanGreaterThanEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'GreaterThanGreaterThanEqualsToken' as const, pos, end, text, children,
} as KSGreaterThanGreaterThanEqualsToken));

register(ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'GreaterThanGreaterThanGreaterThanEqualsToken' as const, pos, end, text, children,
} as KSGreaterThanGreaterThanGreaterThanEqualsToken));

register(ts.SyntaxKind.AmpersandEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'AmpersandEqualsToken' as const, pos, end, text, children,
} as KSAmpersandEqualsToken));

register(ts.SyntaxKind.BarEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'BarEqualsToken' as const, pos, end, text, children,
} as KSBarEqualsToken));

register(ts.SyntaxKind.BarBarEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'BarBarEqualsToken' as const, pos, end, text, children,
} as KSBarBarEqualsToken));

register(ts.SyntaxKind.AmpersandAmpersandEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'AmpersandAmpersandEqualsToken' as const, pos, end, text, children,
} as KSAmpersandAmpersandEqualsToken));

register(ts.SyntaxKind.QuestionQuestionEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'QuestionQuestionEqualsToken' as const, pos, end, text, children,
} as KSQuestionQuestionEqualsToken));

register(ts.SyntaxKind.CaretEqualsToken, (node, sf, children, pos, end, text) => ({
  kind: 'CaretEqualsToken' as const, pos, end, text, children,
} as KSCaretEqualsToken));

register(82 as ts.SyntaxKind, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocCommentTextToken' as const, pos, end, text, children,
} as KSJSDocCommentTextToken));

register(ts.SyntaxKind.BreakKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'BreakKeyword' as const, pos, end, text, children,
} as KSBreakKeyword));

register(ts.SyntaxKind.CaseKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'CaseKeyword' as const, pos, end, text, children,
} as KSCaseKeyword));

register(ts.SyntaxKind.CatchKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'CatchKeyword' as const, pos, end, text, children,
} as KSCatchKeyword));

register(ts.SyntaxKind.ClassKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ClassKeyword' as const, pos, end, text, children,
} as KSClassKeyword));

register(ts.SyntaxKind.ConstKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ConstKeyword' as const, pos, end, text, children,
} as KSConstKeyword));

register(ts.SyntaxKind.ContinueKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ContinueKeyword' as const, pos, end, text, children,
} as KSContinueKeyword));

register(ts.SyntaxKind.DebuggerKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'DebuggerKeyword' as const, pos, end, text, children,
} as KSDebuggerKeyword));

register(ts.SyntaxKind.DefaultKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'DefaultKeyword' as const, pos, end, text, children,
} as KSDefaultKeyword));

register(ts.SyntaxKind.DeleteKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'DeleteKeyword' as const, pos, end, text, children,
} as KSDeleteKeyword));

register(ts.SyntaxKind.DoKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'DoKeyword' as const, pos, end, text, children,
} as KSDoKeyword));

register(ts.SyntaxKind.ElseKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ElseKeyword' as const, pos, end, text, children,
} as KSElseKeyword));

register(ts.SyntaxKind.EnumKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'EnumKeyword' as const, pos, end, text, children,
} as KSEnumKeyword));

register(ts.SyntaxKind.ExportKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ExportKeyword' as const, pos, end, text, children,
} as KSExportKeyword));

register(ts.SyntaxKind.ExtendsKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ExtendsKeyword' as const, pos, end, text, children,
} as KSExtendsKeyword));

register(ts.SyntaxKind.FalseKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'FalseKeyword' as const, pos, end, text, children,
} as KSFalseKeyword));

register(ts.SyntaxKind.FinallyKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'FinallyKeyword' as const, pos, end, text, children,
} as KSFinallyKeyword));

register(ts.SyntaxKind.ForKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ForKeyword' as const, pos, end, text, children,
} as KSForKeyword));

register(ts.SyntaxKind.FunctionKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'FunctionKeyword' as const, pos, end, text, children,
} as KSFunctionKeyword));

register(ts.SyntaxKind.IfKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'IfKeyword' as const, pos, end, text, children,
} as KSIfKeyword));

register(ts.SyntaxKind.ImportKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ImportKeyword' as const, pos, end, text, children,
} as KSImportKeyword));

register(ts.SyntaxKind.InKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'InKeyword' as const, pos, end, text, children,
} as KSInKeyword));

register(ts.SyntaxKind.InstanceOfKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'InstanceOfKeyword' as const, pos, end, text, children,
} as KSInstanceOfKeyword));

register(ts.SyntaxKind.NewKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'NewKeyword' as const, pos, end, text, children,
} as KSNewKeyword));

register(ts.SyntaxKind.NullKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'NullKeyword' as const, pos, end, text, children,
} as KSNullKeyword));

register(ts.SyntaxKind.ReturnKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ReturnKeyword' as const, pos, end, text, children,
} as KSReturnKeyword));

register(ts.SyntaxKind.SuperKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'SuperKeyword' as const, pos, end, text, children,
} as KSSuperKeyword));

register(ts.SyntaxKind.SwitchKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'SwitchKeyword' as const, pos, end, text, children,
} as KSSwitchKeyword));

register(ts.SyntaxKind.ThisKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ThisKeyword' as const, pos, end, text, children,
} as KSThisKeyword));

register(ts.SyntaxKind.ThrowKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ThrowKeyword' as const, pos, end, text, children,
} as KSThrowKeyword));

register(ts.SyntaxKind.TrueKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'TrueKeyword' as const, pos, end, text, children,
} as KSTrueKeyword));

register(ts.SyntaxKind.TryKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'TryKeyword' as const, pos, end, text, children,
} as KSTryKeyword));

register(ts.SyntaxKind.TypeOfKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'TypeOfKeyword' as const, pos, end, text, children,
} as KSTypeOfKeyword));

register(ts.SyntaxKind.VarKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'VarKeyword' as const, pos, end, text, children,
} as KSVarKeyword));

register(ts.SyntaxKind.VoidKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'VoidKeyword' as const, pos, end, text, children,
} as KSVoidKeyword));

register(ts.SyntaxKind.WhileKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'WhileKeyword' as const, pos, end, text, children,
} as KSWhileKeyword));

register(ts.SyntaxKind.WithKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'WithKeyword' as const, pos, end, text, children,
} as KSWithKeyword));

register(ts.SyntaxKind.ImplementsKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ImplementsKeyword' as const, pos, end, text, children,
} as KSImplementsKeyword));

register(ts.SyntaxKind.InterfaceKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'InterfaceKeyword' as const, pos, end, text, children,
} as KSInterfaceKeyword));

register(ts.SyntaxKind.LetKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'LetKeyword' as const, pos, end, text, children,
} as KSLetKeyword));

register(ts.SyntaxKind.PackageKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'PackageKeyword' as const, pos, end, text, children,
} as KSPackageKeyword));

register(ts.SyntaxKind.PrivateKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'PrivateKeyword' as const, pos, end, text, children,
} as KSPrivateKeyword));

register(ts.SyntaxKind.ProtectedKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ProtectedKeyword' as const, pos, end, text, children,
} as KSProtectedKeyword));

register(ts.SyntaxKind.PublicKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'PublicKeyword' as const, pos, end, text, children,
} as KSPublicKeyword));

register(ts.SyntaxKind.StaticKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'StaticKeyword' as const, pos, end, text, children,
} as KSStaticKeyword));

register(ts.SyntaxKind.YieldKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'YieldKeyword' as const, pos, end, text, children,
} as KSYieldKeyword));

register(ts.SyntaxKind.AbstractKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'AbstractKeyword' as const, pos, end, text, children,
} as KSAbstractKeyword));

register(ts.SyntaxKind.AccessorKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'AccessorKeyword' as const, pos, end, text, children,
} as KSAccessorKeyword));

register(ts.SyntaxKind.AsKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'AsKeyword' as const, pos, end, text, children,
} as KSAsKeyword));

register(ts.SyntaxKind.AssertsKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'AssertsKeyword' as const, pos, end, text, children,
} as KSAssertsKeyword));

register(ts.SyntaxKind.AssertKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'AssertKeyword' as const, pos, end, text, children,
} as KSAssertKeyword));

register(ts.SyntaxKind.AnyKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'AnyKeyword' as const, pos, end, text, children,
} as KSAnyKeyword));

register(ts.SyntaxKind.AsyncKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'AsyncKeyword' as const, pos, end, text, children,
} as KSAsyncKeyword));

register(ts.SyntaxKind.AwaitKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'AwaitKeyword' as const, pos, end, text, children,
} as KSAwaitKeyword));

register(ts.SyntaxKind.BooleanKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'BooleanKeyword' as const, pos, end, text, children,
} as KSBooleanKeyword));

register(ts.SyntaxKind.ConstructorKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ConstructorKeyword' as const, pos, end, text, children,
} as KSConstructorKeyword));

register(ts.SyntaxKind.DeclareKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'DeclareKeyword' as const, pos, end, text, children,
} as KSDeclareKeyword));

register(ts.SyntaxKind.GetKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'GetKeyword' as const, pos, end, text, children,
} as KSGetKeyword));

register(ts.SyntaxKind.InferKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'InferKeyword' as const, pos, end, text, children,
} as KSInferKeyword));

register(ts.SyntaxKind.IntrinsicKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'IntrinsicKeyword' as const, pos, end, text, children,
} as KSIntrinsicKeyword));

register(ts.SyntaxKind.IsKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'IsKeyword' as const, pos, end, text, children,
} as KSIsKeyword));

register(ts.SyntaxKind.KeyOfKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'KeyOfKeyword' as const, pos, end, text, children,
} as KSKeyOfKeyword));

register(ts.SyntaxKind.ModuleKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ModuleKeyword' as const, pos, end, text, children,
} as KSModuleKeyword));

register(ts.SyntaxKind.NamespaceKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'NamespaceKeyword' as const, pos, end, text, children,
} as KSNamespaceKeyword));

register(ts.SyntaxKind.NeverKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'NeverKeyword' as const, pos, end, text, children,
} as KSNeverKeyword));

register(ts.SyntaxKind.OutKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'OutKeyword' as const, pos, end, text, children,
} as KSOutKeyword));

register(ts.SyntaxKind.ReadonlyKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ReadonlyKeyword' as const, pos, end, text, children,
} as KSReadonlyKeyword));

register(ts.SyntaxKind.RequireKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'RequireKeyword' as const, pos, end, text, children,
} as KSRequireKeyword));

register(ts.SyntaxKind.NumberKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'NumberKeyword' as const, pos, end, text, children,
} as KSNumberKeyword));

register(ts.SyntaxKind.ObjectKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'ObjectKeyword' as const, pos, end, text, children,
} as KSObjectKeyword));

register(ts.SyntaxKind.SatisfiesKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'SatisfiesKeyword' as const, pos, end, text, children,
} as KSSatisfiesKeyword));

register(ts.SyntaxKind.SetKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'SetKeyword' as const, pos, end, text, children,
} as KSSetKeyword));

register(ts.SyntaxKind.StringKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'StringKeyword' as const, pos, end, text, children,
} as KSStringKeyword));

register(ts.SyntaxKind.SymbolKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'SymbolKeyword' as const, pos, end, text, children,
} as KSSymbolKeyword));

register(ts.SyntaxKind.TypeKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'TypeKeyword' as const, pos, end, text, children,
} as KSTypeKeyword));

register(ts.SyntaxKind.UndefinedKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'UndefinedKeyword' as const, pos, end, text, children,
} as KSUndefinedKeyword));

register(ts.SyntaxKind.UniqueKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'UniqueKeyword' as const, pos, end, text, children,
} as KSUniqueKeyword));

register(ts.SyntaxKind.UnknownKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'UnknownKeyword' as const, pos, end, text, children,
} as KSUnknownKeyword));

register(ts.SyntaxKind.UsingKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'UsingKeyword' as const, pos, end, text, children,
} as KSUsingKeyword));

register(ts.SyntaxKind.FromKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'FromKeyword' as const, pos, end, text, children,
} as KSFromKeyword));

register(ts.SyntaxKind.GlobalKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'GlobalKeyword' as const, pos, end, text, children,
} as KSGlobalKeyword));

register(ts.SyntaxKind.BigIntKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'BigIntKeyword' as const, pos, end, text, children,
} as KSBigIntKeyword));

register(ts.SyntaxKind.OverrideKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'OverrideKeyword' as const, pos, end, text, children,
} as KSOverrideKeyword));

register(ts.SyntaxKind.OfKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'OfKeyword' as const, pos, end, text, children,
} as KSOfKeyword));

register(ts.SyntaxKind.DeferKeyword, (node, sf, children, pos, end, text) => ({
  kind: 'DeferKeyword' as const, pos, end, text, children,
} as KSDeferKeyword));

register(ts.SyntaxKind.JSDocAllType, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocAllType' as const, pos, end, text, children,
} as KSJSDocAllType));

register(ts.SyntaxKind.JSDocUnknownType, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocUnknownType' as const, pos, end, text, children,
} as KSJSDocUnknownType));

register(ts.SyntaxKind.JSDocNamepathType, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocNamepathType' as const, pos, end, text, children,
} as KSJSDocNamepathType));

register(ts.SyntaxKind.JSDoc, (node, sf, children, pos, end, text) => ({
  kind: 'JSDoc' as const, pos, end, text, children,
} as KSJSDoc));

register(ts.SyntaxKind.JSDocText, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocText' as const, pos, end, text, children,
} as KSJSDocText));

register(ts.SyntaxKind.JSDocSignature, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocSignature' as const, pos, end, text, children,
} as KSJSDocSignature));

register(ts.SyntaxKind.JSDocLink, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocLink' as const, pos, end, text, children,
} as KSJSDocLink));

register(ts.SyntaxKind.JSDocLinkCode, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocLinkCode' as const, pos, end, text, children,
} as KSJSDocLinkCode));

register(ts.SyntaxKind.JSDocLinkPlain, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocLinkPlain' as const, pos, end, text, children,
} as KSJSDocLinkPlain));

register(ts.SyntaxKind.JSDocTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocTag' as const, pos, end, text, children,
} as KSJSDocTag));

register(ts.SyntaxKind.JSDocAugmentsTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocAugmentsTag' as const, pos, end, text, children,
} as KSJSDocAugmentsTag));

register(ts.SyntaxKind.JSDocImplementsTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocImplementsTag' as const, pos, end, text, children,
} as KSJSDocImplementsTag));

register(ts.SyntaxKind.JSDocAuthorTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocAuthorTag' as const, pos, end, text, children,
} as KSJSDocAuthorTag));

register(ts.SyntaxKind.JSDocDeprecatedTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocDeprecatedTag' as const, pos, end, text, children,
} as KSJSDocDeprecatedTag));

register(ts.SyntaxKind.JSDocClassTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocClassTag' as const, pos, end, text, children,
} as KSJSDocClassTag));

register(ts.SyntaxKind.JSDocPublicTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocPublicTag' as const, pos, end, text, children,
} as KSJSDocPublicTag));

register(ts.SyntaxKind.JSDocPrivateTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocPrivateTag' as const, pos, end, text, children,
} as KSJSDocPrivateTag));

register(ts.SyntaxKind.JSDocProtectedTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocProtectedTag' as const, pos, end, text, children,
} as KSJSDocProtectedTag));

register(ts.SyntaxKind.JSDocReadonlyTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocReadonlyTag' as const, pos, end, text, children,
} as KSJSDocReadonlyTag));

register(ts.SyntaxKind.JSDocOverrideTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocOverrideTag' as const, pos, end, text, children,
} as KSJSDocOverrideTag));

register(ts.SyntaxKind.JSDocCallbackTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocCallbackTag' as const, pos, end, text, children,
} as KSJSDocCallbackTag));

register(ts.SyntaxKind.JSDocOverloadTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocOverloadTag' as const, pos, end, text, children,
} as KSJSDocOverloadTag));

register(ts.SyntaxKind.JSDocEnumTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocEnumTag' as const, pos, end, text, children,
} as KSJSDocEnumTag));

register(ts.SyntaxKind.JSDocParameterTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocParameterTag' as const, pos, end, text, children,
} as KSJSDocParameterTag));

register(ts.SyntaxKind.JSDocReturnTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocReturnTag' as const, pos, end, text, children,
} as KSJSDocReturnTag));

register(ts.SyntaxKind.JSDocThisTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocThisTag' as const, pos, end, text, children,
} as KSJSDocThisTag));

register(ts.SyntaxKind.JSDocTypeTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocTypeTag' as const, pos, end, text, children,
} as KSJSDocTypeTag));

register(ts.SyntaxKind.JSDocTemplateTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocTemplateTag' as const, pos, end, text, children,
} as KSJSDocTemplateTag));

register(ts.SyntaxKind.JSDocTypedefTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocTypedefTag' as const, pos, end, text, children,
} as KSJSDocTypedefTag));

register(ts.SyntaxKind.JSDocSeeTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocSeeTag' as const, pos, end, text, children,
} as KSJSDocSeeTag));

register(ts.SyntaxKind.JSDocPropertyTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocPropertyTag' as const, pos, end, text, children,
} as KSJSDocPropertyTag));

register(ts.SyntaxKind.JSDocThrowsTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocThrowsTag' as const, pos, end, text, children,
} as KSJSDocThrowsTag));

register(ts.SyntaxKind.JSDocSatisfiesTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocSatisfiesTag' as const, pos, end, text, children,
} as KSJSDocSatisfiesTag));

register(ts.SyntaxKind.JSDocImportTag, (node, sf, children, pos, end, text) => ({
  kind: 'JSDocImportTag' as const, pos, end, text, children,
} as KSJSDocImportTag));

register(ts.SyntaxKind.SyntaxList, (node, sf, children, pos, end, text) => ({
  kind: 'SyntaxList' as const, pos, end, text, children,
} as KSSyntaxList));

register(ts.SyntaxKind.NotEmittedStatement, (node, sf, children, pos, end, text) => ({
  kind: 'NotEmittedStatement' as const, pos, end, text, children,
} as KSNotEmittedStatement));

register(ts.SyntaxKind.NotEmittedTypeElement, (node, sf, children, pos, end, text) => ({
  kind: 'NotEmittedTypeElement' as const, pos, end, text, children,
} as KSNotEmittedTypeElement));

register(ts.SyntaxKind.SyntheticExpression, (node, sf, children, pos, end, text) => ({
  kind: 'SyntheticExpression' as const, pos, end, text, children,
} as KSSyntheticExpression));

register(ts.SyntaxKind.SyntheticReferenceExpression, (node, sf, children, pos, end, text) => ({
  kind: 'SyntheticReferenceExpression' as const, pos, end, text, children,
} as KSSyntheticReferenceExpression));

register(ts.SyntaxKind.Bundle, (node, sf, children, pos, end, text) => ({
  kind: 'Bundle' as const, pos, end, text, children,
} as KSBundle));

register(ts.SyntaxKind.ImportTypeAssertionContainer, (node, sf, children, pos, end, text) => ({
  kind: 'ImportTypeAssertionContainer' as const, pos, end, text, children,
} as KSImportTypeAssertionContainer));

// ═══════════════════════════════════════════════════════════════════════
// Generated complex node converters
// ═══════════════════════════════════════════════════════════════════════

register(ts.SyntaxKind.BigIntLiteral, (node, sf, children, pos, end, text) => {
  const n = node as ts.BigIntLiteral;
  return { kind: 'BigIntLiteral' as const, value: n.text ?? '', pos, end, text, children} as KSBigIntLiteral;
});

register(ts.SyntaxKind.RegularExpressionLiteral, (node, sf, children, pos, end, text) => {
  const n = node as ts.RegularExpressionLiteral;
  return { kind: 'RegularExpressionLiteral' as const, value: n.text ?? '', pos, end, text, children} as KSRegularExpressionLiteral;
});

register(ts.SyntaxKind.TemplateHead, (node, sf, children, pos, end, text) => {
  const n = node as ts.TemplateHead;
  return { kind: 'TemplateHead' as const, value: n.text ?? '', pos, end, text, children} as KSTemplateHead;
});

register(ts.SyntaxKind.TemplateMiddle, (node, sf, children, pos, end, text) => {
  const n = node as ts.TemplateMiddle;
  return { kind: 'TemplateMiddle' as const, value: n.text ?? '', pos, end, text, children} as KSTemplateMiddle;
});

register(ts.SyntaxKind.TemplateTail, (node, sf, children, pos, end, text) => {
  const n = node as ts.TemplateTail;
  return { kind: 'TemplateTail' as const, value: n.text ?? '', pos, end, text, children} as KSTemplateTail;
});

register(ts.SyntaxKind.JsxText, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxText;
  return { kind: 'JsxText' as const, value: n.text ?? '', containsOnlyTriviaWhiteSpaces: !!n.containsOnlyTriviaWhiteSpaces, pos, end, text, children} as KSJsxText;
});

register(ts.SyntaxKind.PrivateIdentifier, (node, sf, children, pos, end, text) => {
  const n = node as ts.PrivateIdentifier;
  return { kind: 'PrivateIdentifier' as const, escapedText: n.text ?? '', pos, end, text, children} as KSPrivateIdentifier;
});

register(ts.SyntaxKind.QualifiedName, (node, sf, children, pos, end, text) => {
  const n = node as ts.QualifiedName;
  return { kind: 'QualifiedName' as const, left: findChild(children, n.left)!, right: findChild(children, n.right)!, pos, end, text, children} as KSQualifiedName;
});

register(ts.SyntaxKind.Decorator, (node, sf, children, pos, end, text) => {
  const n = node as ts.Decorator;
  return { kind: 'Decorator' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSDecorator;
});

register(ts.SyntaxKind.MethodSignature, (node, sf, children, pos, end, text) => {
  const n = node as ts.MethodSignature;
  return { kind: 'MethodSignature' as const, name: findChild(children, n.name)!, typeParameters: findChildrenOf(children, n.typeParameters), parameters: findChildrenOf(children, n.parameters), type: findChild(children, n.type), modifiers: extractModifiers(children, n), pos, end, text, children} as KSMethodSignature;
});

register(ts.SyntaxKind.ClassStaticBlockDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.ClassStaticBlockDeclaration;
  return { kind: 'ClassStaticBlockDeclaration' as const, body: findChild(children, n.body)!, modifiers: extractModifiers(children, n as unknown as { modifiers?: ts.NodeArray<ts.ModifierLike> }), pos, end, text, children} as KSClassStaticBlockDeclaration;
});

register(ts.SyntaxKind.CallSignature, (node, sf, children, pos, end, text) => {
  const n = node as ts.CallSignatureDeclaration;
  return { kind: 'CallSignature' as const, typeParameters: findChildrenOf(children, n.typeParameters), parameters: findChildrenOf(children, n.parameters), type: findChild(children, n.type), pos, end, text, children} as KSCallSignature;
});

register(ts.SyntaxKind.ConstructSignature, (node, sf, children, pos, end, text) => {
  const n = node as ts.ConstructSignatureDeclaration;
  return { kind: 'ConstructSignature' as const, typeParameters: findChildrenOf(children, n.typeParameters), parameters: findChildrenOf(children, n.parameters), type: findChild(children, n.type), pos, end, text, children} as KSConstructSignature;
});

register(ts.SyntaxKind.IndexSignature, (node, sf, children, pos, end, text) => {
  const n = node as ts.IndexSignatureDeclaration;
  return { kind: 'IndexSignature' as const, parameters: findChildrenOf(children, n.parameters), type: findChild(children, n.type), modifiers: extractModifiers(children, n), pos, end, text, children} as KSIndexSignature;
});

register(ts.SyntaxKind.TypePredicate, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypePredicateNode;
  return { kind: 'TypePredicate' as const, parameterName: findChild(children, n.parameterName)!, type: findChild(children, n.type), pos, end, text, children} as KSTypePredicate;
});

register(ts.SyntaxKind.ConstructorType, (node, sf, children, pos, end, text) => {
  const n = node as ts.ConstructorTypeNode;
  return { kind: 'ConstructorType' as const, typeParameters: findChildrenOf(children, n.typeParameters), parameters: findChildrenOf(children, n.parameters), type: findChild(children, n.type)!, modifiers: extractModifiers(children, n), pos, end, text, children} as KSConstructorType;
});

register(ts.SyntaxKind.OptionalType, (node, sf, children, pos, end, text) => {
  const n = node as ts.OptionalTypeNode;
  return { kind: 'OptionalType' as const, type: findChild(children, n.type)!, pos, end, text, children} as KSOptionalType;
});

register(ts.SyntaxKind.RestType, (node, sf, children, pos, end, text) => {
  const n = node as ts.RestTypeNode;
  return { kind: 'RestType' as const, type: findChild(children, n.type)!, pos, end, text, children} as KSRestType;
});

register(ts.SyntaxKind.InferType, (node, sf, children, pos, end, text) => {
  const n = node as ts.InferTypeNode;
  return { kind: 'InferType' as const, typeParameter: findChild(children, n.typeParameter)!, pos, end, text, children} as KSInferType;
});

register(ts.SyntaxKind.ParenthesizedType, (node, sf, children, pos, end, text) => {
  const n = node as ts.ParenthesizedTypeNode;
  return { kind: 'ParenthesizedType' as const, type: findChild(children, n.type)!, pos, end, text, children} as KSParenthesizedType;
});

register(ts.SyntaxKind.ThisType, (node, sf, children, pos, end, text) => {
  return { kind: 'ThisType' as const, pos, end, text, children} as KSThisType;
});

register(ts.SyntaxKind.TypeOperator, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypeOperatorNode;
  return { kind: 'TypeOperator' as const, type: findChild(children, n.type)!, operator: n.operator, pos, end, text, children} as KSTypeOperator;
});

register(ts.SyntaxKind.NamedTupleMember, (node, sf, children, pos, end, text) => {
  const n = node as ts.NamedTupleMember;
  return { kind: 'NamedTupleMember' as const, name: findChild(children, n.name)!, type: findChild(children, n.type)!, dotDotDotToken: findChild(children, n.dotDotDotToken), questionToken: findChild(children, n.questionToken), pos, end, text, children} as KSNamedTupleMember;
});

register(ts.SyntaxKind.TemplateLiteralType, (node, sf, children, pos, end, text) => {
  const n = node as ts.TemplateLiteralTypeNode;
  return { kind: 'TemplateLiteralType' as const, head: findChild(children, n.head)!, templateSpans: findChildrenOf(children, n.templateSpans), pos, end, text, children} as KSTemplateLiteralType;
});

register(ts.SyntaxKind.TemplateLiteralTypeSpan, (node, sf, children, pos, end, text) => {
  const n = node as ts.TemplateLiteralTypeSpan;
  return { kind: 'TemplateLiteralTypeSpan' as const, type: findChild(children, n.type)!, literal: findChild(children, n.literal)!, pos, end, text, children} as KSTemplateLiteralTypeSpan;
});

register(ts.SyntaxKind.ImportType, (node, sf, children, pos, end, text) => {
  const n = node as ts.ImportTypeNode;
  return { kind: 'ImportType' as const, argument: findChild(children, n.argument)!, qualifier: findChild(children, n.qualifier), typeArguments: findChildrenOf(children, n.typeArguments), isTypeOf: !!n.isTypeOf, pos, end, text, children} as KSImportType;
});

register(ts.SyntaxKind.ObjectBindingPattern, (node, sf, children, pos, end, text) => {
  const n = node as ts.ObjectBindingPattern;
  return { kind: 'ObjectBindingPattern' as const, elements: findChildrenOf(children, n.elements), pos, end, text, children} as KSObjectBindingPattern;
});

register(ts.SyntaxKind.ArrayBindingPattern, (node, sf, children, pos, end, text) => {
  const n = node as ts.ArrayBindingPattern;
  return { kind: 'ArrayBindingPattern' as const, elements: findChildrenOf(children, n.elements), pos, end, text, children} as KSArrayBindingPattern;
});

register(ts.SyntaxKind.BindingElement, (node, sf, children, pos, end, text) => {
  const n = node as ts.BindingElement;
  return { kind: 'BindingElement' as const, name: findChild(children, n.name)!, propertyName: findChild(children, n.propertyName), initializer: findChild(children, n.initializer), dotDotDotToken: findChild(children, n.dotDotDotToken), pos, end, text, children} as KSBindingElement;
});

register(ts.SyntaxKind.TaggedTemplateExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.TaggedTemplateExpression;
  return { kind: 'TaggedTemplateExpression' as const, tag: findChild(children, n.tag)!, typeArguments: findChildrenOf(children, n.typeArguments), template: findChild(children, n.template)!, pos, end, text, children} as KSTaggedTemplateExpression;
});

register(ts.SyntaxKind.TypeAssertionExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypeAssertion;
  return { kind: 'TypeAssertionExpression' as const, type: findChild(children, n.type)!, expression: findChild(children, n.expression)!, pos, end, text, children} as KSTypeAssertionExpression;
});

register(ts.SyntaxKind.DeleteExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.DeleteExpression;
  return { kind: 'DeleteExpression' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSDeleteExpression;
});

register(ts.SyntaxKind.TypeOfExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.TypeOfExpression;
  return { kind: 'TypeOfExpression' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSTypeOfExpression;
});

register(ts.SyntaxKind.VoidExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.VoidExpression;
  return { kind: 'VoidExpression' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSVoidExpression;
});

register(ts.SyntaxKind.YieldExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.YieldExpression;
  return { kind: 'YieldExpression' as const, expression: findChild(children, n.expression), asteriskToken: findChild(children, n.asteriskToken), pos, end, text, children} as KSYieldExpression;
});

register(ts.SyntaxKind.ClassExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.ClassExpression;
  return { kind: 'ClassExpression' as const, name: findChildAs<KSIdentifier>(children, n.name), typeParameters: findChildrenOf(children, n.typeParameters), members: findChildrenOf(children, n.members), heritageClauses: findChildrenOf(children, n.heritageClauses), modifiers: extractModifiers(children, n), pos, end, text, children} as KSClassExpression;
});

register(ts.SyntaxKind.OmittedExpression, (node, sf, children, pos, end, text) => {
  return { kind: 'OmittedExpression' as const, pos, end, text, children} as KSOmittedExpression;
});

register(ts.SyntaxKind.ExpressionWithTypeArguments, (node, sf, children, pos, end, text) => {
  const n = node as ts.ExpressionWithTypeArguments;
  return { kind: 'ExpressionWithTypeArguments' as const, expression: findChild(children, n.expression)!, typeArguments: findChildrenOf(children, n.typeArguments), pos, end, text, children} as KSExpressionWithTypeArguments;
});

register(ts.SyntaxKind.NonNullExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.NonNullExpression;
  return { kind: 'NonNullExpression' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSNonNullExpression;
});

register(ts.SyntaxKind.MetaProperty, (node, sf, children, pos, end, text) => {
  const n = node as ts.MetaProperty;
  return { kind: 'MetaProperty' as const, name: findChild(children, n.name)!, keywordToken: n.keywordToken, pos, end, text, children} as KSMetaProperty;
});

register(ts.SyntaxKind.SatisfiesExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.SatisfiesExpression;
  return { kind: 'SatisfiesExpression' as const, expression: findChild(children, n.expression)!, type: findChild(children, n.type)!, pos, end, text, children} as KSSatisfiesExpression;
});

register(ts.SyntaxKind.TemplateSpan, (node, sf, children, pos, end, text) => {
  const n = node as ts.TemplateSpan;
  return { kind: 'TemplateSpan' as const, expression: findChild(children, n.expression)!, literal: findChild(children, n.literal)!, pos, end, text, children} as KSTemplateSpan;
});

register(ts.SyntaxKind.SemicolonClassElement, (node, sf, children, pos, end, text) => {
  return { kind: 'SemicolonClassElement' as const, pos, end, text, children} as KSSemicolonClassElement;
});

register(ts.SyntaxKind.EmptyStatement, (node, sf, children, pos, end, text) => {
  return { kind: 'EmptyStatement' as const, pos, end, text, children} as KSEmptyStatement;
});

register(ts.SyntaxKind.ContinueStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.ContinueStatement;
  return { kind: 'ContinueStatement' as const, label: findChild(children, n.label), pos, end, text, children} as KSContinueStatement;
});

register(ts.SyntaxKind.BreakStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.BreakStatement;
  return { kind: 'BreakStatement' as const, label: findChild(children, n.label), pos, end, text, children} as KSBreakStatement;
});

register(ts.SyntaxKind.WithStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.WithStatement;
  return { kind: 'WithStatement' as const, expression: findChild(children, n.expression)!, statement: findChild(children, n.statement)!, pos, end, text, children} as KSWithStatement;
});

register(ts.SyntaxKind.LabeledStatement, (node, sf, children, pos, end, text) => {
  const n = node as ts.LabeledStatement;
  return { kind: 'LabeledStatement' as const, label: findChild(children, n.label)!, statement: findChild(children, n.statement)!, pos, end, text, children} as KSLabeledStatement;
});

register(ts.SyntaxKind.DebuggerStatement, (node, sf, children, pos, end, text) => {
  return { kind: 'DebuggerStatement' as const, pos, end, text, children} as KSDebuggerStatement;
});

register(ts.SyntaxKind.ModuleDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.ModuleDeclaration;
  return { kind: 'ModuleDeclaration' as const, name: findChild(children, n.name)!, body: findChild(children, n.body), modifiers: extractModifiers(children, n), pos, end, text, children} as KSModuleDeclaration;
});

register(ts.SyntaxKind.ModuleBlock, (node, sf, children, pos, end, text) => {
  const n = node as ts.ModuleBlock;
  return { kind: 'ModuleBlock' as const, statements: findChildrenOf(children, n.statements), pos, end, text, children} as KSModuleBlock;
});

register(ts.SyntaxKind.NamespaceExportDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.NamespaceExportDeclaration;
  return { kind: 'NamespaceExportDeclaration' as const, name: findChild(children, n.name)!, pos, end, text, children} as KSNamespaceExportDeclaration;
});

register(ts.SyntaxKind.ImportEqualsDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.ImportEqualsDeclaration;
  return { kind: 'ImportEqualsDeclaration' as const, name: findChild(children, n.name)!, moduleReference: findChild(children, n.moduleReference)!, modifiers: extractModifiers(children, n), isTypeOnly: !!n.isTypeOnly, pos, end, text, children} as KSImportEqualsDeclaration;
});

register(ts.SyntaxKind.NamedExports, (node, sf, children, pos, end, text) => {
  const n = node as ts.NamedExports;
  return { kind: 'NamedExports' as const, elements: findChildrenOf(children, n.elements), pos, end, text, children} as KSNamedExports;
});

register(ts.SyntaxKind.NamespaceExport, (node, sf, children, pos, end, text) => {
  const n = node as ts.NamespaceExport;
  return { kind: 'NamespaceExport' as const, name: findChild(children, n.name)!, pos, end, text, children} as KSNamespaceExport;
});

register(ts.SyntaxKind.ExportSpecifier, (node, sf, children, pos, end, text) => {
  const n = node as ts.ExportSpecifier;
  return { kind: 'ExportSpecifier' as const, name: findChild(children, n.name)!, propertyName: findChild(children, n.propertyName), isTypeOnly: !!n.isTypeOnly, pos, end, text, children} as KSExportSpecifier;
});

register(ts.SyntaxKind.ExternalModuleReference, (node, sf, children, pos, end, text) => {
  const n = node as ts.ExternalModuleReference;
  return { kind: 'ExternalModuleReference' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSExternalModuleReference;
});

register(ts.SyntaxKind.JsxElement, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxElement;
  return { kind: 'JsxElement' as const, openingElement: findChild(children, n.openingElement)!, closingElement: findChild(children, n.closingElement)!, pos, end, text, children} as KSJsxElement;
});

register(ts.SyntaxKind.JsxSelfClosingElement, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxSelfClosingElement;
  return { kind: 'JsxSelfClosingElement' as const, tagName: findChild(children, n.tagName)!, typeArguments: findChildrenOf(children, n.typeArguments), attributes: findChild(children, n.attributes)!, pos, end, text, children} as KSJsxSelfClosingElement;
});

register(ts.SyntaxKind.JsxOpeningElement, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxOpeningElement;
  return { kind: 'JsxOpeningElement' as const, tagName: findChild(children, n.tagName)!, typeArguments: findChildrenOf(children, n.typeArguments), attributes: findChild(children, n.attributes)!, pos, end, text, children} as KSJsxOpeningElement;
});

register(ts.SyntaxKind.JsxClosingElement, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxClosingElement;
  return { kind: 'JsxClosingElement' as const, tagName: findChild(children, n.tagName)!, pos, end, text, children} as KSJsxClosingElement;
});

register(ts.SyntaxKind.JsxFragment, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxFragment;
  return { kind: 'JsxFragment' as const, openingFragment: findChild(children, n.openingFragment)!, closingFragment: findChild(children, n.closingFragment)!, pos, end, text, children} as KSJsxFragment;
});

register(ts.SyntaxKind.JsxOpeningFragment, (node, sf, children, pos, end, text) => {
  return { kind: 'JsxOpeningFragment' as const, pos, end, text, children} as KSJsxOpeningFragment;
});

register(ts.SyntaxKind.JsxClosingFragment, (node, sf, children, pos, end, text) => {
  return { kind: 'JsxClosingFragment' as const, pos, end, text, children} as KSJsxClosingFragment;
});

register(ts.SyntaxKind.JsxAttribute, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxAttribute;
  return { kind: 'JsxAttribute' as const, name: findChild(children, n.name)!, initializer: findChild(children, n.initializer), pos, end, text, children} as KSJsxAttribute;
});

register(ts.SyntaxKind.JsxAttributes, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxAttributes;
  return { kind: 'JsxAttributes' as const, properties: findChildrenOf(children, n.properties), pos, end, text, children} as KSJsxAttributes;
});

register(ts.SyntaxKind.JsxSpreadAttribute, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxSpreadAttribute;
  return { kind: 'JsxSpreadAttribute' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSJsxSpreadAttribute;
});

register(ts.SyntaxKind.JsxExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxExpression;
  return { kind: 'JsxExpression' as const, expression: findChild(children, n.expression), pos, end, text, children} as KSJsxExpression;
});

register(ts.SyntaxKind.JsxNamespacedName, (node, sf, children, pos, end, text) => {
  const n = node as ts.JsxNamespacedName;
  return { kind: 'JsxNamespacedName' as const, namespace: findChild(children, n.namespace)!, name: findChild(children, n.name)!, pos, end, text, children} as KSJsxNamespacedName;
});

register(ts.SyntaxKind.ImportAttributes, (node, sf, children, pos, end, text) => {
  const n = node as ts.ImportAttributes;
  return { kind: 'ImportAttributes' as const, elements: findChildrenOf(children, n.elements), pos, end, text, children} as KSImportAttributes;
});

register(ts.SyntaxKind.ImportAttribute, (node, sf, children, pos, end, text) => {
  const n = node as ts.ImportAttribute;
  return { kind: 'ImportAttribute' as const, name: findChild(children, n.name)!, value: findChild(children, n.value)!, pos, end, text, children} as KSImportAttribute;
});

register(ts.SyntaxKind.SpreadAssignment, (node, sf, children, pos, end, text) => {
  const n = node as ts.SpreadAssignment;
  return { kind: 'SpreadAssignment' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSSpreadAssignment;
});

register(ts.SyntaxKind.JSDocTypeExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocTypeExpression;
  return { kind: 'JSDocTypeExpression' as const, type: findChild(children, n.type)!, pos, end, text, children} as KSJSDocTypeExpression;
});

register(ts.SyntaxKind.JSDocNameReference, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocNameReference;
  return { kind: 'JSDocNameReference' as const, name: findChild(children, n.name)!, pos, end, text, children} as KSJSDocNameReference;
});

register(ts.SyntaxKind.JSDocMemberName, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocMemberName;
  return { kind: 'JSDocMemberName' as const, left: findChild(children, n.left)!, right: findChild(children, n.right)!, pos, end, text, children} as KSJSDocMemberName;
});

register(ts.SyntaxKind.JSDocNullableType, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocNullableType;
  return { kind: 'JSDocNullableType' as const, type: findChild(children, n.type)!, pos, end, text, children} as KSJSDocNullableType;
});

register(ts.SyntaxKind.JSDocNonNullableType, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocNonNullableType;
  return { kind: 'JSDocNonNullableType' as const, type: findChild(children, n.type)!, pos, end, text, children} as KSJSDocNonNullableType;
});

register(ts.SyntaxKind.JSDocOptionalType, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocOptionalType;
  return { kind: 'JSDocOptionalType' as const, type: findChild(children, n.type)!, pos, end, text, children} as KSJSDocOptionalType;
});

register(ts.SyntaxKind.JSDocFunctionType, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocFunctionType;
  return { kind: 'JSDocFunctionType' as const, parameters: findChildrenOf(children, n.parameters), type: findChild(children, n.type), pos, end, text, children} as KSJSDocFunctionType;
});

register(ts.SyntaxKind.JSDocVariadicType, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocVariadicType;
  return { kind: 'JSDocVariadicType' as const, type: findChild(children, n.type)!, pos, end, text, children} as KSJSDocVariadicType;
});

register(ts.SyntaxKind.JSDocTypeLiteral, (node, sf, children, pos, end, text) => {
  const n = node as ts.JSDocTypeLiteral;
  return { kind: 'JSDocTypeLiteral' as const, isArrayType: !!n.isArrayType, pos, end, text, children} as KSJSDocTypeLiteral;
});

register(ts.SyntaxKind.PartiallyEmittedExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.PartiallyEmittedExpression;
  return { kind: 'PartiallyEmittedExpression' as const, expression: findChild(children, n.expression)!, pos, end, text, children} as KSPartiallyEmittedExpression;
});

register(ts.SyntaxKind.CommaListExpression, (node, sf, children, pos, end, text) => {
  const n = node as ts.CommaListExpression;
  return { kind: 'CommaListExpression' as const, elements: findChildrenOf(children, n.elements), pos, end, text, children} as KSCommaListExpression;
});

register(ts.SyntaxKind.MissingDeclaration, (node, sf, children, pos, end, text) => {
  const n = node as ts.MissingDeclaration;
  return { kind: 'MissingDeclaration' as const, modifiers: extractModifiers(children, n as unknown as { modifiers?: ts.NodeArray<ts.ModifierLike> }), pos, end, text, children} as KSMissingDeclaration;
});

