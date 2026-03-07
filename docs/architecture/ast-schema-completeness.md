# AST Schema Completeness — Implementation Tracker

Tracks all improvements to make the ast-schema more comprehensive and accurate.

## Phase 1: Initial Improvements

### 1. Add missing fields on existing nodes
Status: **done**

| Node | Field added | Type | Notes |
|------|-------------|------|-------|
| `ImportDeclaration` | `attributes` | `optChild('ImportAttributes')` | Import attributes (`with { type: 'json' }`) |
| `ImportDeclaration` | `modifiers` | `list(Modifier)` | `type` modifier on imports |
| `ExportDeclaration` | `attributes` | `optChild('ImportAttributes')` | Import attributes on re-exports |
| `ExportDeclaration` | `modifiers` | `list(Modifier)` | Modifiers on re-exports |
| `TypeParameter` | `modifiers` | `list(Modifier)` | `in`/`out` variance modifiers (TS 4.7+) |
| `PropertyAssignment` | `questionToken` | `optChild('QuestionToken')` | Optional properties in object literals |

### 2. Add type refs to untyped child() calls
Status: **done**

New sum types created (with `sumTypeIncludes` for composite membership):
- `ForInitializer` = `VariableDeclarationList` + all `Expression` members (50 members)
- `ConciseBody` = `Block` + all `Expression` members (50 members)
- `JSDocMemberLeft` = `JSDocMemberName | JSDocNameReference`
- `JSDocTypedefType` = `JSDocTypeExpression | JSDocTypeLiteral`

Builder infrastructure added:
- `sumTypeIncludes(name, ...included)` — declares that a sum type includes all members of another
- `resolveIncludes()` — expands transitive memberships at codegen time

Fields updated:
- `ForStatement.initializer` → `optChild(ForInitializer)`
- `ForInStatement.initializer` → `child(ForInitializer)`
- `ForOfStatement.initializer` → `child(ForInitializer)`
- `ArrowFunction.body` → `child(ConciseBody)`
- `JSDocMemberName.left` → `child(JSDocMemberLeft)`
- `JSDocTypedefTag.typeExpression` → `optChild(JSDocTypedefType)`

### 3. Convert raw number operator props to string enums
Status: **done**

Fields converted from `prop('number')` to decoded string literals:
- `HeritageClause.token` → `prop("'extends' | 'implements'")`
- `PrefixUnaryExpression.operator` → `prop("'+' | '-' | '~' | '!' | '++' | '--'")`
- `PostfixUnaryExpression.operator` → `prop("'++' | '--'")`
- `TypeOperator.operator` → `prop("'keyof' | 'unique' | 'readonly'")`
- `MetaProperty.keywordToken` → `prop("'new' | 'import'")`

Conversion maps added to `convert.ts`: `prefixUnaryOperatorMap`, `postfixUnaryOperatorMap`, `typeOperatorMap`, `heritageTokenMap`, `metaPropertyKeywordMap`.

### 4. Upgrade JSDoc leaves that have real structure
Status: **done**

Nodes upgraded from `leaf()` to `node()`:
- `JSDocAuthorTag` → `tagName: child('Identifier'), comment: prop('string')`
- `JSDocClassTag` → `tagName: child('Identifier'), comment: prop('string')`
- `JSDocPublicTag` → `tagName: child('Identifier'), comment: prop('string')`
- `JSDocPrivateTag` → `tagName: child('Identifier'), comment: prop('string')`
- `JSDocProtectedTag` → `tagName: child('Identifier'), comment: prop('string')`
- `JSDocReadonlyTag` → `tagName: child('Identifier'), comment: prop('string')`
- `JSDocOverrideTag` → `tagName: child('Identifier'), comment: prop('string')`
- `JSDocLink` → `name: optChild(EntityName), linkText: prop('string')`
- `JSDocLinkCode` → `name: optChild(EntityName), linkText: prop('string')`
- `JSDocLinkPlain` → `name: optChild(EntityName), linkText: prop('string')`
- `JSDocSignature` → `typeParameters: list('JSDocTemplateTag'), parameters: list('JSDocParameterTag'), type: optChild('JSDocReturnTag')`

Note: JSDocLink field named `linkText` (not `text`) to avoid collision with the base `KSNodeBase.text` property.

### 5. Richer CompilationUnit
Status: **done**

Field added:
- `languageVariant` → `prop("'Standard' | 'JSX'")` — distinguishes .tsx from .ts files

### 6. Generate convert.ts from the schema
Status: **deferred** — requires adding TS SyntaxKind mapping to schema; out of scope for this pass

### 7. Derived convenience props
Status: **skipped** — these belong in AG equations, not the schema

## Phase 2: Comprehensive Audit

Automated comparison of every TS AST node against our schema, identifying missing child nodes and properties.

### 8. Missing child node fields
Status: **done**

| Node | Field added | Type | Notes |
|------|-------------|------|-------|
| `JsxElement` | `jsxChildren` | `list(JsxChild)` | Child elements/text/expressions |
| `JsxFragment` | `jsxChildren` | `list(JsxChild)` | Fragment child elements |
| `JSDoc` | `tags` | `list(JSDocNode)` | JSDoc block tags |
| `JSDocTypeLiteral` | `jsDocPropertyTags` | `list('JSDocPropertyTag')` | Property tags in typedef |
| `TypeQuery` | `typeArguments` | `list(TypeNode)` | `typeof X<T>` type arguments |
| `TypePredicate` | `assertsModifier` | `optChild('AssertsKeyword')` | `asserts x is T` modifier |
| `ConditionalExpression` | `questionToken` | `child('QuestionToken')` | `?` token |
| `ConditionalExpression` | `colonToken` | `child('ColonToken')` | `:` token |
| `ArrowFunction` | `equalsGreaterThanToken` | `child('EqualsGreaterThanToken')` | `=>` token |
| `JSDocImportTag` | `importClause` | `optChild('ImportClause')` | Import clause |
| `JSDocImportTag` | `moduleSpecifier` | `child(Expression)` | Module specifier |
| `JSDocImportTag` | `attributes` | `optChild('ImportAttributes')` | Import attributes |
| `ExportAssignment` | `modifiers` | `list(Modifier)` | Export modifiers |
| `VariableDeclaration` | `exclamationToken` | `optChild('ExclamationToken')` | Definite assignment assertion |
| `ImportType` | `attributes` | `optChild('ImportAttributes')` | Import attributes on type imports |
| `TaggedTemplateExpression` | `questionDotToken` | `optChild('QuestionDotToken')` | Optional chaining on tagged templates |
| `MethodSignature` | `questionToken` | `optChild('QuestionToken')` | Optional method in interface |
| `NamespaceExportDeclaration` | `modifiers` | `list(Modifier)` | Modifiers on namespace exports |
| `JsxExpression` | `dotDotDotToken` | `optChild('DotDotDotToken')` | Spread in JSX expressions |

New sum type created:
- `JsxChild` = `JsxText | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment` (5 members)

### 9. Convert.ts updates for Phase 2
Status: **done**

All new schema fields have corresponding extraction logic in `convert.ts`. Notable implementation details:
- `TaggedTemplateExpression.questionDotToken` uses `(n as any).questionDotToken` (not on public TS types)
- `JSDocTypeLiteral.jsDocPropertyTags` uses manual `.map()` instead of `findChildrenOf()` (readonly array, not `NodeArray`)

---

## Summary

All actionable items (1-5, 8-9) implemented across two phases. Schema now has:
- 364 nodes, 48 sum types (up from 25)
- 453 fields across 188 complex nodes (up from ~400 across ~176)
- 0 untyped `child()` / `optChild()` calls
- 0 raw `prop('number')` fields for operator/token enums
- 11 JSDoc nodes upgraded from leaf to structured
- Full import attributes support on ImportDeclaration/ExportDeclaration/ImportType
- Comprehensive child node coverage verified by automated audit against TS compiler

Verification: 362/362 TS SyntaxKinds covered, 0 errors, 107 tests pass.
