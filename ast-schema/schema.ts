/**
 * KSC AST Schema — the single source of truth.
 *
 * Defines all 360 node kinds, their fields, and sum type memberships.
 * This file mirrors TypeScript's AST structure from src/compiler/types.ts.
 *
 * Run `npx tsx ast-schema/codegen.ts` to generate output files.
 */

import {
  sumType, sumTypeIncludes, resolveIncludes, node, leaf,
  child, optChild, list, prop,
} from './builder.js';

// ═══════════════════════════════════════════════════════════════════════
// Sum type declarations (TypeScript's full hierarchy)
// ═══════════════════════════════════════════════════════════════════════

// Expression hierarchy (nested: Primary ⊂ Member ⊂ LeftHandSide ⊂ Update ⊂ Unary ⊂ Expression)
const Expression = sumType('Expression');
const UnaryExpression = sumType('UnaryExpression');
const UpdateExpression = sumType('UpdateExpression');
const LeftHandSideExpression = sumType('LeftHandSideExpression');
const MemberExpression = sumType('MemberExpression');
const PrimaryExpression = sumType('PrimaryExpression');

// Statement
const Statement = sumType('Statement');

// Declaration hierarchy
const Declaration = sumType('Declaration');
const DeclarationStatement = sumType('DeclarationStatement');
const FunctionLikeDeclaration = sumType('FunctionLikeDeclaration');
const ClassLikeDeclaration = sumType('ClassLikeDeclaration');
const ObjectTypeDeclaration = sumType('ObjectTypeDeclaration');
const SignatureDeclaration = sumType('SignatureDeclaration');

// Type nodes
const TypeNode = sumType('TypeNode');

// Members
const ClassElement = sumType('ClassElement');
const TypeElement = sumType('TypeElement');
const ObjectLiteralElement = sumType('ObjectLiteralElement');

// Tokens and keywords
const Token = sumType('Token');
const Keyword = sumType('Keyword');
const Modifier = sumType('Modifier');

// Names and patterns
const BindingPattern = sumType('BindingPattern');
const PropertyName = sumType('PropertyName');

// Literals
const Literal = sumType('Literal');

// JSX
const JsxNode = sumType('JsxNode');

// JSDoc
const JSDocNode = sumType('JSDocNode');

// Names and references
const EntityName = sumType('EntityName');
const BindingName = sumType('BindingName');
const MemberName = sumType('MemberName');

// Module
const ModuleBody = sumType('ModuleBody');
const ModuleName = sumType('ModuleName');
const ModuleReference = sumType('ModuleReference');

// Import/Export bindings
const NamedImportBindings = sumType('NamedImportBindings');
const NamedExportBindings = sumType('NamedExportBindings');

// Switch
const CaseOrDefaultClause = sumType('CaseOrDefaultClause');

// Templates
const TemplateLiteralToken = sumType('TemplateLiteralToken');
const TemplateLiteral = sumType('TemplateLiteral');

// Binding elements
const ArrayBindingElement = sumType('ArrayBindingElement');

// JSX
const JsxAttributeLike = sumType('JsxAttributeLike');
const JsxTagName = sumType('JsxTagName');
const JsxAttributeName = sumType('JsxAttributeName');
const JsxAttributeValue = sumType('JsxAttributeValue');

// JSX children
const JsxChild = sumType('JsxChild');

// Import attributes
const ImportAttributeName = sumType('ImportAttributeName');

// For-loop initializers and arrow function body
const ForInitializer = sumType('ForInitializer');
const ConciseBody = sumType('ConciseBody');

// JSDoc member left-hand side
const JSDocMemberLeft = sumType('JSDocMemberLeft');

// JSDoc typedef type expression
const JSDocTypedefType = sumType('JSDocTypedefType');

// Type predicates
const TypePredicateParameterName = sumType('TypePredicateParameterName');

// ═══════════════════════════════════════════════════════════════════════
// KSC-specific nodes (not in TypeScript)
// ═══════════════════════════════════════════════════════════════════════

node('Program', [], {
  compilationUnits: list('CompilationUnit'),
});

node('CompilationUnit', [], {
  fileName: prop('string'),
  isDeclarationFile: prop('boolean'),
  sourceText: prop('string'),
  lineStarts: prop('readonly number[]'),
  languageVariant: prop("'Standard' | 'JSX'"),
});

// ═══════════════════════════════════════════════════════════════════════
// Identifiers and names
// ═══════════════════════════════════════════════════════════════════════

node('Identifier', [
  PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression,
  UnaryExpression, Expression, Declaration, PropertyName,
  EntityName, BindingName, MemberName, ModuleName, ModuleReference,
  JsxTagName, JsxAttributeName, ImportAttributeName, TypePredicateParameterName,
], {
  escapedText: prop('string'),
  resolvesToImport: prop('boolean'),
});

node('PrivateIdentifier', [PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Expression, PropertyName, MemberName], {
  escapedText: prop('string'),
});

node('QualifiedName', [EntityName, ModuleReference], {
  left: child(EntityName),
  right: child('Identifier'),
});

node('ComputedPropertyName', [PropertyName], {
  expression: child(Expression),
});

// ═══════════════════════════════════════════════════════════════════════
// Declarations
// ═══════════════════════════════════════════════════════════════════════

node('TypeAliasDeclaration', [Statement, Declaration, DeclarationStatement], {
  name: child('Identifier'),
  typeParameters: list('TypeParameter'),
  type: child(TypeNode),
  modifiers: list(Modifier),
});

node('InterfaceDeclaration', [Statement, Declaration, DeclarationStatement, ObjectTypeDeclaration], {
  name: child('Identifier'),
  typeParameters: list('TypeParameter'),
  members: list(TypeElement),
  heritageClauses: list('HeritageClause'),
  modifiers: list(Modifier),
});

node('FunctionDeclaration', [Statement, Declaration, DeclarationStatement, FunctionLikeDeclaration, SignatureDeclaration], {
  name: optChild('Identifier'),
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
  body: optChild('Block'),
  modifiers: list(Modifier),
  asteriskToken: optChild('AsteriskToken'),
});

node('ClassDeclaration', [Statement, Declaration, DeclarationStatement, ClassLikeDeclaration, ObjectTypeDeclaration], {
  name: optChild('Identifier'),
  typeParameters: list('TypeParameter'),
  members: list(ClassElement),
  heritageClauses: list('HeritageClause'),
  modifiers: list(Modifier),
});

node('EnumDeclaration', [Statement, Declaration, DeclarationStatement], {
  name: child('Identifier'),
  members: list('EnumMember'),
  modifiers: list(Modifier),
});

node('ModuleDeclaration', [Statement, Declaration, DeclarationStatement, ModuleBody], {
  name: child(ModuleName),
  body: optChild(ModuleBody),
  modifiers: list(Modifier),
});

node('NamespaceExportDeclaration', [Statement, Declaration, DeclarationStatement], {
  name: child('Identifier'),
  modifiers: list(Modifier),
});

node('ImportEqualsDeclaration', [Statement, Declaration, DeclarationStatement], {
  name: child('Identifier'),
  moduleReference: child(ModuleReference),
  modifiers: list(Modifier),
  isTypeOnly: prop('boolean'),
});

// ═══════════════════════════════════════════════════════════════════════
// Variable declarations
// ═══════════════════════════════════════════════════════════════════════

node('VariableStatement', [Statement], {
  declarationList: child('VariableDeclarationList'),
  modifiers: list(Modifier),
});

node('VariableDeclarationList', [ForInitializer], {
  declarations: list('VariableDeclaration'),
  declarationKind: prop("'var' | 'let' | 'const' | 'using' | 'await using'"),
});

node('VariableDeclaration', [Declaration], {
  name: child(BindingName),
  exclamationToken: optChild('ExclamationToken'),
  type: optChild(TypeNode),
  initializer: optChild(Expression),
});

// ═══════════════════════════════════════════════════════════════════════
// Import / Export
// ═══════════════════════════════════════════════════════════════════════

node('ImportDeclaration', [Statement, Declaration, DeclarationStatement], {
  importClause: optChild('ImportClause'),
  moduleSpecifier: child(Expression),
  attributes: optChild('ImportAttributes'),
  modifiers: list(Modifier),
});

node('ImportClause', [Declaration], {
  isTypeOnly: prop('boolean'),
  name: optChild('Identifier'),
  namedBindings: optChild(NamedImportBindings),
});

node('NamedImports', [NamedImportBindings], {
  elements: list('ImportSpecifier'),
});

node('ImportSpecifier', [Declaration], {
  isTypeOnly: prop('boolean'),
  name: child('Identifier'),
  propertyName: optChild('Identifier'),
});

node('NamespaceImport', [Declaration, NamedImportBindings], {
  name: child('Identifier'),
});

node('ExportDeclaration', [Statement, Declaration, DeclarationStatement], {
  isTypeOnly: prop('boolean'),
  exportClause: optChild(NamedExportBindings),
  moduleSpecifier: optChild(Expression),
  attributes: optChild('ImportAttributes'),
  modifiers: list(Modifier),
});

node('ExportAssignment', [Statement, Declaration, DeclarationStatement], {
  expression: child(Expression),
  isExportEquals: prop('boolean'),
  modifiers: list(Modifier),
});

node('NamedExports', [NamedExportBindings], {
  elements: list('ExportSpecifier'),
});

node('NamespaceExport', [NamedExportBindings], {
  name: child('Identifier'),
});

node('ExportSpecifier', [Declaration], {
  name: child('Identifier'),
  propertyName: optChild('Identifier'),
  isTypeOnly: prop('boolean'),
});

node('ExternalModuleReference', [ModuleReference], {
  expression: child(Expression),
});

node('ImportAttributes', [], {
  elements: list('ImportAttribute'),
});

node('ImportAttribute', [], {
  name: child(ImportAttributeName),
  value: child('StringLiteral'),
});

// ═══════════════════════════════════════════════════════════════════════
// Statements
// ═══════════════════════════════════════════════════════════════════════

node('Block', [Statement, ConciseBody], {
  statements: list(Statement),
});

node('ExpressionStatement', [Statement], {
  expression: child(Expression),
});

node('ReturnStatement', [Statement], {
  expression: optChild(Expression),
});

node('IfStatement', [Statement], {
  expression: child(Expression),
  thenStatement: child(Statement),
  elseStatement: optChild(Statement),
});

node('ForStatement', [Statement], {
  initializer: optChild(ForInitializer),
  condition: optChild(Expression),
  incrementor: optChild(Expression),
  statement: child(Statement),
});

node('ForOfStatement', [Statement], {
  awaitModifier: optChild('AwaitKeyword'),
  initializer: child(ForInitializer),
  expression: child(Expression),
  statement: child(Statement),
});

node('ForInStatement', [Statement], {
  initializer: child(ForInitializer),
  expression: child(Expression),
  statement: child(Statement),
});

node('WhileStatement', [Statement], {
  expression: child(Expression),
  statement: child(Statement),
});

node('DoStatement', [Statement], {
  expression: child(Expression),
  statement: child(Statement),
});

node('SwitchStatement', [Statement], {
  expression: child(Expression),
  caseBlock: child('CaseBlock'),
});

node('ThrowStatement', [Statement], {
  expression: child(Expression),
});

node('TryStatement', [Statement], {
  tryBlock: child('Block'),
  catchClause: optChild('CatchClause'),
  finallyBlock: optChild('Block'),
});

node('ContinueStatement', [Statement], {
  label: optChild('Identifier'),
});

node('BreakStatement', [Statement], {
  label: optChild('Identifier'),
});

node('WithStatement', [Statement], {
  expression: child(Expression),
  statement: child(Statement),
});

node('LabeledStatement', [Statement], {
  label: child('Identifier'),
  statement: child(Statement),
});

// ═══════════════════════════════════════════════════════════════════════
// Switch internals
// ═══════════════════════════════════════════════════════════════════════

node('CaseBlock', [], {
  clauses: list(CaseOrDefaultClause),
});

node('CaseClause', [CaseOrDefaultClause], {
  expression: child(Expression),
  statements: list(Statement),
});

node('DefaultClause', [CaseOrDefaultClause], {
  statements: list(Statement),
});

// ═══════════════════════════════════════════════════════════════════════
// Try internals
// ═══════════════════════════════════════════════════════════════════════

node('CatchClause', [], {
  variableDeclaration: optChild('VariableDeclaration'),
  block: child('Block'),
});

// ═══════════════════════════════════════════════════════════════════════
// Expressions
// ═══════════════════════════════════════════════════════════════════════

node('CallExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression], {
  expression: child(LeftHandSideExpression),
  typeArguments: list(TypeNode),
  arguments: list(Expression),
  questionDotToken: optChild('QuestionDotToken'),
});

node('NewExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression], {
  expression: child(LeftHandSideExpression),
  typeArguments: list(TypeNode),
  arguments: list(Expression),
});

node('TaggedTemplateExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression, MemberExpression], {
  tag: child(LeftHandSideExpression),
  typeArguments: list(TypeNode),
  template: child(TemplateLiteral),
  questionDotToken: optChild('QuestionDotToken'),
});

node('PropertyAccessExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression, MemberExpression, JsxTagName], {
  expression: child(LeftHandSideExpression),
  name: child(MemberName),
  questionDotToken: optChild('QuestionDotToken'),
});

node('ElementAccessExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression, MemberExpression], {
  expression: child(LeftHandSideExpression),
  argumentExpression: child(Expression),
  questionDotToken: optChild('QuestionDotToken'),
});

node('BinaryExpression', [Expression, Declaration], {
  left: child(Expression),
  operatorToken: child(Token),
  right: child(Expression),
});

node('PrefixUnaryExpression', [Expression, UnaryExpression, UpdateExpression], {
  operand: child(UnaryExpression),
  operator: prop("'+' | '-' | '~' | '!' | '++' | '--'"),
});

node('PostfixUnaryExpression', [Expression, UnaryExpression, UpdateExpression], {
  operand: child(LeftHandSideExpression),
  operator: prop("'++' | '--'"),
});

node('ConditionalExpression', [Expression], {
  condition: child(Expression),
  questionToken: child('QuestionToken'),
  whenTrue: child(Expression),
  colonToken: child('ColonToken'),
  whenFalse: child(Expression),
});

node('ArrowFunction', [Expression, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
  equalsGreaterThanToken: child('EqualsGreaterThanToken'),
  body: child(ConciseBody),
  modifiers: list(Modifier),
});

node('FunctionExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
  name: optChild('Identifier'),
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
  body: child('Block'),
  asteriskToken: optChild('AsteriskToken'),
  modifiers: list(Modifier),
});

node('ClassExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Declaration, ClassLikeDeclaration, ObjectTypeDeclaration], {
  name: optChild('Identifier'),
  typeParameters: list('TypeParameter'),
  members: list(ClassElement),
  heritageClauses: list('HeritageClause'),
  modifiers: list(Modifier),
});

node('ObjectLiteralExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Declaration, ObjectTypeDeclaration], {
  properties: list(ObjectLiteralElement),
});

node('ArrayLiteralExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression], {
  elements: list(Expression),
});

node('ParenthesizedExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression], {
  expression: child(Expression),
});

node('TemplateExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, TemplateLiteral], {
  head: child('TemplateHead'),
  templateSpans: list('TemplateSpan'),
});

node('SpreadElement', [Expression], {
  expression: child(Expression),
});

node('AsExpression', [Expression], {
  expression: child(Expression),
  type: child(TypeNode),
});

node('SatisfiesExpression', [Expression], {
  expression: child(Expression),
  type: child(TypeNode),
});

node('NonNullExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression], {
  expression: child(Expression),
});

node('MetaProperty', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression], {
  name: child('Identifier'),
  keywordToken: prop("'new' | 'import'"),
});

node('AwaitExpression', [Expression, UnaryExpression], {
  expression: child(UnaryExpression),
});

node('DeleteExpression', [Expression, UnaryExpression], {
  expression: child(UnaryExpression),
});

node('TypeOfExpression', [Expression, UnaryExpression], {
  expression: child(UnaryExpression),
});

node('VoidExpression', [Expression, UnaryExpression], {
  expression: child(UnaryExpression),
});

node('YieldExpression', [Expression], {
  expression: optChild(Expression),
  asteriskToken: optChild('AsteriskToken'),
});

node('TypeAssertionExpression', [Expression, UnaryExpression], {
  type: child(TypeNode),
  expression: child(UnaryExpression),
});

node('PartiallyEmittedExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression], {
  expression: child(Expression),
});

node('CommaListExpression', [Expression], {
  elements: list(Expression),
});

node('ExpressionWithTypeArguments', [TypeNode], {
  expression: child(Expression),
  typeArguments: list(TypeNode),
});

// ═══════════════════════════════════════════════════════════════════════
// Template internals
// ═══════════════════════════════════════════════════════════════════════

node('TemplateSpan', [], {
  expression: child(Expression),
  literal: child(TemplateLiteralToken),
});

// ═══════════════════════════════════════════════════════════════════════
// Literals
// ═══════════════════════════════════════════════════════════════════════

node('StringLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal, Declaration, PropertyName, ModuleName, ImportAttributeName, JsxAttributeValue], {
  value: prop('string'),
});

node('NumericLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal, Declaration, PropertyName], {
  value: prop('string'),
});

node('BigIntLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal, PropertyName], {
  value: prop('string'),
});

node('RegularExpressionLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal], {
  value: prop('string'),
});

node('NoSubstitutionTemplateLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal, Declaration, TemplateLiteral], {
  value: prop('string'),
});

node('TemplateHead', [Literal], {
  value: prop('string'),
});

node('TemplateMiddle', [Literal, TemplateLiteralToken], {
  value: prop('string'),
});

node('TemplateTail', [Literal, TemplateLiteralToken], {
  value: prop('string'),
});

node('JsxText', [Literal, JsxChild], {
  value: prop('string'),
  containsOnlyTriviaWhiteSpaces: prop('boolean'),
});

// ═══════════════════════════════════════════════════════════════════════
// Class and interface members
// ═══════════════════════════════════════════════════════════════════════

node('PropertyDeclaration', [ClassElement, Declaration], {
  name: child(PropertyName),
  type: optChild(TypeNode),
  initializer: optChild(Expression),
  questionToken: optChild('QuestionToken'),
  exclamationToken: optChild('ExclamationToken'),
  modifiers: list(Modifier),
});

node('MethodDeclaration', [ClassElement, ObjectLiteralElement, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
  name: child(PropertyName),
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
  body: optChild('Block'),
  questionToken: optChild('QuestionToken'),
  asteriskToken: optChild('AsteriskToken'),
  modifiers: list(Modifier),
});

node('Constructor', [ClassElement, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
  parameters: list('Parameter'),
  body: optChild('Block'),
  modifiers: list(Modifier),
});

node('GetAccessor', [ClassElement, TypeElement, ObjectLiteralElement, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
  name: child(PropertyName),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
  body: optChild('Block'),
  modifiers: list(Modifier),
});

node('SetAccessor', [ClassElement, TypeElement, ObjectLiteralElement, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
  name: child(PropertyName),
  parameters: list('Parameter'),
  body: optChild('Block'),
  modifiers: list(Modifier),
});

node('ClassStaticBlockDeclaration', [ClassElement], {
  body: child('Block'),
  modifiers: list(Modifier),
});

node('PropertySignature', [TypeElement, Declaration], {
  name: child(PropertyName),
  type: optChild(TypeNode),
  questionToken: optChild('QuestionToken'),
  modifiers: list(Modifier),
});

node('MethodSignature', [TypeElement, Declaration, SignatureDeclaration], {
  name: child(PropertyName),
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
  questionToken: optChild('QuestionToken'),
  modifiers: list(Modifier),
});

node('CallSignature', [TypeElement, Declaration, SignatureDeclaration], {
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
});

node('ConstructSignature', [TypeElement, Declaration, SignatureDeclaration], {
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
});

node('IndexSignature', [ClassElement, TypeElement, Declaration, SignatureDeclaration], {
  parameters: list('Parameter'),
  type: optChild(TypeNode),
  modifiers: list(Modifier),
});

// ═══════════════════════════════════════════════════════════════════════
// Object literal elements
// ═══════════════════════════════════════════════════════════════════════

node('PropertyAssignment', [ObjectLiteralElement, Declaration], {
  name: child(PropertyName),
  initializer: child(Expression),
  questionToken: optChild('QuestionToken'),
});

node('ShorthandPropertyAssignment', [ObjectLiteralElement, Declaration], {
  name: child('Identifier'),
  objectAssignmentInitializer: optChild(Expression),
  equalsToken: optChild('EqualsToken'),
});

node('SpreadAssignment', [ObjectLiteralElement], {
  expression: child(Expression),
});

// ═══════════════════════════════════════════════════════════════════════
// Parameters and type parameters
// ═══════════════════════════════════════════════════════════════════════

node('Parameter', [Declaration], {
  name: child(BindingName),
  type: optChild(TypeNode),
  initializer: optChild(Expression),
  dotDotDotToken: optChild('DotDotDotToken'),
  questionToken: optChild('QuestionToken'),
  modifiers: list(Modifier),
});

node('TypeParameter', [Declaration], {
  name: child('Identifier'),
  constraint: optChild(TypeNode),
  default: optChild(TypeNode),
  modifiers: list(Modifier),
});

node('Decorator', [], {
  expression: child(LeftHandSideExpression),
});

// ═══════════════════════════════════════════════════════════════════════
// Binding patterns
// ═══════════════════════════════════════════════════════════════════════

node('ObjectBindingPattern', [BindingPattern, BindingName], {
  elements: list('BindingElement'),
});

node('ArrayBindingPattern', [BindingPattern, BindingName], {
  elements: list(ArrayBindingElement),
});

node('BindingElement', [Declaration, ArrayBindingElement], {
  name: child(BindingName),
  propertyName: optChild(PropertyName),
  initializer: optChild(Expression),
  dotDotDotToken: optChild('DotDotDotToken'),
});

// ═══════════════════════════════════════════════════════════════════════
// Heritage
// ═══════════════════════════════════════════════════════════════════════

node('HeritageClause', [], {
  token: prop("'extends' | 'implements'"),
  types: list('ExpressionWithTypeArguments'),
});

node('EnumMember', [Declaration], {
  name: child(PropertyName),
  initializer: optChild(Expression),
});

// ═══════════════════════════════════════════════════════════════════════
// Module internals
// ═══════════════════════════════════════════════════════════════════════

node('ModuleBlock', [ModuleBody], {
  statements: list(Statement),
});

// ═══════════════════════════════════════════════════════════════════════
// Type nodes
// ═══════════════════════════════════════════════════════════════════════

node('TypeReference', [TypeNode], {
  typeName: child(EntityName),
  typeArguments: list(TypeNode),
});

node('TypeLiteral', [TypeNode, Declaration, ObjectTypeDeclaration], {
  members: list(TypeElement),
});

node('UnionType', [TypeNode], {
  types: list(TypeNode),
});

node('IntersectionType', [TypeNode], {
  types: list(TypeNode),
});

node('FunctionType', [TypeNode, Declaration, SignatureDeclaration], {
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: child(TypeNode),
});

node('ConstructorType', [TypeNode, Declaration, SignatureDeclaration], {
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: child(TypeNode),
  modifiers: list(Modifier),
});

node('ArrayType', [TypeNode], {
  elementType: child(TypeNode),
});

node('TupleType', [TypeNode], {
  elements: list(TypeNode),
});

node('NamedTupleMember', [TypeNode, Declaration], {
  name: child('Identifier'),
  type: child(TypeNode),
  dotDotDotToken: optChild('DotDotDotToken'),
  questionToken: optChild('QuestionToken'),
});

node('OptionalType', [TypeNode], {
  type: child(TypeNode),
});

node('RestType', [TypeNode], {
  type: child(TypeNode),
});

node('LiteralType', [TypeNode], {
  literal: child(Expression),
});

node('ConditionalType', [TypeNode], {
  checkType: child(TypeNode),
  extendsType: child(TypeNode),
  trueType: child(TypeNode),
  falseType: child(TypeNode),
});

node('InferType', [TypeNode], {
  typeParameter: child('TypeParameter'),
});

node('ParenthesizedType', [TypeNode], {
  type: child(TypeNode),
});

node('TypeOperator', [TypeNode], {
  type: child(TypeNode),
  operator: prop("'keyof' | 'unique' | 'readonly'"),
});

node('IndexedAccessType', [TypeNode], {
  objectType: child(TypeNode),
  indexType: child(TypeNode),
});

node('MappedType', [TypeNode, Declaration], {
  typeParameter: child('TypeParameter'),
  nameType: optChild(TypeNode),
  type: optChild(TypeNode),
  readonlyToken: optChild(Token),
  questionToken: optChild(Token),
});

node('TypeQuery', [TypeNode], {
  exprName: child(EntityName),
  typeArguments: list(TypeNode),
});

node('TypePredicate', [TypeNode], {
  assertsModifier: optChild('AssertsKeyword'),
  parameterName: child(TypePredicateParameterName),
  type: optChild(TypeNode),
});

node('TemplateLiteralType', [TypeNode], {
  head: child('TemplateHead'),
  templateSpans: list('TemplateLiteralTypeSpan'),
});

node('TemplateLiteralTypeSpan', [TypeNode], {
  type: child(TypeNode),
  literal: child(TemplateLiteralToken),
});

node('ImportType', [TypeNode], {
  argument: child(TypeNode),
  attributes: optChild('ImportAttributes'),
  qualifier: optChild(EntityName),
  typeArguments: list(TypeNode),
  isTypeOf: prop('boolean'),
});

// ═══════════════════════════════════════════════════════════════════════
// JSX nodes
// ═══════════════════════════════════════════════════════════════════════

node('JsxElement', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, JsxNode, JsxAttributeValue, JsxChild], {
  openingElement: child('JsxOpeningElement'),
  jsxChildren: list(JsxChild),
  closingElement: child('JsxClosingElement'),
});

node('JsxSelfClosingElement', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, JsxNode, JsxAttributeValue, JsxChild], {
  tagName: child(JsxTagName),
  typeArguments: list(TypeNode),
  attributes: child('JsxAttributes'),
});

node('JsxOpeningElement', [Expression, JsxNode], {
  tagName: child(JsxTagName),
  typeArguments: list(TypeNode),
  attributes: child('JsxAttributes'),
});

node('JsxClosingElement', [JsxNode], {
  tagName: child(JsxTagName),
});

node('JsxFragment', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, JsxNode, JsxAttributeValue, JsxChild], {
  openingFragment: child('JsxOpeningFragment'),
  jsxChildren: list(JsxChild),
  closingFragment: child('JsxClosingFragment'),
});

node('JsxAttribute', [Declaration, JsxNode, JsxAttributeLike], {
  name: child(JsxAttributeName),
  initializer: optChild(JsxAttributeValue),
});

node('JsxAttributes', [Declaration, JsxNode], {
  properties: list(JsxAttributeLike),
});

node('JsxSpreadAttribute', [JsxNode, JsxAttributeLike], {
  expression: child(Expression),
});

node('JsxExpression', [Expression, JsxNode, JsxAttributeValue, JsxChild], {
  dotDotDotToken: optChild('DotDotDotToken'),
  expression: optChild(Expression),
});

node('JsxNamespacedName', [JsxNode, JsxAttributeName, JsxTagName], {
  namespace: child('Identifier'),
  name: child('Identifier'),
});

// ═══════════════════════════════════════════════════════════════════════
// JSDoc nodes
// ═══════════════════════════════════════════════════════════════════════

node('JSDocTypeExpression', [TypeNode, JSDocNode, JSDocTypedefType], {
  type: child(TypeNode),
});

node('JSDocNameReference', [JSDocNode, JSDocMemberLeft], {
  name: child(EntityName),
});

node('JSDocMemberName', [JSDocNode, JSDocMemberLeft], {
  left: child(JSDocMemberLeft),
  right: child('Identifier'),
});

node('JSDocNullableType', [TypeNode, JSDocNode], {
  type: child(TypeNode),
});

node('JSDocNonNullableType', [TypeNode, JSDocNode], {
  type: child(TypeNode),
});

node('JSDocOptionalType', [TypeNode, JSDocNode], {
  type: child(TypeNode),
});

node('JSDocFunctionType', [TypeNode, Declaration, SignatureDeclaration, JSDocNode], {
  parameters: list('Parameter'),
  type: optChild(TypeNode),
});

node('JSDocVariadicType', [TypeNode, JSDocNode], {
  type: child(TypeNode),
});

node('JSDocTypeLiteral', [TypeNode, JSDocNode, JSDocTypedefType], {
  jsDocPropertyTags: list('JSDocPropertyTag'),
  isArrayType: prop('boolean'),
});

node('MissingDeclaration', [Statement, Declaration, DeclarationStatement], {
  modifiers: list(Modifier),
});

// SourceFile — TS internal, we use CompilationUnit instead but need the kind for coverage
leaf('SourceFile');

// Assert clause (deprecated in newer TS, replaced by ImportAttributes)
node('AssertClause', [], {
  elements: list('AssertEntry'),
});

node('AssertEntry', [], {
  name: child(ImportAttributeName),
  value: child(Expression),
});

// JSDocComment — alias used in some TS versions
leaf('JSDocComment', JSDocNode);

// ═══════════════════════════════════════════════════════════════════════
// Leaf nodes — tokens, keywords, trivia, simple nodes
// Listed individually per design decision.
// ═══════════════════════════════════════════════════════════════════════

// Trivia
leaf('Unknown');
leaf('EndOfFileToken');
leaf('SingleLineCommentTrivia');
leaf('MultiLineCommentTrivia');
leaf('NewLineTrivia');
leaf('WhitespaceTrivia');
leaf('ShebangTrivia');
leaf('ConflictMarkerTrivia');
leaf('NonTextFileMarkerTrivia');
leaf('JsxTextAllWhiteSpaces');

// Punctuation / operator tokens
leaf('OpenBraceToken', Token);
leaf('CloseBraceToken', Token);
leaf('OpenParenToken', Token);
leaf('CloseParenToken', Token);
leaf('OpenBracketToken', Token);
leaf('CloseBracketToken', Token);
leaf('DotToken', Token);
leaf('DotDotDotToken', Token);
leaf('SemicolonToken', Token);
leaf('CommaToken', Token);
leaf('QuestionDotToken', Token);
leaf('LessThanToken', Token);
leaf('LessThanSlashToken', Token);
leaf('GreaterThanToken', Token);
leaf('LessThanEqualsToken', Token);
leaf('GreaterThanEqualsToken', Token);
leaf('EqualsEqualsToken', Token);
leaf('ExclamationEqualsToken', Token);
leaf('EqualsEqualsEqualsToken', Token);
leaf('ExclamationEqualsEqualsToken', Token);
leaf('EqualsGreaterThanToken', Token);
leaf('PlusToken', Token);
leaf('MinusToken', Token);
leaf('AsteriskToken', Token);
leaf('AsteriskAsteriskToken', Token);
leaf('SlashToken', Token);
leaf('PercentToken', Token);
leaf('PlusPlusToken', Token);
leaf('MinusMinusToken', Token);
leaf('LessThanLessThanToken', Token);
leaf('GreaterThanGreaterThanToken', Token);
leaf('GreaterThanGreaterThanGreaterThanToken', Token);
leaf('AmpersandToken', Token);
leaf('BarToken', Token);
leaf('CaretToken', Token);
leaf('ExclamationToken', Token);
leaf('TildeToken', Token);
leaf('AmpersandAmpersandToken', Token);
leaf('BarBarToken', Token);
leaf('QuestionToken', Token);
leaf('ColonToken', Token);
leaf('AtToken', Token);
leaf('QuestionQuestionToken', Token);
leaf('BacktickToken', Token);
leaf('HashToken', Token);

// Assignment tokens
leaf('EqualsToken', Token);
leaf('PlusEqualsToken', Token);
leaf('MinusEqualsToken', Token);
leaf('AsteriskEqualsToken', Token);
leaf('AsteriskAsteriskEqualsToken', Token);
leaf('SlashEqualsToken', Token);
leaf('PercentEqualsToken', Token);
leaf('LessThanLessThanEqualsToken', Token);
leaf('GreaterThanGreaterThanEqualsToken', Token);
leaf('GreaterThanGreaterThanGreaterThanEqualsToken', Token);
leaf('AmpersandEqualsToken', Token);
leaf('BarEqualsToken', Token);
leaf('BarBarEqualsToken', Token);
leaf('AmpersandAmpersandEqualsToken', Token);
leaf('QuestionQuestionEqualsToken', Token);
leaf('CaretEqualsToken', Token);

// JSDoc token
leaf('JSDocCommentTextToken');

// Reserved keywords
leaf('BreakKeyword', Keyword);
leaf('CaseKeyword', Keyword);
leaf('CatchKeyword', Keyword);
leaf('ClassKeyword', Keyword);
leaf('ConstKeyword', Keyword, Modifier);
leaf('ContinueKeyword', Keyword);
leaf('DebuggerKeyword', Keyword);
leaf('DefaultKeyword', Keyword, Modifier);
leaf('DeleteKeyword', Keyword);
leaf('DoKeyword', Keyword);
leaf('ElseKeyword', Keyword);
leaf('EnumKeyword', Keyword);
leaf('ExportKeyword', Keyword, Modifier);
leaf('ExtendsKeyword', Keyword);
leaf('FalseKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal);
leaf('FinallyKeyword', Keyword);
leaf('ForKeyword', Keyword);
leaf('FunctionKeyword', Keyword);
leaf('IfKeyword', Keyword);
leaf('ImportKeyword', Keyword);
leaf('InKeyword', Keyword, Modifier);
leaf('InstanceOfKeyword', Keyword);
leaf('NewKeyword', Keyword);
leaf('NullKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal);
leaf('ReturnKeyword', Keyword);
leaf('SuperKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression);
leaf('SwitchKeyword', Keyword);
leaf('ThisKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, JsxTagName, TypePredicateParameterName);
leaf('ThrowKeyword', Keyword);
leaf('TrueKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal);
leaf('TryKeyword', Keyword);
leaf('TypeOfKeyword', Keyword);
leaf('VarKeyword', Keyword);
leaf('VoidKeyword', Keyword, TypeNode);
leaf('WhileKeyword', Keyword);
leaf('WithKeyword', Keyword);

// Contextual keywords
leaf('ImplementsKeyword', Keyword);
leaf('InterfaceKeyword', Keyword);
leaf('LetKeyword', Keyword);
leaf('PackageKeyword', Keyword);
leaf('PrivateKeyword', Keyword, Modifier);
leaf('ProtectedKeyword', Keyword, Modifier);
leaf('PublicKeyword', Keyword, Modifier);
leaf('StaticKeyword', Keyword, Modifier);
leaf('YieldKeyword', Keyword);
leaf('AbstractKeyword', Keyword, Modifier);
leaf('AccessorKeyword', Keyword, Modifier);
leaf('AsKeyword', Keyword);
leaf('AssertsKeyword', Keyword);
leaf('AssertKeyword', Keyword);
leaf('AnyKeyword', Keyword, TypeNode);
leaf('AsyncKeyword', Keyword, Modifier);
leaf('AwaitKeyword', Keyword);
leaf('BooleanKeyword', Keyword, TypeNode);
leaf('ConstructorKeyword', Keyword);
leaf('DeclareKeyword', Keyword, Modifier);
leaf('GetKeyword', Keyword);
leaf('InferKeyword', Keyword);
leaf('IntrinsicKeyword', Keyword, TypeNode);
leaf('IsKeyword', Keyword);
leaf('KeyOfKeyword', Keyword);
leaf('ModuleKeyword', Keyword);
leaf('NamespaceKeyword', Keyword);
leaf('NeverKeyword', Keyword, TypeNode);
leaf('OutKeyword', Keyword, Modifier);
leaf('ReadonlyKeyword', Keyword, Modifier);
leaf('RequireKeyword', Keyword);
leaf('NumberKeyword', Keyword, TypeNode);
leaf('ObjectKeyword', Keyword, TypeNode);
leaf('SatisfiesKeyword', Keyword);
leaf('SetKeyword', Keyword);
leaf('StringKeyword', Keyword, TypeNode);
leaf('SymbolKeyword', Keyword, TypeNode);
leaf('TypeKeyword', Keyword);
leaf('UndefinedKeyword', Keyword, TypeNode);
leaf('UniqueKeyword', Keyword);
leaf('UnknownKeyword', Keyword, TypeNode);
leaf('UsingKeyword', Keyword);
leaf('FromKeyword', Keyword);
leaf('GlobalKeyword', Keyword);
leaf('BigIntKeyword', Keyword, TypeNode);
leaf('OverrideKeyword', Keyword, Modifier);
leaf('OfKeyword', Keyword);
leaf('DeferKeyword', Keyword);

// JSDoc types (leaf)
leaf('JSDocAllType', TypeNode, JSDocNode);
leaf('JSDocUnknownType', TypeNode, JSDocNode);
leaf('JSDocNamepathType', TypeNode, JSDocNode);

// JSDoc nodes — upgraded from leaf to node where structure exists
node('JSDoc', [JSDocNode], {
  tags: list(JSDocNode),
  comment: prop('string'),
});

leaf('JSDocText', JSDocNode);
node('JSDocSignature', [TypeNode, JSDocNode], {
  typeParameters: list('JSDocTemplateTag'),
  parameters: list('JSDocParameterTag'),
  type: optChild('JSDocReturnTag'),
});
node('JSDocLink', [JSDocNode], {
  name: optChild(EntityName),
  linkText: prop('string'),
});

node('JSDocLinkCode', [JSDocNode], {
  name: optChild(EntityName),
  linkText: prop('string'),
});

node('JSDocLinkPlain', [JSDocNode], {
  name: optChild(EntityName),
  linkText: prop('string'),
});

node('JSDocTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocAugmentsTag', [JSDocNode], {
  tagName: child('Identifier'),
  class: child('ExpressionWithTypeArguments'),
  comment: prop('string'),
});

node('JSDocImplementsTag', [JSDocNode], {
  tagName: child('Identifier'),
  class: child('ExpressionWithTypeArguments'),
  comment: prop('string'),
});

node('JSDocAuthorTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocDeprecatedTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocClassTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocPublicTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocPrivateTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocProtectedTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocReadonlyTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocOverrideTag', [JSDocNode], {
  tagName: child('Identifier'),
  comment: prop('string'),
});

node('JSDocCallbackTag', [JSDocNode], {
  tagName: child('Identifier'),
  fullName: optChild('Identifier'),
  typeExpression: optChild('JSDocSignature'),
  comment: prop('string'),
});

node('JSDocOverloadTag', [JSDocNode], {
  tagName: child('Identifier'),
  typeExpression: child('JSDocSignature'),
  comment: prop('string'),
});

node('JSDocEnumTag', [JSDocNode], {
  tagName: child('Identifier'),
  typeExpression: child('JSDocTypeExpression'),
  comment: prop('string'),
});

node('JSDocParameterTag', [JSDocNode], {
  tagName: child('Identifier'),
  name: child(EntityName),
  typeExpression: optChild('JSDocTypeExpression'),
  isBracketed: prop('boolean'),
  comment: prop('string'),
});

node('JSDocReturnTag', [JSDocNode], {
  tagName: child('Identifier'),
  typeExpression: optChild('JSDocTypeExpression'),
  comment: prop('string'),
});

node('JSDocThisTag', [JSDocNode], {
  tagName: child('Identifier'),
  typeExpression: optChild('JSDocTypeExpression'),
  comment: prop('string'),
});

node('JSDocTypeTag', [JSDocNode], {
  tagName: child('Identifier'),
  typeExpression: child('JSDocTypeExpression'),
  comment: prop('string'),
});

node('JSDocTemplateTag', [JSDocNode], {
  tagName: child('Identifier'),
  typeParameters: list('TypeParameter'),
  constraint: optChild('JSDocTypeExpression'),
  comment: prop('string'),
});

node('JSDocTypedefTag', [JSDocNode], {
  tagName: child('Identifier'),
  fullName: optChild('Identifier'),
  typeExpression: optChild(JSDocTypedefType),
  comment: prop('string'),
});

node('JSDocSeeTag', [JSDocNode], {
  tagName: child('Identifier'),
  name: optChild('JSDocNameReference'),
  comment: prop('string'),
});

node('JSDocPropertyTag', [JSDocNode], {
  tagName: child('Identifier'),
  name: child(EntityName),
  typeExpression: optChild('JSDocTypeExpression'),
  isBracketed: prop('boolean'),
  comment: prop('string'),
});

node('JSDocThrowsTag', [JSDocNode], {
  tagName: child('Identifier'),
  typeExpression: optChild('JSDocTypeExpression'),
  comment: prop('string'),
});

node('JSDocSatisfiesTag', [JSDocNode], {
  tagName: child('Identifier'),
  typeExpression: child('JSDocTypeExpression'),
  comment: prop('string'),
});

node('JSDocImportTag', [JSDocNode], {
  tagName: child('Identifier'),
  importClause: optChild('ImportClause'),
  moduleSpecifier: child(Expression),
  attributes: optChild('ImportAttributes'),
  comment: prop('string'),
});

// Internal / synthetic nodes
leaf('SyntaxList');
leaf('NotEmittedStatement', Statement);
leaf('NotEmittedTypeElement', TypeElement);
leaf('SyntheticExpression', Expression);
leaf('SyntheticReferenceExpression', Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression);
leaf('Bundle');
leaf('ImportTypeAssertionContainer');
leaf('ThisType', TypeNode, TypePredicateParameterName);
leaf('OmittedExpression', Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, ArrayBindingElement);
leaf('SemicolonClassElement', ClassElement);
leaf('EmptyStatement', Statement);
leaf('DebuggerStatement', Statement);
leaf('JsxOpeningFragment', JsxNode);
leaf('JsxClosingFragment', JsxNode);

// ═══════════════════════════════════════════════════════════════════════
// Sum type includes (resolved after all nodes are registered)
// ═══════════════════════════════════════════════════════════════════════

// ForInitializer = VariableDeclarationList | Expression
sumTypeIncludes(ForInitializer, Expression);

// ConciseBody = Block | Expression
sumTypeIncludes(ConciseBody, Expression);

// JSDocMemberLeft = JSDocMemberName | JSDocNameReference (inline, no sum type needed)
// JSDocTypedefType = JSDocTypeExpression | JSDocTypeLiteral (inline, no sum type needed)

resolveIncludes();
