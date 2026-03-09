/**
 * KSC AST Schema — the single source of truth.
 *
 * Defines all 360 node kinds, their fields, and sum type memberships.
 * This file mirrors TypeScript's AST structure from src/compiler/types.ts.
 *
 * Run `npx tsx app/codegen/ts-kind-checking.ts grammar` to generate output files.
 */

import type { GrammarBuilder } from '../../../grammar/builder.js';
import { child, optChild, list, prop } from '../../../grammar/builder.js';

export function defineGrammar(b: GrammarBuilder): void {

  // ═══════════════════════════════════════════════════════════════════════
  // Sum type declarations (TypeScript's full hierarchy)
  // ═══════════════════════════════════════════════════════════════════════

  // Expression hierarchy (nested: Primary ⊂ Member ⊂ LeftHandSide ⊂ Update ⊂ Unary ⊂ Expression)
  const Expression = b.sumType('Expression');
  const UnaryExpression = b.sumType('UnaryExpression');
  const UpdateExpression = b.sumType('UpdateExpression');
  const LeftHandSideExpression = b.sumType('LeftHandSideExpression');
  const MemberExpression = b.sumType('MemberExpression');
  const PrimaryExpression = b.sumType('PrimaryExpression');

  // Statement
  const Statement = b.sumType('Statement');

  // Declaration hierarchy
  const Declaration = b.sumType('Declaration');
  const DeclarationStatement = b.sumType('DeclarationStatement');
  const FunctionLikeDeclaration = b.sumType('FunctionLikeDeclaration');
  const ClassLikeDeclaration = b.sumType('ClassLikeDeclaration');
  const ObjectTypeDeclaration = b.sumType('ObjectTypeDeclaration');
  const SignatureDeclaration = b.sumType('SignatureDeclaration');

  // Type nodes
  const TypeNode = b.sumType('TypeNode');

  // Members
  const ClassElement = b.sumType('ClassElement');
  const TypeElement = b.sumType('TypeElement');
  const ObjectLiteralElement = b.sumType('ObjectLiteralElement');

  // Tokens and keywords
  const Token = b.sumType('Token');
  const Keyword = b.sumType('Keyword');
  const Modifier = b.sumType('Modifier');

  // Names and patterns
  const BindingPattern = b.sumType('BindingPattern');
  const PropertyName = b.sumType('PropertyName');

  // Literals
  const Literal = b.sumType('Literal');

  // JSX
  const JsxNode = b.sumType('JsxNode');

  // JSDoc
  const JSDocNode = b.sumType('JSDocNode');

  // Names and references
  const EntityName = b.sumType('EntityName');
  const BindingName = b.sumType('BindingName');
  const MemberName = b.sumType('MemberName');

  // Module
  const ModuleBody = b.sumType('ModuleBody');
  const ModuleName = b.sumType('ModuleName');
  const ModuleReference = b.sumType('ModuleReference');

  // Import/Export bindings
  const NamedImportBindings = b.sumType('NamedImportBindings');
  const NamedExportBindings = b.sumType('NamedExportBindings');

  // Switch
  const CaseOrDefaultClause = b.sumType('CaseOrDefaultClause');

  // Templates
  const TemplateLiteralToken = b.sumType('TemplateLiteralToken');
  const TemplateLiteral = b.sumType('TemplateLiteral');

  // Binding elements
  const ArrayBindingElement = b.sumType('ArrayBindingElement');

  // JSX
  const JsxAttributeLike = b.sumType('JsxAttributeLike');
  const JsxTagName = b.sumType('JsxTagName');
  const JsxAttributeName = b.sumType('JsxAttributeName');
  const JsxAttributeValue = b.sumType('JsxAttributeValue');

  // JSX children
  const JsxChild = b.sumType('JsxChild');

  // Import attributes
  const ImportAttributeName = b.sumType('ImportAttributeName');

  // For-loop initializers and arrow function body
  const ForInitializer = b.sumType('ForInitializer');
  const ConciseBody = b.sumType('ConciseBody');

  // JSDoc member left-hand side
  const JSDocMemberLeft = b.sumType('JSDocMemberLeft');

  // JSDoc typedef type expression
  const JSDocTypedefType = b.sumType('JSDocTypedefType');

  // Type predicates
  const TypePredicateParameterName = b.sumType('TypePredicateParameterName');

  // ═══════════════════════════════════════════════════════════════════════
  // KSC-specific nodes (not in TypeScript)
  // ═══════════════════════════════════════════════════════════════════════

  b.node('Program', [], {
    compilationUnits: list('CompilationUnit'),
  });

  b.node('CompilationUnit', [], {
    fileName: prop('string'),
    isDeclarationFile: prop('boolean'),
    sourceText: prop('string'),
    lineStarts: prop('readonly number[]'),
    languageVariant: prop("'Standard' | 'JSX'"),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Identifiers and names
  // ═══════════════════════════════════════════════════════════════════════

  b.node('Identifier', [
    PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression,
    UnaryExpression, Expression, Declaration, PropertyName,
    EntityName, BindingName, MemberName, ModuleName, ModuleReference,
    JsxTagName, JsxAttributeName, ImportAttributeName, TypePredicateParameterName,
  ], {
    escapedText: prop('string'),
    resolvesToImport: prop('boolean'),
    isDefinitionSite: prop('boolean'),
    resolvedFileName: prop('string'),
    symIsVariable: prop('boolean'),
    symIsFunctionScopedVariable: prop('boolean'),
    symIsBlockScopedVariable: prop('boolean'),
    symIsFunction: prop('boolean'),
    symIsClass: prop('boolean'),
    symIsInterface: prop('boolean'),
    symIsTypeAlias: prop('boolean'),
    symIsAlias: prop('boolean'),
    symIsProperty: prop('boolean'),
    symIsMethod: prop('boolean'),
    symIsEnum: prop('boolean'),
    symIsEnumMember: prop('boolean'),
    symIsNamespace: prop('boolean'),
    symIsExportValue: prop('boolean'),
    symIsType: prop('boolean'),
    symIsValue: prop('boolean'),
    importModuleSpecifier: prop('string'),
  });

  b.node('PrivateIdentifier', [PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Expression, PropertyName, MemberName], {
    escapedText: prop('string'),
  });

  b.node('QualifiedName', [EntityName, ModuleReference], {
    left: child(EntityName),
    right: child('Identifier'),
  });

  b.node('ComputedPropertyName', [PropertyName], {
    expression: child(Expression),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Declarations
  // ═══════════════════════════════════════════════════════════════════════

  b.node('TypeAliasDeclaration', [Statement, Declaration, DeclarationStatement], {
    name: child('Identifier'),
    typeParameters: list('TypeParameter'),
    type: child(TypeNode),
    modifiers: list(Modifier),
    isExported: prop('boolean'),
  });

  b.node('InterfaceDeclaration', [Statement, Declaration, DeclarationStatement, ObjectTypeDeclaration], {
    name: child('Identifier'),
    typeParameters: list('TypeParameter'),
    members: list(TypeElement),
    heritageClauses: list('HeritageClause'),
    modifiers: list(Modifier),
    isExported: prop('boolean'),
  });

  b.node('FunctionDeclaration', [Statement, Declaration, DeclarationStatement, FunctionLikeDeclaration, SignatureDeclaration], {
    name: optChild('Identifier'),
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: optChild(TypeNode),
    body: optChild('Block'),
    modifiers: list(Modifier),
    asteriskToken: optChild('AsteriskToken'),
    isExported: prop('boolean'),
    localCount: prop('number'),
  });

  b.node('ClassDeclaration', [Statement, Declaration, DeclarationStatement, ClassLikeDeclaration, ObjectTypeDeclaration], {
    name: optChild('Identifier'),
    typeParameters: list('TypeParameter'),
    members: list(ClassElement),
    heritageClauses: list('HeritageClause'),
    modifiers: list(Modifier),
    isExported: prop('boolean'),
  });

  b.node('EnumDeclaration', [Statement, Declaration, DeclarationStatement], {
    name: child('Identifier'),
    members: list('EnumMember'),
    modifiers: list(Modifier),
    isExported: prop('boolean'),
  });

  b.node('ModuleDeclaration', [Statement, Declaration, DeclarationStatement, ModuleBody], {
    name: child(ModuleName),
    body: optChild(ModuleBody),
    modifiers: list(Modifier),
    isExported: prop('boolean'),
  });

  b.node('NamespaceExportDeclaration', [Statement, Declaration, DeclarationStatement], {
    name: child('Identifier'),
    modifiers: list(Modifier),
  });

  b.node('ImportEqualsDeclaration', [Statement, Declaration, DeclarationStatement], {
    name: child('Identifier'),
    moduleReference: child(ModuleReference),
    modifiers: list(Modifier),
    isTypeOnly: prop('boolean'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Variable declarations
  // ═══════════════════════════════════════════════════════════════════════

  b.node('VariableStatement', [Statement], {
    declarationList: child('VariableDeclarationList'),
    modifiers: list(Modifier),
    isExported: prop('boolean'),
  });

  b.node('VariableDeclarationList', [ForInitializer], {
    declarations: list('VariableDeclaration'),
    declarationKind: prop("'var' | 'let' | 'const' | 'using' | 'await using'"),
  });

  b.node('VariableDeclaration', [Declaration], {
    name: child(BindingName),
    exclamationToken: optChild('ExclamationToken'),
    type: optChild(TypeNode),
    initializer: optChild(Expression),
    isExported: prop('boolean'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Import / Export
  // ═══════════════════════════════════════════════════════════════════════

  b.node('ImportDeclaration', [Statement, Declaration, DeclarationStatement], {
    importClause: optChild('ImportClause'),
    moduleSpecifier: child(Expression),
    attributes: optChild('ImportAttributes'),
    modifiers: list(Modifier),
    resolvedModulePath: prop('string'),
  });

  b.node('ImportClause', [Declaration], {
    isTypeOnly: prop('boolean'),
    name: optChild('Identifier'),
    namedBindings: optChild(NamedImportBindings),
  });

  b.node('NamedImports', [NamedImportBindings], {
    elements: list('ImportSpecifier'),
  });

  b.node('ImportSpecifier', [Declaration], {
    isTypeOnly: prop('boolean'),
    name: child('Identifier'),
    propertyName: optChild('Identifier'),
  });

  b.node('NamespaceImport', [Declaration, NamedImportBindings], {
    name: child('Identifier'),
  });

  b.node('ExportDeclaration', [Statement, Declaration, DeclarationStatement], {
    isTypeOnly: prop('boolean'),
    exportClause: optChild(NamedExportBindings),
    moduleSpecifier: optChild(Expression),
    attributes: optChild('ImportAttributes'),
    modifiers: list(Modifier),
  });

  b.node('ExportAssignment', [Statement, Declaration, DeclarationStatement], {
    expression: child(Expression),
    isExportEquals: prop('boolean'),
    modifiers: list(Modifier),
  });

  b.node('NamedExports', [NamedExportBindings], {
    elements: list('ExportSpecifier'),
  });

  b.node('NamespaceExport', [NamedExportBindings], {
    name: child('Identifier'),
  });

  b.node('ExportSpecifier', [Declaration], {
    name: child('Identifier'),
    propertyName: optChild('Identifier'),
    isTypeOnly: prop('boolean'),
  });

  b.node('ExternalModuleReference', [ModuleReference], {
    expression: child(Expression),
  });

  b.node('ImportAttributes', [], {
    elements: list('ImportAttribute'),
  });

  b.node('ImportAttribute', [], {
    name: child(ImportAttributeName),
    value: child('StringLiteral'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Statements
  // ═══════════════════════════════════════════════════════════════════════

  b.node('Block', [Statement, ConciseBody], {
    statements: list(Statement),
    localCount: prop('number'),
  });

  b.node('ExpressionStatement', [Statement], {
    expression: child(Expression),
  });

  b.node('ReturnStatement', [Statement], {
    expression: optChild(Expression),
  });

  b.node('IfStatement', [Statement], {
    expression: child(Expression),
    thenStatement: child(Statement),
    elseStatement: optChild(Statement),
  });

  b.node('ForStatement', [Statement], {
    initializer: optChild(ForInitializer),
    condition: optChild(Expression),
    incrementor: optChild(Expression),
    statement: child(Statement),
    localCount: prop('number'),
  });

  b.node('ForOfStatement', [Statement], {
    awaitModifier: optChild('AwaitKeyword'),
    initializer: child(ForInitializer),
    expression: child(Expression),
    statement: child(Statement),
    localCount: prop('number'),
  });

  b.node('ForInStatement', [Statement], {
    initializer: child(ForInitializer),
    expression: child(Expression),
    statement: child(Statement),
    localCount: prop('number'),
  });

  b.node('WhileStatement', [Statement], {
    expression: child(Expression),
    statement: child(Statement),
  });

  b.node('DoStatement', [Statement], {
    expression: child(Expression),
    statement: child(Statement),
  });

  b.node('SwitchStatement', [Statement], {
    expression: child(Expression),
    caseBlock: child('CaseBlock'),
  });

  b.node('ThrowStatement', [Statement], {
    expression: child(Expression),
  });

  b.node('TryStatement', [Statement], {
    tryBlock: child('Block'),
    catchClause: optChild('CatchClause'),
    finallyBlock: optChild('Block'),
  });

  b.node('ContinueStatement', [Statement], {
    label: optChild('Identifier'),
  });

  b.node('BreakStatement', [Statement], {
    label: optChild('Identifier'),
  });

  b.node('WithStatement', [Statement], {
    expression: child(Expression),
    statement: child(Statement),
  });

  b.node('LabeledStatement', [Statement], {
    label: child('Identifier'),
    statement: child(Statement),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Switch internals
  // ═══════════════════════════════════════════════════════════════════════

  b.node('CaseBlock', [], {
    clauses: list(CaseOrDefaultClause),
  });

  b.node('CaseClause', [CaseOrDefaultClause], {
    expression: child(Expression),
    statements: list(Statement),
    localCount: prop('number'),
  });

  b.node('DefaultClause', [CaseOrDefaultClause], {
    statements: list(Statement),
    localCount: prop('number'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Try internals
  // ═══════════════════════════════════════════════════════════════════════

  b.node('CatchClause', [], {
    variableDeclaration: optChild('VariableDeclaration'),
    block: child('Block'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Expressions
  // ═══════════════════════════════════════════════════════════════════════

  b.node('CallExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression], {
    expression: child(LeftHandSideExpression),
    typeArguments: list(TypeNode),
    arguments: list(Expression),
    questionDotToken: optChild('QuestionDotToken'),
  });

  b.node('NewExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression], {
    expression: child(LeftHandSideExpression),
    typeArguments: list(TypeNode),
    arguments: list(Expression),
  });

  b.node('TaggedTemplateExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression, MemberExpression], {
    tag: child(LeftHandSideExpression),
    typeArguments: list(TypeNode),
    template: child(TemplateLiteral),
    questionDotToken: optChild('QuestionDotToken'),
  });

  b.node('PropertyAccessExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression, MemberExpression, JsxTagName], {
    expression: child(LeftHandSideExpression),
    name: child(MemberName),
    questionDotToken: optChild('QuestionDotToken'),
  });

  b.node('ElementAccessExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression, MemberExpression], {
    expression: child(LeftHandSideExpression),
    argumentExpression: child(Expression),
    questionDotToken: optChild('QuestionDotToken'),
  });

  b.node('BinaryExpression', [Expression, Declaration], {
    left: child(Expression),
    operatorToken: child(Token),
    right: child(Expression),
  });

  b.node('PrefixUnaryExpression', [Expression, UnaryExpression, UpdateExpression], {
    operand: child(UnaryExpression),
    operator: prop("'+' | '-' | '~' | '!' | '++' | '--'"),
  });

  b.node('PostfixUnaryExpression', [Expression, UnaryExpression, UpdateExpression], {
    operand: child(LeftHandSideExpression),
    operator: prop("'++' | '--'"),
  });

  b.node('ConditionalExpression', [Expression], {
    condition: child(Expression),
    questionToken: child('QuestionToken'),
    whenTrue: child(Expression),
    colonToken: child('ColonToken'),
    whenFalse: child(Expression),
  });

  b.node('ArrowFunction', [Expression, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: optChild(TypeNode),
    equalsGreaterThanToken: child('EqualsGreaterThanToken'),
    body: child(ConciseBody),
    modifiers: list(Modifier),
    localCount: prop('number'),
  });

  b.node('FunctionExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
    name: optChild('Identifier'),
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: optChild(TypeNode),
    body: child('Block'),
    asteriskToken: optChild('AsteriskToken'),
    modifiers: list(Modifier),
    localCount: prop('number'),
  });

  b.node('ClassExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Declaration, ClassLikeDeclaration, ObjectTypeDeclaration], {
    name: optChild('Identifier'),
    typeParameters: list('TypeParameter'),
    members: list(ClassElement),
    heritageClauses: list('HeritageClause'),
    modifiers: list(Modifier),
  });

  b.node('ObjectLiteralExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Declaration, ObjectTypeDeclaration], {
    properties: list(ObjectLiteralElement),
  });

  b.node('ArrayLiteralExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression], {
    elements: list(Expression),
  });

  b.node('ParenthesizedExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression], {
    expression: child(Expression),
  });

  b.node('TemplateExpression', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, TemplateLiteral], {
    head: child('TemplateHead'),
    templateSpans: list('TemplateSpan'),
  });

  b.node('SpreadElement', [Expression], {
    expression: child(Expression),
  });

  b.node('AsExpression', [Expression], {
    expression: child(Expression),
    type: child(TypeNode),
  });

  b.node('SatisfiesExpression', [Expression], {
    expression: child(Expression),
    type: child(TypeNode),
  });

  b.node('NonNullExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression], {
    expression: child(Expression),
  });

  b.node('MetaProperty', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression], {
    name: child('Identifier'),
    keywordToken: prop("'new' | 'import'"),
  });

  b.node('AwaitExpression', [Expression, UnaryExpression], {
    expression: child(UnaryExpression),
  });

  b.node('DeleteExpression', [Expression, UnaryExpression], {
    expression: child(UnaryExpression),
  });

  b.node('TypeOfExpression', [Expression, UnaryExpression], {
    expression: child(UnaryExpression),
  });

  b.node('VoidExpression', [Expression, UnaryExpression], {
    expression: child(UnaryExpression),
  });

  b.node('YieldExpression', [Expression], {
    expression: optChild(Expression),
    asteriskToken: optChild('AsteriskToken'),
  });

  b.node('TypeAssertionExpression', [Expression, UnaryExpression], {
    type: child(TypeNode),
    expression: child(UnaryExpression),
  });

  b.node('PartiallyEmittedExpression', [Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression], {
    expression: child(Expression),
  });

  b.node('CommaListExpression', [Expression], {
    elements: list(Expression),
  });

  b.node('ExpressionWithTypeArguments', [TypeNode], {
    expression: child(Expression),
    typeArguments: list(TypeNode),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Template internals
  // ═══════════════════════════════════════════════════════════════════════

  b.node('TemplateSpan', [], {
    expression: child(Expression),
    literal: child(TemplateLiteralToken),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Literals
  // ═══════════════════════════════════════════════════════════════════════

  b.node('StringLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal, Declaration, PropertyName, ModuleName, ImportAttributeName, JsxAttributeValue], {
    value: prop('string'),
  });

  b.node('NumericLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal, Declaration, PropertyName], {
    value: prop('string'),
  });

  b.node('BigIntLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal, PropertyName], {
    value: prop('string'),
  });

  b.node('RegularExpressionLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal], {
    value: prop('string'),
  });

  b.node('NoSubstitutionTemplateLiteral', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal, Declaration, TemplateLiteral], {
    value: prop('string'),
  });

  b.node('TemplateHead', [Literal], {
    value: prop('string'),
  });

  b.node('TemplateMiddle', [Literal, TemplateLiteralToken], {
    value: prop('string'),
  });

  b.node('TemplateTail', [Literal, TemplateLiteralToken], {
    value: prop('string'),
  });

  b.node('JsxText', [Literal, JsxChild], {
    value: prop('string'),
    containsOnlyTriviaWhiteSpaces: prop('boolean'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Class and interface members
  // ═══════════════════════════════════════════════════════════════════════

  b.node('PropertyDeclaration', [ClassElement, Declaration], {
    name: child(PropertyName),
    type: optChild(TypeNode),
    initializer: optChild(Expression),
    questionToken: optChild('QuestionToken'),
    exclamationToken: optChild('ExclamationToken'),
    modifiers: list(Modifier),
    isExported: prop('boolean'),
  });

  b.node('MethodDeclaration', [ClassElement, ObjectLiteralElement, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
    name: child(PropertyName),
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: optChild(TypeNode),
    body: optChild('Block'),
    questionToken: optChild('QuestionToken'),
    asteriskToken: optChild('AsteriskToken'),
    modifiers: list(Modifier),
    isExported: prop('boolean'),
  });

  b.node('Constructor', [ClassElement, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
    parameters: list('Parameter'),
    body: optChild('Block'),
    modifiers: list(Modifier),
    localCount: prop('number'),
  });

  b.node('GetAccessor', [ClassElement, TypeElement, ObjectLiteralElement, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
    name: child(PropertyName),
    parameters: list('Parameter'),
    type: optChild(TypeNode),
    body: optChild('Block'),
    modifiers: list(Modifier),
  });

  b.node('SetAccessor', [ClassElement, TypeElement, ObjectLiteralElement, Declaration, FunctionLikeDeclaration, SignatureDeclaration], {
    name: child(PropertyName),
    parameters: list('Parameter'),
    body: optChild('Block'),
    modifiers: list(Modifier),
  });

  b.node('ClassStaticBlockDeclaration', [ClassElement], {
    body: child('Block'),
    modifiers: list(Modifier),
  });

  b.node('PropertySignature', [TypeElement, Declaration], {
    name: child(PropertyName),
    type: optChild(TypeNode),
    questionToken: optChild('QuestionToken'),
    modifiers: list(Modifier),
  });

  b.node('MethodSignature', [TypeElement, Declaration, SignatureDeclaration], {
    name: child(PropertyName),
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: optChild(TypeNode),
    questionToken: optChild('QuestionToken'),
    modifiers: list(Modifier),
  });

  b.node('CallSignature', [TypeElement, Declaration, SignatureDeclaration], {
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: optChild(TypeNode),
  });

  b.node('ConstructSignature', [TypeElement, Declaration, SignatureDeclaration], {
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: optChild(TypeNode),
  });

  b.node('IndexSignature', [ClassElement, TypeElement, Declaration, SignatureDeclaration], {
    parameters: list('Parameter'),
    type: optChild(TypeNode),
    modifiers: list(Modifier),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Object literal elements
  // ═══════════════════════════════════════════════════════════════════════

  b.node('PropertyAssignment', [ObjectLiteralElement, Declaration], {
    name: child(PropertyName),
    initializer: child(Expression),
    questionToken: optChild('QuestionToken'),
  });

  b.node('ShorthandPropertyAssignment', [ObjectLiteralElement, Declaration], {
    name: child('Identifier'),
    objectAssignmentInitializer: optChild(Expression),
    equalsToken: optChild('EqualsToken'),
  });

  b.node('SpreadAssignment', [ObjectLiteralElement], {
    expression: child(Expression),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Parameters and type parameters
  // ═══════════════════════════════════════════════════════════════════════

  b.node('Parameter', [Declaration], {
    name: child(BindingName),
    type: optChild(TypeNode),
    initializer: optChild(Expression),
    dotDotDotToken: optChild('DotDotDotToken'),
    questionToken: optChild('QuestionToken'),
    modifiers: list(Modifier),
  });

  b.node('TypeParameter', [Declaration], {
    name: child('Identifier'),
    constraint: optChild(TypeNode),
    default: optChild(TypeNode),
    modifiers: list(Modifier),
  });

  b.node('Decorator', [], {
    expression: child(LeftHandSideExpression),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Binding patterns
  // ═══════════════════════════════════════════════════════════════════════

  b.node('ObjectBindingPattern', [BindingPattern, BindingName], {
    elements: list('BindingElement'),
  });

  b.node('ArrayBindingPattern', [BindingPattern, BindingName], {
    elements: list(ArrayBindingElement),
  });

  b.node('BindingElement', [Declaration, ArrayBindingElement], {
    name: child(BindingName),
    propertyName: optChild(PropertyName),
    initializer: optChild(Expression),
    dotDotDotToken: optChild('DotDotDotToken'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Heritage
  // ═══════════════════════════════════════════════════════════════════════

  b.node('HeritageClause', [], {
    token: prop("'extends' | 'implements'"),
    types: list('ExpressionWithTypeArguments'),
  });

  b.node('EnumMember', [Declaration], {
    name: child(PropertyName),
    initializer: optChild(Expression),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Module internals
  // ═══════════════════════════════════════════════════════════════════════

  b.node('ModuleBlock', [ModuleBody], {
    statements: list(Statement),
    localCount: prop('number'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Type nodes
  // ═══════════════════════════════════════════════════════════════════════

  b.node('TypeReference', [TypeNode], {
    typeName: child(EntityName),
    typeArguments: list(TypeNode),
  });

  b.node('TypeLiteral', [TypeNode, Declaration, ObjectTypeDeclaration], {
    members: list(TypeElement),
  });

  b.node('UnionType', [TypeNode], {
    types: list(TypeNode),
  });

  b.node('IntersectionType', [TypeNode], {
    types: list(TypeNode),
  });

  b.node('FunctionType', [TypeNode, Declaration, SignatureDeclaration], {
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: child(TypeNode),
  });

  b.node('ConstructorType', [TypeNode, Declaration, SignatureDeclaration], {
    typeParameters: list('TypeParameter'),
    parameters: list('Parameter'),
    type: child(TypeNode),
    modifiers: list(Modifier),
  });

  b.node('ArrayType', [TypeNode], {
    elementType: child(TypeNode),
  });

  b.node('TupleType', [TypeNode], {
    elements: list(TypeNode),
  });

  b.node('NamedTupleMember', [TypeNode, Declaration], {
    name: child('Identifier'),
    type: child(TypeNode),
    dotDotDotToken: optChild('DotDotDotToken'),
    questionToken: optChild('QuestionToken'),
  });

  b.node('OptionalType', [TypeNode], {
    type: child(TypeNode),
  });

  b.node('RestType', [TypeNode], {
    type: child(TypeNode),
  });

  b.node('LiteralType', [TypeNode], {
    literal: child(Expression),
  });

  b.node('ConditionalType', [TypeNode], {
    checkType: child(TypeNode),
    extendsType: child(TypeNode),
    trueType: child(TypeNode),
    falseType: child(TypeNode),
  });

  b.node('InferType', [TypeNode], {
    typeParameter: child('TypeParameter'),
  });

  b.node('ParenthesizedType', [TypeNode], {
    type: child(TypeNode),
  });

  b.node('TypeOperator', [TypeNode], {
    type: child(TypeNode),
    operator: prop("'keyof' | 'unique' | 'readonly'"),
  });

  b.node('IndexedAccessType', [TypeNode], {
    objectType: child(TypeNode),
    indexType: child(TypeNode),
  });

  b.node('MappedType', [TypeNode, Declaration], {
    typeParameter: child('TypeParameter'),
    nameType: optChild(TypeNode),
    type: optChild(TypeNode),
    readonlyToken: optChild(Token),
    questionToken: optChild(Token),
  });

  b.node('TypeQuery', [TypeNode], {
    exprName: child(EntityName),
    typeArguments: list(TypeNode),
  });

  b.node('TypePredicate', [TypeNode], {
    assertsModifier: optChild('AssertsKeyword'),
    parameterName: child(TypePredicateParameterName),
    type: optChild(TypeNode),
  });

  b.node('TemplateLiteralType', [TypeNode], {
    head: child('TemplateHead'),
    templateSpans: list('TemplateLiteralTypeSpan'),
  });

  b.node('TemplateLiteralTypeSpan', [TypeNode], {
    type: child(TypeNode),
    literal: child(TemplateLiteralToken),
  });

  b.node('ImportType', [TypeNode], {
    argument: child(TypeNode),
    attributes: optChild('ImportAttributes'),
    qualifier: optChild(EntityName),
    typeArguments: list(TypeNode),
    isTypeOf: prop('boolean'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JSX nodes
  // ═══════════════════════════════════════════════════════════════════════

  b.node('JsxElement', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, JsxNode, JsxAttributeValue, JsxChild], {
    openingElement: child('JsxOpeningElement'),
    jsxChildren: list(JsxChild),
    closingElement: child('JsxClosingElement'),
  });

  b.node('JsxSelfClosingElement', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, JsxNode, JsxAttributeValue, JsxChild], {
    tagName: child(JsxTagName),
    typeArguments: list(TypeNode),
    attributes: child('JsxAttributes'),
  });

  b.node('JsxOpeningElement', [Expression, JsxNode], {
    tagName: child(JsxTagName),
    typeArguments: list(TypeNode),
    attributes: child('JsxAttributes'),
  });

  b.node('JsxClosingElement', [JsxNode], {
    tagName: child(JsxTagName),
  });

  b.node('JsxFragment', [Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, JsxNode, JsxAttributeValue, JsxChild], {
    openingFragment: child('JsxOpeningFragment'),
    jsxChildren: list(JsxChild),
    closingFragment: child('JsxClosingFragment'),
  });

  b.node('JsxAttribute', [Declaration, JsxNode, JsxAttributeLike], {
    name: child(JsxAttributeName),
    initializer: optChild(JsxAttributeValue),
  });

  b.node('JsxAttributes', [Declaration, JsxNode], {
    properties: list(JsxAttributeLike),
  });

  b.node('JsxSpreadAttribute', [JsxNode, JsxAttributeLike], {
    expression: child(Expression),
  });

  b.node('JsxExpression', [Expression, JsxNode, JsxAttributeValue, JsxChild], {
    dotDotDotToken: optChild('DotDotDotToken'),
    expression: optChild(Expression),
  });

  b.node('JsxNamespacedName', [JsxNode, JsxAttributeName, JsxTagName], {
    namespace: child('Identifier'),
    name: child('Identifier'),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JSDoc nodes
  // ═══════════════════════════════════════════════════════════════════════

  b.node('JSDocTypeExpression', [TypeNode, JSDocNode, JSDocTypedefType], {
    type: child(TypeNode),
  });

  b.node('JSDocNameReference', [JSDocNode, JSDocMemberLeft], {
    name: child(EntityName),
  });

  b.node('JSDocMemberName', [JSDocNode, JSDocMemberLeft], {
    left: child(JSDocMemberLeft),
    right: child('Identifier'),
  });

  b.node('JSDocNullableType', [TypeNode, JSDocNode], {
    type: child(TypeNode),
  });

  b.node('JSDocNonNullableType', [TypeNode, JSDocNode], {
    type: child(TypeNode),
  });

  b.node('JSDocOptionalType', [TypeNode, JSDocNode], {
    type: child(TypeNode),
  });

  b.node('JSDocFunctionType', [TypeNode, Declaration, SignatureDeclaration, JSDocNode], {
    parameters: list('Parameter'),
    type: optChild(TypeNode),
  });

  b.node('JSDocVariadicType', [TypeNode, JSDocNode], {
    type: child(TypeNode),
  });

  b.node('JSDocTypeLiteral', [TypeNode, JSDocNode, JSDocTypedefType], {
    jsDocPropertyTags: list('JSDocPropertyTag'),
    isArrayType: prop('boolean'),
  });

  b.node('MissingDeclaration', [Statement, Declaration, DeclarationStatement], {
    modifiers: list(Modifier),
  });

  // SourceFile — TS internal, we use CompilationUnit instead but need the kind for coverage
  b.leaf('SourceFile');

  // Assert clause (deprecated in newer TS, replaced by ImportAttributes)
  b.node('AssertClause', [], {
    elements: list('AssertEntry'),
  });

  b.node('AssertEntry', [], {
    name: child(ImportAttributeName),
    value: child(Expression),
  });

  // JSDocComment — alias used in some TS versions
  b.leaf('JSDocComment', JSDocNode);

  // ═══════════════════════════════════════════════════════════════════════
  // Leaf nodes — tokens, keywords, trivia, simple nodes
  // Listed individually per design decision.
  // ═══════════════════════════════════════════════════════════════════════

  // Trivia
  b.leaf('Unknown');
  b.leaf('EndOfFileToken');
  b.leaf('SingleLineCommentTrivia');
  b.leaf('MultiLineCommentTrivia');
  b.leaf('NewLineTrivia');
  b.leaf('WhitespaceTrivia');
  b.leaf('ShebangTrivia');
  b.leaf('ConflictMarkerTrivia');
  b.leaf('NonTextFileMarkerTrivia');
  b.leaf('JsxTextAllWhiteSpaces');

  // Punctuation / operator tokens
  b.leaf('OpenBraceToken', Token);
  b.leaf('CloseBraceToken', Token);
  b.leaf('OpenParenToken', Token);
  b.leaf('CloseParenToken', Token);
  b.leaf('OpenBracketToken', Token);
  b.leaf('CloseBracketToken', Token);
  b.leaf('DotToken', Token);
  b.leaf('DotDotDotToken', Token);
  b.leaf('SemicolonToken', Token);
  b.leaf('CommaToken', Token);
  b.leaf('QuestionDotToken', Token);
  b.leaf('LessThanToken', Token);
  b.leaf('LessThanSlashToken', Token);
  b.leaf('GreaterThanToken', Token);
  b.leaf('LessThanEqualsToken', Token);
  b.leaf('GreaterThanEqualsToken', Token);
  b.leaf('EqualsEqualsToken', Token);
  b.leaf('ExclamationEqualsToken', Token);
  b.leaf('EqualsEqualsEqualsToken', Token);
  b.leaf('ExclamationEqualsEqualsToken', Token);
  b.leaf('EqualsGreaterThanToken', Token);
  b.leaf('PlusToken', Token);
  b.leaf('MinusToken', Token);
  b.leaf('AsteriskToken', Token);
  b.leaf('AsteriskAsteriskToken', Token);
  b.leaf('SlashToken', Token);
  b.leaf('PercentToken', Token);
  b.leaf('PlusPlusToken', Token);
  b.leaf('MinusMinusToken', Token);
  b.leaf('LessThanLessThanToken', Token);
  b.leaf('GreaterThanGreaterThanToken', Token);
  b.leaf('GreaterThanGreaterThanGreaterThanToken', Token);
  b.leaf('AmpersandToken', Token);
  b.leaf('BarToken', Token);
  b.leaf('CaretToken', Token);
  b.leaf('ExclamationToken', Token);
  b.leaf('TildeToken', Token);
  b.leaf('AmpersandAmpersandToken', Token);
  b.leaf('BarBarToken', Token);
  b.leaf('QuestionToken', Token);
  b.leaf('ColonToken', Token);
  b.leaf('AtToken', Token);
  b.leaf('QuestionQuestionToken', Token);
  b.leaf('BacktickToken', Token);
  b.leaf('HashToken', Token);

  // Assignment tokens
  b.leaf('EqualsToken', Token);
  b.leaf('PlusEqualsToken', Token);
  b.leaf('MinusEqualsToken', Token);
  b.leaf('AsteriskEqualsToken', Token);
  b.leaf('AsteriskAsteriskEqualsToken', Token);
  b.leaf('SlashEqualsToken', Token);
  b.leaf('PercentEqualsToken', Token);
  b.leaf('LessThanLessThanEqualsToken', Token);
  b.leaf('GreaterThanGreaterThanEqualsToken', Token);
  b.leaf('GreaterThanGreaterThanGreaterThanEqualsToken', Token);
  b.leaf('AmpersandEqualsToken', Token);
  b.leaf('BarEqualsToken', Token);
  b.leaf('BarBarEqualsToken', Token);
  b.leaf('AmpersandAmpersandEqualsToken', Token);
  b.leaf('QuestionQuestionEqualsToken', Token);
  b.leaf('CaretEqualsToken', Token);

  // JSDoc token
  b.leaf('JSDocCommentTextToken');

  // Reserved keywords
  b.leaf('BreakKeyword', Keyword);
  b.leaf('CaseKeyword', Keyword);
  b.leaf('CatchKeyword', Keyword);
  b.leaf('ClassKeyword', Keyword);
  b.leaf('ConstKeyword', Keyword, Modifier);
  b.leaf('ContinueKeyword', Keyword);
  b.leaf('DebuggerKeyword', Keyword);
  b.leaf('DefaultKeyword', Keyword, Modifier);
  b.leaf('DeleteKeyword', Keyword);
  b.leaf('DoKeyword', Keyword);
  b.leaf('ElseKeyword', Keyword);
  b.leaf('EnumKeyword', Keyword);
  b.leaf('ExportKeyword', Keyword, Modifier);
  b.leaf('ExtendsKeyword', Keyword);
  b.leaf('FalseKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal);
  b.leaf('FinallyKeyword', Keyword);
  b.leaf('ForKeyword', Keyword);
  b.leaf('FunctionKeyword', Keyword);
  b.leaf('IfKeyword', Keyword);
  b.leaf('ImportKeyword', Keyword);
  b.leaf('InKeyword', Keyword, Modifier);
  b.leaf('InstanceOfKeyword', Keyword);
  b.leaf('NewKeyword', Keyword);
  b.leaf('NullKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal);
  b.leaf('ReturnKeyword', Keyword);
  b.leaf('SuperKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression);
  b.leaf('SwitchKeyword', Keyword);
  b.leaf('ThisKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, JsxTagName, TypePredicateParameterName);
  b.leaf('ThrowKeyword', Keyword);
  b.leaf('TrueKeyword', Keyword, Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, Literal);
  b.leaf('TryKeyword', Keyword);
  b.leaf('TypeOfKeyword', Keyword);
  b.leaf('VarKeyword', Keyword);
  b.leaf('VoidKeyword', Keyword, TypeNode);
  b.leaf('WhileKeyword', Keyword);
  b.leaf('WithKeyword', Keyword);

  // Contextual keywords
  b.leaf('ImplementsKeyword', Keyword);
  b.leaf('InterfaceKeyword', Keyword);
  b.leaf('LetKeyword', Keyword);
  b.leaf('PackageKeyword', Keyword);
  b.leaf('PrivateKeyword', Keyword, Modifier);
  b.leaf('ProtectedKeyword', Keyword, Modifier);
  b.leaf('PublicKeyword', Keyword, Modifier);
  b.leaf('StaticKeyword', Keyword, Modifier);
  b.leaf('YieldKeyword', Keyword);
  b.leaf('AbstractKeyword', Keyword, Modifier);
  b.leaf('AccessorKeyword', Keyword, Modifier);
  b.leaf('AsKeyword', Keyword);
  b.leaf('AssertsKeyword', Keyword);
  b.leaf('AssertKeyword', Keyword);
  b.leaf('AnyKeyword', Keyword, TypeNode);
  b.leaf('AsyncKeyword', Keyword, Modifier);
  b.leaf('AwaitKeyword', Keyword);
  b.leaf('BooleanKeyword', Keyword, TypeNode);
  b.leaf('ConstructorKeyword', Keyword);
  b.leaf('DeclareKeyword', Keyword, Modifier);
  b.leaf('GetKeyword', Keyword);
  b.leaf('InferKeyword', Keyword);
  b.leaf('IntrinsicKeyword', Keyword, TypeNode);
  b.leaf('IsKeyword', Keyword);
  b.leaf('KeyOfKeyword', Keyword);
  b.leaf('ModuleKeyword', Keyword);
  b.leaf('NamespaceKeyword', Keyword);
  b.leaf('NeverKeyword', Keyword, TypeNode);
  b.leaf('OutKeyword', Keyword, Modifier);
  b.leaf('ReadonlyKeyword', Keyword, Modifier);
  b.leaf('RequireKeyword', Keyword);
  b.leaf('NumberKeyword', Keyword, TypeNode);
  b.leaf('ObjectKeyword', Keyword, TypeNode);
  b.leaf('SatisfiesKeyword', Keyword);
  b.leaf('SetKeyword', Keyword);
  b.leaf('StringKeyword', Keyword, TypeNode);
  b.leaf('SymbolKeyword', Keyword, TypeNode);
  b.leaf('TypeKeyword', Keyword);
  b.leaf('UndefinedKeyword', Keyword, TypeNode);
  b.leaf('UniqueKeyword', Keyword);
  b.leaf('UnknownKeyword', Keyword, TypeNode);
  b.leaf('UsingKeyword', Keyword);
  b.leaf('FromKeyword', Keyword);
  b.leaf('GlobalKeyword', Keyword);
  b.leaf('BigIntKeyword', Keyword, TypeNode);
  b.leaf('OverrideKeyword', Keyword, Modifier);
  b.leaf('OfKeyword', Keyword);
  b.leaf('DeferKeyword', Keyword);

  // JSDoc types (leaf)
  b.leaf('JSDocAllType', TypeNode, JSDocNode);
  b.leaf('JSDocUnknownType', TypeNode, JSDocNode);
  b.leaf('JSDocNamepathType', TypeNode, JSDocNode);

  // JSDoc nodes — upgraded from leaf to node where structure exists
  b.node('JSDoc', [JSDocNode], {
    tags: list(JSDocNode),
    comment: prop('string'),
  });

  b.leaf('JSDocText', JSDocNode);
  b.node('JSDocSignature', [TypeNode, JSDocNode], {
    typeParameters: list('JSDocTemplateTag'),
    parameters: list('JSDocParameterTag'),
    type: optChild('JSDocReturnTag'),
  });
  b.node('JSDocLink', [JSDocNode], {
    name: optChild(EntityName),
    linkText: prop('string'),
  });

  b.node('JSDocLinkCode', [JSDocNode], {
    name: optChild(EntityName),
    linkText: prop('string'),
  });

  b.node('JSDocLinkPlain', [JSDocNode], {
    name: optChild(EntityName),
    linkText: prop('string'),
  });

  b.node('JSDocTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocAugmentsTag', [JSDocNode], {
    tagName: child('Identifier'),
    class: child('ExpressionWithTypeArguments'),
    comment: prop('string'),
  });

  b.node('JSDocImplementsTag', [JSDocNode], {
    tagName: child('Identifier'),
    class: child('ExpressionWithTypeArguments'),
    comment: prop('string'),
  });

  b.node('JSDocAuthorTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocDeprecatedTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocClassTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocPublicTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocPrivateTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocProtectedTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocReadonlyTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocOverrideTag', [JSDocNode], {
    tagName: child('Identifier'),
    comment: prop('string'),
  });

  b.node('JSDocCallbackTag', [JSDocNode], {
    tagName: child('Identifier'),
    fullName: optChild('Identifier'),
    typeExpression: optChild('JSDocSignature'),
    comment: prop('string'),
  });

  b.node('JSDocOverloadTag', [JSDocNode], {
    tagName: child('Identifier'),
    typeExpression: child('JSDocSignature'),
    comment: prop('string'),
  });

  b.node('JSDocEnumTag', [JSDocNode], {
    tagName: child('Identifier'),
    typeExpression: child('JSDocTypeExpression'),
    comment: prop('string'),
  });

  b.node('JSDocParameterTag', [JSDocNode], {
    tagName: child('Identifier'),
    name: child(EntityName),
    typeExpression: optChild('JSDocTypeExpression'),
    isBracketed: prop('boolean'),
    comment: prop('string'),
  });

  b.node('JSDocReturnTag', [JSDocNode], {
    tagName: child('Identifier'),
    typeExpression: optChild('JSDocTypeExpression'),
    comment: prop('string'),
  });

  b.node('JSDocThisTag', [JSDocNode], {
    tagName: child('Identifier'),
    typeExpression: optChild('JSDocTypeExpression'),
    comment: prop('string'),
  });

  b.node('JSDocTypeTag', [JSDocNode], {
    tagName: child('Identifier'),
    typeExpression: child('JSDocTypeExpression'),
    comment: prop('string'),
  });

  b.node('JSDocTemplateTag', [JSDocNode], {
    tagName: child('Identifier'),
    typeParameters: list('TypeParameter'),
    constraint: optChild('JSDocTypeExpression'),
    comment: prop('string'),
  });

  b.node('JSDocTypedefTag', [JSDocNode], {
    tagName: child('Identifier'),
    fullName: optChild('Identifier'),
    typeExpression: optChild(JSDocTypedefType),
    comment: prop('string'),
  });

  b.node('JSDocSeeTag', [JSDocNode], {
    tagName: child('Identifier'),
    name: optChild('JSDocNameReference'),
    comment: prop('string'),
  });

  b.node('JSDocPropertyTag', [JSDocNode], {
    tagName: child('Identifier'),
    name: child(EntityName),
    typeExpression: optChild('JSDocTypeExpression'),
    isBracketed: prop('boolean'),
    comment: prop('string'),
  });

  b.node('JSDocThrowsTag', [JSDocNode], {
    tagName: child('Identifier'),
    typeExpression: optChild('JSDocTypeExpression'),
    comment: prop('string'),
  });

  b.node('JSDocSatisfiesTag', [JSDocNode], {
    tagName: child('Identifier'),
    typeExpression: child('JSDocTypeExpression'),
    comment: prop('string'),
  });

  b.node('JSDocImportTag', [JSDocNode], {
    tagName: child('Identifier'),
    importClause: optChild('ImportClause'),
    moduleSpecifier: child(Expression),
    attributes: optChild('ImportAttributes'),
    comment: prop('string'),
  });

  // Internal / synthetic nodes
  b.leaf('SyntaxList');
  b.leaf('NotEmittedStatement', Statement);
  b.leaf('NotEmittedTypeElement', TypeElement);
  b.leaf('SyntheticExpression', Expression);
  b.leaf('SyntheticReferenceExpression', Expression, UnaryExpression, UpdateExpression, LeftHandSideExpression);
  b.leaf('Bundle');
  b.leaf('ImportTypeAssertionContainer');
  b.leaf('ThisType', TypeNode, TypePredicateParameterName);
  b.leaf('OmittedExpression', Expression, PrimaryExpression, MemberExpression, LeftHandSideExpression, UpdateExpression, UnaryExpression, ArrayBindingElement);
  b.leaf('SemicolonClassElement', ClassElement);
  b.leaf('EmptyStatement', Statement);
  b.leaf('DebuggerStatement', Statement);
  b.leaf('JsxOpeningFragment', JsxNode);
  b.leaf('JsxClosingFragment', JsxNode);

  // ═══════════════════════════════════════════════════════════════════════
  // Sum type includes (resolved after all nodes are registered)
  // ═══════════════════════════════════════════════════════════════════════

  // ForInitializer = VariableDeclarationList | Expression
  b.sumTypeIncludes(ForInitializer, Expression);

  // ConciseBody = Block | Expression
  b.sumTypeIncludes(ConciseBody, Expression);

  // JSDocMemberLeft = JSDocMemberName | JSDocNameReference (inline, no sum type needed)
  // JSDocTypedefType = JSDocTypeExpression | JSDocTypeLiteral (inline, no sum type needed)

  b.resolveIncludes();

  // ═══════════════════════════════════════════════════════════════════════
  // Checker-level fields (batch-added after all nodes are registered)
  // ═══════════════════════════════════════════════════════════════════════

  // typeString: inferred type from TS checker, added to all Expression members
  // and key declaration nodes. Empty string when checker not available.
  b.addFieldToSumTypeMembers('Expression', 'typeString', prop('string'));

  // Also add typeString to declaration nodes that aren't Expression members
  b.addFieldToKinds([
    'VariableDeclaration', 'FunctionDeclaration', 'ClassDeclaration',
    'MethodDeclaration', 'PropertyDeclaration', 'Parameter',
    'GetAccessor', 'SetAccessor', 'PropertySignature', 'MethodSignature',
  ], 'typeString', prop('string'));
}
