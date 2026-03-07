# ast-schema — KSC AST Schema & Codegen

Single source of truth for all KSC AST node definitions. Defines 364 node kinds
and 48 sum types mirroring TypeScript's full AST hierarchy, then generates
strictly-typed interfaces, runtime schema, and type guards.

## Quick Start

```bash
# Generate output files (after editing schema.ts)
npx tsx ast-schema/codegen.ts

# Verify schema matches TypeScript's AST
npx tsx ast-schema/verify.ts
```

## Directory Layout

```
ast-schema/
├── builder.ts          Schema builder DSL (sumType, node, leaf, child, etc.)
├── schema.ts           THE source of truth — all 364 nodes, hand-written
├── codegen.ts          Reads schema, writes generated/ output
├── verify.ts           Compares schema against TypeScript's SyntaxKind enum
├── README.md           This file
└── generated/          AUTO-GENERATED — do not edit
    ├── node-types.ts   KS* interfaces, KSNode union, sum type unions, type guards
    ├── schema.ts       getChildren, allKinds, getChildFields (pure static code)
    ├── convert.ts      TS → KS AST conversion layer (buildKSTree)
    ├── builders.ts     Factory functions for constructing KS nodes
    ├── serialize.ts    Schema-aware JSON serialization (nodeToJSON/nodeFromJSON)
    └── index.ts        Barrel re-export of everything above
```

## How It Works

### 1. Schema Definition (`schema.ts`)

The schema declares every AST node using builder functions from `builder.ts`:

```ts
// Declare a sum type
const Expression = sumType('Expression');

// Declare a node with typed child fields
node('IfStatement', [Statement], {
  expression: child(Expression),      // required child
  thenStatement: child(Statement),
  elseStatement: optChild(Statement),  // optional child
});

// Declare a leaf node (no named children)
leaf('TrueKeyword', Keyword, Expression, PrimaryExpression, ...);
```

**Field types:**
| Builder       | Meaning                        | Generated TS type         |
|---------------|--------------------------------|---------------------------|
| `child(T)`    | Required child node of type T  | `T`                       |
| `optChild(T)` | Optional child node            | `T \| undefined`          |
| `list(T)`     | Ordered list of child nodes    | `T[]`                     |
| `prop(type)`  | Scalar property (not a node)   | The literal type string   |

The type argument `T` can be a sum type name (`Expression`), a specific node
kind (`'Identifier'`), or a composite sum type created with `sumTypeIncludes()`
(e.g., `ForInitializer` = VariableDeclarationList + all Expression members).

### 2. Code Generation (`codegen.ts`)

Importing `schema.ts` populates global registries in `builder.ts` as a side
effect. The codegen script reads these registries and writes six files:

- **`node-types.ts`** — `KSCommentRange` interface, `KSNodeBase` with optional
  `leadingComments`/`trailingComments`, one `KS*` interface per node kind, the
  `KSNode` discriminated union, sum type union aliases (`KSExpression`,
  `KSStatement`, etc.), and `is*()` type guard functions.

- **`schema.ts`** — Pure generated static code with zero library dependencies.
  Contains an internal `C` lookup table mapping complex node kinds to their child
  field names, plus three exports: `getChildren(node)` (ordered child extraction),
  `allKinds` (Set of all 364 kind strings), and `getChildFields(kind)`.

- **`convert.ts`** — TS → KS AST conversion. Walks the TypeScript AST via
  `forEachChild` and produces the KS mirror tree. Uses a `WeakMap<ts.Node, KSNode>`
  for identity-based child lookup. Only 6 field overrides remain (operator/token
  decoding and `declarationKind`); everything else maps 1:1 from TS property
  names. See [`docs/architecture/convert-special-cases.md`](../docs/architecture/convert-special-cases.md).

- **`builders.ts`** — Factory functions (`createXxx()`) for constructing valid
  KS nodes from field values without parsing.

- **`serialize.ts`** — Schema-aware JSON serialization. `nodeToJSON`/`nodeFromJSON`
  preserve typed fields through round-trips.

- **`index.ts`** — Barrel re-export of all types, guards, schema, builders,
  and serialization.

### 3. Verification (`verify.ts`)

Runs four automated checks against the TypeScript compiler API:

1. **Kind coverage** — every `ts.SyntaxKind` (362 values, excluding range
   aliases like `FirstKeyword`) has a matching node in our schema.
2. **Sum type sanity** — all 48 sum types checked: members exist, no duplicates,
   expression hierarchy subset relationships hold (Primary ⊂ Member ⊂
   LeftHandSide ⊂ Update ⊂ Unary ⊂ Expression).
3. **Field reference validation** — all 453 fields across 188 complex nodes
   checked: every `typeRef` resolves to a known node kind or sum type.
4. **Type guard cross-check** — parses sample code, walks the AST, and compares
   `ts.isExpression()` / `ts.isStatement()` / `ts.isTypeNode()` results against
   our sum type memberships.

## Sum Types

48 sum types organized into several hierarchies:

### Expression hierarchy (nested subsets)
```
Expression (49 members)
 └─ UnaryExpression (38)
     └─ UpdateExpression (33)
         └─ LeftHandSideExpression (31)
             └─ MemberExpression (26)
                 └─ PrimaryExpression (23)
```

### Declaration hierarchy
- `Declaration` — all declaration nodes (50 members)
- `DeclarationStatement` — declarations that are also statements
- `FunctionLikeDeclaration` — function, method, constructor, accessor, arrow
- `ClassLikeDeclaration` — class declaration, class expression
- `ObjectTypeDeclaration` — interface, class, type literal
- `SignatureDeclaration` — call/construct/method signatures, function/constructor types

### Name and binding types
- `EntityName` — Identifier | QualifiedName
- `BindingName` — Identifier | ObjectBindingPattern | ArrayBindingPattern
- `MemberName` — Identifier | PrivateIdentifier
- `PropertyName` — Identifier | PrivateIdentifier | ComputedPropertyName | StringLiteral | NumericLiteral | BigIntLiteral
- `ImportAttributeName` — Identifier | StringLiteral

### Module types
- `ModuleBody` — ModuleBlock | ModuleDeclaration
- `ModuleName` — Identifier | StringLiteral
- `ModuleReference` — Identifier | QualifiedName | ExternalModuleReference
- `NamedImportBindings` — NamespaceImport | NamedImports
- `NamedExportBindings` — NamespaceExport | NamedExports

### Template types
- `TemplateLiteral` — TemplateExpression | NoSubstitutionTemplateLiteral
- `TemplateLiteralToken` — TemplateMiddle | TemplateTail

### Other categories
- `Statement` (32), `TypeNode` (48), `ClassElement`, `TypeElement`,
  `ObjectLiteralElement`, `Token` (61), `Keyword` (84), `Modifier` (15),
  `BindingPattern`, `Literal`
- `CaseOrDefaultClause` — CaseClause | DefaultClause
- `ArrayBindingElement` — BindingElement | OmittedExpression
- `TypePredicateParameterName` — Identifier | ThisType | ThisKeyword

### JSX types
- `JsxNode` — all JSX-related nodes
- `JsxChild` — JsxText | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment
- `JsxAttributeLike` — JsxAttribute | JsxSpreadAttribute
- `JsxTagName` — Identifier | PropertyAccessExpression | JsxNamespacedName | ThisKeyword
- `JsxAttributeName` — Identifier | JsxNamespacedName
- `JsxAttributeValue` — StringLiteral | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment

### JSDoc
- `JSDocNode` — all JSDoc nodes (44 members, 16 with structured fields)
- `JSDocMemberLeft` — JSDocMemberName | JSDocNameReference
- `JSDocTypedefType` — JSDocTypeExpression | JSDocTypeLiteral

### Composite sum types (include all members of another sum type)
- `ForInitializer` — VariableDeclarationList + all Expression members
- `ConciseBody` — Block + all Expression members

## Comment Association

Every node can optionally carry leading and trailing comment ranges:

```ts
interface KSCommentRange {
  pos: number;
  end: number;
  kind: 'SingleLine' | 'MultiLine';
  hasTrailingNewLine?: boolean;
}

interface KSNodeBase {
  // ...
  leadingComments?: KSCommentRange[];
  trailingComments?: KSCommentRange[];
}
```

Comments are extracted in `convert.ts` using `ts.getLeadingCommentRanges()` and
`ts.getTrailingCommentRanges()`. Only nodes with actual comments get these
fields populated.

## Integration with KSC Pipeline

The generated code is consumed through a four-module architecture:

- **`src/pipeline/ast.ts`** — Single import point for all AST concerns. Re-exports
  types, `getChildren`, `allKinds`, and `getChildFields` from `ast-schema/generated/`.
- **`src/pipeline/convert.ts`** — Thin re-export from `ast-schema/generated/convert.ts`.
  All conversion logic is schema-generated.
- **`ksc-behavior/`** — AG specs (binder, checker) that operate on the typed AST nodes.
  Depends on ast-schema for node types and `ag-behavior/` for `SpecInput`.
- **`ksc-interpreter/`** — Orchestration. `evaluate()` passes `getChildren` to
  `createGrammar()` from `ag-interpreter/`. This is the only bridge between AST
  structure and the AG evaluation engine.

```
ast-schema/generated/     ksc-behavior/          ag-behavior/
  node-types.ts             binder.ts              spec.ts (SpecInput, AttrDecl)
  schema.ts                 checker.ts
  (getChildren)             types.ts             ag-interpreter/
  (allKinds)                                       grammar, semantics, interpret
       \                        |                       /
        \                       |                      /
         ▼                      ▼                     ▼
                     ksc-interpreter/evaluate.ts
                     (wires data + behavior + engine)
                                |
                                ▼
                            src/program.ts
```

## Composite Sum Types

Some fields have unions like `Expression | Block` — too large to list as flat
sum types. These are handled via `sumTypeIncludes()`, which creates a composite
sum type that includes all members of another sum type plus additional members:

| Sum Type | Composition | Used by |
|----------|------------|---------|
| `ForInitializer` | VariableDeclarationList + all Expression members | `ForStatement.initializer`, `ForInStatement.initializer`, `ForOfStatement.initializer` |
| `ConciseBody` | Block + all Expression members | `ArrowFunction.body` |
| `JSDocMemberLeft` | JSDocMemberName \| JSDocNameReference | `JSDocMemberName.left` |
| `JSDocTypedefType` | JSDocTypeExpression \| JSDocTypeLiteral | `JSDocTypedefTag.typeExpression` |

## Modifying the Schema

1. Edit `ast-schema/schema.ts` (add/remove/modify nodes or sum types).
2. Run `npx tsx ast-schema/codegen.ts` to regenerate output.
3. Run `npx tsx ast-schema/verify.ts` to check against TypeScript.
4. Run `npx vitest run` to confirm the pipeline still works.
