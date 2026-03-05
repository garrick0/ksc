/**
 * KSC AST node types — complete mirror of the TypeScript AST.
 *
 * Every ts.SyntaxKind has a specific KS interface — no generic fallback.
 * The tree goes all the way down through expressions, type nodes,
 * identifiers, literals, tokens, keywords, trivia, everything.
 *
 * Architecture:
 * - KSNodeBase: common fields every node shares
 * - ~77 hand-written specific interfaces for nodes we pattern-match on
 * - ~280 generated interfaces for all remaining SyntaxKinds
 * - ALL SyntaxKinds are covered — no KSGenericNode needed
 * - Discriminant field: `kind` (string matching ts.SyntaxKind name)
 *
 * JastAdd grammar equivalent:
 *   Program ::= CompilationUnit*;
 *   CompilationUnit ::= <children via forEachChild>;
 *   ... (every TS SyntaxKind is a production)
 */

// ═══════════════════════════════════════════════════════════════════════
// Base
// ═══════════════════════════════════════════════════════════════════════

/** Fields shared by every KS node (except Program which is synthetic). */
export interface KSNodeBase {
  /** SyntaxKind name string — discriminant for pattern matching. */
  kind: string;
  /** Start position (0-based offset in source text). */
  pos: number;
  /** End position. */
  end: number;
  /** Source text of this node. */
  text: string;
  /** Syntactic children (same as ts.forEachChild order). */
  children: KSNode[];
}

// ═══════════════════════════════════════════════════════════════════════
// Program + CompilationUnit (KSC additions)
// ═══════════════════════════════════════════════════════════════════════

/** Program root. JastAdd: Program ::= CompilationUnit*; */
export interface KSProgram {
  kind: 'Program';
  compilationUnits: KSCompilationUnit[];
  pos: 0;
  end: 0;
  text: '';
  children: KSCompilationUnit[];
}

/** One per source file. JastAdd: CompilationUnit ::= <children>; */
export interface KSCompilationUnit extends KSNodeBase {
  kind: 'CompilationUnit';
  fileName: string;
  isDeclarationFile: boolean;
  sourceText: string;
  lineStarts: readonly number[];
}

// ═══════════════════════════════════════════════════════════════════════
// Declarations
// ═══════════════════════════════════════════════════════════════════════

export interface KSTypeAliasDeclaration extends KSNodeBase {
  kind: 'TypeAliasDeclaration';
  name: KSIdentifier;
  typeParameters: KSNode[];
  type: KSNode;
  modifiers: KSNode[];
}

export interface KSInterfaceDeclaration extends KSNodeBase {
  kind: 'InterfaceDeclaration';
  name: KSIdentifier;
  typeParameters: KSNode[];
  members: KSNode[];
  heritageClauses: KSNode[];
  modifiers: KSNode[];
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
}

export interface KSClassDeclaration extends KSNodeBase {
  kind: 'ClassDeclaration';
  name: KSIdentifier | undefined;
  typeParameters: KSNode[];
  members: KSNode[];
  heritageClauses: KSNode[];
  modifiers: KSNode[];
}

export interface KSEnumDeclaration extends KSNodeBase {
  kind: 'EnumDeclaration';
  name: KSIdentifier;
  members: KSNode[];
  modifiers: KSNode[];
}

export interface KSVariableStatement extends KSNodeBase {
  kind: 'VariableStatement';
  declarationList: KSVariableDeclarationList;
  modifiers: KSNode[];
}

export interface KSVariableDeclarationList extends KSNodeBase {
  kind: 'VariableDeclarationList';
  declarations: KSVariableDeclaration[];
  isConst: boolean;
  isLet: boolean;
}

export interface KSVariableDeclaration extends KSNodeBase {
  kind: 'VariableDeclaration';
  name: KSNode;
  type: KSNode | undefined;
  initializer: KSNode | undefined;
}

// ═══════════════════════════════════════════════════════════════════════
// Import / Export
// ═══════════════════════════════════════════════════════════════════════

export interface KSImportDeclaration extends KSNodeBase {
  kind: 'ImportDeclaration';
  importClause: KSNode | undefined;
  moduleSpecifier: KSNode;
}

export interface KSImportClause extends KSNodeBase {
  kind: 'ImportClause';
  isTypeOnly: boolean;
  name: KSIdentifier | undefined;
  namedBindings: KSNode | undefined;
}

export interface KSNamedImports extends KSNodeBase {
  kind: 'NamedImports';
  elements: KSNode[];
}

export interface KSImportSpecifier extends KSNodeBase {
  kind: 'ImportSpecifier';
  isTypeOnly: boolean;
  name: KSIdentifier;
  propertyName: KSIdentifier | undefined;
}

export interface KSNamespaceImport extends KSNodeBase {
  kind: 'NamespaceImport';
  name: KSIdentifier;
}

export interface KSExportDeclaration extends KSNodeBase {
  kind: 'ExportDeclaration';
  isTypeOnly: boolean;
  exportClause: KSNode | undefined;
  moduleSpecifier: KSNode | undefined;
}

export interface KSExportAssignment extends KSNodeBase {
  kind: 'ExportAssignment';
  expression: KSNode;
  isExportEquals: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Statements
// ═══════════════════════════════════════════════════════════════════════

export interface KSBlock extends KSNodeBase {
  kind: 'Block';
  statements: KSNode[];
}

export interface KSExpressionStatement extends KSNodeBase {
  kind: 'ExpressionStatement';
  expression: KSNode;
}

export interface KSReturnStatement extends KSNodeBase {
  kind: 'ReturnStatement';
  expression: KSNode | undefined;
}

export interface KSIfStatement extends KSNodeBase {
  kind: 'IfStatement';
  expression: KSNode;
  thenStatement: KSNode;
  elseStatement: KSNode | undefined;
}

export interface KSForStatement extends KSNodeBase {
  kind: 'ForStatement';
  initializer: KSNode | undefined;
  condition: KSNode | undefined;
  incrementor: KSNode | undefined;
  statement: KSNode;
}

export interface KSForOfStatement extends KSNodeBase {
  kind: 'ForOfStatement';
  initializer: KSNode;
  expression: KSNode;
  statement: KSNode;
}

export interface KSForInStatement extends KSNodeBase {
  kind: 'ForInStatement';
  initializer: KSNode;
  expression: KSNode;
  statement: KSNode;
}

export interface KSWhileStatement extends KSNodeBase {
  kind: 'WhileStatement';
  expression: KSNode;
  statement: KSNode;
}

export interface KSDoStatement extends KSNodeBase {
  kind: 'DoStatement';
  expression: KSNode;
  statement: KSNode;
}

export interface KSSwitchStatement extends KSNodeBase {
  kind: 'SwitchStatement';
  expression: KSNode;
  caseBlock: KSNode;
}

export interface KSThrowStatement extends KSNodeBase {
  kind: 'ThrowStatement';
  expression: KSNode;
}

export interface KSTryStatement extends KSNodeBase {
  kind: 'TryStatement';
  tryBlock: KSNode;
  catchClause: KSNode | undefined;
  finallyBlock: KSNode | undefined;
}

// ═══════════════════════════════════════════════════════════════════════
// Expressions
// ═══════════════════════════════════════════════════════════════════════

export interface KSCallExpression extends KSNodeBase {
  kind: 'CallExpression';
  expression: KSNode;
  typeArguments: KSNode[];
  arguments: KSNode[];
}

export interface KSPropertyAccessExpression extends KSNodeBase {
  kind: 'PropertyAccessExpression';
  expression: KSNode;
  name: KSIdentifier;
}

export interface KSElementAccessExpression extends KSNodeBase {
  kind: 'ElementAccessExpression';
  expression: KSNode;
  argumentExpression: KSNode;
}

export interface KSBinaryExpression extends KSNodeBase {
  kind: 'BinaryExpression';
  left: KSNode;
  operatorToken: KSNode;
  right: KSNode;
}

export interface KSPrefixUnaryExpression extends KSNodeBase {
  kind: 'PrefixUnaryExpression';
  operand: KSNode;
  operator: number;
}

export interface KSPostfixUnaryExpression extends KSNodeBase {
  kind: 'PostfixUnaryExpression';
  operand: KSNode;
  operator: number;
}

export interface KSArrowFunction extends KSNodeBase {
  kind: 'ArrowFunction';
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode;
  modifiers: KSNode[];
}

export interface KSFunctionExpression extends KSNodeBase {
  kind: 'FunctionExpression';
  name: KSIdentifier | undefined;
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode;
  modifiers: KSNode[];
}

export interface KSObjectLiteralExpression extends KSNodeBase {
  kind: 'ObjectLiteralExpression';
  properties: KSNode[];
}

export interface KSArrayLiteralExpression extends KSNodeBase {
  kind: 'ArrayLiteralExpression';
  elements: KSNode[];
}

export interface KSTemplateExpression extends KSNodeBase {
  kind: 'TemplateExpression';
  head: KSNode;
  templateSpans: KSNode[];
}

export interface KSConditionalExpression extends KSNodeBase {
  kind: 'ConditionalExpression';
  condition: KSNode;
  whenTrue: KSNode;
  whenFalse: KSNode;
}

export interface KSNewExpression extends KSNodeBase {
  kind: 'NewExpression';
  expression: KSNode;
  typeArguments: KSNode[];
  arguments: KSNode[];
}

export interface KSAwaitExpression extends KSNodeBase {
  kind: 'AwaitExpression';
  expression: KSNode;
}

export interface KSSpreadElement extends KSNodeBase {
  kind: 'SpreadElement';
  expression: KSNode;
}

export interface KSAsExpression extends KSNodeBase {
  kind: 'AsExpression';
  expression: KSNode;
  type: KSNode;
}

export interface KSParenthesizedExpression extends KSNodeBase {
  kind: 'ParenthesizedExpression';
  expression: KSNode;
}

// ═══════════════════════════════════════════════════════════════════════
// Type nodes
// ═══════════════════════════════════════════════════════════════════════

export interface KSTypeReferenceNode extends KSNodeBase {
  kind: 'TypeReference';
  typeName: KSNode;
  typeArguments: KSNode[];
}

export interface KSTypeLiteralNode extends KSNodeBase {
  kind: 'TypeLiteral';
  members: KSNode[];
}

export interface KSUnionType extends KSNodeBase {
  kind: 'UnionType';
  types: KSNode[];
}

export interface KSIntersectionType extends KSNodeBase {
  kind: 'IntersectionType';
  types: KSNode[];
}

export interface KSFunctionType extends KSNodeBase {
  kind: 'FunctionType';
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode;
}

export interface KSArrayType extends KSNodeBase {
  kind: 'ArrayType';
  elementType: KSNode;
}

export interface KSTupleType extends KSNodeBase {
  kind: 'TupleType';
  elements: KSNode[];
}

export interface KSLiteralType extends KSNodeBase {
  kind: 'LiteralType';
  literal: KSNode;
}

export interface KSConditionalType extends KSNodeBase {
  kind: 'ConditionalType';
  checkType: KSNode;
  extendsType: KSNode;
  trueType: KSNode;
  falseType: KSNode;
}

export interface KSMappedType extends KSNodeBase {
  kind: 'MappedType';
  typeParameter: KSNode;
  nameType: KSNode | undefined;
  type: KSNode | undefined;
}

export interface KSIndexedAccessType extends KSNodeBase {
  kind: 'IndexedAccessType';
  objectType: KSNode;
  indexType: KSNode;
}

export interface KSTypeQuery extends KSNodeBase {
  kind: 'TypeQuery';
  exprName: KSNode;
}

// ═══════════════════════════════════════════════════════════════════════
// Identifiers and literals
// ═══════════════════════════════════════════════════════════════════════

export interface KSIdentifier extends KSNodeBase {
  kind: 'Identifier';
  escapedText: string;
}

export interface KSStringLiteral extends KSNodeBase {
  kind: 'StringLiteral';
  value: string;
}

export interface KSNumericLiteral extends KSNodeBase {
  kind: 'NumericLiteral';
  value: string;
}

export interface KSNoSubstitutionTemplateLiteral extends KSNodeBase {
  kind: 'NoSubstitutionTemplateLiteral';
  value: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Class / interface members
// ═══════════════════════════════════════════════════════════════════════

export interface KSPropertySignature extends KSNodeBase {
  kind: 'PropertySignature';
  name: KSNode;
  type: KSNode | undefined;
  questionToken: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSPropertyDeclaration extends KSNodeBase {
  kind: 'PropertyDeclaration';
  name: KSNode;
  type: KSNode | undefined;
  initializer: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSMethodDeclaration extends KSNodeBase {
  kind: 'MethodDeclaration';
  name: KSNode;
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSConstructorDeclaration extends KSNodeBase {
  kind: 'Constructor';
  parameters: KSNode[];
  body: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSGetAccessorDeclaration extends KSNodeBase {
  kind: 'GetAccessor';
  name: KSNode;
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSSetAccessorDeclaration extends KSNodeBase {
  kind: 'SetAccessor';
  name: KSNode;
  parameters: KSNode[];
  body: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSParameterNode extends KSNodeBase {
  kind: 'Parameter';
  name: KSNode;
  type: KSNode | undefined;
  initializer: KSNode | undefined;
  dotDotDotToken: KSNode | undefined;
  questionToken: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSTypeParameterNode extends KSNodeBase {
  kind: 'TypeParameter';
  name: KSIdentifier;
  constraint: KSNode | undefined;
  default: KSNode | undefined;
}

// ═══════════════════════════════════════════════════════════════════════
// Other structural nodes
// ═══════════════════════════════════════════════════════════════════════

export interface KSPropertyAssignment extends KSNodeBase {
  kind: 'PropertyAssignment';
  name: KSNode;
  initializer: KSNode;
}

export interface KSShorthandPropertyAssignment extends KSNodeBase {
  kind: 'ShorthandPropertyAssignment';
  name: KSIdentifier;
}

export interface KSComputedPropertyName extends KSNodeBase {
  kind: 'ComputedPropertyName';
  expression: KSNode;
}

export interface KSHeritageClause extends KSNodeBase {
  kind: 'HeritageClause';
  token: number;
  types: KSNode[];
}

export interface KSCatchClause extends KSNodeBase {
  kind: 'CatchClause';
  variableDeclaration: KSNode | undefined;
  block: KSNode;
}

export interface KSCaseBlock extends KSNodeBase {
  kind: 'CaseBlock';
  clauses: KSNode[];
}

export interface KSCaseClause extends KSNodeBase {
  kind: 'CaseClause';
  expression: KSNode;
  statements: KSNode[];
}

export interface KSDefaultClause extends KSNodeBase {
  kind: 'DefaultClause';
  statements: KSNode[];
}

export interface KSEnumMember extends KSNodeBase {
  kind: 'EnumMember';
  name: KSNode;
  initializer: KSNode | undefined;
}

// ═══════════════════════════════════════════════════════════════════════
// Generated leaf node interfaces (tokens, keywords, trivia, simple nodes)
// ═══════════════════════════════════════════════════════════════════════

export interface KSUnknown extends KSNodeBase {
  kind: 'Unknown';
}

export interface KSEndOfFileToken extends KSNodeBase {
  kind: 'EndOfFileToken';
}

export interface KSSingleLineCommentTrivia extends KSNodeBase {
  kind: 'SingleLineCommentTrivia';
}

export interface KSMultiLineCommentTrivia extends KSNodeBase {
  kind: 'MultiLineCommentTrivia';
}

export interface KSNewLineTrivia extends KSNodeBase {
  kind: 'NewLineTrivia';
}

export interface KSWhitespaceTrivia extends KSNodeBase {
  kind: 'WhitespaceTrivia';
}

export interface KSShebangTrivia extends KSNodeBase {
  kind: 'ShebangTrivia';
}

export interface KSConflictMarkerTrivia extends KSNodeBase {
  kind: 'ConflictMarkerTrivia';
}

export interface KSNonTextFileMarkerTrivia extends KSNodeBase {
  kind: 'NonTextFileMarkerTrivia';
}

export interface KSJsxTextAllWhiteSpaces extends KSNodeBase {
  kind: 'JsxTextAllWhiteSpaces';
}

export interface KSOpenBraceToken extends KSNodeBase {
  kind: 'OpenBraceToken';
}

export interface KSCloseBraceToken extends KSNodeBase {
  kind: 'CloseBraceToken';
}

export interface KSOpenParenToken extends KSNodeBase {
  kind: 'OpenParenToken';
}

export interface KSCloseParenToken extends KSNodeBase {
  kind: 'CloseParenToken';
}

export interface KSOpenBracketToken extends KSNodeBase {
  kind: 'OpenBracketToken';
}

export interface KSCloseBracketToken extends KSNodeBase {
  kind: 'CloseBracketToken';
}

export interface KSDotToken extends KSNodeBase {
  kind: 'DotToken';
}

export interface KSDotDotDotToken extends KSNodeBase {
  kind: 'DotDotDotToken';
}

export interface KSSemicolonToken extends KSNodeBase {
  kind: 'SemicolonToken';
}

export interface KSCommaToken extends KSNodeBase {
  kind: 'CommaToken';
}

export interface KSQuestionDotToken extends KSNodeBase {
  kind: 'QuestionDotToken';
}

export interface KSLessThanToken extends KSNodeBase {
  kind: 'LessThanToken';
}

export interface KSLessThanSlashToken extends KSNodeBase {
  kind: 'LessThanSlashToken';
}

export interface KSGreaterThanToken extends KSNodeBase {
  kind: 'GreaterThanToken';
}

export interface KSLessThanEqualsToken extends KSNodeBase {
  kind: 'LessThanEqualsToken';
}

export interface KSGreaterThanEqualsToken extends KSNodeBase {
  kind: 'GreaterThanEqualsToken';
}

export interface KSEqualsEqualsToken extends KSNodeBase {
  kind: 'EqualsEqualsToken';
}

export interface KSExclamationEqualsToken extends KSNodeBase {
  kind: 'ExclamationEqualsToken';
}

export interface KSEqualsEqualsEqualsToken extends KSNodeBase {
  kind: 'EqualsEqualsEqualsToken';
}

export interface KSExclamationEqualsEqualsToken extends KSNodeBase {
  kind: 'ExclamationEqualsEqualsToken';
}

export interface KSEqualsGreaterThanToken extends KSNodeBase {
  kind: 'EqualsGreaterThanToken';
}

export interface KSPlusToken extends KSNodeBase {
  kind: 'PlusToken';
}

export interface KSMinusToken extends KSNodeBase {
  kind: 'MinusToken';
}

export interface KSAsteriskToken extends KSNodeBase {
  kind: 'AsteriskToken';
}

export interface KSAsteriskAsteriskToken extends KSNodeBase {
  kind: 'AsteriskAsteriskToken';
}

export interface KSSlashToken extends KSNodeBase {
  kind: 'SlashToken';
}

export interface KSPercentToken extends KSNodeBase {
  kind: 'PercentToken';
}

export interface KSPlusPlusToken extends KSNodeBase {
  kind: 'PlusPlusToken';
}

export interface KSMinusMinusToken extends KSNodeBase {
  kind: 'MinusMinusToken';
}

export interface KSLessThanLessThanToken extends KSNodeBase {
  kind: 'LessThanLessThanToken';
}

export interface KSGreaterThanGreaterThanToken extends KSNodeBase {
  kind: 'GreaterThanGreaterThanToken';
}

export interface KSGreaterThanGreaterThanGreaterThanToken extends KSNodeBase {
  kind: 'GreaterThanGreaterThanGreaterThanToken';
}

export interface KSAmpersandToken extends KSNodeBase {
  kind: 'AmpersandToken';
}

export interface KSBarToken extends KSNodeBase {
  kind: 'BarToken';
}

export interface KSCaretToken extends KSNodeBase {
  kind: 'CaretToken';
}

export interface KSExclamationToken extends KSNodeBase {
  kind: 'ExclamationToken';
}

export interface KSTildeToken extends KSNodeBase {
  kind: 'TildeToken';
}

export interface KSAmpersandAmpersandToken extends KSNodeBase {
  kind: 'AmpersandAmpersandToken';
}

export interface KSBarBarToken extends KSNodeBase {
  kind: 'BarBarToken';
}

export interface KSQuestionToken extends KSNodeBase {
  kind: 'QuestionToken';
}

export interface KSColonToken extends KSNodeBase {
  kind: 'ColonToken';
}

export interface KSAtToken extends KSNodeBase {
  kind: 'AtToken';
}

export interface KSQuestionQuestionToken extends KSNodeBase {
  kind: 'QuestionQuestionToken';
}

export interface KSBacktickToken extends KSNodeBase {
  kind: 'BacktickToken';
}

export interface KSHashToken extends KSNodeBase {
  kind: 'HashToken';
}

export interface KSEqualsToken extends KSNodeBase {
  kind: 'EqualsToken';
}

export interface KSPlusEqualsToken extends KSNodeBase {
  kind: 'PlusEqualsToken';
}

export interface KSMinusEqualsToken extends KSNodeBase {
  kind: 'MinusEqualsToken';
}

export interface KSAsteriskEqualsToken extends KSNodeBase {
  kind: 'AsteriskEqualsToken';
}

export interface KSAsteriskAsteriskEqualsToken extends KSNodeBase {
  kind: 'AsteriskAsteriskEqualsToken';
}

export interface KSSlashEqualsToken extends KSNodeBase {
  kind: 'SlashEqualsToken';
}

export interface KSPercentEqualsToken extends KSNodeBase {
  kind: 'PercentEqualsToken';
}

export interface KSLessThanLessThanEqualsToken extends KSNodeBase {
  kind: 'LessThanLessThanEqualsToken';
}

export interface KSGreaterThanGreaterThanEqualsToken extends KSNodeBase {
  kind: 'GreaterThanGreaterThanEqualsToken';
}

export interface KSGreaterThanGreaterThanGreaterThanEqualsToken extends KSNodeBase {
  kind: 'GreaterThanGreaterThanGreaterThanEqualsToken';
}

export interface KSAmpersandEqualsToken extends KSNodeBase {
  kind: 'AmpersandEqualsToken';
}

export interface KSBarEqualsToken extends KSNodeBase {
  kind: 'BarEqualsToken';
}

export interface KSBarBarEqualsToken extends KSNodeBase {
  kind: 'BarBarEqualsToken';
}

export interface KSAmpersandAmpersandEqualsToken extends KSNodeBase {
  kind: 'AmpersandAmpersandEqualsToken';
}

export interface KSQuestionQuestionEqualsToken extends KSNodeBase {
  kind: 'QuestionQuestionEqualsToken';
}

export interface KSCaretEqualsToken extends KSNodeBase {
  kind: 'CaretEqualsToken';
}

export interface KSJSDocCommentTextToken extends KSNodeBase {
  kind: 'JSDocCommentTextToken';
}

export interface KSBreakKeyword extends KSNodeBase {
  kind: 'BreakKeyword';
}

export interface KSCaseKeyword extends KSNodeBase {
  kind: 'CaseKeyword';
}

export interface KSCatchKeyword extends KSNodeBase {
  kind: 'CatchKeyword';
}

export interface KSClassKeyword extends KSNodeBase {
  kind: 'ClassKeyword';
}

export interface KSConstKeyword extends KSNodeBase {
  kind: 'ConstKeyword';
}

export interface KSContinueKeyword extends KSNodeBase {
  kind: 'ContinueKeyword';
}

export interface KSDebuggerKeyword extends KSNodeBase {
  kind: 'DebuggerKeyword';
}

export interface KSDefaultKeyword extends KSNodeBase {
  kind: 'DefaultKeyword';
}

export interface KSDeleteKeyword extends KSNodeBase {
  kind: 'DeleteKeyword';
}

export interface KSDoKeyword extends KSNodeBase {
  kind: 'DoKeyword';
}

export interface KSElseKeyword extends KSNodeBase {
  kind: 'ElseKeyword';
}

export interface KSEnumKeyword extends KSNodeBase {
  kind: 'EnumKeyword';
}

export interface KSExportKeyword extends KSNodeBase {
  kind: 'ExportKeyword';
}

export interface KSExtendsKeyword extends KSNodeBase {
  kind: 'ExtendsKeyword';
}

export interface KSFalseKeyword extends KSNodeBase {
  kind: 'FalseKeyword';
}

export interface KSFinallyKeyword extends KSNodeBase {
  kind: 'FinallyKeyword';
}

export interface KSForKeyword extends KSNodeBase {
  kind: 'ForKeyword';
}

export interface KSFunctionKeyword extends KSNodeBase {
  kind: 'FunctionKeyword';
}

export interface KSIfKeyword extends KSNodeBase {
  kind: 'IfKeyword';
}

export interface KSImportKeyword extends KSNodeBase {
  kind: 'ImportKeyword';
}

export interface KSInKeyword extends KSNodeBase {
  kind: 'InKeyword';
}

export interface KSInstanceOfKeyword extends KSNodeBase {
  kind: 'InstanceOfKeyword';
}

export interface KSNewKeyword extends KSNodeBase {
  kind: 'NewKeyword';
}

export interface KSNullKeyword extends KSNodeBase {
  kind: 'NullKeyword';
}

export interface KSReturnKeyword extends KSNodeBase {
  kind: 'ReturnKeyword';
}

export interface KSSuperKeyword extends KSNodeBase {
  kind: 'SuperKeyword';
}

export interface KSSwitchKeyword extends KSNodeBase {
  kind: 'SwitchKeyword';
}

export interface KSThisKeyword extends KSNodeBase {
  kind: 'ThisKeyword';
}

export interface KSThrowKeyword extends KSNodeBase {
  kind: 'ThrowKeyword';
}

export interface KSTrueKeyword extends KSNodeBase {
  kind: 'TrueKeyword';
}

export interface KSTryKeyword extends KSNodeBase {
  kind: 'TryKeyword';
}

export interface KSTypeOfKeyword extends KSNodeBase {
  kind: 'TypeOfKeyword';
}

export interface KSVarKeyword extends KSNodeBase {
  kind: 'VarKeyword';
}

export interface KSVoidKeyword extends KSNodeBase {
  kind: 'VoidKeyword';
}

export interface KSWhileKeyword extends KSNodeBase {
  kind: 'WhileKeyword';
}

export interface KSWithKeyword extends KSNodeBase {
  kind: 'WithKeyword';
}

export interface KSImplementsKeyword extends KSNodeBase {
  kind: 'ImplementsKeyword';
}

export interface KSInterfaceKeyword extends KSNodeBase {
  kind: 'InterfaceKeyword';
}

export interface KSLetKeyword extends KSNodeBase {
  kind: 'LetKeyword';
}

export interface KSPackageKeyword extends KSNodeBase {
  kind: 'PackageKeyword';
}

export interface KSPrivateKeyword extends KSNodeBase {
  kind: 'PrivateKeyword';
}

export interface KSProtectedKeyword extends KSNodeBase {
  kind: 'ProtectedKeyword';
}

export interface KSPublicKeyword extends KSNodeBase {
  kind: 'PublicKeyword';
}

export interface KSStaticKeyword extends KSNodeBase {
  kind: 'StaticKeyword';
}

export interface KSYieldKeyword extends KSNodeBase {
  kind: 'YieldKeyword';
}

export interface KSAbstractKeyword extends KSNodeBase {
  kind: 'AbstractKeyword';
}

export interface KSAccessorKeyword extends KSNodeBase {
  kind: 'AccessorKeyword';
}

export interface KSAsKeyword extends KSNodeBase {
  kind: 'AsKeyword';
}

export interface KSAssertsKeyword extends KSNodeBase {
  kind: 'AssertsKeyword';
}

export interface KSAssertKeyword extends KSNodeBase {
  kind: 'AssertKeyword';
}

export interface KSAnyKeyword extends KSNodeBase {
  kind: 'AnyKeyword';
}

export interface KSAsyncKeyword extends KSNodeBase {
  kind: 'AsyncKeyword';
}

export interface KSAwaitKeyword extends KSNodeBase {
  kind: 'AwaitKeyword';
}

export interface KSBooleanKeyword extends KSNodeBase {
  kind: 'BooleanKeyword';
}

export interface KSConstructorKeyword extends KSNodeBase {
  kind: 'ConstructorKeyword';
}

export interface KSDeclareKeyword extends KSNodeBase {
  kind: 'DeclareKeyword';
}

export interface KSGetKeyword extends KSNodeBase {
  kind: 'GetKeyword';
}

export interface KSInferKeyword extends KSNodeBase {
  kind: 'InferKeyword';
}

export interface KSIntrinsicKeyword extends KSNodeBase {
  kind: 'IntrinsicKeyword';
}

export interface KSIsKeyword extends KSNodeBase {
  kind: 'IsKeyword';
}

export interface KSKeyOfKeyword extends KSNodeBase {
  kind: 'KeyOfKeyword';
}

export interface KSModuleKeyword extends KSNodeBase {
  kind: 'ModuleKeyword';
}

export interface KSNamespaceKeyword extends KSNodeBase {
  kind: 'NamespaceKeyword';
}

export interface KSNeverKeyword extends KSNodeBase {
  kind: 'NeverKeyword';
}

export interface KSOutKeyword extends KSNodeBase {
  kind: 'OutKeyword';
}

export interface KSReadonlyKeyword extends KSNodeBase {
  kind: 'ReadonlyKeyword';
}

export interface KSRequireKeyword extends KSNodeBase {
  kind: 'RequireKeyword';
}

export interface KSNumberKeyword extends KSNodeBase {
  kind: 'NumberKeyword';
}

export interface KSObjectKeyword extends KSNodeBase {
  kind: 'ObjectKeyword';
}

export interface KSSatisfiesKeyword extends KSNodeBase {
  kind: 'SatisfiesKeyword';
}

export interface KSSetKeyword extends KSNodeBase {
  kind: 'SetKeyword';
}

export interface KSStringKeyword extends KSNodeBase {
  kind: 'StringKeyword';
}

export interface KSSymbolKeyword extends KSNodeBase {
  kind: 'SymbolKeyword';
}

export interface KSTypeKeyword extends KSNodeBase {
  kind: 'TypeKeyword';
}

export interface KSUndefinedKeyword extends KSNodeBase {
  kind: 'UndefinedKeyword';
}

export interface KSUniqueKeyword extends KSNodeBase {
  kind: 'UniqueKeyword';
}

export interface KSUnknownKeyword extends KSNodeBase {
  kind: 'UnknownKeyword';
}

export interface KSUsingKeyword extends KSNodeBase {
  kind: 'UsingKeyword';
}

export interface KSFromKeyword extends KSNodeBase {
  kind: 'FromKeyword';
}

export interface KSGlobalKeyword extends KSNodeBase {
  kind: 'GlobalKeyword';
}

export interface KSBigIntKeyword extends KSNodeBase {
  kind: 'BigIntKeyword';
}

export interface KSOverrideKeyword extends KSNodeBase {
  kind: 'OverrideKeyword';
}

export interface KSOfKeyword extends KSNodeBase {
  kind: 'OfKeyword';
}

export interface KSDeferKeyword extends KSNodeBase {
  kind: 'DeferKeyword';
}

export interface KSJSDocAllType extends KSNodeBase {
  kind: 'JSDocAllType';
}

export interface KSJSDocUnknownType extends KSNodeBase {
  kind: 'JSDocUnknownType';
}

export interface KSJSDocNamepathType extends KSNodeBase {
  kind: 'JSDocNamepathType';
}

export interface KSJSDoc extends KSNodeBase {
  kind: 'JSDoc';
}

export interface KSJSDocText extends KSNodeBase {
  kind: 'JSDocText';
}

export interface KSJSDocSignature extends KSNodeBase {
  kind: 'JSDocSignature';
}

export interface KSJSDocLink extends KSNodeBase {
  kind: 'JSDocLink';
}

export interface KSJSDocLinkCode extends KSNodeBase {
  kind: 'JSDocLinkCode';
}

export interface KSJSDocLinkPlain extends KSNodeBase {
  kind: 'JSDocLinkPlain';
}

export interface KSJSDocTag extends KSNodeBase {
  kind: 'JSDocTag';
}

export interface KSJSDocAugmentsTag extends KSNodeBase {
  kind: 'JSDocAugmentsTag';
}

export interface KSJSDocImplementsTag extends KSNodeBase {
  kind: 'JSDocImplementsTag';
}

export interface KSJSDocAuthorTag extends KSNodeBase {
  kind: 'JSDocAuthorTag';
}

export interface KSJSDocDeprecatedTag extends KSNodeBase {
  kind: 'JSDocDeprecatedTag';
}

export interface KSJSDocClassTag extends KSNodeBase {
  kind: 'JSDocClassTag';
}

export interface KSJSDocPublicTag extends KSNodeBase {
  kind: 'JSDocPublicTag';
}

export interface KSJSDocPrivateTag extends KSNodeBase {
  kind: 'JSDocPrivateTag';
}

export interface KSJSDocProtectedTag extends KSNodeBase {
  kind: 'JSDocProtectedTag';
}

export interface KSJSDocReadonlyTag extends KSNodeBase {
  kind: 'JSDocReadonlyTag';
}

export interface KSJSDocOverrideTag extends KSNodeBase {
  kind: 'JSDocOverrideTag';
}

export interface KSJSDocCallbackTag extends KSNodeBase {
  kind: 'JSDocCallbackTag';
}

export interface KSJSDocOverloadTag extends KSNodeBase {
  kind: 'JSDocOverloadTag';
}

export interface KSJSDocEnumTag extends KSNodeBase {
  kind: 'JSDocEnumTag';
}

export interface KSJSDocParameterTag extends KSNodeBase {
  kind: 'JSDocParameterTag';
}

export interface KSJSDocReturnTag extends KSNodeBase {
  kind: 'JSDocReturnTag';
}

export interface KSJSDocThisTag extends KSNodeBase {
  kind: 'JSDocThisTag';
}

export interface KSJSDocTypeTag extends KSNodeBase {
  kind: 'JSDocTypeTag';
}

export interface KSJSDocTemplateTag extends KSNodeBase {
  kind: 'JSDocTemplateTag';
}

export interface KSJSDocTypedefTag extends KSNodeBase {
  kind: 'JSDocTypedefTag';
}

export interface KSJSDocSeeTag extends KSNodeBase {
  kind: 'JSDocSeeTag';
}

export interface KSJSDocPropertyTag extends KSNodeBase {
  kind: 'JSDocPropertyTag';
}

export interface KSJSDocThrowsTag extends KSNodeBase {
  kind: 'JSDocThrowsTag';
}

export interface KSJSDocSatisfiesTag extends KSNodeBase {
  kind: 'JSDocSatisfiesTag';
}

export interface KSJSDocImportTag extends KSNodeBase {
  kind: 'JSDocImportTag';
}

export interface KSSyntaxList extends KSNodeBase {
  kind: 'SyntaxList';
}

export interface KSNotEmittedStatement extends KSNodeBase {
  kind: 'NotEmittedStatement';
}

export interface KSNotEmittedTypeElement extends KSNodeBase {
  kind: 'NotEmittedTypeElement';
}

export interface KSSyntheticExpression extends KSNodeBase {
  kind: 'SyntheticExpression';
}

export interface KSSyntheticReferenceExpression extends KSNodeBase {
  kind: 'SyntheticReferenceExpression';
}

export interface KSBundle extends KSNodeBase {
  kind: 'Bundle';
}

export interface KSImportTypeAssertionContainer extends KSNodeBase {
  kind: 'ImportTypeAssertionContainer';
}

// ═══════════════════════════════════════════════════════════════════════
// Generated complex node interfaces (nodes with named children)
// ═══════════════════════════════════════════════════════════════════════

export interface KSBigIntLiteral extends KSNodeBase {
  kind: 'BigIntLiteral';
  value: string;
}

export interface KSRegularExpressionLiteral extends KSNodeBase {
  kind: 'RegularExpressionLiteral';
  value: string;
}

export interface KSTemplateHead extends KSNodeBase {
  kind: 'TemplateHead';
  value: string;
}

export interface KSTemplateMiddle extends KSNodeBase {
  kind: 'TemplateMiddle';
  value: string;
}

export interface KSTemplateTail extends KSNodeBase {
  kind: 'TemplateTail';
  value: string;
}

export interface KSJsxText extends KSNodeBase {
  kind: 'JsxText';
  value: string;
  containsOnlyTriviaWhiteSpaces: boolean;
}

export interface KSPrivateIdentifier extends KSNodeBase {
  kind: 'PrivateIdentifier';
  escapedText: string;
}

export interface KSQualifiedName extends KSNodeBase {
  kind: 'QualifiedName';
  left: KSNode;
  right: KSNode;
}

export interface KSDecorator extends KSNodeBase {
  kind: 'Decorator';
  expression: KSNode;
}

export interface KSMethodSignature extends KSNodeBase {
  kind: 'MethodSignature';
  name: KSNode;
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSClassStaticBlockDeclaration extends KSNodeBase {
  kind: 'ClassStaticBlockDeclaration';
  body: KSNode;
  modifiers: KSNode[];
}

export interface KSCallSignature extends KSNodeBase {
  kind: 'CallSignature';
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
}

export interface KSConstructSignature extends KSNodeBase {
  kind: 'ConstructSignature';
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
}

export interface KSIndexSignature extends KSNodeBase {
  kind: 'IndexSignature';
  parameters: KSNode[];
  type: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSTypePredicate extends KSNodeBase {
  kind: 'TypePredicate';
  parameterName: KSNode;
  type: KSNode | undefined;
}

export interface KSConstructorType extends KSNodeBase {
  kind: 'ConstructorType';
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode;
  modifiers: KSNode[];
}

export interface KSOptionalType extends KSNodeBase {
  kind: 'OptionalType';
  type: KSNode;
}

export interface KSRestType extends KSNodeBase {
  kind: 'RestType';
  type: KSNode;
}

export interface KSInferType extends KSNodeBase {
  kind: 'InferType';
  typeParameter: KSNode;
}

export interface KSParenthesizedType extends KSNodeBase {
  kind: 'ParenthesizedType';
  type: KSNode;
}

export interface KSThisType extends KSNodeBase {
  kind: 'ThisType';
}

export interface KSTypeOperator extends KSNodeBase {
  kind: 'TypeOperator';
  type: KSNode;
  operator: number;
}

export interface KSNamedTupleMember extends KSNodeBase {
  kind: 'NamedTupleMember';
  name: KSNode;
  type: KSNode;
  dotDotDotToken: KSNode | undefined;
  questionToken: KSNode | undefined;
}

export interface KSTemplateLiteralType extends KSNodeBase {
  kind: 'TemplateLiteralType';
  head: KSNode;
  templateSpans: KSNode[];
}

export interface KSTemplateLiteralTypeSpan extends KSNodeBase {
  kind: 'TemplateLiteralTypeSpan';
  type: KSNode;
  literal: KSNode;
}

export interface KSImportType extends KSNodeBase {
  kind: 'ImportType';
  argument: KSNode;
  qualifier: KSNode | undefined;
  typeArguments: KSNode[];
  isTypeOf: boolean;
}

export interface KSObjectBindingPattern extends KSNodeBase {
  kind: 'ObjectBindingPattern';
  elements: KSNode[];
}

export interface KSArrayBindingPattern extends KSNodeBase {
  kind: 'ArrayBindingPattern';
  elements: KSNode[];
}

export interface KSBindingElement extends KSNodeBase {
  kind: 'BindingElement';
  name: KSNode;
  propertyName: KSNode | undefined;
  initializer: KSNode | undefined;
  dotDotDotToken: KSNode | undefined;
}

export interface KSTaggedTemplateExpression extends KSNodeBase {
  kind: 'TaggedTemplateExpression';
  tag: KSNode;
  typeArguments: KSNode[];
  template: KSNode;
}

export interface KSTypeAssertionExpression extends KSNodeBase {
  kind: 'TypeAssertionExpression';
  type: KSNode;
  expression: KSNode;
}

export interface KSDeleteExpression extends KSNodeBase {
  kind: 'DeleteExpression';
  expression: KSNode;
}

export interface KSTypeOfExpression extends KSNodeBase {
  kind: 'TypeOfExpression';
  expression: KSNode;
}

export interface KSVoidExpression extends KSNodeBase {
  kind: 'VoidExpression';
  expression: KSNode;
}

export interface KSYieldExpression extends KSNodeBase {
  kind: 'YieldExpression';
  expression: KSNode | undefined;
  asteriskToken: KSNode | undefined;
}

export interface KSClassExpression extends KSNodeBase {
  kind: 'ClassExpression';
  name: KSIdentifier | undefined;
  typeParameters: KSNode[];
  members: KSNode[];
  heritageClauses: KSNode[];
  modifiers: KSNode[];
}

export interface KSOmittedExpression extends KSNodeBase {
  kind: 'OmittedExpression';
}

export interface KSExpressionWithTypeArguments extends KSNodeBase {
  kind: 'ExpressionWithTypeArguments';
  expression: KSNode;
  typeArguments: KSNode[];
}

export interface KSNonNullExpression extends KSNodeBase {
  kind: 'NonNullExpression';
  expression: KSNode;
}

export interface KSMetaProperty extends KSNodeBase {
  kind: 'MetaProperty';
  name: KSNode;
  keywordToken: number;
}

export interface KSSatisfiesExpression extends KSNodeBase {
  kind: 'SatisfiesExpression';
  expression: KSNode;
  type: KSNode;
}

export interface KSTemplateSpan extends KSNodeBase {
  kind: 'TemplateSpan';
  expression: KSNode;
  literal: KSNode;
}

export interface KSSemicolonClassElement extends KSNodeBase {
  kind: 'SemicolonClassElement';
}

export interface KSEmptyStatement extends KSNodeBase {
  kind: 'EmptyStatement';
}

export interface KSContinueStatement extends KSNodeBase {
  kind: 'ContinueStatement';
  label: KSNode | undefined;
}

export interface KSBreakStatement extends KSNodeBase {
  kind: 'BreakStatement';
  label: KSNode | undefined;
}

export interface KSWithStatement extends KSNodeBase {
  kind: 'WithStatement';
  expression: KSNode;
  statement: KSNode;
}

export interface KSLabeledStatement extends KSNodeBase {
  kind: 'LabeledStatement';
  label: KSNode;
  statement: KSNode;
}

export interface KSDebuggerStatement extends KSNodeBase {
  kind: 'DebuggerStatement';
}

export interface KSModuleDeclaration extends KSNodeBase {
  kind: 'ModuleDeclaration';
  name: KSNode;
  body: KSNode | undefined;
  modifiers: KSNode[];
}

export interface KSModuleBlock extends KSNodeBase {
  kind: 'ModuleBlock';
  statements: KSNode[];
}

export interface KSNamespaceExportDeclaration extends KSNodeBase {
  kind: 'NamespaceExportDeclaration';
  name: KSNode;
}

export interface KSImportEqualsDeclaration extends KSNodeBase {
  kind: 'ImportEqualsDeclaration';
  name: KSNode;
  moduleReference: KSNode;
  modifiers: KSNode[];
  isTypeOnly: boolean;
}

export interface KSNamedExports extends KSNodeBase {
  kind: 'NamedExports';
  elements: KSNode[];
}

export interface KSNamespaceExport extends KSNodeBase {
  kind: 'NamespaceExport';
  name: KSNode;
}

export interface KSExportSpecifier extends KSNodeBase {
  kind: 'ExportSpecifier';
  name: KSNode;
  propertyName: KSNode | undefined;
  isTypeOnly: boolean;
}

export interface KSExternalModuleReference extends KSNodeBase {
  kind: 'ExternalModuleReference';
  expression: KSNode;
}

export interface KSJsxElement extends KSNodeBase {
  kind: 'JsxElement';
  openingElement: KSNode;
  closingElement: KSNode;
}

export interface KSJsxSelfClosingElement extends KSNodeBase {
  kind: 'JsxSelfClosingElement';
  tagName: KSNode;
  typeArguments: KSNode[];
  attributes: KSNode;
}

export interface KSJsxOpeningElement extends KSNodeBase {
  kind: 'JsxOpeningElement';
  tagName: KSNode;
  typeArguments: KSNode[];
  attributes: KSNode;
}

export interface KSJsxClosingElement extends KSNodeBase {
  kind: 'JsxClosingElement';
  tagName: KSNode;
}

export interface KSJsxFragment extends KSNodeBase {
  kind: 'JsxFragment';
  openingFragment: KSNode;
  closingFragment: KSNode;
}

export interface KSJsxOpeningFragment extends KSNodeBase {
  kind: 'JsxOpeningFragment';
}

export interface KSJsxClosingFragment extends KSNodeBase {
  kind: 'JsxClosingFragment';
}

export interface KSJsxAttribute extends KSNodeBase {
  kind: 'JsxAttribute';
  name: KSNode;
  initializer: KSNode | undefined;
}

export interface KSJsxAttributes extends KSNodeBase {
  kind: 'JsxAttributes';
  properties: KSNode[];
}

export interface KSJsxSpreadAttribute extends KSNodeBase {
  kind: 'JsxSpreadAttribute';
  expression: KSNode;
}

export interface KSJsxExpression extends KSNodeBase {
  kind: 'JsxExpression';
  expression: KSNode | undefined;
}

export interface KSJsxNamespacedName extends KSNodeBase {
  kind: 'JsxNamespacedName';
  namespace: KSNode;
  name: KSNode;
}

export interface KSImportAttributes extends KSNodeBase {
  kind: 'ImportAttributes';
  elements: KSNode[];
}

export interface KSImportAttribute extends KSNodeBase {
  kind: 'ImportAttribute';
  name: KSNode;
  value: KSNode;
}

export interface KSSpreadAssignment extends KSNodeBase {
  kind: 'SpreadAssignment';
  expression: KSNode;
}

export interface KSJSDocTypeExpression extends KSNodeBase {
  kind: 'JSDocTypeExpression';
  type: KSNode;
}

export interface KSJSDocNameReference extends KSNodeBase {
  kind: 'JSDocNameReference';
  name: KSNode;
}

export interface KSJSDocMemberName extends KSNodeBase {
  kind: 'JSDocMemberName';
  left: KSNode;
  right: KSNode;
}

export interface KSJSDocNullableType extends KSNodeBase {
  kind: 'JSDocNullableType';
  type: KSNode;
}

export interface KSJSDocNonNullableType extends KSNodeBase {
  kind: 'JSDocNonNullableType';
  type: KSNode;
}

export interface KSJSDocOptionalType extends KSNodeBase {
  kind: 'JSDocOptionalType';
  type: KSNode;
}

export interface KSJSDocFunctionType extends KSNodeBase {
  kind: 'JSDocFunctionType';
  parameters: KSNode[];
  type: KSNode | undefined;
}

export interface KSJSDocVariadicType extends KSNodeBase {
  kind: 'JSDocVariadicType';
  type: KSNode;
}

export interface KSJSDocTypeLiteral extends KSNodeBase {
  kind: 'JSDocTypeLiteral';
  isArrayType: boolean;
}

export interface KSPartiallyEmittedExpression extends KSNodeBase {
  kind: 'PartiallyEmittedExpression';
  expression: KSNode;
}

export interface KSCommaListExpression extends KSNodeBase {
  kind: 'CommaListExpression';
  elements: KSNode[];
}

export interface KSMissingDeclaration extends KSNodeBase {
  kind: 'MissingDeclaration';
  modifiers: KSNode[];
}

// ═══════════════════════════════════════════════════════════════════════
// Union of all node types — every SyntaxKind is covered
// ═══════════════════════════════════════════════════════════════════════

export type KSNode =
  // KSC additions
  | KSProgram
  | KSCompilationUnit
  // Declarations
  | KSTypeAliasDeclaration
  | KSInterfaceDeclaration
  | KSFunctionDeclaration
  | KSClassDeclaration
  | KSEnumDeclaration
  | KSVariableStatement
  | KSVariableDeclarationList
  | KSVariableDeclaration
  // Imports / Exports
  | KSImportDeclaration
  | KSImportClause
  | KSNamedImports
  | KSImportSpecifier
  | KSNamespaceImport
  | KSExportDeclaration
  | KSExportAssignment
  // Statements
  | KSBlock
  | KSExpressionStatement
  | KSReturnStatement
  | KSIfStatement
  | KSForStatement
  | KSForOfStatement
  | KSForInStatement
  | KSWhileStatement
  | KSDoStatement
  | KSSwitchStatement
  | KSThrowStatement
  | KSTryStatement
  // Expressions
  | KSCallExpression
  | KSPropertyAccessExpression
  | KSElementAccessExpression
  | KSBinaryExpression
  | KSPrefixUnaryExpression
  | KSPostfixUnaryExpression
  | KSArrowFunction
  | KSFunctionExpression
  | KSObjectLiteralExpression
  | KSArrayLiteralExpression
  | KSTemplateExpression
  | KSConditionalExpression
  | KSNewExpression
  | KSAwaitExpression
  | KSSpreadElement
  | KSAsExpression
  | KSParenthesizedExpression
  // Type nodes
  | KSTypeReferenceNode
  | KSTypeLiteralNode
  | KSUnionType
  | KSIntersectionType
  | KSFunctionType
  | KSArrayType
  | KSTupleType
  | KSLiteralType
  | KSConditionalType
  | KSMappedType
  | KSIndexedAccessType
  | KSTypeQuery
  // Identifiers & Literals
  | KSIdentifier
  | KSStringLiteral
  | KSNumericLiteral
  | KSNoSubstitutionTemplateLiteral
  // Members
  | KSPropertySignature
  | KSPropertyDeclaration
  | KSMethodDeclaration
  | KSConstructorDeclaration
  | KSGetAccessorDeclaration
  | KSSetAccessorDeclaration
  | KSParameterNode
  | KSTypeParameterNode
  // Structural
  | KSPropertyAssignment
  | KSShorthandPropertyAssignment
  | KSComputedPropertyName
  | KSHeritageClause
  | KSCatchClause
  | KSCaseBlock
  | KSCaseClause
  | KSDefaultClause
  | KSEnumMember
  // Generated: tokens, keywords, trivia, simple nodes
  | KSUnknown
  | KSEndOfFileToken
  | KSSingleLineCommentTrivia
  | KSMultiLineCommentTrivia
  | KSNewLineTrivia
  | KSWhitespaceTrivia
  | KSShebangTrivia
  | KSConflictMarkerTrivia
  | KSNonTextFileMarkerTrivia
  | KSJsxTextAllWhiteSpaces
  | KSOpenBraceToken
  | KSCloseBraceToken
  | KSOpenParenToken
  | KSCloseParenToken
  | KSOpenBracketToken
  | KSCloseBracketToken
  | KSDotToken
  | KSDotDotDotToken
  | KSSemicolonToken
  | KSCommaToken
  | KSQuestionDotToken
  | KSLessThanToken
  | KSLessThanSlashToken
  | KSGreaterThanToken
  | KSLessThanEqualsToken
  | KSGreaterThanEqualsToken
  | KSEqualsEqualsToken
  | KSExclamationEqualsToken
  | KSEqualsEqualsEqualsToken
  | KSExclamationEqualsEqualsToken
  | KSEqualsGreaterThanToken
  | KSPlusToken
  | KSMinusToken
  | KSAsteriskToken
  | KSAsteriskAsteriskToken
  | KSSlashToken
  | KSPercentToken
  | KSPlusPlusToken
  | KSMinusMinusToken
  | KSLessThanLessThanToken
  | KSGreaterThanGreaterThanToken
  | KSGreaterThanGreaterThanGreaterThanToken
  | KSAmpersandToken
  | KSBarToken
  | KSCaretToken
  | KSExclamationToken
  | KSTildeToken
  | KSAmpersandAmpersandToken
  | KSBarBarToken
  | KSQuestionToken
  | KSColonToken
  | KSAtToken
  | KSQuestionQuestionToken
  | KSBacktickToken
  | KSHashToken
  | KSEqualsToken
  | KSPlusEqualsToken
  | KSMinusEqualsToken
  | KSAsteriskEqualsToken
  | KSAsteriskAsteriskEqualsToken
  | KSSlashEqualsToken
  | KSPercentEqualsToken
  | KSLessThanLessThanEqualsToken
  | KSGreaterThanGreaterThanEqualsToken
  | KSGreaterThanGreaterThanGreaterThanEqualsToken
  | KSAmpersandEqualsToken
  | KSBarEqualsToken
  | KSBarBarEqualsToken
  | KSAmpersandAmpersandEqualsToken
  | KSQuestionQuestionEqualsToken
  | KSCaretEqualsToken
  | KSJSDocCommentTextToken
  | KSBreakKeyword
  | KSCaseKeyword
  | KSCatchKeyword
  | KSClassKeyword
  | KSConstKeyword
  | KSContinueKeyword
  | KSDebuggerKeyword
  | KSDefaultKeyword
  | KSDeleteKeyword
  | KSDoKeyword
  | KSElseKeyword
  | KSEnumKeyword
  | KSExportKeyword
  | KSExtendsKeyword
  | KSFalseKeyword
  | KSFinallyKeyword
  | KSForKeyword
  | KSFunctionKeyword
  | KSIfKeyword
  | KSImportKeyword
  | KSInKeyword
  | KSInstanceOfKeyword
  | KSNewKeyword
  | KSNullKeyword
  | KSReturnKeyword
  | KSSuperKeyword
  | KSSwitchKeyword
  | KSThisKeyword
  | KSThrowKeyword
  | KSTrueKeyword
  | KSTryKeyword
  | KSTypeOfKeyword
  | KSVarKeyword
  | KSVoidKeyword
  | KSWhileKeyword
  | KSWithKeyword
  | KSImplementsKeyword
  | KSInterfaceKeyword
  | KSLetKeyword
  | KSPackageKeyword
  | KSPrivateKeyword
  | KSProtectedKeyword
  | KSPublicKeyword
  | KSStaticKeyword
  | KSYieldKeyword
  | KSAbstractKeyword
  | KSAccessorKeyword
  | KSAsKeyword
  | KSAssertsKeyword
  | KSAssertKeyword
  | KSAnyKeyword
  | KSAsyncKeyword
  | KSAwaitKeyword
  | KSBooleanKeyword
  | KSConstructorKeyword
  | KSDeclareKeyword
  | KSGetKeyword
  | KSInferKeyword
  | KSIntrinsicKeyword
  | KSIsKeyword
  | KSKeyOfKeyword
  | KSModuleKeyword
  | KSNamespaceKeyword
  | KSNeverKeyword
  | KSOutKeyword
  | KSReadonlyKeyword
  | KSRequireKeyword
  | KSNumberKeyword
  | KSObjectKeyword
  | KSSatisfiesKeyword
  | KSSetKeyword
  | KSStringKeyword
  | KSSymbolKeyword
  | KSTypeKeyword
  | KSUndefinedKeyword
  | KSUniqueKeyword
  | KSUnknownKeyword
  | KSUsingKeyword
  | KSFromKeyword
  | KSGlobalKeyword
  | KSBigIntKeyword
  | KSOverrideKeyword
  | KSOfKeyword
  | KSDeferKeyword
  | KSJSDocAllType
  | KSJSDocUnknownType
  | KSJSDocNamepathType
  | KSJSDoc
  | KSJSDocText
  | KSJSDocSignature
  | KSJSDocLink
  | KSJSDocLinkCode
  | KSJSDocLinkPlain
  | KSJSDocTag
  | KSJSDocAugmentsTag
  | KSJSDocImplementsTag
  | KSJSDocAuthorTag
  | KSJSDocDeprecatedTag
  | KSJSDocClassTag
  | KSJSDocPublicTag
  | KSJSDocPrivateTag
  | KSJSDocProtectedTag
  | KSJSDocReadonlyTag
  | KSJSDocOverrideTag
  | KSJSDocCallbackTag
  | KSJSDocOverloadTag
  | KSJSDocEnumTag
  | KSJSDocParameterTag
  | KSJSDocReturnTag
  | KSJSDocThisTag
  | KSJSDocTypeTag
  | KSJSDocTemplateTag
  | KSJSDocTypedefTag
  | KSJSDocSeeTag
  | KSJSDocPropertyTag
  | KSJSDocThrowsTag
  | KSJSDocSatisfiesTag
  | KSJSDocImportTag
  | KSSyntaxList
  | KSNotEmittedStatement
  | KSNotEmittedTypeElement
  | KSSyntheticExpression
  | KSSyntheticReferenceExpression
  | KSBundle
  | KSImportTypeAssertionContainer
  // Generated: complex nodes with named children
  | KSBigIntLiteral
  | KSRegularExpressionLiteral
  | KSTemplateHead
  | KSTemplateMiddle
  | KSTemplateTail
  | KSJsxText
  | KSPrivateIdentifier
  | KSQualifiedName
  | KSDecorator
  | KSMethodSignature
  | KSClassStaticBlockDeclaration
  | KSCallSignature
  | KSConstructSignature
  | KSIndexSignature
  | KSTypePredicate
  | KSConstructorType
  | KSOptionalType
  | KSRestType
  | KSInferType
  | KSParenthesizedType
  | KSThisType
  | KSTypeOperator
  | KSNamedTupleMember
  | KSTemplateLiteralType
  | KSTemplateLiteralTypeSpan
  | KSImportType
  | KSObjectBindingPattern
  | KSArrayBindingPattern
  | KSBindingElement
  | KSTaggedTemplateExpression
  | KSTypeAssertionExpression
  | KSDeleteExpression
  | KSTypeOfExpression
  | KSVoidExpression
  | KSYieldExpression
  | KSClassExpression
  | KSOmittedExpression
  | KSExpressionWithTypeArguments
  | KSNonNullExpression
  | KSMetaProperty
  | KSSatisfiesExpression
  | KSTemplateSpan
  | KSSemicolonClassElement
  | KSEmptyStatement
  | KSContinueStatement
  | KSBreakStatement
  | KSWithStatement
  | KSLabeledStatement
  | KSDebuggerStatement
  | KSModuleDeclaration
  | KSModuleBlock
  | KSNamespaceExportDeclaration
  | KSImportEqualsDeclaration
  | KSNamedExports
  | KSNamespaceExport
  | KSExportSpecifier
  | KSExternalModuleReference
  | KSJsxElement
  | KSJsxSelfClosingElement
  | KSJsxOpeningElement
  | KSJsxClosingElement
  | KSJsxFragment
  | KSJsxOpeningFragment
  | KSJsxClosingFragment
  | KSJsxAttribute
  | KSJsxAttributes
  | KSJsxSpreadAttribute
  | KSJsxExpression
  | KSJsxNamespacedName
  | KSImportAttributes
  | KSImportAttribute
  | KSSpreadAssignment
  | KSJSDocTypeExpression
  | KSJSDocNameReference
  | KSJSDocMemberName
  | KSJSDocNullableType
  | KSJSDocNonNullableType
  | KSJSDocOptionalType
  | KSJSDocFunctionType
  | KSJSDocVariadicType
  | KSJSDocTypeLiteral
  | KSPartiallyEmittedExpression
  | KSCommaListExpression
  | KSMissingDeclaration;

// ═══════════════════════════════════════════════════════════════════════
// Tree child accessor
// ═══════════════════════════════════════════════════════════════════════

/**
 * Child accessor for stampTree.
 *
 * Program → compilationUnits. Everything else → children array
 * (populated during conversion from ts.forEachChild).
 */
export function getChildren(node: KSNode): KSNode[] {
  if (node.kind === 'Program') {
    return (node as KSProgram).compilationUnits;
  }
  return node.children;
}
