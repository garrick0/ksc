> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# Attribute Grammar Systems: Silver, JastAdd, and @ksc/ag

A comprehensive comparison of two production attribute grammar systems with our library implementation.

---

## Part 1: System Overviews

### Silver (University of Minnesota / MELT Group)

**What it is:** A standalone extensible attribute grammar specification *language* (`.sv` files) that compiles to Java. Self-hosted. Designed around modular language extension with formal composability guarantees.

**Key use case:** ableC (extensible C compiler), language extension research.

#### Core Nomenclature

| Term | Meaning |
|------|---------|
| **Grammar** | A module (like a Java package). Named with domain-style paths: `edu:umn:cs:melt:silver` |
| **Nonterminal** | A type of syntax tree node. Can be parameterized (polymorphic). Declared with `nonterminal Expr with pp, env, errors;` |
| **Production** | Constructor for a nonterminal — abstract (semantic) or concrete (parser-facing). Signature: `top::Expr ::= l::Expr r::Expr` |
| **Attribute** | Named value on a node — `synthesized`, `inherited`, or collection |
| **Equation** | Defines an attribute value within a production body using `=` |
| **Occurs on** | Declaration binding an attribute to a nonterminal |
| **Aspect production** | Extends an existing production with new equations from a different grammar module |
| **Annotation** | Value supplied at node-creation time, accessible from undecorated nodes |
| **Decorated / Undecorated** | Type-level distinction: undecorated = bare tree structure; decorated = tree with inherited attributes supplied and all attributes evaluable |
| **Forwarding** | A production delegates unspecified attributes to a semantically equivalent tree |

#### Attribute Types in Silver

| Type | Declaration | Notes |
|------|-------------|-------|
| **Synthesized** | `synthesized attribute pp :: String;` | Bottom-up. Equations in productions. |
| **Inherited** | `inherited attribute env :: [Pair<String Type>];` | Top-down. Equations in parent for children. |
| **Collection** | `synthesized attribute errors :: [Message] with ++;` | Base (`:=`) + contributions (`<-`). Combining op must be commutative. |
| **Higher-order** | `synthesized attribute ast :: Expr;` | Value is an undecorated syntax tree. |
| **Reference** | `synthesized attribute dcl :: Decorated Decl with {env};` | Value is a decorated node (pointer into tree). |
| **Local** | `local attribute myTree :: Expr;` | Scoped to a production. Can be decorated with inherited attrs. |
| **Annotation** | `annotation location :: Location;` | Supplied at construction, not during decoration. |

#### Automatic / Propagate Patterns

Silver provides `propagate` for common attribute patterns:

| Pattern | What it does |
|---------|--------------|
| **Monoid** | Collects values upward by `append`ing child contributions |
| **Functor** | Reconstructs production with transformed children (tree-to-tree) |
| **Threaded** | Paired inh/syn attributes threaded through traversal |
| **Destruct** | Decompose another decorated tree of same shape |
| **Equality / Ordering** | Structural comparison |

```silver
propagate errors, env;  -- auto-generate equations
propagate errors on Expr excluding someSpecialProd;  -- with exceptions
```

#### Evaluation

- **Demand-driven** (lazy): attributes computed only when accessed
- **Memoized**: cached on decorated nodes after first evaluation
- **Decorated vs. undecorated**: two-stage — build bare tree, then decorate with inherited attributes
- **Tree sharing**: `@` operator reuses decorated trees, prevents exponential recomputation
- **No native circular attribute support** — uses strategies and collections for iterative patterns

#### Module & Extension System

- Grammar-level modules with `imports` / `exports`
- **Modular Well-Definedness Analysis (MWDA)**: formal guarantee that independently developed extensions compose safely
- Extension productions **must forward** — this solves the expression problem
- Separate compilation to Java classes

#### Forwarding (Silver's signature feature)

```silver
abstract production gte
top::Expr ::= l::Expr r::Expr
{
  top.pp = l.pp ++ " >= " ++ r.pp;  -- explicit
  forwards to not(lt(l, r));         -- default for everything else
}
```

- Explicitly defined attributes use their equations; unspecified attributes delegate to the forwarded-to tree
- Inherited attributes auto-copied to forwarded tree
- Pattern matching falls through to forwarded tree on mismatch

#### Rewrite / Transformation Support

| Mechanism | Description |
|-----------|-------------|
| **Strategy attributes** | Rewrite rules + strategy combinators (`topDown`, `bottomUp`, `innermost`, etc.) on decorated trees |
| **Reflection-based term rewriting** | Stratego-style rewriting on undecorated terms via `reflect`/`reify` |
| **Functor propagate** | Lightweight tree-to-tree via `propagate` |

#### Type System

Full type system: parametric polymorphism, higher-kinded types, type classes (with default implementations, superclass constraints, instance deriving), type aliases, function types.

#### Code Generation

Compiles `.sv` → Java → JAR. Bundled with **Copper** (LALR(1) parser generator for composable concrete syntax).

---

### JastAdd (Lund University)

**What it is:** A metacompiler that reads `.ast` / `.jrag` / `.jadd` files and generates Java source code. Based on Reference Attribute Grammars (RAGs). Uses inter-type declarations (aspect-style) to modularly add attributes to AST classes.

**Key use case:** ExtendJ (full extensible Java compiler), IDE integration, static analysis tools.

#### Core Nomenclature

| Term | Meaning |
|------|---------|
| **AST class** | Java class representing a node. Defined in `.ast` files. |
| **Nonterminal** | Abstract superclass: `abstract Stmt;` |
| **Production** | Concrete subclass: `WhileStmt : Stmt ::= Condition:Expr Body:Stmt;` |
| **Attribute** | Computed property on an AST node — `syn`, `inh`, `coll`, `circular`, parameterized, or NTA |
| **Equation** | `eq Node.attr() = expr;` — how to compute an attribute |
| **Aspect** | A `.jrag`/`.jadd` module that adds attributes/equations/methods to AST classes |
| **ASTNode** | Predefined base class of all generated AST classes |
| **List / Opt** | Generic containers: `C*` (list children), `[C]` (optional children) |
| **Token** | Leaf string/typed value: `<Name>` or `<Value:int>` |
| **NTA** | Nonterminal Attribute — higher-order attribute whose value is a fresh AST subtree |
| **Refinement** | One aspect overriding another's equation: `refine A eq Node.attr() = ...;` |

#### File Types

| Extension | Purpose |
|-----------|---------|
| `.ast` | Abstract grammar declarations — AST class hierarchy, children, tokens, NTA slots |
| `.jrag` | Declarative aspects — attributes, equations, rewrites |
| `.jadd` | Imperative aspects — methods, fields, constructors |

#### Attribute Types in JastAdd

| Type | Declaration | Notes |
|------|-------------|-------|
| **Synthesized** | `syn Type Expr.type();` | Bottom-up. Equations per production subclass. |
| **Inherited** | `inh Env Expr.env();` | Top-down. Equation in parent: `eq C.getA().env() = ...;`. **Broadcasts** to entire subtree. |
| **Parameterized** | `syn boolean TypeDecl.subclassOf(TypeDecl other);` | Function-like. Can be cached (`syn lazy`). |
| **Reference** | `syn lazy Decl Use.decl() = lookup(getName());` | Value is a pointer to another AST node. The "R" in RAG. |
| **NTA (Higher-order)** | `syn nta TypeDecl Program.unknownType() = new UnknownType();` | Value is a fresh AST subtree, grafted into tree with parent pointer. Always cached. |
| **Circular** | `syn Set<State> State.reachable() circular [new HashSet<>()] = ...;` | Fixed-point iteration. Must form finite-height lattice with monotonic equations. Always cached. |
| **Collection** | `coll Set<String> Program.errors() [new HashSet<>()] with add root Program;` | Aggregates contributions from entire subtree. Two-phase: survey then collect. |

#### Collection Attributes (Detail)

```java
// Declaration
coll Set<String> Program.errors() [new HashSet<>()] with add root Program;

// Contributions (from any node type)
VarDecl contributes "Duplicate: " + getName()
  when isDuplicate()
  to Program.errors()
  for program();  // target node reference

// Multiple values
TypeDecl contributes each getErrors() to Program.errors();
```

**Evaluation**: (1) Survey phase — traverse subtree from collection root to find contributors. (2) Collection phase — evaluate contributions and combine with `with` method.

**Key features**: `when` clause (conditional), `for` clause (target disambiguation), `each` (multiple contributions), NTA contributions, custom survey blocks.

#### Rewrites

```java
rewrite UnresolvedType {
  when (isType()) to ResolvedType { return resolve(); }
}
```

- Triggered transparently when node is first accessed via `getChild()`
- Conditions checked in order (superclass first, then lexical)
- After replacement, all rules re-checked (iterative)
- `--rewrite=cnta`: Models rewrites as circular NTAs internally (recommended)
- `--flush=rewrite`: Preserves originals so rewrites can be undone

#### Evaluation Strategy

- **Demand-driven** (lazy): computed only when accessed
- **Caching**: opt-in via `lazy` keyword, or global `--cache=all`
- **Circular**: fixed-point iteration with `IN_CIRCLE`/`CHANGE` state machine
- **No explicit traversal schedule** — engine interleaves computation as needed

#### Incremental Evaluation

- Experimental `--incremental` flag
- Dynamic dependency tracking at evaluation time
- On AST modification, only invalidated caches are flushed
- Critical for IDE integration (keystroke-level updates)
- **RagConnect**: reactive connections to external systems (MQTT, REST)

#### Flush / Invalidation Hierarchy

| Method | Scope |
|--------|-------|
| `flushCache()` | This node only |
| `flushAttrCache()` | Attribute values in this node |
| `flushRewriteCache()` | Rewrite state (restore originals if `--flush=rewrite`) |
| `flushCollectionCache()` | Collection caches in this node |
| `flushTreeCache()` | Recursive flush on entire subtree |

#### Concurrency

`--concurrent` flag enables parallel attribute evaluation with thread-safe caching.

#### Code Generation

Generates one Java class per AST node. Includes: constructors, `getX()`/`setX()` accessors, `copy()`/`fullCopy()`, all cache infrastructure, `Define_T_x()` inherited dispatch methods, `collect_contributors_X_y()` for collections.

**Build**: `java -jar jastadd2.jar --package=lang --o=src/gen --rewrite=cnta --safeLazy lang/*.ast lang/*.jrag lang/*.jadd`

**Gradle plugin**: `org.jastadd` version 1.13.3+.

---

## Part 2: Feature Matrix

### Complete Feature Comparison

| Feature | Silver | JastAdd | @ksc/ag |
|---------|--------|---------|---------|
| **Implementation approach** | Standalone language → Java | Metacompiler → Java | TypeScript library (no codegen) |
| **Synthesized attributes** | Yes | Yes (`syn`) | Yes (`syn`, `uncached`, `paramSyn`) — lazy getters stamped on nodes |
| **Inherited attributes** | Yes (per-child equations) | Yes (`inh`, per-child + broadcasting) | Partial (`down`, `atRoot` — ancestor walk, no per-child dispatch) |
| **Parameterized attributes** | Yes (functions) | Yes (`syn lazy T A.x(P p)`) | Yes (`paramSyn`) |
| **Circular attributes** | No native support | Yes (fixed-point, lattice) | Yes (`circular` — Magnusson-Hedin algorithm) |
| **Collection attributes** | Yes (`:=` base, `<-` contributions, commutative op) | Yes (two-phase survey/contribute, `for`/`when`/`each`) | Partial (`coll` — DFS subtree aggregation, no contributions from remote nodes) |
| **Higher-order attributes (NTA)** | Yes (undecorated tree values) | Yes (`syn nta`, grafted into tree) | No |
| **Reference attributes** | Yes (decorated node pointers) | Yes (RAG — the defining feature) | Partial (`lookup` — global symbol table, not per-node reference) |
| **Rewrites** | Yes (strategies, reflection, functor) | Yes (transparent on `getChild`, iterative, CNTA) | No |
| **Forwarding** | Yes (Silver's signature feature) | No | No |
| **Per-production dispatch** | Implicit (equations in productions) | Implicit (equations in subclasses) | Yes (`match` — discriminant-based) |
| **Chain/threaded attributes** | Yes (`propagate` threaded) | Manual (paired inh/syn) | Yes (`chain` — DFS pre-order) |
| **Caching** | Always (on decorated nodes) | Opt-in (`lazy`) or global `--cache=all` | Property-stamp via lazy getters (default), or uncached |
| **Tree construction/navigation** | Built-in (production application) | Generated (`getChild`, `getParent`, etc.) | `stampTree` stamps `$parent`/`$children`/`$index`/`$root`/`$prev`/`$next` on nodes |
| **Modular extension** | Yes (MWDA, forwarding, grammar modules) | Yes (aspects, inter-type declarations, refinement) | No (pure library composition) |
| **Pattern matching** | Yes (ML-style, forwarding-aware) | Via aspect dispatch | `match` on discriminant field |
| **Incremental evaluation** | No | Experimental (`--incremental`, dependency tracking) | No |
| **Concurrent evaluation** | No | Experimental (`--concurrent`) | No |
| **Flush / cache invalidation** | N/A (immutable decorated trees) | Yes (hierarchy of flush methods) | No (properties are permanent once computed) |
| **AST modification** | Immutable (build new trees) | Mutable (`addChild`, `removeChild`, `setChild`) | Immutable (tree is stamped once) |
| **Type system** | Full (polymorphism, type classes, higher-kinded) | Java's type system | TypeScript generics |
| **Decorated vs. undecorated** | Yes (type-level distinction) | No (single mutable tree) | No |
| **Annotations** | Yes (values at construction time) | No | No |
| **Aspect/module system** | Grammar modules with imports/exports | `.jrag`/`.jadd` aspects with inter-type declarations | None (function composition) |
| **Code generation** | → Java → JAR | → Java source | None (runtime library) |
| **Parser integration** | Copper (bundled) | External (Beaver/JFlex typical) | None |
| **Automatic attribute propagation** | `propagate` (monoid, functor, threaded, etc.) | No (manual equations) | No |
| **Rewrite strategies** | Yes (topDown, bottomUp, innermost, etc.) | No (condition-based only) | No |
| **Collection `when` guard** | No (use `if` in contribution) | Yes (`when` clause) | No (check in `contribute` function) |
| **Collection `for` targeting** | N/A | Yes (target specific node) | No (contributions scoped to subtree) |
| **Collection root scoping** | N/A | Yes (`root R` clause) | Implicit (rooted at node being evaluated) |

---

## Part 3: Gap Analysis — @ksc/ag vs. Silver & JastAdd

### Critical Missing Features

#### 1. Higher-Order Attributes / NTAs
**What it is:** Attributes whose values are fresh AST subtrees that become part of the tree (with parent pointers, their own attributes, etc.).

**Why it matters:** Enables desugaring, intermediate representations, synthetic nodes (e.g., built-in types), and tree-to-tree transformations within the AG framework.

**Silver:** `synthesized attribute ast :: Expr;` — value is an undecorated nonterminal type.
**JastAdd:** `syn nta TypeDecl Program.unknownType() = new UnknownType();` — grafted into tree.
**@ksc/ag:** Not supported. Could partially simulate by having an attribute return a new tree and calling `stampTree` on it, but it won't be "grafted" into the parent tree.

#### 2. Rewrites / Tree Transformations
**What it is:** Declarative rules that transparently transform AST nodes, typically triggered on first access.

**Why it matters:** Critical for desugaring (e.g., `for` → `while`), type resolution (e.g., unresolved name → resolved reference), and normalization passes.

**Silver:** Three mechanisms — strategy attributes (decorated), reflection-based term rewriting (undecorated), functor propagation.
**JastAdd:** Transparent rewrites on `getChild()` access, iterative until fixpoint, CNTA implementation.
**@ksc/ag:** Not supported. Users must manually transform trees before or after attribute evaluation.

#### 3. Per-Child Inherited Attribute Dispatch
**What it is:** The ability to provide different inherited attribute values to different children, with fine-grained control (e.g., different env for each statement in a block based on preceding declarations).

**Why it matters:** Essential for scoping, where each child in a list needs a progressively augmented environment.

**Silver:** Full per-child equations: `l.env = top.env; r.env = extendEnv(top.env, l.defs);`
**JastAdd:** Full per-child with index: `eq Block.getStmt(int i).env() = computeEnv(i);`. Plus **broadcasting** to entire subtree.
**@ksc/ag:** `inh(rootValue, eq?)` uses parent-defined equations: `eq(parent, child, childIndex)` provides per-child differentiation (JastAdd/Silver-style). Auto-propagation via `return undefined`.

#### 4. Two-Phase Collection Attributes (Survey/Contribute)
**What it is:** Collection attributes where contributions come from *anywhere in the tree* (not just the subtree), with a target reference (`for` clause) and conditional contributions (`when` clause).

**Why it matters:** Enables gathering contributions to a node from nodes that aren't its descendants (e.g., all uses of a declaration contributing to the declaration's reference list).

**Silver:** Collection with `:=` (base) and `<-` (contribution). Commutative combining.
**JastAdd:** Full two-phase: survey from root, then collect. `for` targets specific nodes. `when` guards. `each` for multiple values. NTA contributions.
**@ksc/ag:** `coll()` only aggregates from the subtree rooted at the evaluated node. No `for` targeting. No `when` guard (must be encoded in `contribute` function). No survey phase.

#### 5. Modular Extension / Aspect System
**What it is:** The ability to add attributes, equations, and behavior to existing AST classes from separate modules without modifying the original definitions.

**Why it matters:** Enables separation of concerns (name analysis in one module, type checking in another) and extensibility (adding new attributes to existing nodes).

**Silver:** Grammar modules with `imports`/`exports`, aspect productions, MWDA.
**JastAdd:** `.jrag`/`.jadd` aspects with inter-type declarations, refinement.
**@ksc/ag:** None. Attributes are `AttributeDef` specs applied via `applyAttributes`. Composition is via merging spec objects. No way to "add" an attribute to a node type from a separate module after initial application.

#### 6. Incremental / Reactive Evaluation
**What it is:** Tracking dependencies at evaluation time and re-evaluating only what changed when the AST is modified.

**Why it matters:** Critical for IDE integration, live editing, and interactive tools.

**JastAdd:** Experimental `--incremental` with dependency tracking. RagConnect for reactive connections.
**Silver:** Not supported.
**@ksc/ag:** Not supported. Property-stamped caches are permanent — if the tree changes, stamped values are stale.

### Moderate Missing Features

#### 7. Forwarding
**Silver-specific.** Not in JastAdd or @ksc/ag. Enables modular language extension by delegating unspecified attributes to a semantically equivalent host-language tree.

#### 8. Decorated vs. Undecorated Distinction
**Silver-specific.** Type-level distinction between bare trees and fully-attributed trees. Prevents accessing attributes on undecorated nodes. @ksc/ag has no such distinction — attributes are just functions callable on any node.

#### 9. Automatic Attribute Propagation
**Silver:** `propagate errors, env;` auto-generates equations for monoid collection, threading, functor transformation, etc.
**JastAdd:** No equivalent.
**@ksc/ag:** No equivalent (each attribute must be manually defined).

#### 10. Concurrent Evaluation
**JastAdd:** `--concurrent` flag for thread-safe parallel attribute evaluation.
**@ksc/ag:** Not supported (single-threaded JS runtime, though could work with workers).

#### 11. Cache Flush / Invalidation
**JastAdd:** Hierarchy of flush methods (`flushAttrCache`, `flushRewriteCache`, `flushCollectionCache`, `flushTreeCache`).
**@ksc/ag:** No invalidation API. Lazy getters become permanent data properties after first access. Could theoretically be reset by redefining properties, but no API for it.

#### 12. AST Mutability / Modification
**JastAdd:** Full mutable AST API (`addChild`, `removeChild`, `setChild`, `insertChild`) + flush.
**@ksc/ag:** Designed for immutable ASTs. No mutation API.

### Minor / Niche Missing Features

| Feature | In Silver | In JastAdd | In @ksc/ag |
|---------|-----------|------------|------------|
| Parser integration | Copper (LALR+scanner) | External | None |
| Source position tracking | Annotations | `getStartLine()` etc. | None |
| Tree copying | Implicit (immutable) | `copy()`, `fullCopy()` | None |
| Circularity detection | N/A | `--visitCheck` | None (infinite loop) |
| Attribute statistics/profiling | `--dump-flow-graph` | `--statistics` | None |
| Pattern matching on trees | ML-style + forwarding-aware | Via dispatch | `match` on discriminant |
| Type classes / constraints | Yes | N/A (Java) | N/A (TypeScript) |
| String templates | Yes (`s"..."`) | No | No (template literals) |

---

## Part 4: Interface & Configuration Differences

### How Grammars Are Defined

| Concern | Silver | JastAdd | @ksc/ag |
|---------|--------|---------|---------|
| **Node types** | `nonterminal Expr with pp, env;` | `.ast` file: `abstract Expr; AddExpr : Expr ::= Left:Expr Right:Expr;` | TypeScript interfaces/unions: `type Expr = Leaf \| Fork;` |
| **Children** | In production signature: `top::Expr ::= l::Expr r::Expr` | In `.ast`: `AddExpr : Expr ::= Left:Expr Right:Expr;` | User-provided `getChildren` function to `createTree()` |
| **Attribute declaration** | `synthesized attribute pp :: String;` + `attribute pp occurs on Expr;` (or `with` clause) | `syn String Expr.pp();` in `.jrag` aspect | `const pp = syn(node => ...)` returns `AttributeDef`, installed via `applyAttributes` |
| **Equations** | In production body: `top.pp = l.pp ++ " + " ++ r.pp;` | `eq AddExpr.pp() = getLeft().pp() + " + " + getRight().pp();` | Inside the `syn` callback: `if (n.type === 'Add') return (n.left as any).pp + " + " + (n.right as any).pp;` |
| **Inherited equations** | In production body: `l.env = top.env;` | `eq Parent.getChild().env() = expr;` | `inh(rootValue, eq?)` — parent-defined, JastAdd/Silver-style |
| **Per-production dispatch** | Implicit (each production has its own body) | Implicit (equations on subclasses) | Explicit `match('type', { Add: ..., Lit: ... })` |

### How Trees Are Built & Navigated

| Concern | Silver | JastAdd | @ksc/ag |
|---------|--------|---------|---------|
| **Construction** | Apply production: `add(l, r)` | `new AddExpr(left, right)` | Build any object, then `stampTree(root, getChildren)` stamps navigation on nodes |
| **Parent access** | Via inherited attributes (parent provides values) | `getParent()` method | `node.$parent` (stamped property) |
| **Child access** | Named children in production scope: `l`, `r` | Generated getters: `getLeft()`, `getRight()` | Direct property access: `node.left`, `node.right` |
| **Sibling access** | Not direct | Not direct | `node.$prev`, `node.$next` (stamped properties) |
| **Tree modification** | Immutable (build new) | Mutable (`setChild`, `addChild`, etc.) | Immutable |

### How Attributes Are Evaluated

| Concern | Silver | JastAdd | @ksc/ag |
|---------|--------|---------|---------|
| **Triggering** | Access decorated node attribute | Call generated method: `node.type()` | Property access: `node.type` (lazy getter computes on first read) |
| **Caching** | Automatic on decorated nodes | Opt-in (`lazy`) or global | Property stamp (lazy getter → data property on first access) |
| **Circular** | Not native | Fixed-point with `circular` keyword | `circular(init, compute, {equals})` — Symbol-keyed iteration state on nodes |
| **Collection access** | Access like any attribute | Call: `program.errors()` | Property access: `node.errors` |

### How Modules / Extensions Work

| Concern | Silver | JastAdd | @ksc/ag |
|---------|--------|---------|---------|
| **Module unit** | Grammar (directory of `.sv` files) | Aspect (`.jrag`/`.jadd` file) | TypeScript module |
| **Adding attributes** | `aspect production` in different grammar | New aspect with `syn`/`inh` declarations | Define new function in new file |
| **Overriding** | Not directly (forwarding instead) | `refine` keyword | N/A (functions are standalone) |
| **Composition guarantee** | MWDA formal verification | None (Java type checking only) | None (TypeScript type checking only) |

---

## Part 5: Recommendations

### High-Impact Features to Consider Adding

1. **Per-child inherited attribute dispatch** — Now supported via `inh(rootValue, eq?)` where `eq(parent, child, childIndex)` provides per-child values. Already JastAdd/Silver-style.

2. **Two-phase collection attributes** — Current `coll()` only gathers from subtrees. For real-world use (error collection, reference gathering), need contributions from anywhere in the tree targeting specific nodes.

3. **Higher-order attributes / NTAs** — Essential for desugaring and intermediate representations. Even a simplified version (attribute returns a tree that can itself be attributed) would be valuable.

4. **Rewrites** — Declarative tree transformation is a major productivity feature. Could start with a simple "rewrite on first access" pattern.

5. **Cache invalidation** — For interactive/dashboard use cases, need a way to invalidate caches when the tree changes.

### Features That May Not Be Needed

- **Forwarding** — Silver-specific, designed for composable language extensions. Not needed unless building an extensible language workbench.
- **Concurrent evaluation** — JS is single-threaded. Could matter for worker-based parallelism but low priority.
- **Decorated vs. undecorated types** — TypeScript's type system can't enforce this at the level Silver does. The property-stamp API sidesteps most of the problems this solves.
- **Full aspect/inter-type system** — The library approach with `AttributeDef` specs and `applyAttributes` provides adequate modularity for our use case.

### Bridging Strategies

For features that "require code generation" per the DESIGN.md, consider:

- **Per-child inherited dispatch**: Implemented as `inh(rootValue, eq?)` where `eq(parent, child, childIndex)` returns value or `undefined` for auto-propagation.
- **Two-phase collections**: Could implement a global survey pass during `stampTree`, building a contribution registry that `coll` consults.
- **NTAs**: Could wrap attribute results in a lightweight subtree that gets its own `stampTree` + `applyAttributes` call.
- **Rewrites**: Could implement as a tree transformation layer that runs before `stampTree`, or as a lazy proxy pattern on `getChildren`.
