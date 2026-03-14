/**
 * TS AST grammar barrel — Adapter: Grammar<TSNodeKind>
 *
 * Implements the Grammar port for TypeScript AST (364 node kinds).
 *
 * This is the spec-level barrel that consumers (evaluator, user-api, tests)
 * import from. It applies generic grammar utilities to the concrete TS AST
 * schema (NODES, SUM_TYPES) and exports:
 *   - grammar: Grammar<TSNodeKind> — the port-conforming grammar object
 *   - Concrete node types (KSNode, KindToNode, specific KS* interfaces)
 *   - Runtime metadata (fieldDefs, allKinds, type guards, serialization)
 *   - Schema re-exports (NODES, SUM_TYPES)
 */

import type { ASTNode, KSNodeBase, KSCommentRange, ChildFieldDef, PropFieldDef, FieldDef, Grammar, GrammarMetadata, JSONNode, JSONTree, SumTypeDefShape } from '@ksc/grammar';
import {
  createGrammarMetadata,
  getChildren as getChildrenImpl,
  createNode as createNodeImpl,
  nodeToJSON as nodeToJSONImpl,
  nodeFromJSON as nodeFromJSONImpl,
  treeToJSON as treeToJSONImpl,
  treeFromJSON as treeFromJSONImpl,
} from '@ksc/grammar';
import { NODES as NODES_RAW, SUM_TYPES, type TSNodeKind } from './nodes.js';

// Re-export base types
export type { ASTNode, KSNodeBase, KSCommentRange, ChildFieldDef, PropFieldDef, FieldDef, Grammar, GrammarMetadata, JSONNode, JSONTree, AttributeDepGraph } from '@ksc/grammar';
export { type TSNodeKind } from './nodes.js';

// ═══════════════════════════════════════════════════════════════════════
// Grammar metadata factory
// ═══════════════════════════════════════════════════════════════════════

/** Create all runtime metadata for the TS AST grammar. */
export function createTSASTGrammarMetadata(): GrammarMetadata<typeof NODES_RAW> {
  return createGrammarMetadata(NODES_RAW, SUM_TYPES as Record<string, SumTypeDefShape>);
}

/** Create the TS AST grammar object (Grammar port implementation). */
export function createTSASTGrammar(): Grammar<TSNodeKind> {
  const metadata = createTSASTGrammarMetadata();
  return {
    fieldDefs: metadata.fieldDefs,
    allKinds: metadata.allKinds as ReadonlySet<TSNodeKind>,
    fileContainerKind: 'CompilationUnit' as TSNodeKind,
    fileNameField: 'fileName',
    sumTypeMembers: metadata.sumTypeMembers,
    sumTypeMembership: metadata.sumTypeMembership,
  };
}

// ── Deprecated singletons (moved to composition roots in apps/ or local factories) ──

const _grammar = createTSASTGrammarMetadata();

/** Propagated NODES (sum type fields distributed to members). */
export const NODES = _grammar.nodes;
export { SUM_TYPES };

/** Canonical field metadata for all 364 node kinds. */
export const fieldDefs = _grammar.fieldDefs;

/** Set of all node kind strings. */
export const allKinds = _grammar.allKinds;

/** Sum type → member kinds. */
export const sumTypeMembers = _grammar.sumTypeMembers;

/** Kind → sum type names (inverse of sumTypeMembers). */
export const sumTypeMembership = _grammar.sumTypeMembership;

// ═══════════════════════════════════════════════════════════════════════
// Derived functions (bound to fieldDefs)
// ═══════════════════════════════════════════════════════════════════════

export function getChildren(node: KSNode): KSNode[] {
  return getChildrenImpl(node, fieldDefs) as KSNode[];
}

/** Fields accepted by createNode for a given kind. */
export type NodeFields<K extends TSNodeKind> = Partial<Omit<KindToNode[K], keyof KSNodeBase>>;

export function createNode<K extends string & TSNodeKind>(
  kind: K,
  fields?: NodeFields<K>,
): KindToNode[K] {
  return createNodeImpl(kind, fields as Record<string, unknown>, fieldDefs) as KindToNode[K];
}

// ── Type guards ──

/** Check if a node is a member of a given sum type. */
export function isSumTypeMember(node: KSNode, sumType: string): boolean {
  return (sumTypeMembership[node.kind] ?? []).includes(sumType);
}

// ── Serialization ──

export function nodeToJSON(node: KSNode): JSONNode {
  return nodeToJSONImpl(node, fieldDefs);
}

export function nodeFromJSON(data: JSONNode): KSNode {
  return nodeFromJSONImpl(data, fieldDefs) as KSNode;
}

export function treeToJSON(tree: { root: KSNode }): JSONTree {
  return treeToJSONImpl(tree, fieldDefs);
}

export function treeFromJSON(data: JSONTree): { root: KSNode } {
  return treeFromJSONImpl(data, fieldDefs) as { root: KSNode };
}

// ═══════════════════════════════════════════════════════════════════════
// Concrete types — KSNode, KindToNode, specific node interfaces
// ═══════════════════════════════════════════════════════════════════════

/**
 * KSNode — the union type for all TS AST grammar nodes.
 * Uses TSNodeKind (364-member string union) for exhaustiveness checks.
 */
export type KSNode = KSNodeBase & { kind: TSNodeKind };

// ── Specific node interfaces (used by equations.ts for KindCtx narrowing) ──

export interface KSProgram extends KSNodeBase {
  kind: 'Program';
  compilationUnits: KSCompilationUnit[];
}

export interface KSCompilationUnit extends KSNodeBase {
  kind: 'CompilationUnit';
  fileName: string;
  isDeclarationFile: boolean;
  sourceText: string;
  lineStarts: readonly number[];
  languageVariant: 'Standard' | 'JSX';
  statements: KSStatement[];
}

export interface KSIdentifier extends KSNodeBase {
  kind: 'Identifier';
  escapedText: string;
  resolvesToImport: boolean;
  isDefinitionSite: boolean;
  resolvedFileName: string;
  symIsVariable: boolean;
  symIsFunctionScopedVariable: boolean;
  symIsBlockScopedVariable: boolean;
  symIsFunction: boolean;
  symIsClass: boolean;
  symIsInterface: boolean;
  symIsTypeAlias: boolean;
  symIsAlias: boolean;
  symIsProperty: boolean;
  symIsMethod: boolean;
  symIsEnum: boolean;
  symIsEnumMember: boolean;
  symIsNamespace: boolean;
  symIsExportValue: boolean;
  symIsType: boolean;
  symIsValue: boolean;
  importModuleSpecifier: string;
  typeString: string;
}

export interface KSTypeAliasDeclaration extends KSNodeBase {
  kind: 'TypeAliasDeclaration';
  name: KSIdentifier;
  typeParameters: KSNode[];
  type: KSNode;
  modifiers: KSNode[];
  isExported: boolean;
  typeString: string;
}

export interface KSTypeReference extends KSNodeBase {
  kind: 'TypeReference';
  typeName: KSNode;
  typeArguments: KSNode[];
  typeString: string;
}

export interface KSTypeLiteral extends KSNodeBase {
  kind: 'TypeLiteral';
  members: KSNode[];
  typeString: string;
}

export interface KSPropertySignature extends KSNodeBase {
  kind: 'PropertySignature';
  name: KSNode;
  type: KSNode | undefined;
  questionToken: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSIntersectionType extends KSNodeBase {
  kind: 'IntersectionType';
  types: KSNode[];
  typeString: string;
}

export interface KSVariableDeclaration extends KSNodeBase {
  kind: 'VariableDeclaration';
  name: KSNode;
  type: KSNode | undefined;
  initializer: KSNode | undefined;
  exclamationToken: KSNode | undefined;
  typeString: string;
}

export interface KSVariableDeclarationList extends KSNodeBase {
  kind: 'VariableDeclarationList';
  declarations: KSNode[];
  declarationKind: 'var' | 'let' | 'const' | 'using' | 'await using';
}

export interface KSPropertyAccessExpression extends KSNodeBase {
  kind: 'PropertyAccessExpression';
  expression: KSNode;
  name: KSNode;
  questionDotToken: KSNode | undefined;
  typeString: string;
}

export interface KSExpressionStatement extends KSNodeBase {
  kind: 'ExpressionStatement';
  expression: KSNode;
}

export interface KSBinaryExpression extends KSNodeBase {
  kind: 'BinaryExpression';
  left: KSNode;
  operatorToken: KSNode;
  right: KSNode;
  typeString: string;
}

export interface KSPrefixUnaryExpression extends KSNodeBase {
  kind: 'PrefixUnaryExpression';
  operand: KSNode;
  operator: '+' | '-' | '~' | '!' | '++' | '--';
  typeString: string;
}

export interface KSPostfixUnaryExpression extends KSNodeBase {
  kind: 'PostfixUnaryExpression';
  operand: KSNode;
  operator: '++' | '--';
  typeString: string;
}

export interface KSLiteralType extends KSNodeBase {
  kind: 'LiteralType';
  literal: KSNode;
  typeString: string;
}

export interface KSDeleteExpression extends KSNodeBase {
  kind: 'DeleteExpression';
  expression: KSNode;
  typeString: string;
}

export interface KSCallExpression extends KSNodeBase {
  kind: 'CallExpression';
  expression: KSNode;
  typeArguments: KSNode[];
  arguments: KSNode[];
  typeString: string;
}

export interface KSFunctionDeclaration extends KSNodeBase {
  kind: 'FunctionDeclaration';
  name: KSIdentifier | undefined;
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode | undefined;
  modifiers: KSNode[];
  asteriskToken: KSNode | undefined;
  isExported: boolean;
  localCount: number;
  typeString: string;
}

export interface KSVariableStatement extends KSNodeBase {
  kind: 'VariableStatement';
  declarationList: KSVariableDeclarationList;
  modifiers: KSNode[];
  isExported: boolean;
}

export interface KSImportDeclaration extends KSNodeBase {
  kind: 'ImportDeclaration';
  importClause: KSNode | undefined;
  moduleSpecifier: KSNode;
  attributes: KSNode | undefined;
  modifiers: KSNode[];
  resolvedModulePath: string;
}

export interface KSStringLiteral extends KSNodeBase {
  kind: 'StringLiteral';
  value: string;
}

export interface KSArrowFunction extends KSNodeBase {
  kind: 'ArrowFunction';
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  equalsGreaterThanToken: KSNode;
  body: KSNode;
  modifiers: KSNode[];
  localCount: number;
}

export interface KSClassDeclaration extends KSNodeBase {
  kind: 'ClassDeclaration';
  name: KSIdentifier | undefined;
  typeParameters: KSNode[];
  members: KSNode[];
  heritageClauses: KSNode[];
  modifiers: KSNode[];
  isExported: boolean;
  typeString: string;
}

export interface KSBlock extends KSNodeBase {
  kind: 'Block';
  statements: KSNode[];
  localCount: number;
}

export interface KSIfStatement extends KSNodeBase {
  kind: 'IfStatement';
  expression: KSNode;
  thenStatement: KSNode;
  elseStatement: KSNode | undefined;
}

// ── Sum type unions ──

/** Statement union — all nodes with memberOf including 'Statement'. */
export type KSStatement = KSNode & { kind: string };

/** Expression union — all nodes with memberOf including 'Expression'. */
export type KSExpression = KSNode & { kind: string; typeString: string };

// ── KindToNode map ──

/** Maps each AST kind string to its corresponding interface (specific where defined, generic otherwise). */
interface SpecificNodes {
  Program: KSProgram;
  CompilationUnit: KSCompilationUnit;
  Identifier: KSIdentifier;
  TypeAliasDeclaration: KSTypeAliasDeclaration;
  TypeReference: KSTypeReference;
  TypeLiteral: KSTypeLiteral;
  LiteralType: KSLiteralType;
  PropertySignature: KSPropertySignature;
  IntersectionType: KSIntersectionType;
  VariableDeclaration: KSVariableDeclaration;
  VariableDeclarationList: KSVariableDeclarationList;
  PropertyAccessExpression: KSPropertyAccessExpression;
  ExpressionStatement: KSExpressionStatement;
  BinaryExpression: KSBinaryExpression;
  PrefixUnaryExpression: KSPrefixUnaryExpression;
  PostfixUnaryExpression: KSPostfixUnaryExpression;
  DeleteExpression: KSDeleteExpression;
  CallExpression: KSCallExpression;
  FunctionDeclaration: KSFunctionDeclaration;
  VariableStatement: KSVariableStatement;
  ImportDeclaration: KSImportDeclaration;
  StringLiteral: KSStringLiteral;
  ArrowFunction: KSArrowFunction;
  ClassDeclaration: KSClassDeclaration;
  Block: KSBlock;
  IfStatement: KSIfStatement;
}

export type KindToNode = {
  [K in TSNodeKind]: K extends keyof SpecificNodes ? SpecificNodes[K] : KSNode & { kind: K };
};
