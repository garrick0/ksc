# Schema-Driven AST Generation: Prior Art Research

Comparative analysis of compiler projects that use schema-first AST generation,
benchmarked against KSC's `ast-schema` system.

---

## KSC (Our System)

**Schema format:** TypeScript builder DSL (`schema.ts`) using `node()`, `leaf()`,
`sumType()`, `child()`, `optChild()`, `list()`, `prop()`.

**Scale:** 364 node kinds, 48 sum types, 453 fields across 188 complex nodes.

**What we generate** (from `codegen.ts`):

| Output | Contents |
|--------|----------|
| `node-types.ts` | `KS*` interfaces, `KSNode` discriminated union, sum type unions, `is*()` type guards |
| `schema.ts` | `getChildren()`, `allKinds`, `getChildFields()` — pure static code, no runtime library |
| `convert.ts` | TS → KS AST conversion (364 node converters, comment attachment) |
| `builders.ts` | Factory functions (`createXxx()`) for constructing KS nodes |
| `serialize.ts` | Schema-aware JSON serialization (`nodeToJSON`/`nodeFromJSON`) |
| `index.ts` | Barrel re-export |

**Runtime capabilities:** `getChildren()` (ordered child extraction from named fields),
`allKinds` (Set of all node kind strings), `getChildFields(kind)` (child field introspection).

**What we do NOT generate:** Visitors, rewriters/transformers,
pattern matching utilities, validation of constructed trees.

---

## 1. Roslyn (C# Compiler)

**Schema format:** Single XML file (`Syntax.xml`) with `<Node>`, `<AbstractNode>`,
`<PredefinedNode>`, and `<Field>` elements. Fields specify type, optionality,
minimum count, and allowed `SyntaxKind` values. A single `<Node>` can map to
multiple `SyntaxKind` values (e.g., `BinaryExpressionSyntax` covers ~30 kinds).

**What it generates** (3 files):

| Output | Contents |
|--------|----------|
| `Syntax.xml.Internal.Generated.cs` | Green tree node classes, green visitor, green rewriter, green factory |
| `Syntax.xml.Syntax.Generated.cs` | Red tree (public API) node classes with lazy child creation |
| `Syntax.xml.Main.Generated.cs` | Public visitors, rewriter, `SyntaxFactory` methods, `With*` updaters |

**Key capabilities beyond KSC:**

- **Visitor pattern** — Generated `CSharpSyntaxVisitor<TResult>` with a `Visit*` method
  per concrete node, plus `Accept()` on each node for dispatch.
- **Rewriter** — `CSharpSyntaxRewriter` visits all children by default, reconstructs via
  `Update()`. Override specific `Visit*` methods to transform. Returns original reference
  if nothing changed (structural sharing).
- **Factory methods** — Two layers: internal green factory (no validation, cached) for the
  parser hot path; public `SyntaxFactory` (validates arguments) for external consumers.
- **Immutable updaters** — Every property gets a `With*` method for functional updates.
  `Add*` helpers for collection properties.
- **Red-green tree** — Immutable green tree (width-based, structurally shared, cached) +
  lazily-constructed red facade (absolute positions, parent pointers). The schema generates
  both layers in lockstep.
- **Trivia** — Comments and whitespace are `SyntaxTrivia` structs attached to tokens as
  leading/trailing collections. Structured trivia (XML doc comments, preprocessor directives)
  are full syntax nodes accessible via `GetStructure()`.
- **Flag propagation** — `ContainsDiagnostics`, `ContainsAnnotations`, etc. bubble up from
  children to parents automatically. O(1) subtree queries.
- **Node caching** — Small green nodes (≤3 children) are identity-cached, so structurally
  identical subtrees share memory.

**Schema size:** ~2,500 lines of XML → thousands of lines of generated C#.

**Novel patterns:**
- Multi-kind nodes reduce class proliferation
- `ConditionalWeakTable` for diagnostics/annotations avoids node bloat
- The generator is itself a Roslyn incremental source generator

---

## 2. rust-analyzer (Ungrammar)

**Schema format:** Custom DSL (`.ungram`) describing the shape of a **concrete syntax
tree**, not a grammar for parsing. Uses `|` (alternation), `*` (repetition), `?`
(optional), and `label:Rule` (named fields). Rust's entire grammar fits in ~618 lines.

```
BinExpr = Attr* lhs:Expr op:('+' | '-' | '*' | '/') rhs:Expr
```

**Key insight:** "EBNF specifies a language (a set of strings). Ungrammar describes a
concrete syntax tree (a set of data types)." Producing a parser is an explicit non-goal.

**What it generates:**

| Output | Contents |
|--------|----------|
| `SyntaxKind` enum | ~305 variants (`#[repr(u16)]`), with `is_keyword()`, `is_punct()`, `T![]` macro |
| `nodes.rs` | Typed wrapper structs over untyped `SyntaxNode`, accessor methods, `AstNode` trait impls |
| `tokens.rs` | Token wrapper types implementing `AstToken` |

**Key capabilities beyond KSC:**

- **Trait extraction** — Codegen detects common field patterns (e.g., nodes with `attrs` +
  `name` + `visibility`) and auto-generates trait impls (`HasAttrs`, `HasName`,
  `HasVisibility`). KSC has no equivalent.
- **Zero-cost typed views** — AST types are newtype wrappers around the untyped rowan
  `SyntaxNode`. `AstNode::cast` is just a kind-check, no data copying.
- **Lossless CST** — Preserves all tokens (whitespace, comments, delimiters). Any source
  file round-trips exactly.
- **Separated list recognition** — Codegen pattern-matches `T (',' T)* ','?` and collapses
  to a single `Many` field.

**What it does NOT generate:**
- Parsers (hand-written, decoupled from grammar)
- Builder/make functions (hand-written `ast::make` module)
- Visitors (uses rowan's generic tree walking)
- Serialization

**Novel patterns:**
- Grammar can be ambiguous — it describes tree shape, not parsing rules
- Enum promotion: when node fields match all variants of an enum, they collapse
- Adopted by Biome (JS/TS linter) via `js.ungram`

---

## 3. Swift (swift-syntax CodeGeneration)

**Schema format:** Swift source files in `CodeGeneration/Sources/SyntaxSupport/` (~29 files).
Uses `Node(kind:, base:, children:)` declarations with `Child(name:, kind:)` entries.
Child kinds: `.node(kind:)`, `.nodeChoices(choices:)`, `.collection(kind:)`,
`.token(choices:)`. ~350+ node kinds across 7 base categories.

**What it generates** (~35+ files across 4 modules):

| Module | Key outputs |
|--------|-------------|
| SwiftSyntax | Node structs, raw nodes, `SyntaxVisitor`, `SyntaxAnyVisitor`, `SyntaxRewriter`, `SyntaxKind`, collection types, trivia, validation |
| SwiftSyntaxBuilder | Convenience initializers, `@resultBuilder` structs, string interpolation conformances |
| SwiftParser | Token spec sets, parsable conformances, experimental features |
| SwiftParserDiagnostics | Human-readable names for diagnostics |

**Key capabilities beyond KSC:**

- **Visitor** — Open class with `visit(_ node: XxxSyntax) -> SyntaxVisitorContinueKind`
  and `visitPost(_ node: XxxSyntax)` for every node type.
- **Rewriter** — `SyntaxRewriter` with `visit` methods returning modified nodes. Lazily
  rebuilds parents only when children change.
- **Result builders** — `@resultBuilder` structs for every collection node, enabling
  DSL-style tree construction: `CodeBlockItemListSyntax { ... }`.
- **String interpolation** — Build syntax trees via string literals with interpolated
  sub-trees: `"func \(name)(\(params)) { \(body) }"`.
- **Traits** — 15 reusable traits (`Braced`, `DeclGroup`, `NamedDecl`, `WithAttributes`,
  `WithModifiers`, `Parenthesized`, `WithTrailingComma`) that nodes conform to.
- **Two-tier tree** — `RawSyntax` (immutable, arena-allocated, shared) + `Syntax` (value-type
  wrappers with parent/position context, created lazily).
- **Incremental parsing** — `IncrementalParseTransition` reuses nodes from previous parse
  when re-parsing after edits. Near-O(1) for small edits in large files.
- **Backward compatibility layer** — `Child.History` tracks schema evolution through
  `Refactoring` operations. Auto-generates deprecated accessors for renamed children.
- **Validation** — `RawSyntaxValidation.swift` verifies tree structure at construction time.

**Novel patterns:**
- Self-hosting: SwiftSyntaxBuilder generates the library it is built with
- Schema split alphabetically for compilation performance
- Experimental feature gating at schema level

---

## 4. ASDL (CPython)

**Schema format:** Custom DSL (`Python.asdl`, ~123 lines) with sum types (`stmt = A | B | C`)
and product types (`comprehension = (expr target, expr iter, ...)`). Field modifiers:
`?` (optional), `*` (sequence). Shared `attributes` across sum type variants.

```
stmt = FunctionDef(identifier name, arguments args, stmt* body, expr* decorators)
     | Return(expr? value)
     | Assign(expr* targets, expr value)
     attributes (int lineno, int col_offset, ...)
```

**What it generates** (~8,000 lines of C from 123 lines of ASDL):

| Output | Contents |
|--------|----------|
| `pycore_ast.h` | C structs with kind enum + union of variant data + attribute fields |
| `Python-ast.c` | Constructor functions, `obj2ast_*`/`ast2obj_*` marshalling for Python↔C serialization |

**Key capabilities beyond KSC:**

- **Serialization** — Auto-generated marshalling between C structs and Python objects.
  Enables `ast.dump()`, `compile()`, and macro-like AST manipulation from Python.
- **Shared attributes** — Sum type `attributes` block adds fields (like `lineno`,
  `col_offset`) to all variants automatically.

**What it does NOT generate:** Visitors, transformers, builders (beyond constructors).

**Trade-offs:** Very minimal — ASDL is purely about data type definition + serialization.
No tree structure awareness, no traversal, no type hierarchy.

---

## 5. Babel (@babel/types)

**Schema format:** JavaScript `defineType()` calls in `packages/babel-types/src/definitions/`.
Each call specifies `builder` (constructor args), `fields` (with validation rules),
`visitor` (traversal fields), and `aliases` (category membership).

```js
defineType("IfStatement", {
  visitor: ["test", "consequent", "alternate"],
  aliases: ["Statement", "Conditional"],
  fields: {
    test: { validate: assertNodeType("Expression") },
    consequent: { validate: assertNodeType("Statement") },
    alternate: { optional: true, validate: assertNodeType("Statement") },
  },
});
```

**What it generates:**

| Output | Contents |
|--------|----------|
| Builder functions | `t.ifStatement(test, consequent, alternate)` with argument validation |
| Type guard functions | `t.isIfStatement(node)`, `t.isExpression(node)` (per alias) |
| TypeScript `.d.ts` | Generated from validator chains |
| Flow types | Generated type definitions |

**Key capabilities beyond KSC:**

- **Validated builders** — Every builder function validates arguments against the schema's
  validator rules at runtime.
- **Alias-based guards** — Type guards for both individual nodes and alias groups.
- **Visitor field declaration** — Schema explicitly declares which fields are traversed,
  decoupling traversal order from field order.

**Trade-offs:** Not a separate DSL — schema is imperative JS. No tree-level operations
(rewriting is done by `@babel/traverse` which is separate from the type system).

---

## 6. tree-sitter

**Schema format:** JavaScript DSL (`grammar.js`) with `seq()`, `choice()`, `repeat()`,
`optional()`, `field()`, `prec()`. Unlike the others, tree-sitter's primary purpose
is **parser generation**, with the schema as a byproduct.

**What it generates:**

| Output | Contents |
|--------|----------|
| `parser.c` | Complete incremental LR/GLR parser |
| `node-types.json` | Structured schema of all possible node types, fields, and subtypes |
| `grammar.json` | JSON representation of the grammar |

**Key capabilities beyond KSC:**

- **Incremental parsing** — Built into the parser core. Re-parses only the affected
  portion of the tree after edits.
- **`node-types.json` as a schema** — Machine-readable description of every node type
  with field requirements, multiplicity, and type constraints. Enables downstream
  typed wrapper generation (e.g., `type-sitter` for Rust).
- **Error recovery** — Built into the parser itself.

**Trade-offs:** The schema is a byproduct of parser definition, not the primary artifact.
Grammar must encode parsing concerns (precedence, conflicts, GLR ambiguities) alongside
structural description.

---

## 7. TypeScript Compiler (Reference — No Schema)

Included for contrast, since KSC mirrors TypeScript's AST.

**Approach:** Entirely hand-written. `types.ts` (~12,000 lines) defines `SyntaxKind` enum
and node interfaces. `nodeFactory.ts` (~8,400 lines) has ~100+ `create*`/`update*` pairs.
`forEachChild` and `visitEachChild` use manually-maintained function tables.

**Known pain points that KSC's schema approach solves:**

1. **Sync burden** — Adding a node kind requires updating 6+ files manually (types, factory,
   forEachChild, visitEachChild, parser, HasChildren union). Our schema requires editing
   one file.
2. **No introspection** — No way to programmatically ask "what children does ForStatement
   have?" at runtime. Our `getChildFields(kind)` provides this.
3. **forEachChild/visitEachChild inconsistency** — The two functions don't cover the same
   node kinds. Our `getChildren()` is derived from one source of truth.
4. **No completeness checking** — No mechanism to verify all node kinds are handled in a
   visitor/transformer. Our `checkCompleteness()` validates AG equation coverage.

---

## Comparative Matrix

| Capability | KSC | Roslyn | rust-analyzer | Swift | ASDL | Babel | tree-sitter |
|---|---|---|---|---|---|---|---|
| **Schema language** | TS builder DSL | XML | `.ungram` DSL | Swift declarations | `.asdl` DSL | JS `defineType()` | JS `grammar.js` |
| **Tree type** | AST (abstract) | CST (lossless) | CST (lossless) | CST (lossless) | AST (abstract) | AST (abstract) | CST (lossless) |
| **Typed node defs** | Yes | Yes | Yes | Yes | Yes (C structs) | Yes (TS/Flow) | JSON schema |
| **Sum types / unions** | 48 sum types | Abstract nodes | Enum alternations | Base kinds + choices | Sum types | Aliases | Supertypes |
| **Type guards** | Yes (`is*()`) | Via visitor dispatch | `AstNode::cast` | `is`/`as`/`cast` | Manual | `t.isX()` | Kind checks |
| **Visitors** | No | Yes (generated) | No (rowan generic) | Yes (generated) | No | No (separate lib) | No |
| **Rewriter/transformer** | No | Yes (generated) | No | Yes (generated) | No | No (separate lib) | No |
| **Node builders/factory** | Yes (generated) | Yes (generated) | No (hand-written) | Yes (generated + result builders) | Constructors only | Yes (generated) | N/A |
| **Immutable updaters** | No | Yes (`With*`) | No | Yes (`with` setters) | No | No | N/A |
| **Serialization** | Yes (generated) | No | No | No | Yes (generated) | No | No |
| **Runtime schema** | Yes (`getChildren`, `allKinds`, `getChildFields`) | No (compile-time only) | No | No | No | Partial (validators) | Yes (`node-types.json`) |
| **Tree validation** | No | Factory validates | No | Yes (generated) | No | Builder validates | Parser validates |
| **Conversion layer** | Yes (TS→KS) | N/A | N/A | N/A | N/A | N/A | N/A |
| **Incremental parsing** | No | Via red-green persistence | No (separate parser) | Yes (generated support) | No | No | Yes (core feature) |
| **Trait/mixin extraction** | No | No | Yes (auto-detected) | Yes (declared in schema) | Attributes block | Aliases | No |
| **Comment handling** | Schema-level (leadingComments/trailingComments) | Trivia on tokens | Rowan CST (all tokens preserved) | Trivia pieces on tokens | Not in schema | Not in schema | CST preserves all |
| **Backward compat layer** | No | No | No | Yes (generated deprecated accessors) | No | No | No |

---

## Gap Analysis: What KSC Could Add

### High Value — Directly Applicable

#### 1. Generated Visitor Pattern
**Seen in:** Roslyn, Swift
**What:** Generate a `KSVisitor<T>` base class with a `visitXxx()` method for every node
kind, plus `accept()` on each node. Also a void-returning variant.
**Why:** The AG library handles attribute computation, but general-purpose AST walking
(for tooling, linting, pretty-printing) currently requires manual `switch` on `kind` or
using `getChildren()` without type narrowing. A generated visitor provides exhaustive,
type-safe dispatch.
**Effort:** Medium. Add a `generateVisitor()` function to `codegen.ts`.

#### 2. Generated Rewriter/Transformer
**Seen in:** Roslyn, Swift
**What:** Generate a `KSRewriter` class that visits all children by default and
reconstructs the node via an `update()` call. Override specific `visitXxx()` methods
to transform nodes. Return original reference if nothing changed.
**Why:** Enables source-to-source transformations, refactoring tools, and code fixes.
Currently no way to create modified AST trees.
**Effort:** Medium-High. Requires node builders (see below) as a prerequisite.
**Prerequisite:** Node builders/factory.

#### 3. Node Builders / Factory Functions
**Seen in:** Roslyn, Swift, Babel, ASDL
**What:** Generate `createXxx()` functions that construct valid KS nodes from field values.
E.g., `createIfStatement(expression, thenStatement, elseStatement?)`.
**Why:** Currently KS nodes are only created by `convert.ts` from TS nodes. Builders
would enable: (a) constructing nodes for tests without parsing, (b) rewriter output,
(c) synthetic node creation for code generation.
**Effort:** Medium. Generate from the same field metadata used for `convert.ts`.

#### 4. Trait/Mixin Extraction
**Seen in:** rust-analyzer (auto-detected), Swift (declared)
**What:** Identify common field patterns across nodes (e.g., nodes with `modifiers`,
nodes with `name`, nodes with `type`) and generate shared interfaces/protocols.
**Why:** Enables writing code that works across all "named declarations" or all
"nodes with modifiers" without enumerating specific kinds. Our 48 sum types handle
some of this, but traits are orthogonal to the kind hierarchy.
**Effort:** Low-Medium. Analyze field patterns across `schema.ts`, generate interfaces.

### Medium Value — Worth Considering

#### 5. Serialization (JSON/Binary)
**Seen in:** ASDL (CPython)
**What:** Generate `toJSON()`/`fromJSON()` for the KS AST.
**Why:** Enables: (a) AST caching across compilations, (b) language server protocol
integration, (c) external tool interop, (d) debugging/inspection.
**Effort:** Medium. Each node's fields are already fully described.

#### 6. Tree Validation
**Seen in:** Swift (`RawSyntaxValidation`), Roslyn (factory validation), Babel (builder validation)
**What:** Generate validation that checks a constructed node has the right child kinds,
required fields are present, and field types match the schema.
**Why:** Catches bugs in builder/rewriter output. Less critical while nodes are only
created by `convert.ts` (which is schema-generated and correct by construction).
**Effort:** Low-Medium. Validate against `getChildFields()` metadata.

#### 7. Exhaustive `switch` Helper / Syntax Enum
**Seen in:** Swift (`SyntaxEnum`)
**What:** Generate a `KSSyntaxEnum` with one case per node kind, enabling exhaustive
`switch` statements over the full AST.
**Why:** TypeScript's discriminated union already provides this via `node.kind`, but an
explicit enum type could improve ergonomics for visitors that aren't using the generated
visitor class.
**Effort:** Low.

### Lower Priority — Contextually Useful

#### 8. Backward Compatibility Layer
**Seen in:** Swift (deprecated accessors for renamed children)
**What:** When schema fields are renamed, auto-generate deprecated accessors.
**Why:** Only valuable if we have external consumers of the KS AST. Currently internal.
**Effort:** Low, but premature.

#### 9. Incremental Parsing Support
**Seen in:** Swift, tree-sitter
**What:** Reuse syntax tree nodes when re-parsing after small edits.
**Why:** Essential for IDE integration with large files. Not applicable to batch
compilation.
**Effort:** Very High. Requires parser changes, not just schema changes.

#### 10. Lossless CST / Trivia Preservation
**Seen in:** Roslyn, rust-analyzer, Swift, tree-sitter
**What:** Preserve all whitespace and comments as part of the tree structure rather
than as optional metadata.
**Why:** Enables exact round-tripping (print source → parse → print = identical).
Currently our comment attachment is optional metadata, not structural.
**Effort:** Very High. Fundamental architectural change.

---

## Architectural Observations

### 1. Schema Complexity vs. Generation Scope

There's a clear correlation between schema expressiveness and generation breadth:

- **Minimal schema → minimal generation:** ASDL (types + constructors + serialization)
- **Medium schema → focused generation:** KSC, rust-analyzer (types + guards + traversal)
- **Rich schema → comprehensive generation:** Roslyn, Swift (types + visitors + rewriters +
  builders + validation + compatibility)

KSC sits in the "medium" tier. The schema already has all the metadata needed to
generate visitors, rewriters, and builders — the information is there, we just don't
emit it yet.

### 2. The CST vs. AST Split

Projects divide into two camps:
- **CST (lossless):** Roslyn, rust-analyzer, Swift, tree-sitter — preserve all tokens,
  enable exact round-tripping
- **AST (abstract):** KSC, ASDL, Babel — discard syntactic noise, simpler tree

KSC's position is pragmatic: we mirror TypeScript's AST (which is abstract), so going
CST would require departing from TS's tree shape. Our comment attachment approach is
a middle ground.

### 3. Parser Coupling

| Project | Parser–Schema relationship |
|---------|--------------------------|
| Roslyn | Schema describes parser output exactly |
| rust-analyzer | Schema is independent; parser hand-written to produce matching trees |
| Swift | Schema drives parser via generated `Parsable` conformances |
| tree-sitter | Schema is a byproduct of parser definition |
| KSC | Schema mirrors TS's existing parser output; conversion layer bridges |
| ASDL/Babel | Schema is independent of parser |

KSC's conversion-layer approach is unique — we don't write a parser, we bridge from
an existing one. This means our schema must track TS's AST evolution, but we avoid
parser maintenance entirely.

### 4. The Self-Hosting Opportunity

Swift's self-hosting approach (SwiftSyntaxBuilder generates SwiftSyntax) is elegant
but creates bootstrap complexity. KSC's TypeScript-based codegen is simpler — we just
run `tsx codegen.ts`. No bootstrapping needed.

---

## Recommended Next Steps (Priority Order)

1. **Generated visitor** — Highest immediate value. Unblocks type-safe AST walking
   for tooling beyond the AG pipeline.

2. **Node builders** — Prerequisite for rewriter. Enables test fixtures without parsing.

3. **Generated rewriter** — Enables source-to-source transformations. Depends on builders.

4. **Trait extraction** — Low effort, improves API ergonomics. Analyze field patterns
   and generate shared interfaces.

5. **JSON serialization** — Medium effort, enables caching and external tool interop.

---

## Sources

### Roslyn
- [Syntax.xml on GitHub](https://github.com/dotnet/roslyn/blob/main/src/Compilers/CSharp/Portable/Syntax/Syntax.xml)
- [Eric Lippert: Red-Green Trees](https://ericlippert.com/2012/06/08/red-green-trees/)
- [CSharpSyntaxGenerator SourceWriter.cs](https://github.com/dotnet/roslyn/blob/main/src/Tools/Source/CompilerGeneratorTools/Source/CSharpSyntaxGenerator/SourceWriter.cs)

### rust-analyzer / Ungrammar
- [Introducing Ungrammar](https://rust-analyzer.github.io//blog/2020/10/24/introducing-ungrammar.html)
- [ungrammar crate](https://docs.rs/ungrammar/latest/ungrammar/)
- [rust-analyzer architecture](https://rust-analyzer.github.io/book/contributing/architecture.html)

### Swift
- [swift-syntax repository](https://github.com/swiftlang/swift-syntax)
- [SwiftSyntax self-hosting discussion](https://forums.swift.org/t/use-swiftsyntax-itself-to-generate-swiftsyntax-s-source-code/56599)
- [Incremental parsing design](https://gist.github.com/ahoppen/3ae1a6cd64e558710a4afcd372e8fdc4)

### ASDL
- [Eli Bendersky: Using ASDL](https://eli.thegreenplace.net/2014/06/04/using-asdl-to-describe-asts-in-compilers)
- [CPython Parser/Python.asdl](https://github.com/python/cpython/blob/main/Parser/Python.asdl)

### Babel
- [@babel/types docs](https://babeljs.io/docs/babel-types)
- [Babel definitions/ directory](https://github.com/babel/babel/tree/master/packages/babel-types/src/definitions)

### tree-sitter
- [Grammar DSL docs](https://tree-sitter.github.io/tree-sitter/creating-parsers/2-the-grammar-dsl.html)
- [Static node types docs](https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.html)

### TypeScript Compiler
- [TypeScript Compiler API Wiki](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [PR #50225: forEachChild refactoring](https://github.com/microsoft/TypeScript/pull/50225)
