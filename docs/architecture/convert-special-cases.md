# convert.ts Special Cases Analysis

Analysis of every special case in the schema-driven `convert.ts` codegen
(`ast-schema/codegen.ts`), evaluating whether each should be kept or removed.

**Principle:** KS AST should mirror TS as closely as possible. Special cases
should only exist when there is a structural reason the default handler
cannot work.

---

## Categories

### 1. Explicit Field Overrides (`convertFieldOverrides`)

#### REMOVE — Default handler works

| Node | Field | Override | Why removable |
|------|-------|----------|---------------|
| `Identifier` | `escapedText` | `n.text ?? ""` | TS has `escapedText` as own property. Default `n.escapedText ?? ""` is correct. Override used a getter instead. |
| `PrivateIdentifier` | `escapedText` | `n.text ?? ""` | Same as Identifier. |
| `ImportDeclaration` | `attributes` | `findChild(children, n.attributes ?? n.assertClause)` | On TS 5.9+, `.attributes` always exists. `assertClause` fallback is legacy compat for pre-5.3 TS. Default `findChild(children, n.attributes)` works. |
| `ExportDeclaration` | `attributes` | `findChild(children, n.attributes ?? n.assertClause)` | Same as ImportDeclaration. |
| `JSDocTypeLiteral` | `jsDocPropertyTags` | Manual `map + get + filter` | `.jsDocPropertyTags` IS a NodeArray (has `.pos`/`.end`). Default `findChildrenOf(children, n.jsDocPropertyTags)` works. |

#### REMOVE — Convert to auto-detection rule

| Node(s) | Field | Override | New auto-rule |
|----------|-------|----------|---------------|
| `StringLiteral`, `NumericLiteral`, `BigIntLiteral`, `RegularExpressionLiteral`, `NoSubstitutionTemplateLiteral`, `TemplateHead`, `TemplateMiddle`, `TemplateTail`, `JsxText` (9 nodes) | `value` | `n.text ?? ""` | **Auto-detect:** if field is `value: prop('string')`, emit `n.text ?? ""`. Reason: TS uses `.text` for the literal value, but we must rename to `value` to avoid collision with the base KS `text` (source text) property. |
| `JSDocLink`, `JSDocLinkCode`, `JSDocLinkPlain` (3 nodes) | `linkText` | `n.text ?? ""` | **Auto-detect:** if field is `linkText: prop('string')`, emit `n.text ?? ""`. Same `.text` collision reason. |
| `JSDoc` | `comment` | `typeof n.comment === "string" ? n.comment : ""` | Already covered by JSDoc comment auto-detection (JSDoc is a member of JSDocNode sum type). |

#### REMOVE — Schema rename eliminates need

| Node | Field | Override | Action |
|------|-------|----------|--------|
| `JSDocCallbackTag` | `name` | `findChild(children, n.fullName)` | Rename schema field from `name` to `fullName`. TS's `forEachChild` visits `fullName`, not `name`. With qualified names like `Foo.Bar`, they're different objects — `findChild(children, n.name)` would fail. After rename, default `findChild(children, n.fullName)` works. |
| `JSDocTypedefTag` | `name` | `findChild(children, n.fullName)` | Same as JSDocCallbackTag. |

#### KEEP — Necessary (numeric-to-string decoding)

| Node | Field | Override | Why necessary |
|------|-------|----------|---------------|
| `PrefixUnaryExpression` | `operator` | `prefixUnaryOperatorMap[n.operator]` | TS stores operator as numeric `SyntaxKind` (e.g. 41 = MinusToken). We decode to human-readable string (`"-"`). |
| `PostfixUnaryExpression` | `operator` | `postfixUnaryOperatorMap[n.operator]` | Same pattern. |
| `TypeOperator` | `operator` | `typeOperatorMap[n.operator]` | Same — `keyof`, `unique`, `readonly`. |
| `HeritageClause` | `token` | `heritageTokenMap[n.token]` | Same — `extends`, `implements`. |
| `MetaProperty` | `keywordToken` | `metaPropertyKeywordMap[n.keywordToken]` | Same — `new`, `import`. |

#### KEEP — Necessary (flag decoding)

| Node | Field | Override | Why necessary |
|------|-------|----------|---------------|
| `VariableDeclarationList` | `declarationKind` | `getDeclarationKind(n.flags)` | TS stores `const`/`let`/`var` in `NodeFlags` bit field. We decode to a string. No TS property to read directly. |

### 2. Auto-Detection Rules (`getConvertFieldExpr`)

#### REMOVE — Default handler is sufficient

| Rule | Detection | Generated code | Why removable |
|------|-----------|---------------|---------------|
| `modifiers` | `fname === 'modifiers' && list && typeRef === 'Modifier'` | `extractModifiers(children, n)` | `extractModifiers` just wraps `findChildrenOf(children, n.modifiers)` with a null check. `findChildrenOf` already handles `undefined` → `[]`. Default `findChildrenOf(children, n.modifiers)` is identical. |

#### KEEP — Necessary

| Rule | Detection | Generated code | Why necessary |
|------|-----------|---------------|---------------|
| JSDoc `comment` | `fname === 'comment' && prop('string') && JSDocNode member` | `extractJSDocComment(n)` | TS's `.comment` can be `string \| NodeArray<JSDocComment> \| undefined`. Default `n.comment ?? ""` would pass through a NodeArray object. Must check `typeof`. |

### 3. Other Special Cases

| Case | Why it exists | Status |
|------|---------------|--------|
| `syntaxKindOverrides` (`JSDocCommentTextToken: 82`) | TS runtime has `SyntaxKind.JSDocCommentTextToken = 82` but the type declarations don't expose it. | **KEEP** — required to compile. |
| `convertSkipNodes` (`Program`, `CompilationUnit`) | These nodes have custom converters (not generated from schema). | **KEEP** — structural necessity. |

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Remove (default works) | 5 field overrides | Delete from `convertFieldOverrides` |
| Remove (→ auto-detect) | 13 field overrides | Replace with 2 auto-detection rules |
| Remove (schema rename) | 2 field overrides | Rename schema fields, delete overrides |
| Remove (auto-detect rule) | 1 rule | Delete modifiers auto-detection |
| Keep (operator decode) | 5 field overrides | Necessary divergence from TS |
| Keep (flag decode) | 1 field override | Necessary divergence from TS |
| Keep (JSDoc comment) | 1 auto-detect rule | Type check necessary |
| Keep (other) | 2 cases | Structural necessity |

**Before:** 26 explicit field overrides + 2 auto-detection rules
**After:** 6 explicit field overrides + 2 auto-detection rules

**Net reduction:** 20 explicit overrides removed. All removals verified with
`tsc --noEmit` (0 errors) and `vitest run` (107/107 tests passing).

### Schema changes made

- `JSDocCallbackTag.name` → `JSDocCallbackTag.fullName` (matches TS property)
- `JSDocTypedefTag.name` → `JSDocTypedefTag.fullName` (matches TS property)
