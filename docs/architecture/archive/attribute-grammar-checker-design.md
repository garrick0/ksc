# Attribute Grammar Checker Design

How to redesign the KindScript checker using the architecture, design patterns,
nomenclature, and interfaces of JastAdd and Silver — starting with noImports.

---

## Background: What JastAdd and Silver Are

**JastAdd** (Lund University) and **Silver** (University of Minnesota / MELT group)
are attribute grammar systems for building compilers. Both extend Knuth's
attribute grammar formalism with modern features. They share a core philosophy:

- **Attributes replace passes.** Instead of writing sequential passes over an
  AST, you declare attributes with equations. The evaluator handles ordering.
- **Demand-driven (lazy) evaluation.** Attributes are computed only when
  accessed, and results are cached. No explicit pass scheduling.
- **The AST is the central data structure.** Rather than building separate
  symbol tables, lookup tables, or analysis results, you attach computed
  attributes directly to AST nodes.
- **Modular extensibility.** New analyses are added by declaring new attributes
  and equations on existing AST node types, without modifying existing code.

### Key Differences Between Them

| Aspect | JastAdd | Silver |
|--------|---------|--------|
| Implementation | Java-embedded DSL (.jrag/.jadd files woven into generated Java classes) | Standalone language that generates Java |
| Binding model | Reference Attribute Grammars (RAGs) — attributes can reference other AST nodes directly | Decorated vs. undecorated trees — clear separation between tree structure and computed attributes |
| Extensibility | Aspect-oriented inter-type declarations with `refine` | Forwarding + Modular Well-Definedness Analysis (MWDA) for guaranteed safe composition |
| Error checking | Static analysis at runtime for missing equations | Static flow analysis at compile time |
| Circular attrs | First-class support with fixed-point iteration | Not a primary focus (relies on forwarding instead) |

### Attribute Types They Both Support

| Type | Direction | Description |
|------|-----------|-------------|
| **Synthesized** (`syn`) | Bottom-up | Computed on a node from its children. `syn Type Exp.actualType()` |
| **Inherited** (`inh`) | Top-down | Supplied to a node by its parent. `inh Env Exp.env()` |
| **Collection** (`coll`) | Scattered → aggregated | Multiple nodes contribute values to a collection on an ancestor. Used for error gathering. |
| **Reference** | Cross-tree | Value is a reference to another AST node. `syn Decl Var.decl()` |
| **Higher-order / NTA** | Computed subtree | Value is itself an AST subtree that can be further attributed. |
| **Circular** | Fixed-point | Self-referencing attributes resolved via iteration until convergence. |

---

## How JastAdd and Silver Handle Binding

This is the central question: TypeScript has a separate binding pass that builds
symbol tables, resolves names, and links identifiers to declarations. JastAdd
and Silver do not have a separate binding pass. Here is how they handle it.

### JastAdd: The AST Is the Symbol Table

In JastAdd, name resolution is expressed purely as attributes. There is no
separate binding pass. The canonical pattern uses two attributes:

```java
// "What declarations are visible at this point in the tree?"
inh Decl Var.lookup(String name);

// "Which declaration does this variable refer to?"
syn Decl Var.decl() = lookup(getName());
```

The `lookup` attribute is **inherited** — parent nodes define what names are
visible to their children. A `Block` provides `lookup` by checking local
declarations first, then delegating to its parent's `lookup` (lexical scoping).
The `decl()` attribute is **synthesized** — it is a **reference attribute**
whose value is a direct pointer to another AST node (the declaration).

There is no `Map<string, Declaration>` symbol table. The AST itself, navigated
by `lookup` attributes, serves that role. When you call `varUse.decl()`, the
demand-driven evaluator walks up the tree through `lookup` equations until it
finds the declaration. The result is cached on the node.

ExtendJ (the Java compiler built with JastAdd) handles all of Java's name
resolution this way — package lookup, type lookup, method resolution, field
access — all as attributes. No binding pass.

### Silver: env/defs Pattern

Silver uses the same approach, just with different syntax:

```silver
inherited attribute env :: [Binding];
synthesized attribute defs :: [Binding];

abstract production varRef
e::Expr ::= name::String
{
  local lookupResult :: Maybe<Type> = lookup(name, e.env);
  e.errors := case lookupResult of
    | just(_) -> []
    | nothing() -> [err(e.location, "Undefined: " ++ name)]
    end;
}
```

An inherited `env` attribute flows down the tree. A synthesized `defs` attribute
flows up from declarations. Parent nodes combine them — extending `env` with
`defs` from earlier children before passing it to later children.

Silver makes the **decorated vs. undecorated** distinction explicit. An
undecorated tree is just structure. A decorated tree has all attribute values
available. You can decorate the same tree multiple times with different
inherited attributes.

### Summary: Both Systems

- No separate binding pass
- Name resolution expressed as attributes on the AST
- The AST itself is the symbol table (reference attributes point to declaration nodes)
- Scoping rules encoded as equations on how `lookup`/`env` attributes are computed
- All lazy, all cached, all demand-driven

---

## Our Situation: Piggybacking on TypeScript

We are not building a compiler from scratch. We are building a **property
checker** that sits on top of TypeScript. TypeScript already does:

- Scanning and parsing → `ts.SourceFile` AST
- Binding → symbol tables, scope chains, `ts.Symbol`
- Type checking → `ts.Type`, `ts.TypeChecker`

Our checker needs to:

1. Find kind definitions: `type X = Kind<{ noImports: true }>`
2. Find kind annotations: `const add: NoImports & ((a, b) => number) = ...`
3. Resolve annotations to definitions (which may be imported from other files)
4. Evaluate properties (e.g., check that noImports files have no imports)

This creates a design tension: JastAdd/Silver assume you own the AST and can
attach attributes to nodes. We do not own the TypeScript AST. We operate on
`ts.Node` objects that we cannot modify.

---

## Design Decisions

### Decision 1: What to Do with the Binding Stage

**The question:** JastAdd and Silver express binding as attributes on AST nodes
(no separate pass). TypeScript has already done binding for us. Should we (a)
keep a separate binding pass, (b) express binding as attributes, or (c) do
something hybrid?

**Option A: Keep a separate binder pass (current approach)**

How it works now: `ksBind(tsProgram)` walks all source files, finds kind
definitions, returns a `BinderResult` with `definitions[]` and
`definitionsByName` map. The checker then uses this map to resolve annotations.

Pros:
- Simple, works today
- Clear separation: binder finds definitions, checker finds annotations and
  evaluates properties
- The `definitionsByName` map is essentially our symbol table — O(1) lookup

Cons:
- Not how JastAdd/Silver do it — they have no separate pass
- The binder eagerly walks all files even if the checker never runs
- Adding new "phases" (like a future binder for scope-level kinds) means adding
  more passes

**Option B: Express binding as attributes (pure AG approach)**

Make kind definition discovery an attribute on AST nodes. A `SourceFile` node
would have a synthesized attribute `kindDefinitions` that lazily computes the
list of kind definitions in that file. The program root would aggregate them.

```
syn KindDefinition[] SourceFile.kindDefinitions  // computed on demand
syn Map<string, KindDefinition> Program.definitionsByName  // aggregated from children
```

Pros:
- True to the AG model — no separate pass, everything is attributes
- Lazy — definitions in a file are only discovered if something demands them
- Naturally extends to more attributes without adding more passes

Cons:
- We cannot add methods/properties to `ts.Node` or `ts.SourceFile` — they are
  TypeScript's objects
- Requires an indirection layer (external attribute map keyed by node identity)
- More complex infrastructure for what is currently a 30-line function

**Option C: Hybrid — binder produces a "decorated tree" that the checker
consumes as attributes (recommended)**

Keep the binder as a separate function, but reconceptualize it as producing the
**inherited attributes** for the checker. In AG terms:

- The binder computes the `env` (inherited attribute) — the set of known kind
  definitions available in the program
- The checker computes `syn` attributes (symbols, diagnostics) using that `env`
- The checker's attributes are demand-driven and cached

This maps cleanly to Silver's decorated/undecorated model:
- The raw `ts.Program` is the **undecorated tree**
- Binding (running `ksBind`) is **decoration** — supplying inherited attributes
- The checker computes synthesized attributes on the decorated tree

```typescript
// Conceptually:
// undecorated tree = ts.Program
// decoration = ksBind(tsProgram) → BinderResult (≈ inherited env)
// synthesized attributes = checker.getSymbols(), checker.getDiagnostics()
```

Pros:
- Maps cleanly to Silver's decorated/undecorated model
- Keeps the simple, working binder
- The checker becomes purely demand-driven (already is, with lazy `run()`)
- Clear mental model: binder = compute env, checker = compute syn from env
- No need to modify TypeScript's AST objects

Cons:
- The binder is still eager (walks all files up front)
- Not purely "attributes on nodes" — more like "attributes on the program"

**Recommendation: Option C.** It gives us the AG mental model and nomenclature
without fighting TypeScript's immutable AST. The binder is small and fast, and
eagerly computing definitions is fine — there are typically very few kind
definitions. The real value of AG-style design is in the checker, where
demand-driven evaluation and modularity matter.

### Decision 2: How to Represent Attributes

**The question:** In JastAdd, attributes are methods woven into AST classes.
In Silver, attributes are computed on decorated trees. Since we cannot modify
`ts.Node`, how do we represent attributes?

**Option A: External attribute maps (WeakMap keyed by ts.Node)**

```typescript
const noImports = new WeakMap<ts.SourceFile, boolean>();

function getNoImports(sf: ts.SourceFile): boolean {
  let result = noImports.get(sf);
  if (result === undefined) {
    result = computeNoImports(sf);
    noImports.set(sf, result);
  }
  return result;
}
```

Pros:
- Clean separation — no wrapper objects
- WeakMap means no memory leaks
- Each attribute is independent — can be defined in its own module

Cons:
- Scattered state — attributes live in separate maps, not on a cohesive object
- No type-safe way to express "this node has these attributes"
- Each attribute needs its own boilerplate (get, compute, cache)

**Option B: Wrapper/decorator objects around ts.Node**

Create wrapper objects that hold the original node plus computed attributes:

```typescript
interface DecoratedSourceFile {
  readonly node: ts.SourceFile;
  readonly noImports: boolean;  // synthesized attribute
  readonly kindDefinitions: KindDefinition[];  // synthesized attribute
}
```

Pros:
- All attributes for a node in one place
- Type-safe — you know what attributes are available
- Closer to JastAdd's model (attributes as properties on a node object)

Cons:
- Need to create wrapper objects for every node
- Two representations of the same thing (wrapper and underlying ts.Node)
- Doesn't compose well — extending with new attributes means changing the interface

**Option C: Attribute functions with memoization (recommended)**

Define each attribute as a standalone function that takes a node and returns
the computed value. Use a shared memoization mechanism.

```typescript
// An attribute is a function from a node to a value, with caching.
type Attribute<Node, Value> = (node: Node) => Value;

function synthesized<N extends object, V>(
  compute: (node: N) => V
): Attribute<N, V> {
  const cache = new WeakMap<N, V>();
  return (node: N): V => {
    let v = cache.get(node);
    if (v === undefined) {
      v = compute(node);
      cache.set(node, v);
    }
    return v;
  };
}

// Usage:
const noImports = synthesized((sf: ts.SourceFile) => {
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!stmt.importClause) return false;
    if (!stmt.importClause.isTypeOnly) return false;
  }
  return true;
});

// Demand-driven: noImports(sourceFile) — computed on first call, cached.
```

Pros:
- True to the AG model — attributes are pure functions with caching
- Composable — attributes can reference other attributes
- Each attribute defined in its own module (aspect-style)
- The `synthesized()` wrapper is the "caching" mechanism from JastAdd
- No wrapper objects needed
- Natural TypeScript idiom

Cons:
- WeakMap caching can't handle `undefined` as a value (need sentinel)
- Parameterized attributes (like `lookup(name)`) need a different cache strategy
- No static guarantee that all required attributes are defined

**Recommendation: Option C.** Attribute functions with memoization are the
cleanest TypeScript translation of JastAdd's lazy cached attributes. They are
composable, modular, and don't require wrapping TypeScript's AST. The
`synthesized()` helper is a ~10 line utility that gives us JastAdd's core
evaluation strategy.

### Decision 3: How to Handle Inherited Attributes (env)

**The question:** In JastAdd/Silver, inherited attributes like `env` flow
downward from parent to child. Since we don't control the tree traversal, how
do we supply inherited context to attribute computations?

**Option A: Thread env through function parameters**

```typescript
const noImports = synthesized((sf: ts.SourceFile) => { ... });
// No env needed for noImports — it's purely local.

const kindSymbols = (sf: ts.SourceFile, env: BinderResult) => { ... };
// env passed explicitly.
```

Pros:
- Simple, explicit
- No hidden state

Cons:
- Every attribute that needs context must accept it as a parameter
- Can't use the simple `synthesized()` wrapper (cache key includes env)
- Not how AGs work — inherited attributes are part of the node's decoration

**Option B: Closure-captured context (decoration) (recommended)**

Create attribute functions within a closure that captures the inherited context.
This maps to Silver's "decoration" — you decorate the tree with inherited
attributes, and synthesized attributes are computed within that decoration.

```typescript
function createCheckerAttributes(env: BinderResult, tsProgram: ts.Program) {
  // env is the inherited attribute — captured by closure (= decoration)

  const noImports = synthesized((sf: ts.SourceFile): boolean => {
    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;
      if (!stmt.importClause) return false;
      if (!stmt.importClause.isTypeOnly) return false;
    }
    return true;
  });

  const kindSymbols = synthesized((sf: ts.SourceFile): KindSymbol[] => {
    // Uses env (inherited) and noImports (synthesized sibling) — both in scope.
    const symbols: KindSymbol[] = [];
    // ... walk declarations, resolve kind references using env ...
    return symbols;
  });

  return { noImports, kindSymbols };
}
```

This is exactly Silver's model:
- `env` (BinderResult) = inherited attribute, supplied when you "decorate" the tree
- `noImports`, `kindSymbols` = synthesized attributes, computed on demand
- The closure = the decorated tree
- Calling `createCheckerAttributes(env, program)` = decorating the tree

Pros:
- Maps directly to Silver's `decorate expr with { env = ... }`
- Inherited context available to all attributes without parameter threading
- Attributes can reference each other (they're in the same closure scope)
- Memoization still works (cache is per-decoration, which is correct)

Cons:
- All attributes for a decoration are defined in one closure (less modular than pure AG)
- Re-decorating with different env means creating new attribute functions

**Recommendation: Option B.** This is the most natural TypeScript translation of
Silver's decoration model. The closure captures inherited attributes, and
synthesized attributes are demand-driven functions within that closure. It is
also essentially what our current `createChecker()` already does — we just need
to decompose the monolithic `run()` into individual attribute functions.

### Decision 4: How to Structure Property Evaluation

**The question:** How should we organize the evaluation of individual properties
(noImports, and future properties)? This is about modularity — how easy it is
to add a new property.

**Option A: Monolithic checker function (current approach)**

All property evaluation happens inside the checker's `run()` function:

```typescript
// Current: everything in one function
if (def.properties.noImports) {
  const passes = computeNoImports(sf);
  if (!passes) { diagnostics.push(...); }
}
// Future: add more if-blocks here
```

Pros:
- Simple, direct
- All checking logic in one place

Cons:
- Adding a property requires modifying the checker's core loop
- Not modular — the opposite of AG-style "just add an aspect"

**Option B: Property evaluator registry**

Each property defines an evaluator function. The checker iterates over
properties and calls the corresponding evaluator.

```typescript
interface PropertyEvaluator {
  property: string;
  evaluate(sf: ts.SourceFile, sym: KindSymbol): KSDiagnostic | undefined;
}

const noImportsEvaluator: PropertyEvaluator = {
  property: 'noImports',
  evaluate(sf, sym) {
    if (!computeNoImports(sf)) {
      return { /* diagnostic */ };
    }
  }
};

const evaluators: PropertyEvaluator[] = [noImportsEvaluator];
```

Pros:
- Adding a property = adding a new evaluator object
- Each evaluator is independent
- Can be in separate files

Cons:
- Indirection — harder to trace what happens during checking
- Need a registry mechanism
- Evaluator interface constrains what properties can do

**Option C: Attribute-per-property with collection diagnostic (recommended)**

Each property is a synthesized attribute. Diagnostics are gathered using a
collection attribute pattern.

```typescript
// Each property is its own attribute (aspect):
const noImports = synthesized((sf: ts.SourceFile): boolean => { ... });

// Each property contributes diagnostics (collection attribute pattern):
function noImportsDiagnostics(sf: ts.SourceFile, symbols: KindSymbol[]): KSDiagnostic[] {
  if (noImports(sf)) return [];
  return symbols
    .filter(s => s.definition.properties.noImports)
    .map(s => ({ /* diagnostic for s */ }));
}

// Collection: aggregate all property diagnostics
function allDiagnostics(sf: ts.SourceFile, symbols: KindSymbol[]): KSDiagnostic[] {
  return [
    ...noImportsDiagnostics(sf, symbols),
    // ...pureDiagnostics(sf, symbols),   // future
    // ...noMutationDiagnostics(sf, symbols),  // future
  ];
}
```

This maps directly to JastAdd's collection attribute pattern:

```java
// JastAdd equivalent:
coll LinkedList<Problem> CompilationUnit.problems() root CompilationUnit;
ImportDecl contributes each importProblems() to CompilationUnit.problems();
```

Each property "contributes" its diagnostics to the collection. New properties
add new contribution functions without modifying existing ones.

Pros:
- True to JastAdd's `coll`/`contributes` pattern
- Each property is a self-contained module (attribute + contribution)
- The collection (allDiagnostics) is just aggregation
- Easy to add new properties — write a new attribute + contribution function

Cons:
- Need to remember to add the contribution to `allDiagnostics`
- Slightly more files/functions than the monolithic approach

**Recommendation: Option C.** This is the AG-idiomatic approach. Each property
is a synthesized attribute, and each property independently contributes
diagnostics to a collection. Adding a new property means writing two things:
the attribute function and the contribution function. No existing code changes.

### Decision 5: Granularity of Attributes — File-Level vs. Node-Level

**The question:** Should attributes be computed per-file (`ts.SourceFile`) or
per-node (`ts.Node`)?

**Option A: File-level attributes only (current approach)**

`noImports` is a boolean on `ts.SourceFile`. All properties are evaluated at
file granularity.

Pros:
- Simple — one attribute value per file
- Matches current architecture
- `noImports` is inherently file-level

Cons:
- Future properties (e.g., `noClosure`, `totalFunction`) are node-level
- File-level can't distinguish between different functions in the same file

**Option B: Node-level attributes**

Attributes are computed on individual AST nodes. `noImports` would still be on
`ts.SourceFile`, but `noClosure` would be on `ts.FunctionDeclaration`.

Pros:
- More precise — can check properties per-function
- Matches AG model (attributes on individual nodes, not just roots)
- Future-proof for node-level properties

Cons:
- More complex caching (many more nodes than files)
- `noImports` is still file-level, so you need both
- Some properties span multiple nodes

**Option C: Mixed granularity based on property scope (recommended)**

Each property declares its scope. File-scoped properties are attributes on
`ts.SourceFile`. Node-scoped properties are attributes on specific node types.
The checker walks the tree and evaluates attributes at the appropriate level.

```typescript
// File-scoped attribute:
const noImports = synthesized((sf: ts.SourceFile): boolean => { ... });

// Node-scoped attribute (future):
const noClosure = synthesized((fn: ts.FunctionDeclaration): boolean => {
  // Check if function captures any outer variables
  ...
});
```

Pros:
- Each property uses the natural scope
- No over-engineering for file-level properties
- Extensible to node-level when needed

Cons:
- Need to handle different scopes in the diagnostic collection logic
- Slightly more complex traversal

**Recommendation: Option C.** Start with file-level attributes (noImports is
file-level), but design the attribute infrastructure to work at any node
granularity. The `synthesized()` helper already works with any node type.

### Decision 6: Nomenclature

**The question:** What terminology should we adopt from JastAdd/Silver?

**Recommendation: Adopt the following mapping:**

| AG Concept | Our Term | TypeScript Construct |
|------------|----------|---------------------|
| Nonterminal | (use TS AST node types directly) | `ts.SourceFile`, `ts.VariableDeclaration`, etc. |
| Production | (not applicable — we don't define AST constructors) | — |
| Synthesized attribute | **Attribute** (or `syn` in comments) | `synthesized((node) => value)` |
| Inherited attribute | **Context** (or `inh` in comments) | Closure-captured parameters (env, tsProgram) |
| Collection attribute | **Collection** or **Collector** | Array aggregation via spread: `[...a, ...b]` |
| Equation | (implicit — the function body of an attribute) | — |
| Aspect | **Property module** | A file exporting attribute + contribution functions |
| Decoration | `createChecker(env, program)` | Closure creation with captured inherited context |
| Reference attribute | (use TS type checker for cross-references) | `tsChecker.getSymbolAtLocation()` |
| Demand-driven evaluation | **Lazy evaluation** | `synthesized()` wrapper with WeakMap cache |
| `contributes` / `coll` | **Contribution** | Function returning `KSDiagnostic[]` |

### Decision 7: How to Use TypeScript's Binding (Symbol Tables)

**The question:** TypeScript has already done binding — it has symbol tables,
scope chains, and a type checker. JastAdd/Silver would say "the AST is the
symbol table." What do we use?

**Option A: Ignore TS binding, reimplement lookup as attributes**

Walk the AST ourselves to resolve kind references.

Pros:
- Pure AG approach
- No dependency on TS internals

Cons:
- Reimplementing what TS already does perfectly
- Would not handle re-exports, barrel files, type aliases, etc.
- Enormous effort for zero benefit

**Option B: Use TS binding as an inherited attribute (recommended)**

Treat `ts.TypeChecker` as an inherited attribute supplied during decoration.
It provides the `lookup` functionality that JastAdd would express as
`inh Decl Var.lookup(String name)`.

```typescript
// In JastAdd, you'd write:
//   inh Decl Var.lookup(String name);
//   syn Decl Var.decl() = lookup(getName());

// In our system, TS already provides this:
//   tsChecker.getSymbolAtLocation(node.typeName)
//   → resolves through imports, re-exports, aliases, etc.

// Our equivalent of decl():
function resolveKindReference(
  typeRef: ts.TypeReferenceNode,
  tsChecker: ts.TypeChecker,      // inherited attribute (env)
  kindNames: Set<string>,         // inherited attribute (env)
): string | undefined {
  const symbol = tsChecker.getSymbolAtLocation(typeRef.typeName);
  if (!symbol) return undefined;
  const decl = symbol.declarations?.[0];
  if (decl && ts.isTypeAliasDeclaration(decl) && kindNames.has(decl.name.text)) {
    return decl.name.text;
  }
  return undefined;
}
```

This is conceptually identical to JastAdd's `syn Decl Var.decl() = lookup(getName())`
— we just use TypeScript's type checker as our `lookup` implementation.

Pros:
- Leverages TS's full name resolution (imports, re-exports, aliases, namespaces)
- Zero reimplementation
- Correct by construction (TS's binder is battle-tested)
- Conceptually clean — TS type checker = inherited `lookup` attribute

Cons:
- Depends on TS internals (but we already do)
- Less "pure" AG

**Recommendation: Option B.** TypeScript's type checker is our `lookup`
inherited attribute. This is the pragmatic choice and is still conceptually
sound in AG terms — we're just using a pre-computed inherited attribute rather
than computing it ourselves.

---

## Proposed Architecture: noImports End-to-End

Here is the concrete architecture for the checker, using AG patterns, starting
with noImports.

### File Structure

```
src/pipeline/
  types.ts          -- Nonterminal type definitions (KindDefinition, KindSymbol, etc.)
  binder.ts         -- Computes the "env" inherited attribute (kind definitions)
  checker.ts        -- Decoration factory: creates checker with inherited context
  attributes/
    noImports.ts    -- Synthesized attribute: does a file satisfy noImports?
    index.ts        -- Re-exports all property attributes
```

### The `synthesized()` Helper

```typescript
// src/pipeline/attributes/synthesized.ts

/**
 * Create a memoized synthesized attribute.
 *
 * AG equivalent: syn lazy T Node.attr() = compute(node);
 *
 * The attribute is computed on first access and cached.
 */
export function synthesized<N extends object, V>(
  compute: (node: N) => V,
): (node: N) => V {
  const cache = new WeakMap<N, { value: V }>();
  return (node: N): V => {
    const cached = cache.get(node);
    if (cached !== undefined) return cached.value;
    const value = compute(node);
    cache.set(node, { value });
    return value;
  };
}
```

Note the `{ value: V }` wrapper — this allows caching `undefined` and `false`
values correctly.

### The noImports Attribute

```typescript
// src/pipeline/attributes/noImports.ts

import ts from 'typescript';
import { synthesized } from './synthesized.js';
import type { KindSymbol, KSDiagnostic } from '../types.js';

/**
 * syn boolean SourceFile.noImports
 *
 * True if the source file contains no non-type-only imports.
 */
export const noImports = synthesized((sf: ts.SourceFile): boolean => {
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!stmt.importClause) return false;       // side-effect import
    if (!stmt.importClause.isTypeOnly) return false; // value import
  }
  return true;
});

/**
 * coll KSDiagnostic[] SourceFile.noImportsDiagnostics
 *
 * Contributes diagnostics for kind-annotated symbols in files that
 * violate noImports.
 */
export function contributeNoImportsDiagnostics(
  sf: ts.SourceFile,
  symbols: KindSymbol[],
): KSDiagnostic[] {
  if (noImports(sf)) return [];

  return symbols
    .filter(s => s.definition.properties.noImports)
    .map(s => ({
      file: sf,
      start: s.node.getStart(sf),
      length: s.node.getEnd() - s.node.getStart(sf),
      messageText: `'${s.name}' is kind '${s.definition.name}' (noImports), but file contains imports`,
      category: ts.DiagnosticCategory.Error as ts.DiagnosticCategory,
      code: 70200,
      property: 'noImports',
    }));
}
```

### The Checker (Decoration Factory)

```typescript
// src/pipeline/checker.ts

import ts from 'typescript';
import type { BinderResult, KindSymbol, KSDiagnostic, KSChecker } from './types.js';
import { contributeNoImportsDiagnostics } from './attributes/noImports.js';

/**
 * Create a KindScript checker.
 *
 * In AG terms, this "decorates" the program with inherited attributes
 * (env = BinderResult, tsChecker = ts.TypeChecker) and makes synthesized
 * attributes (symbols, diagnostics) available on demand.
 *
 * Silver equivalent:
 *   decorate program with { env = binderResult; tsChecker = ...; };
 */
export function createChecker(
  binderResult: BinderResult,  // inh env
  tsProgram: ts.Program,       // inh context
): KSChecker {
  // Lazy evaluation: computed on first demand, then cached.
  let symbols: KindSymbol[] | undefined;
  let diagnostics: KSDiagnostic[] | undefined;

  function run() {
    if (symbols !== undefined) return;
    symbols = [];
    diagnostics = [];

    const tsChecker = tsProgram.getTypeChecker();
    const kindNames = new Set(binderResult.definitionsByName.keys());

    let nextSymId = 0;

    // Walk source files — resolve annotations (collector Pass 2 equivalent)
    for (const sf of tsProgram.getSourceFiles()) {
      if (sf.isDeclarationFile) continue;

      const fileSymbols: KindSymbol[] = [];

      for (const stmt of sf.statements) {
        if (!ts.isVariableStatement(stmt)) continue;
        for (const decl of stmt.declarationList.declarations) {
          if (!decl.type) continue;
          const kindRefs = findKindReferencesInType(decl.type, kindNames, tsChecker);
          for (const kindName of kindRefs) {
            const def = binderResult.definitionsByName.get(kindName);
            if (!def) {
              diagnostics!.push({ /* unresolved kind diagnostic */ });
              continue;
            }
            const sym: KindSymbol = {
              id: `sym-${nextSymId++}`,
              name: ts.isIdentifier(decl.name) ? decl.name.text : 'anonymous',
              definition: def,
              node: decl,
              sourceFile: sf,
            };
            fileSymbols.push(sym);
            symbols!.push(sym);
          }
        }
      }

      // Collection attribute: gather diagnostics from all property contributions
      diagnostics!.push(...contributeNoImportsDiagnostics(sf, fileSymbols));
      // Future: diagnostics!.push(...contributeNoClosureDiagnostics(sf, fileSymbols));
    }
  }

  return {
    getSymbols() { run(); return symbols!; },
    getDiagnostics(sourceFile?) {
      run();
      if (sourceFile) return diagnostics!.filter(d => d.file === sourceFile);
      return diagnostics!;
    },
  };
}
```

### Adding a New Property (Future Example)

To add a `noMutation` property, you would:

1. Add `noMutation?: true` to `PropertySet`
2. Create `src/pipeline/attributes/noMutation.ts`:

```typescript
export const noMutation = synthesized((fn: ts.FunctionDeclaration): boolean => {
  // Check that function body contains no assignment expressions
  ...
});

export function contributeNoMutationDiagnostics(
  sf: ts.SourceFile,
  symbols: KindSymbol[],
): KSDiagnostic[] { ... }
```

3. Add `contributeNoMutationDiagnostics` call in the checker's collection

This is the AG "just add an aspect" pattern — you write a new attribute module
and wire its contribution into the collection. No existing property code
changes.

---

## Summary of Recommendations

| # | Decision | Recommendation | AG Justification |
|---|----------|---------------|------------------|
| 1 | Binding stage | Keep binder as env computation, checker as syn computation | Silver's decorated/undecorated model — binder = decoration, checker = syn attrs |
| 2 | Attribute representation | `synthesized()` functions with WeakMap cache | JastAdd's `syn lazy` — demand-driven, cached, per-node |
| 3 | Inherited attributes | Closure-captured context in checker factory | Silver's `decorate with { env = ... }` |
| 4 | Property evaluation | Attribute-per-property with collection diagnostics | JastAdd's `coll`/`contributes` pattern |
| 5 | Granularity | Mixed — file-level for noImports, node-level when needed | AG attributes work at any node granularity |
| 6 | Nomenclature | Adopt AG terms (syn/inh/coll/aspect/decoration) in comments and docs | — |
| 7 | TS binding | Use ts.TypeChecker as inherited `lookup` attribute | JastAdd's `inh Decl Var.lookup()` — same concept, TS implementation |
