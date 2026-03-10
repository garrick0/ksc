/**
 * KSC AST Schema — the single source of truth.
 *
 * Defines all 364 node kinds, their fields, and sum type memberships.
 * This file mirrors TypeScript's AST structure from src/compiler/types.ts.
 *
 * Run `npx tsx app/analysis-codegen/ts-kind-checking.ts` for analysis codegen.
 */

import type { NodeDefShape, SumTypeDefShape } from '../../../grammar/index.js';

// ═══════════════════════════════════════════════════════════════════════
// Sum type declarations (TypeScript's full hierarchy)
// ═══════════════════════════════════════════════════════════════════════

export const SUM_TYPES = {
  Expression: { fields: { typeString: { tag: 'prop', propType: 'string' } as const } },
  UnaryExpression: {},
  UpdateExpression: {},
  LeftHandSideExpression: {},
  MemberExpression: {},
  PrimaryExpression: {},
  Statement: {},
  Declaration: {},
  DeclarationStatement: {},
  FunctionLikeDeclaration: {},
  ClassLikeDeclaration: {},
  ObjectTypeDeclaration: {},
  SignatureDeclaration: {},
  TypeNode: {},
  ClassElement: {},
  TypeElement: {},
  ObjectLiteralElement: {},
  Token: {},
  Keyword: {},
  Modifier: {},
  BindingPattern: {},
  PropertyName: {},
  Literal: {},
  JsxNode: {},
  JSDocNode: {},
  EntityName: {},
  BindingName: {},
  MemberName: {},
  ModuleBody: {},
  ModuleName: {},
  ModuleReference: {},
  NamedImportBindings: {},
  NamedExportBindings: {},
  CaseOrDefaultClause: {},
  TemplateLiteralToken: {},
  TemplateLiteral: {},
  ArrayBindingElement: {},
  JsxAttributeLike: {},
  JsxTagName: {},
  JsxAttributeName: {},
  JsxAttributeValue: {},
  JsxChild: {},
  ImportAttributeName: {},
  ForInitializer: { includes: ['Expression'] },
  ConciseBody: { includes: ['Expression'] },
  JSDocMemberLeft: {},
  JSDocTypedefType: {},
  TypePredicateParameterName: {},
} satisfies Record<string, SumTypeDefShape>;

// ═══════════════════════════════════════════════════════════════════════
// Node definitions
// ═══════════════════════════════════════════════════════════════════════

export const NODES = {
  Program: {
    memberOf: [],
    fields: {
      compilationUnits: { tag: 'list', typeRef: 'CompilationUnit' } as const,
    },
  },
  CompilationUnit: {
    memberOf: [],
    fields: {
      fileName: { tag: 'prop', propType: 'string' } as const,
      isDeclarationFile: { tag: 'prop', propType: 'boolean' } as const,
      sourceText: { tag: 'prop', propType: 'string' } as const,
      lineStarts: { tag: 'prop', propType: 'readonly number[]' } as const,
      languageVariant: { tag: 'prop', propType: "'Standard' | 'JSX'" } as const,
      statements: { tag: 'list', typeRef: 'Statement' } as const,
    },
  },
  Identifier: {
    memberOf: ['PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Expression', 'Declaration', 'PropertyName', 'EntityName', 'BindingName', 'MemberName', 'ModuleName', 'ModuleReference', 'JsxTagName', 'JsxAttributeName', 'ImportAttributeName', 'TypePredicateParameterName'],
    fields: {
      escapedText: { tag: 'prop', propType: 'string' } as const,
      resolvesToImport: { tag: 'prop', propType: 'boolean' } as const,
      isDefinitionSite: { tag: 'prop', propType: 'boolean' } as const,
      resolvedFileName: { tag: 'prop', propType: 'string' } as const,
      symIsVariable: { tag: 'prop', propType: 'boolean' } as const,
      symIsFunctionScopedVariable: { tag: 'prop', propType: 'boolean' } as const,
      symIsBlockScopedVariable: { tag: 'prop', propType: 'boolean' } as const,
      symIsFunction: { tag: 'prop', propType: 'boolean' } as const,
      symIsClass: { tag: 'prop', propType: 'boolean' } as const,
      symIsInterface: { tag: 'prop', propType: 'boolean' } as const,
      symIsTypeAlias: { tag: 'prop', propType: 'boolean' } as const,
      symIsAlias: { tag: 'prop', propType: 'boolean' } as const,
      symIsProperty: { tag: 'prop', propType: 'boolean' } as const,
      symIsMethod: { tag: 'prop', propType: 'boolean' } as const,
      symIsEnum: { tag: 'prop', propType: 'boolean' } as const,
      symIsEnumMember: { tag: 'prop', propType: 'boolean' } as const,
      symIsNamespace: { tag: 'prop', propType: 'boolean' } as const,
      symIsExportValue: { tag: 'prop', propType: 'boolean' } as const,
      symIsType: { tag: 'prop', propType: 'boolean' } as const,
      symIsValue: { tag: 'prop', propType: 'boolean' } as const,
      importModuleSpecifier: { tag: 'prop', propType: 'string' } as const,
    },
  },
  PrivateIdentifier: {
    memberOf: ['PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Expression', 'PropertyName', 'MemberName'],
    fields: {
      escapedText: { tag: 'prop', propType: 'string' } as const,
    },
  },
  QualifiedName: {
    memberOf: ['EntityName', 'ModuleReference'],
    fields: {
      left: { tag: 'child', typeRef: 'EntityName' } as const,
      right: { tag: 'child', typeRef: 'Identifier' } as const,
    },
  },
  ComputedPropertyName: {
    memberOf: ['PropertyName'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  TypeAliasDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  InterfaceDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement', 'ObjectTypeDeclaration'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      members: { tag: 'list', typeRef: 'TypeElement' } as const,
      heritageClauses: { tag: 'list', typeRef: 'HeritageClause' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  FunctionDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement', 'FunctionLikeDeclaration', 'SignatureDeclaration'],
    fields: {
      name: { tag: 'optChild', typeRef: 'Identifier' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      body: { tag: 'optChild', typeRef: 'Block' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      asteriskToken: { tag: 'optChild', typeRef: 'AsteriskToken' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  ClassDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement', 'ClassLikeDeclaration', 'ObjectTypeDeclaration'],
    fields: {
      name: { tag: 'optChild', typeRef: 'Identifier' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      members: { tag: 'list', typeRef: 'ClassElement' } as const,
      heritageClauses: { tag: 'list', typeRef: 'HeritageClause' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  EnumDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      members: { tag: 'list', typeRef: 'EnumMember' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  ModuleDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement', 'ModuleBody'],
    fields: {
      name: { tag: 'child', typeRef: 'ModuleName' } as const,
      body: { tag: 'optChild', typeRef: 'ModuleBody' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  NamespaceExportDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  ImportEqualsDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      moduleReference: { tag: 'child', typeRef: 'ModuleReference' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isTypeOnly: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  VariableStatement: {
    memberOf: ['Statement'],
    fields: {
      declarationList: { tag: 'child', typeRef: 'VariableDeclarationList' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  VariableDeclarationList: {
    memberOf: ['ForInitializer'],
    fields: {
      declarations: { tag: 'list', typeRef: 'VariableDeclaration' } as const,
      declarationKind: { tag: 'prop', propType: "'var' | 'let' | 'const' | 'using' | 'await using'" } as const,
    },
  },
  VariableDeclaration: {
    memberOf: ['Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'BindingName' } as const,
      exclamationToken: { tag: 'optChild', typeRef: 'ExclamationToken' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      initializer: { tag: 'optChild', typeRef: 'Expression' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  ImportDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement'],
    fields: {
      importClause: { tag: 'optChild', typeRef: 'ImportClause' } as const,
      moduleSpecifier: { tag: 'child', typeRef: 'Expression' } as const,
      attributes: { tag: 'optChild', typeRef: 'ImportAttributes' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      resolvedModulePath: { tag: 'prop', propType: 'string' } as const,
    },
  },
  ImportClause: {
    memberOf: ['Declaration'],
    fields: {
      isTypeOnly: { tag: 'prop', propType: 'boolean' } as const,
      name: { tag: 'optChild', typeRef: 'Identifier' } as const,
      namedBindings: { tag: 'optChild', typeRef: 'NamedImportBindings' } as const,
    },
  },
  NamedImports: {
    memberOf: ['NamedImportBindings'],
    fields: {
      elements: { tag: 'list', typeRef: 'ImportSpecifier' } as const,
    },
  },
  ImportSpecifier: {
    memberOf: ['Declaration'],
    fields: {
      isTypeOnly: { tag: 'prop', propType: 'boolean' } as const,
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      propertyName: { tag: 'optChild', typeRef: 'Identifier' } as const,
    },
  },
  NamespaceImport: {
    memberOf: ['Declaration', 'NamedImportBindings'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
    },
  },
  ExportDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement'],
    fields: {
      isTypeOnly: { tag: 'prop', propType: 'boolean' } as const,
      exportClause: { tag: 'optChild', typeRef: 'NamedExportBindings' } as const,
      moduleSpecifier: { tag: 'optChild', typeRef: 'Expression' } as const,
      attributes: { tag: 'optChild', typeRef: 'ImportAttributes' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  ExportAssignment: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      isExportEquals: { tag: 'prop', propType: 'boolean' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  NamedExports: {
    memberOf: ['NamedExportBindings'],
    fields: {
      elements: { tag: 'list', typeRef: 'ExportSpecifier' } as const,
    },
  },
  NamespaceExport: {
    memberOf: ['NamedExportBindings'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
    },
  },
  ExportSpecifier: {
    memberOf: ['Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      propertyName: { tag: 'optChild', typeRef: 'Identifier' } as const,
      isTypeOnly: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  ExternalModuleReference: {
    memberOf: ['ModuleReference'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  ImportAttributes: {
    memberOf: [],
    fields: {
      elements: { tag: 'list', typeRef: 'ImportAttribute' } as const,
    },
  },
  ImportAttribute: {
    memberOf: [],
    fields: {
      name: { tag: 'child', typeRef: 'ImportAttributeName' } as const,
      value: { tag: 'child', typeRef: 'StringLiteral' } as const,
    },
  },
  Block: {
    memberOf: ['Statement', 'ConciseBody'],
    fields: {
      statements: { tag: 'list', typeRef: 'Statement' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  ExpressionStatement: {
    memberOf: ['Statement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  ReturnStatement: {
    memberOf: ['Statement'],
    fields: {
      expression: { tag: 'optChild', typeRef: 'Expression' } as const,
    },
  },
  IfStatement: {
    memberOf: ['Statement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      thenStatement: { tag: 'child', typeRef: 'Statement' } as const,
      elseStatement: { tag: 'optChild', typeRef: 'Statement' } as const,
    },
  },
  ForStatement: {
    memberOf: ['Statement'],
    fields: {
      initializer: { tag: 'optChild', typeRef: 'ForInitializer' } as const,
      condition: { tag: 'optChild', typeRef: 'Expression' } as const,
      incrementor: { tag: 'optChild', typeRef: 'Expression' } as const,
      statement: { tag: 'child', typeRef: 'Statement' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  ForOfStatement: {
    memberOf: ['Statement'],
    fields: {
      awaitModifier: { tag: 'optChild', typeRef: 'AwaitKeyword' } as const,
      initializer: { tag: 'child', typeRef: 'ForInitializer' } as const,
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      statement: { tag: 'child', typeRef: 'Statement' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  ForInStatement: {
    memberOf: ['Statement'],
    fields: {
      initializer: { tag: 'child', typeRef: 'ForInitializer' } as const,
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      statement: { tag: 'child', typeRef: 'Statement' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  WhileStatement: {
    memberOf: ['Statement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      statement: { tag: 'child', typeRef: 'Statement' } as const,
    },
  },
  DoStatement: {
    memberOf: ['Statement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      statement: { tag: 'child', typeRef: 'Statement' } as const,
    },
  },
  SwitchStatement: {
    memberOf: ['Statement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      caseBlock: { tag: 'child', typeRef: 'CaseBlock' } as const,
    },
  },
  ThrowStatement: {
    memberOf: ['Statement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  TryStatement: {
    memberOf: ['Statement'],
    fields: {
      tryBlock: { tag: 'child', typeRef: 'Block' } as const,
      catchClause: { tag: 'optChild', typeRef: 'CatchClause' } as const,
      finallyBlock: { tag: 'optChild', typeRef: 'Block' } as const,
    },
  },
  ContinueStatement: {
    memberOf: ['Statement'],
    fields: {
      label: { tag: 'optChild', typeRef: 'Identifier' } as const,
    },
  },
  BreakStatement: {
    memberOf: ['Statement'],
    fields: {
      label: { tag: 'optChild', typeRef: 'Identifier' } as const,
    },
  },
  WithStatement: {
    memberOf: ['Statement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      statement: { tag: 'child', typeRef: 'Statement' } as const,
    },
  },
  LabeledStatement: {
    memberOf: ['Statement'],
    fields: {
      label: { tag: 'child', typeRef: 'Identifier' } as const,
      statement: { tag: 'child', typeRef: 'Statement' } as const,
    },
  },
  CaseBlock: {
    memberOf: [],
    fields: {
      clauses: { tag: 'list', typeRef: 'CaseOrDefaultClause' } as const,
    },
  },
  CaseClause: {
    memberOf: ['CaseOrDefaultClause'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      statements: { tag: 'list', typeRef: 'Statement' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  DefaultClause: {
    memberOf: ['CaseOrDefaultClause'],
    fields: {
      statements: { tag: 'list', typeRef: 'Statement' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  CatchClause: {
    memberOf: [],
    fields: {
      variableDeclaration: { tag: 'optChild', typeRef: 'VariableDeclaration' } as const,
      block: { tag: 'child', typeRef: 'Block' } as const,
    },
  },
  CallExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression', 'LeftHandSideExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'LeftHandSideExpression' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
      arguments: { tag: 'list', typeRef: 'Expression' } as const,
      questionDotToken: { tag: 'optChild', typeRef: 'QuestionDotToken' } as const,
    },
  },
  NewExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression', 'LeftHandSideExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'LeftHandSideExpression' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
      arguments: { tag: 'list', typeRef: 'Expression' } as const,
    },
  },
  TaggedTemplateExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression', 'LeftHandSideExpression', 'MemberExpression'],
    fields: {
      tag: { tag: 'child', typeRef: 'LeftHandSideExpression' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
      template: { tag: 'child', typeRef: 'TemplateLiteral' } as const,
      questionDotToken: { tag: 'optChild', typeRef: 'QuestionDotToken' } as const,
    },
  },
  PropertyAccessExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression', 'LeftHandSideExpression', 'MemberExpression', 'JsxTagName'],
    fields: {
      expression: { tag: 'child', typeRef: 'LeftHandSideExpression' } as const,
      name: { tag: 'child', typeRef: 'MemberName' } as const,
      questionDotToken: { tag: 'optChild', typeRef: 'QuestionDotToken' } as const,
    },
  },
  ElementAccessExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression', 'LeftHandSideExpression', 'MemberExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'LeftHandSideExpression' } as const,
      argumentExpression: { tag: 'child', typeRef: 'Expression' } as const,
      questionDotToken: { tag: 'optChild', typeRef: 'QuestionDotToken' } as const,
    },
  },
  BinaryExpression: {
    memberOf: ['Expression', 'Declaration'],
    fields: {
      left: { tag: 'child', typeRef: 'Expression' } as const,
      operatorToken: { tag: 'child', typeRef: 'Token' } as const,
      right: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  PrefixUnaryExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression'],
    fields: {
      operand: { tag: 'child', typeRef: 'UnaryExpression' } as const,
      operator: { tag: 'prop', propType: "'+' | '-' | '~' | '!' | '++' | '--'" } as const,
    },
  },
  PostfixUnaryExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression'],
    fields: {
      operand: { tag: 'child', typeRef: 'LeftHandSideExpression' } as const,
      operator: { tag: 'prop', propType: "'++' | '--'" } as const,
    },
  },
  ConditionalExpression: {
    memberOf: ['Expression'],
    fields: {
      condition: { tag: 'child', typeRef: 'Expression' } as const,
      questionToken: { tag: 'child', typeRef: 'QuestionToken' } as const,
      whenTrue: { tag: 'child', typeRef: 'Expression' } as const,
      colonToken: { tag: 'child', typeRef: 'ColonToken' } as const,
      whenFalse: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  ArrowFunction: {
    memberOf: ['Expression', 'Declaration', 'FunctionLikeDeclaration', 'SignatureDeclaration'],
    fields: {
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      equalsGreaterThanToken: { tag: 'child', typeRef: 'EqualsGreaterThanToken' } as const,
      body: { tag: 'child', typeRef: 'ConciseBody' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  FunctionExpression: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Declaration', 'FunctionLikeDeclaration', 'SignatureDeclaration'],
    fields: {
      name: { tag: 'optChild', typeRef: 'Identifier' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      body: { tag: 'child', typeRef: 'Block' } as const,
      asteriskToken: { tag: 'optChild', typeRef: 'AsteriskToken' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  ClassExpression: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Declaration', 'ClassLikeDeclaration', 'ObjectTypeDeclaration'],
    fields: {
      name: { tag: 'optChild', typeRef: 'Identifier' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      members: { tag: 'list', typeRef: 'ClassElement' } as const,
      heritageClauses: { tag: 'list', typeRef: 'HeritageClause' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  ObjectLiteralExpression: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Declaration', 'ObjectTypeDeclaration'],
    fields: {
      properties: { tag: 'list', typeRef: 'ObjectLiteralElement' } as const,
    },
  },
  ArrayLiteralExpression: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression'],
    fields: {
      elements: { tag: 'list', typeRef: 'Expression' } as const,
    },
  },
  ParenthesizedExpression: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  TemplateExpression: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'TemplateLiteral'],
    fields: {
      head: { tag: 'child', typeRef: 'TemplateHead' } as const,
      templateSpans: { tag: 'list', typeRef: 'TemplateSpan' } as const,
    },
  },
  SpreadElement: {
    memberOf: ['Expression'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  AsExpression: {
    memberOf: ['Expression'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  SatisfiesExpression: {
    memberOf: ['Expression'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  NonNullExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression', 'LeftHandSideExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  MetaProperty: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      keywordToken: { tag: 'prop', propType: "'new' | 'import'" } as const,
    },
  },
  AwaitExpression: {
    memberOf: ['Expression', 'UnaryExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'UnaryExpression' } as const,
    },
  },
  DeleteExpression: {
    memberOf: ['Expression', 'UnaryExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'UnaryExpression' } as const,
    },
  },
  TypeOfExpression: {
    memberOf: ['Expression', 'UnaryExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'UnaryExpression' } as const,
    },
  },
  VoidExpression: {
    memberOf: ['Expression', 'UnaryExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'UnaryExpression' } as const,
    },
  },
  YieldExpression: {
    memberOf: ['Expression'],
    fields: {
      expression: { tag: 'optChild', typeRef: 'Expression' } as const,
      asteriskToken: { tag: 'optChild', typeRef: 'AsteriskToken' } as const,
    },
  },
  TypeAssertionExpression: {
    memberOf: ['Expression', 'UnaryExpression'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
      expression: { tag: 'child', typeRef: 'UnaryExpression' } as const,
    },
  },
  PartiallyEmittedExpression: {
    memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression', 'LeftHandSideExpression'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  CommaListExpression: {
    memberOf: ['Expression'],
    fields: {
      elements: { tag: 'list', typeRef: 'Expression' } as const,
    },
  },
  ExpressionWithTypeArguments: {
    memberOf: ['TypeNode'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
    },
  },
  TemplateSpan: {
    memberOf: [],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
      literal: { tag: 'child', typeRef: 'TemplateLiteralToken' } as const,
    },
  },
  StringLiteral: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Literal', 'Declaration', 'PropertyName', 'ModuleName', 'ImportAttributeName', 'JsxAttributeValue'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
    },
  },
  NumericLiteral: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Literal', 'Declaration', 'PropertyName'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
    },
  },
  BigIntLiteral: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Literal', 'PropertyName'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
    },
  },
  RegularExpressionLiteral: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Literal'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
    },
  },
  NoSubstitutionTemplateLiteral: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Literal', 'Declaration', 'TemplateLiteral'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
    },
  },
  TemplateHead: {
    memberOf: ['Literal'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
    },
  },
  TemplateMiddle: {
    memberOf: ['Literal', 'TemplateLiteralToken'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
    },
  },
  TemplateTail: {
    memberOf: ['Literal', 'TemplateLiteralToken'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JsxText: {
    memberOf: ['Literal', 'JsxChild'],
    fields: {
      value: { tag: 'prop', propType: 'string' } as const,
      containsOnlyTriviaWhiteSpaces: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  PropertyDeclaration: {
    memberOf: ['ClassElement', 'Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'PropertyName' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      initializer: { tag: 'optChild', typeRef: 'Expression' } as const,
      questionToken: { tag: 'optChild', typeRef: 'QuestionToken' } as const,
      exclamationToken: { tag: 'optChild', typeRef: 'ExclamationToken' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  MethodDeclaration: {
    memberOf: ['ClassElement', 'ObjectLiteralElement', 'Declaration', 'FunctionLikeDeclaration', 'SignatureDeclaration'],
    fields: {
      name: { tag: 'child', typeRef: 'PropertyName' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      body: { tag: 'optChild', typeRef: 'Block' } as const,
      questionToken: { tag: 'optChild', typeRef: 'QuestionToken' } as const,
      asteriskToken: { tag: 'optChild', typeRef: 'AsteriskToken' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      isExported: { tag: 'prop', propType: 'boolean' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  Constructor: {
    memberOf: ['ClassElement', 'Declaration', 'FunctionLikeDeclaration', 'SignatureDeclaration'],
    fields: {
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      body: { tag: 'optChild', typeRef: 'Block' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  GetAccessor: {
    memberOf: ['ClassElement', 'TypeElement', 'ObjectLiteralElement', 'Declaration', 'FunctionLikeDeclaration', 'SignatureDeclaration'],
    fields: {
      name: { tag: 'child', typeRef: 'PropertyName' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      body: { tag: 'optChild', typeRef: 'Block' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  SetAccessor: {
    memberOf: ['ClassElement', 'TypeElement', 'ObjectLiteralElement', 'Declaration', 'FunctionLikeDeclaration', 'SignatureDeclaration'],
    fields: {
      name: { tag: 'child', typeRef: 'PropertyName' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      body: { tag: 'optChild', typeRef: 'Block' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  ClassStaticBlockDeclaration: {
    memberOf: ['ClassElement'],
    fields: {
      body: { tag: 'child', typeRef: 'Block' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  PropertySignature: {
    memberOf: ['TypeElement', 'Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'PropertyName' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      questionToken: { tag: 'optChild', typeRef: 'QuestionToken' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  MethodSignature: {
    memberOf: ['TypeElement', 'Declaration', 'SignatureDeclaration'],
    fields: {
      name: { tag: 'child', typeRef: 'PropertyName' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      questionToken: { tag: 'optChild', typeRef: 'QuestionToken' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  CallSignature: {
    memberOf: ['TypeElement', 'Declaration', 'SignatureDeclaration'],
    fields: {
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
    },
  },
  ConstructSignature: {
    memberOf: ['TypeElement', 'Declaration', 'SignatureDeclaration'],
    fields: {
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
    },
  },
  IndexSignature: {
    memberOf: ['ClassElement', 'TypeElement', 'Declaration', 'SignatureDeclaration'],
    fields: {
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  PropertyAssignment: {
    memberOf: ['ObjectLiteralElement', 'Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'PropertyName' } as const,
      initializer: { tag: 'child', typeRef: 'Expression' } as const,
      questionToken: { tag: 'optChild', typeRef: 'QuestionToken' } as const,
    },
  },
  ShorthandPropertyAssignment: {
    memberOf: ['ObjectLiteralElement', 'Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      objectAssignmentInitializer: { tag: 'optChild', typeRef: 'Expression' } as const,
      equalsToken: { tag: 'optChild', typeRef: 'EqualsToken' } as const,
    },
  },
  SpreadAssignment: {
    memberOf: ['ObjectLiteralElement'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  Parameter: {
    memberOf: ['Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'BindingName' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      initializer: { tag: 'optChild', typeRef: 'Expression' } as const,
      dotDotDotToken: { tag: 'optChild', typeRef: 'DotDotDotToken' } as const,
      questionToken: { tag: 'optChild', typeRef: 'QuestionToken' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
      typeString: { tag: 'prop', propType: 'string' } as const,
    },
  },
  TypeParameter: {
    memberOf: ['Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      constraint: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      default: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  Decorator: {
    memberOf: [],
    fields: {
      expression: { tag: 'child', typeRef: 'LeftHandSideExpression' } as const,
    },
  },
  ObjectBindingPattern: {
    memberOf: ['BindingPattern', 'BindingName'],
    fields: {
      elements: { tag: 'list', typeRef: 'BindingElement' } as const,
    },
  },
  ArrayBindingPattern: {
    memberOf: ['BindingPattern', 'BindingName'],
    fields: {
      elements: { tag: 'list', typeRef: 'ArrayBindingElement' } as const,
    },
  },
  BindingElement: {
    memberOf: ['Declaration', 'ArrayBindingElement'],
    fields: {
      name: { tag: 'child', typeRef: 'BindingName' } as const,
      propertyName: { tag: 'optChild', typeRef: 'PropertyName' } as const,
      initializer: { tag: 'optChild', typeRef: 'Expression' } as const,
      dotDotDotToken: { tag: 'optChild', typeRef: 'DotDotDotToken' } as const,
    },
  },
  HeritageClause: {
    memberOf: [],
    fields: {
      token: { tag: 'prop', propType: "'extends' | 'implements'" } as const,
      types: { tag: 'list', typeRef: 'ExpressionWithTypeArguments' } as const,
    },
  },
  EnumMember: {
    memberOf: ['Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'PropertyName' } as const,
      initializer: { tag: 'optChild', typeRef: 'Expression' } as const,
    },
  },
  ModuleBlock: {
    memberOf: ['ModuleBody'],
    fields: {
      statements: { tag: 'list', typeRef: 'Statement' } as const,
      localCount: { tag: 'prop', propType: 'number' } as const,
    },
  },
  TypeReference: {
    memberOf: ['TypeNode'],
    fields: {
      typeName: { tag: 'child', typeRef: 'EntityName' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
    },
  },
  TypeLiteral: {
    memberOf: ['TypeNode', 'Declaration', 'ObjectTypeDeclaration'],
    fields: {
      members: { tag: 'list', typeRef: 'TypeElement' } as const,
    },
  },
  UnionType: {
    memberOf: ['TypeNode'],
    fields: {
      types: { tag: 'list', typeRef: 'TypeNode' } as const,
    },
  },
  IntersectionType: {
    memberOf: ['TypeNode'],
    fields: {
      types: { tag: 'list', typeRef: 'TypeNode' } as const,
    },
  },
  FunctionType: {
    memberOf: ['TypeNode', 'Declaration', 'SignatureDeclaration'],
    fields: {
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  ConstructorType: {
    memberOf: ['TypeNode', 'Declaration', 'SignatureDeclaration'],
    fields: {
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  ArrayType: {
    memberOf: ['TypeNode'],
    fields: {
      elementType: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  TupleType: {
    memberOf: ['TypeNode'],
    fields: {
      elements: { tag: 'list', typeRef: 'TypeNode' } as const,
    },
  },
  NamedTupleMember: {
    memberOf: ['TypeNode', 'Declaration'],
    fields: {
      name: { tag: 'child', typeRef: 'Identifier' } as const,
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
      dotDotDotToken: { tag: 'optChild', typeRef: 'DotDotDotToken' } as const,
      questionToken: { tag: 'optChild', typeRef: 'QuestionToken' } as const,
    },
  },
  OptionalType: {
    memberOf: ['TypeNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  RestType: {
    memberOf: ['TypeNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  LiteralType: {
    memberOf: ['TypeNode'],
    fields: {
      literal: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  ConditionalType: {
    memberOf: ['TypeNode'],
    fields: {
      checkType: { tag: 'child', typeRef: 'TypeNode' } as const,
      extendsType: { tag: 'child', typeRef: 'TypeNode' } as const,
      trueType: { tag: 'child', typeRef: 'TypeNode' } as const,
      falseType: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  InferType: {
    memberOf: ['TypeNode'],
    fields: {
      typeParameter: { tag: 'child', typeRef: 'TypeParameter' } as const,
    },
  },
  ParenthesizedType: {
    memberOf: ['TypeNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  TypeOperator: {
    memberOf: ['TypeNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
      operator: { tag: 'prop', propType: "'keyof' | 'unique' | 'readonly'" } as const,
    },
  },
  IndexedAccessType: {
    memberOf: ['TypeNode'],
    fields: {
      objectType: { tag: 'child', typeRef: 'TypeNode' } as const,
      indexType: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  MappedType: {
    memberOf: ['TypeNode', 'Declaration'],
    fields: {
      typeParameter: { tag: 'child', typeRef: 'TypeParameter' } as const,
      nameType: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
      readonlyToken: { tag: 'optChild', typeRef: 'Token' } as const,
      questionToken: { tag: 'optChild', typeRef: 'Token' } as const,
    },
  },
  TypeQuery: {
    memberOf: ['TypeNode'],
    fields: {
      exprName: { tag: 'child', typeRef: 'EntityName' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
    },
  },
  TypePredicate: {
    memberOf: ['TypeNode'],
    fields: {
      assertsModifier: { tag: 'optChild', typeRef: 'AssertsKeyword' } as const,
      parameterName: { tag: 'child', typeRef: 'TypePredicateParameterName' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
    },
  },
  TemplateLiteralType: {
    memberOf: ['TypeNode'],
    fields: {
      head: { tag: 'child', typeRef: 'TemplateHead' } as const,
      templateSpans: { tag: 'list', typeRef: 'TemplateLiteralTypeSpan' } as const,
    },
  },
  TemplateLiteralTypeSpan: {
    memberOf: ['TypeNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
      literal: { tag: 'child', typeRef: 'TemplateLiteralToken' } as const,
    },
  },
  ImportType: {
    memberOf: ['TypeNode'],
    fields: {
      argument: { tag: 'child', typeRef: 'TypeNode' } as const,
      attributes: { tag: 'optChild', typeRef: 'ImportAttributes' } as const,
      qualifier: { tag: 'optChild', typeRef: 'EntityName' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
      isTypeOf: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  JsxElement: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'JsxNode', 'JsxAttributeValue', 'JsxChild'],
    fields: {
      openingElement: { tag: 'child', typeRef: 'JsxOpeningElement' } as const,
      jsxChildren: { tag: 'list', typeRef: 'JsxChild' } as const,
      closingElement: { tag: 'child', typeRef: 'JsxClosingElement' } as const,
    },
  },
  JsxSelfClosingElement: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'JsxNode', 'JsxAttributeValue', 'JsxChild'],
    fields: {
      tagName: { tag: 'child', typeRef: 'JsxTagName' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
      attributes: { tag: 'child', typeRef: 'JsxAttributes' } as const,
    },
  },
  JsxOpeningElement: {
    memberOf: ['Expression', 'JsxNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'JsxTagName' } as const,
      typeArguments: { tag: 'list', typeRef: 'TypeNode' } as const,
      attributes: { tag: 'child', typeRef: 'JsxAttributes' } as const,
    },
  },
  JsxClosingElement: {
    memberOf: ['JsxNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'JsxTagName' } as const,
    },
  },
  JsxFragment: {
    memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'JsxNode', 'JsxAttributeValue', 'JsxChild'],
    fields: {
      openingFragment: { tag: 'child', typeRef: 'JsxOpeningFragment' } as const,
      jsxChildren: { tag: 'list', typeRef: 'JsxChild' } as const,
      closingFragment: { tag: 'child', typeRef: 'JsxClosingFragment' } as const,
    },
  },
  JsxAttribute: {
    memberOf: ['Declaration', 'JsxNode', 'JsxAttributeLike'],
    fields: {
      name: { tag: 'child', typeRef: 'JsxAttributeName' } as const,
      initializer: { tag: 'optChild', typeRef: 'JsxAttributeValue' } as const,
    },
  },
  JsxAttributes: {
    memberOf: ['Declaration', 'JsxNode'],
    fields: {
      properties: { tag: 'list', typeRef: 'JsxAttributeLike' } as const,
    },
  },
  JsxSpreadAttribute: {
    memberOf: ['JsxNode', 'JsxAttributeLike'],
    fields: {
      expression: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  JsxExpression: {
    memberOf: ['Expression', 'JsxNode', 'JsxAttributeValue', 'JsxChild'],
    fields: {
      dotDotDotToken: { tag: 'optChild', typeRef: 'DotDotDotToken' } as const,
      expression: { tag: 'optChild', typeRef: 'Expression' } as const,
    },
  },
  JsxNamespacedName: {
    memberOf: ['JsxNode', 'JsxAttributeName', 'JsxTagName'],
    fields: {
      namespace: { tag: 'child', typeRef: 'Identifier' } as const,
      name: { tag: 'child', typeRef: 'Identifier' } as const,
    },
  },
  JSDocTypeExpression: {
    memberOf: ['TypeNode', 'JSDocNode', 'JSDocTypedefType'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  JSDocNameReference: {
    memberOf: ['JSDocNode', 'JSDocMemberLeft'],
    fields: {
      name: { tag: 'child', typeRef: 'EntityName' } as const,
    },
  },
  JSDocMemberName: {
    memberOf: ['JSDocNode', 'JSDocMemberLeft'],
    fields: {
      left: { tag: 'child', typeRef: 'JSDocMemberLeft' } as const,
      right: { tag: 'child', typeRef: 'Identifier' } as const,
    },
  },
  JSDocNullableType: {
    memberOf: ['TypeNode', 'JSDocNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  JSDocNonNullableType: {
    memberOf: ['TypeNode', 'JSDocNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  JSDocOptionalType: {
    memberOf: ['TypeNode', 'JSDocNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  JSDocFunctionType: {
    memberOf: ['TypeNode', 'Declaration', 'SignatureDeclaration', 'JSDocNode'],
    fields: {
      parameters: { tag: 'list', typeRef: 'Parameter' } as const,
      type: { tag: 'optChild', typeRef: 'TypeNode' } as const,
    },
  },
  JSDocVariadicType: {
    memberOf: ['TypeNode', 'JSDocNode'],
    fields: {
      type: { tag: 'child', typeRef: 'TypeNode' } as const,
    },
  },
  JSDocTypeLiteral: {
    memberOf: ['TypeNode', 'JSDocNode', 'JSDocTypedefType'],
    fields: {
      jsDocPropertyTags: { tag: 'list', typeRef: 'JSDocPropertyTag' } as const,
      isArrayType: { tag: 'prop', propType: 'boolean' } as const,
    },
  },
  MissingDeclaration: {
    memberOf: ['Statement', 'Declaration', 'DeclarationStatement'],
    fields: {
      modifiers: { tag: 'list', typeRef: 'Modifier' } as const,
    },
  },
  SourceFile: { memberOf: [], fields: {} },
  AssertClause: {
    memberOf: [],
    fields: {
      elements: { tag: 'list', typeRef: 'AssertEntry' } as const,
    },
  },
  AssertEntry: {
    memberOf: [],
    fields: {
      name: { tag: 'child', typeRef: 'ImportAttributeName' } as const,
      value: { tag: 'child', typeRef: 'Expression' } as const,
    },
  },
  JSDocComment: { memberOf: ['JSDocNode'], fields: {} },
  Unknown: { memberOf: [], fields: {} },
  EndOfFileToken: { memberOf: [], fields: {} },
  SingleLineCommentTrivia: { memberOf: [], fields: {} },
  MultiLineCommentTrivia: { memberOf: [], fields: {} },
  NewLineTrivia: { memberOf: [], fields: {} },
  WhitespaceTrivia: { memberOf: [], fields: {} },
  ShebangTrivia: { memberOf: [], fields: {} },
  ConflictMarkerTrivia: { memberOf: [], fields: {} },
  NonTextFileMarkerTrivia: { memberOf: [], fields: {} },
  JsxTextAllWhiteSpaces: { memberOf: [], fields: {} },
  OpenBraceToken: { memberOf: ['Token'], fields: {} },
  CloseBraceToken: { memberOf: ['Token'], fields: {} },
  OpenParenToken: { memberOf: ['Token'], fields: {} },
  CloseParenToken: { memberOf: ['Token'], fields: {} },
  OpenBracketToken: { memberOf: ['Token'], fields: {} },
  CloseBracketToken: { memberOf: ['Token'], fields: {} },
  DotToken: { memberOf: ['Token'], fields: {} },
  DotDotDotToken: { memberOf: ['Token'], fields: {} },
  SemicolonToken: { memberOf: ['Token'], fields: {} },
  CommaToken: { memberOf: ['Token'], fields: {} },
  QuestionDotToken: { memberOf: ['Token'], fields: {} },
  LessThanToken: { memberOf: ['Token'], fields: {} },
  LessThanSlashToken: { memberOf: ['Token'], fields: {} },
  GreaterThanToken: { memberOf: ['Token'], fields: {} },
  LessThanEqualsToken: { memberOf: ['Token'], fields: {} },
  GreaterThanEqualsToken: { memberOf: ['Token'], fields: {} },
  EqualsEqualsToken: { memberOf: ['Token'], fields: {} },
  ExclamationEqualsToken: { memberOf: ['Token'], fields: {} },
  EqualsEqualsEqualsToken: { memberOf: ['Token'], fields: {} },
  ExclamationEqualsEqualsToken: { memberOf: ['Token'], fields: {} },
  EqualsGreaterThanToken: { memberOf: ['Token'], fields: {} },
  PlusToken: { memberOf: ['Token'], fields: {} },
  MinusToken: { memberOf: ['Token'], fields: {} },
  AsteriskToken: { memberOf: ['Token'], fields: {} },
  AsteriskAsteriskToken: { memberOf: ['Token'], fields: {} },
  SlashToken: { memberOf: ['Token'], fields: {} },
  PercentToken: { memberOf: ['Token'], fields: {} },
  PlusPlusToken: { memberOf: ['Token'], fields: {} },
  MinusMinusToken: { memberOf: ['Token'], fields: {} },
  LessThanLessThanToken: { memberOf: ['Token'], fields: {} },
  GreaterThanGreaterThanToken: { memberOf: ['Token'], fields: {} },
  GreaterThanGreaterThanGreaterThanToken: { memberOf: ['Token'], fields: {} },
  AmpersandToken: { memberOf: ['Token'], fields: {} },
  BarToken: { memberOf: ['Token'], fields: {} },
  CaretToken: { memberOf: ['Token'], fields: {} },
  ExclamationToken: { memberOf: ['Token'], fields: {} },
  TildeToken: { memberOf: ['Token'], fields: {} },
  AmpersandAmpersandToken: { memberOf: ['Token'], fields: {} },
  BarBarToken: { memberOf: ['Token'], fields: {} },
  QuestionToken: { memberOf: ['Token'], fields: {} },
  ColonToken: { memberOf: ['Token'], fields: {} },
  AtToken: { memberOf: ['Token'], fields: {} },
  QuestionQuestionToken: { memberOf: ['Token'], fields: {} },
  BacktickToken: { memberOf: ['Token'], fields: {} },
  HashToken: { memberOf: ['Token'], fields: {} },
  EqualsToken: { memberOf: ['Token'], fields: {} },
  PlusEqualsToken: { memberOf: ['Token'], fields: {} },
  MinusEqualsToken: { memberOf: ['Token'], fields: {} },
  AsteriskEqualsToken: { memberOf: ['Token'], fields: {} },
  AsteriskAsteriskEqualsToken: { memberOf: ['Token'], fields: {} },
  SlashEqualsToken: { memberOf: ['Token'], fields: {} },
  PercentEqualsToken: { memberOf: ['Token'], fields: {} },
  LessThanLessThanEqualsToken: { memberOf: ['Token'], fields: {} },
  GreaterThanGreaterThanEqualsToken: { memberOf: ['Token'], fields: {} },
  GreaterThanGreaterThanGreaterThanEqualsToken: { memberOf: ['Token'], fields: {} },
  AmpersandEqualsToken: { memberOf: ['Token'], fields: {} },
  BarEqualsToken: { memberOf: ['Token'], fields: {} },
  BarBarEqualsToken: { memberOf: ['Token'], fields: {} },
  AmpersandAmpersandEqualsToken: { memberOf: ['Token'], fields: {} },
  QuestionQuestionEqualsToken: { memberOf: ['Token'], fields: {} },
  CaretEqualsToken: { memberOf: ['Token'], fields: {} },
  JSDocCommentTextToken: { memberOf: [], fields: {} },
  BreakKeyword: { memberOf: ['Keyword'], fields: {} },
  CaseKeyword: { memberOf: ['Keyword'], fields: {} },
  CatchKeyword: { memberOf: ['Keyword'], fields: {} },
  ClassKeyword: { memberOf: ['Keyword'], fields: {} },
  ConstKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  ContinueKeyword: { memberOf: ['Keyword'], fields: {} },
  DebuggerKeyword: { memberOf: ['Keyword'], fields: {} },
  DefaultKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  DeleteKeyword: { memberOf: ['Keyword'], fields: {} },
  DoKeyword: { memberOf: ['Keyword'], fields: {} },
  ElseKeyword: { memberOf: ['Keyword'], fields: {} },
  EnumKeyword: { memberOf: ['Keyword'], fields: {} },
  ExportKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  ExtendsKeyword: { memberOf: ['Keyword'], fields: {} },
  FalseKeyword: { memberOf: ['Keyword', 'Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Literal'], fields: {} },
  FinallyKeyword: { memberOf: ['Keyword'], fields: {} },
  ForKeyword: { memberOf: ['Keyword'], fields: {} },
  FunctionKeyword: { memberOf: ['Keyword'], fields: {} },
  IfKeyword: { memberOf: ['Keyword'], fields: {} },
  ImportKeyword: { memberOf: ['Keyword'], fields: {} },
  InKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  InstanceOfKeyword: { memberOf: ['Keyword'], fields: {} },
  NewKeyword: { memberOf: ['Keyword'], fields: {} },
  NullKeyword: { memberOf: ['Keyword', 'Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Literal'], fields: {} },
  ReturnKeyword: { memberOf: ['Keyword'], fields: {} },
  SuperKeyword: { memberOf: ['Keyword', 'Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression'], fields: {} },
  SwitchKeyword: { memberOf: ['Keyword'], fields: {} },
  ThisKeyword: { memberOf: ['Keyword', 'Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'JsxTagName', 'TypePredicateParameterName'], fields: {} },
  ThrowKeyword: { memberOf: ['Keyword'], fields: {} },
  TrueKeyword: { memberOf: ['Keyword', 'Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'Literal'], fields: {} },
  TryKeyword: { memberOf: ['Keyword'], fields: {} },
  TypeOfKeyword: { memberOf: ['Keyword'], fields: {} },
  VarKeyword: { memberOf: ['Keyword'], fields: {} },
  VoidKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  WhileKeyword: { memberOf: ['Keyword'], fields: {} },
  WithKeyword: { memberOf: ['Keyword'], fields: {} },
  ImplementsKeyword: { memberOf: ['Keyword'], fields: {} },
  InterfaceKeyword: { memberOf: ['Keyword'], fields: {} },
  LetKeyword: { memberOf: ['Keyword'], fields: {} },
  PackageKeyword: { memberOf: ['Keyword'], fields: {} },
  PrivateKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  ProtectedKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  PublicKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  StaticKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  YieldKeyword: { memberOf: ['Keyword'], fields: {} },
  AbstractKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  AccessorKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  AsKeyword: { memberOf: ['Keyword'], fields: {} },
  AssertsKeyword: { memberOf: ['Keyword'], fields: {} },
  AssertKeyword: { memberOf: ['Keyword'], fields: {} },
  AnyKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  AsyncKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  AwaitKeyword: { memberOf: ['Keyword'], fields: {} },
  BooleanKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  ConstructorKeyword: { memberOf: ['Keyword'], fields: {} },
  DeclareKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  GetKeyword: { memberOf: ['Keyword'], fields: {} },
  InferKeyword: { memberOf: ['Keyword'], fields: {} },
  IntrinsicKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  IsKeyword: { memberOf: ['Keyword'], fields: {} },
  KeyOfKeyword: { memberOf: ['Keyword'], fields: {} },
  ModuleKeyword: { memberOf: ['Keyword'], fields: {} },
  NamespaceKeyword: { memberOf: ['Keyword'], fields: {} },
  NeverKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  OutKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  ReadonlyKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  RequireKeyword: { memberOf: ['Keyword'], fields: {} },
  NumberKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  ObjectKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  SatisfiesKeyword: { memberOf: ['Keyword'], fields: {} },
  SetKeyword: { memberOf: ['Keyword'], fields: {} },
  StringKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  SymbolKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  TypeKeyword: { memberOf: ['Keyword'], fields: {} },
  UndefinedKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  UniqueKeyword: { memberOf: ['Keyword'], fields: {} },
  UnknownKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  UsingKeyword: { memberOf: ['Keyword'], fields: {} },
  FromKeyword: { memberOf: ['Keyword'], fields: {} },
  GlobalKeyword: { memberOf: ['Keyword'], fields: {} },
  BigIntKeyword: { memberOf: ['Keyword', 'TypeNode'], fields: {} },
  OverrideKeyword: { memberOf: ['Keyword', 'Modifier'], fields: {} },
  OfKeyword: { memberOf: ['Keyword'], fields: {} },
  DeferKeyword: { memberOf: ['Keyword'], fields: {} },
  JSDocAllType: { memberOf: ['TypeNode', 'JSDocNode'], fields: {} },
  JSDocUnknownType: { memberOf: ['TypeNode', 'JSDocNode'], fields: {} },
  JSDocNamepathType: { memberOf: ['TypeNode', 'JSDocNode'], fields: {} },
  JSDoc: {
    memberOf: ['JSDocNode'],
    fields: {
      tags: { tag: 'list', typeRef: 'JSDocNode' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocText: { memberOf: ['JSDocNode'], fields: {} },
  JSDocSignature: {
    memberOf: ['TypeNode', 'JSDocNode'],
    fields: {
      typeParameters: { tag: 'list', typeRef: 'JSDocTemplateTag' } as const,
      parameters: { tag: 'list', typeRef: 'JSDocParameterTag' } as const,
      type: { tag: 'optChild', typeRef: 'JSDocReturnTag' } as const,
    },
  },
  JSDocLink: {
    memberOf: ['JSDocNode'],
    fields: {
      name: { tag: 'optChild', typeRef: 'EntityName' } as const,
      linkText: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocLinkCode: {
    memberOf: ['JSDocNode'],
    fields: {
      name: { tag: 'optChild', typeRef: 'EntityName' } as const,
      linkText: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocLinkPlain: {
    memberOf: ['JSDocNode'],
    fields: {
      name: { tag: 'optChild', typeRef: 'EntityName' } as const,
      linkText: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocAugmentsTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      class: { tag: 'child', typeRef: 'ExpressionWithTypeArguments' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocImplementsTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      class: { tag: 'child', typeRef: 'ExpressionWithTypeArguments' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocAuthorTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocDeprecatedTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocClassTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocPublicTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocPrivateTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocProtectedTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocReadonlyTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocOverrideTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocCallbackTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      fullName: { tag: 'optChild', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'optChild', typeRef: 'JSDocSignature' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocOverloadTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'child', typeRef: 'JSDocSignature' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocEnumTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'child', typeRef: 'JSDocTypeExpression' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocParameterTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      name: { tag: 'child', typeRef: 'EntityName' } as const,
      typeExpression: { tag: 'optChild', typeRef: 'JSDocTypeExpression' } as const,
      isBracketed: { tag: 'prop', propType: 'boolean' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocReturnTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'optChild', typeRef: 'JSDocTypeExpression' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocThisTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'optChild', typeRef: 'JSDocTypeExpression' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocTypeTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'child', typeRef: 'JSDocTypeExpression' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocTemplateTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      typeParameters: { tag: 'list', typeRef: 'TypeParameter' } as const,
      constraint: { tag: 'optChild', typeRef: 'JSDocTypeExpression' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocTypedefTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      fullName: { tag: 'optChild', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'optChild', typeRef: 'JSDocTypedefType' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocSeeTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      name: { tag: 'optChild', typeRef: 'JSDocNameReference' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocPropertyTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      name: { tag: 'child', typeRef: 'EntityName' } as const,
      typeExpression: { tag: 'optChild', typeRef: 'JSDocTypeExpression' } as const,
      isBracketed: { tag: 'prop', propType: 'boolean' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocThrowsTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'optChild', typeRef: 'JSDocTypeExpression' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocSatisfiesTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      typeExpression: { tag: 'child', typeRef: 'JSDocTypeExpression' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  JSDocImportTag: {
    memberOf: ['JSDocNode'],
    fields: {
      tagName: { tag: 'child', typeRef: 'Identifier' } as const,
      importClause: { tag: 'optChild', typeRef: 'ImportClause' } as const,
      moduleSpecifier: { tag: 'child', typeRef: 'Expression' } as const,
      attributes: { tag: 'optChild', typeRef: 'ImportAttributes' } as const,
      comment: { tag: 'prop', propType: 'string' } as const,
    },
  },
  SyntaxList: { memberOf: [], fields: {} },
  NotEmittedStatement: { memberOf: ['Statement'], fields: {} },
  NotEmittedTypeElement: { memberOf: ['TypeElement'], fields: {} },
  SyntheticExpression: { memberOf: ['Expression'], fields: {} },
  SyntheticReferenceExpression: { memberOf: ['Expression', 'UnaryExpression', 'UpdateExpression', 'LeftHandSideExpression'], fields: {} },
  Bundle: { memberOf: [], fields: {} },
  ImportTypeAssertionContainer: { memberOf: [], fields: {} },
  ThisType: { memberOf: ['TypeNode', 'TypePredicateParameterName'], fields: {} },
  OmittedExpression: { memberOf: ['Expression', 'PrimaryExpression', 'MemberExpression', 'LeftHandSideExpression', 'UpdateExpression', 'UnaryExpression', 'ArrayBindingElement'], fields: {} },
  SemicolonClassElement: { memberOf: ['ClassElement'], fields: {} },
  EmptyStatement: { memberOf: ['Statement'], fields: {} },
  DebuggerStatement: { memberOf: ['Statement'], fields: {} },
  JsxOpeningFragment: { memberOf: ['JsxNode'], fields: {} },
  JsxClosingFragment: { memberOf: ['JsxNode'], fields: {} },
} satisfies Record<string, NodeDefShape>;

/** Union of all TS AST node kind strings (derived at the type level). */
export type TSNodeKind = keyof typeof NODES;
