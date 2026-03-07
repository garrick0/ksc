# Decorated Tree Design Analysis

How to separate tree data from analysis in KSC's AG system: strategies, prior art, and a recommendation.

---

## The fundamental question

An AG system needs to associate three kinds of information with tree nodes:

1. **Data** -- intrinsic to the node: `kind`, `escapedText`, `pos`, `end`, `operator`
2. **Navigation** -- structural position: parent, children, siblings, index, root
3. **Attributes** -- computed analysis results: `scope`, `kindDefs`, `isReference`, `fileImports`

KSC previously put all three on the same object via mutation (`stampTree` + `installLazy`). Strategy 4 (DNode decorated tree) has been implemented to separate them cleanly.

This document evaluates four concrete strategies for implementing a decorated tree, focusing on long-term architectural quality over migration cost.

---

## Prior art: how other systems separate data from analysis

### Silver -- the canonical decorated tree

Silver (University of Minnesota) is the system that most explicitly separates raw and attributed trees. Its `DecoratedNode.java` wraps an undecorated node:

```java
public class DecoratedNode {
    protected final Node undecoratedNode;
    protected final Object[] synthesizedValues;   // indexed by attribute ID
    protected Lazy[] inheritedAttributes;          // thunks
    protected Object[] inheritedValues;            // cached results
}
```

Key properties:
- The undecorated tree is never mutated
- Decoration = supplying inherited attributes + creating a wrapper
- Attribute access is O(1) array indexing (compile-time attribute IDs)
- You can decorate the same raw tree multiple times with different inherited values
- Decoration is the mechanism for inherited attribute flow -- there are no explicit parent pointers

Silver's decorated nodes do NOT expose raw data via `.raw` or similar. The language handles the indirection transparently -- when you write `top.kind` in a production, Silver knows whether `kind` is a terminal attribute (data) or a synthesized attribute, and generates the right access path. This transparency is possible because Silver is a language, not a library.

### Roslyn -- red/green trees

Roslyn (C# compiler) separates tree data from positional context using a two-layer architecture:

- **Green tree**: immutable, shared, no parent pointers. Pure data. Width-based (stores width of each subtree, not absolute positions). Structurally shared across edits.
- **Red tree**: lazily-constructed wrappers that add parent pointers, absolute positions, and a public API. Created on demand as the user navigates the tree.

```csharp
// Red node wraps green node
public abstract class SyntaxNode {
    internal readonly GreenNode Green;
    internal readonly SyntaxNode Parent;
    internal readonly int Position;

    // Properties delegate to green node for data:
    public SyntaxKind Kind => Green.Kind;

    // Navigation is on the red node:
    public SyntaxNode? Parent => _parent;
}
```

The red tree is ephemeral -- nodes are created on demand and can be garbage collected. The green tree is the source of truth. This separation enables:
- Incremental parsing (reuse green nodes from previous parse)
- Structural sharing (identical subtrees share green nodes)
- Clean immutability semantics

Roslyn does NOT put analysis results (types, symbols, etc.) on the syntax tree at all. Those live in a completely separate `SemanticModel` object that you query by passing syntax nodes. This is the most extreme form of separation.

### rust-analyzer / rowan -- typed wrappers over untyped trees

rust-analyzer uses the rowan library for its CST. The architecture:

- **Untyped tree**: `SyntaxNode` -- a generic tree node with kind, children, text ranges
- **Typed wrappers**: `FnDef`, `Expr`, etc. -- zero-cost newtypes over `SyntaxNode` that add typed accessors

```rust
pub struct FnDef(SyntaxNode);

impl FnDef {
    pub fn name(&self) -> Option<Name> {
        child_of_kind(self.0, NAME)  // navigates untyped children
    }
    pub fn body(&self) -> Option<BlockExpr> {
        child_of_kind(self.0, BLOCK_EXPR)
    }
}
```

Analysis results live in a salsa-based incremental computation framework, completely external to the tree. `db.infer(fn_def)` computes types, returning a separate `InferenceResult` struct. The tree is never mutated.

### Kiama -- the closest library analogue

Kiama (Macquarie University) is a Scala library for attribute grammars -- not a language or generator. It faces the same constraints KSC does.

```scala
// Raw tree: plain Scala case classes
sealed trait Expr
case class Add(l: Expr, r: Expr) extends Expr
case class Num(v: Int) extends Expr

// Navigation: external Tree object
val tree = new Tree[Expr, Program](program)
// tree.parent(node), tree.children(node), tree.index(node)

// Attributes: functions with WeakHashMap caching
val depth: Expr => Int = attr {
    case tree.parent(p) => depth(p) + 1
    case _              => 0
}

// Usage: function call, not property access
val d = depth(someNode)
```

Key Kiama properties:
- Raw tree nodes are plain case classes with zero AG awareness
- Navigation is an external `Tree` object (built via a single traversal, like stampTree)
- Attributes are functions `N => V` with internal WeakHashMap caches
- Attribute access is a function call: `depth(node)`, not `node.depth`
- The `Tree` object is passed implicitly (Scala implicits) to attribute definitions
- Multiple `Tree` objects can exist for the same raw tree

Kiama's approach is essentially: navigation in an external context object, attributes as external cached functions. The raw tree is never touched.

### Spoofax / Statix -- constraint-based analysis

Spoofax (Delft University) separates tree and analysis even more radically. The AST is a pure term (algebraic data type). Name resolution and type checking are expressed as constraints in the Statix language, solved by a constraint solver. Results are stored in external scope graphs and constraint solutions, never on the AST.

### Summary of prior art

| System | Tree mutation? | Navigation | Attributes | Data access |
|--------|---------------|------------|------------|-------------|
| Silver | No | Via decoration context | On decorated wrapper (array-indexed) | Transparent (language handles it) |
| Roslyn | No | Red wrapper (parent, position) | External SemanticModel | Delegate to green node |
| rust-analyzer | No | On untyped SyntaxNode | External salsa DB | Typed wrapper methods |
| Kiama | No | External Tree object | External cached functions | Direct on case class |
| JastAdd | Yes (generated fields) | Generated methods on node | Generated fields on node | Direct on node |
| KSC (current) | No | DNode wrapper (parent, children, siblings) | DNode.attr() with Map cache | Via ctx.node |

Every modern system except JastAdd separates tree data from analysis. JastAdd gets away with mutation because it generates code -- the generated node classes are designed for it. KSC mutates plain JavaScript objects, which is more fragile.

---

## The child field problem

Before evaluating strategies, we must understand the hardest design constraint: named child field access.

KSC nodes have named child fields: `.name`, `.body`, `.parameters`, `.expression`. Currently, equations freely access these:

```typescript
// checker.ts -- isReference equation
const parent = (node as any).$parent;
if (parent.kind === 'PropertyAccessExpression' && parent.name === node) return false;
```

This pattern does two things:
1. Reads `parent.name` -- a named child field
2. Compares it by identity (`===`) to `node` to determine which child slot the current node occupies

The identity comparison answers: "am I in the `name` position of my parent?" This is a structural question about the node's role in the tree, but it's expressed as an object identity check.

Any decorated tree strategy must handle this pattern. There are three approaches:

**Approach A: Remap child fields on the wrapper.** Override `name`, `body`, etc. on the decorated node to point to decorated children. Then `parent.name === d` works. Requires schema metadata (`getChildFields`) to know which fields to remap.

**Approach B: Compare raw nodes.** Use `parent.raw.name === d.raw` (or `parent.node.name === d.node`). Works without remapping. The equation must be explicit about reaching through to raw data.

**Approach C: Replace identity checks with structural queries.** Instead of `parent.name === node`, use `ctx.parentIs('PropertyAccessExpression', 'name')` -- asking "is my parent a PropertyAccessExpression, and am I in its `name` field?" This requires the AG engine to track which parent field each child came from.

Approach C is the most principled. The equation is asking a structural question ("what is my role in my parent?"), and Approach C expresses that directly. Approaches A and B are workarounds that preserve the identity-check idiom. The choice between them shapes the entire API.

### Schema metadata that enables Approach C

The schema already provides `getChildFields(kind)`, which returns child field names in declaration order. During tree traversal, the engine can track which field each child came from:

```typescript
// During context construction:
for (const field of getChildFields(parentKind)) {
    const val = (parentNode as any)[field];
    if (Array.isArray(val)) {
        for (const item of val) {
            buildChildContext(item, parentCtx, field);  // field name passed down
        }
    } else if (val != null) {
        buildChildContext(val, parentCtx, field);
    }
}
```

Each child context then knows its `fieldName` in the parent. `parentIs(kind, field)` becomes a trivial check.

---

## Four strategies evaluated

### Strategy 1: Prototype delegation

Use `Object.create(raw)` so the decorated node inherits data properties via the JavaScript prototype chain. Override child fields as own properties pointing to decorated children.

```typescript
function decorate(raw: KSNode, parent: DNode | undefined): DNode {
    const d = Object.create(raw) as DNode;
    d.$parent = parent;
    d.$children = [];  // filled during traversal
    // Override child fields to point to decorated versions
    for (const field of getChildFields(raw.kind)) { ... }
    return d;
}
```

**Equation syntax**: `d.kind` works (prototype), `d.name` works (overridden), `d.$parent` works (own property). Nearly identical to current code.

**Assessment**: This is a clever JS trick that makes decoration nearly transparent. But it's optimizing for migration cost, not long-term clarity. The prototype chain is an implicit delegation mechanism -- `d.kind` looks like a property on `d`, but it's actually on the prototype. This causes confusion in debugging (devtools show prototypes separately), serialization (`Object.keys` misses inherited properties), and reasoning (which properties are "mine" vs inherited?).

More importantly, it doesn't solve the deeper problem. Attribute access (`d.scope`) and data access (`d.kind`) still look identical. The equation `d.name.scope` chains data access (`.name`) with attribute access (`.scope`) in a single expression with no syntactic distinction. This means you can't grep for "all attribute accesses" or "all data accesses" -- they're indistinguishable.

The prototype approach also couples the decorated node's property namespace to the raw node's. If you add a data field called `scope` to a node type, it collides with the `scope` attribute. The `$` prefix convention mitigates this for navigation (`$parent`) but not for attributes.

### Strategy 2: Full copy (spread + remap)

Create a new plain object per node with all data copied and child fields remapped.

```typescript
function decorate(raw: KSNode, parent: DNode | undefined): DNode {
    const d = { ...raw, $parent: parent, $children: [], $raw: raw };
    for (const field of getChildFields(raw.kind)) {
        d[field] = remap(d[field]);  // point to decorated children
    }
    return d;
}
```

**Equation syntax**: Identical to current code. `d.kind`, `d.name.scope`, `d.$parent` all work.

**Assessment**: Same transparency as Strategy 1 but without prototype weirdness. Simpler mental model (plain object, all own properties), but at the cost of doubling memory for the tree. Same fundamental problem: no distinction between data access and attribute access.

Both Strategy 1 and Strategy 2 are "make decoration invisible" approaches. They minimize equation changes by making the decorated node look like the current stamped node. But the whole point of Option D is to separate concerns. If the decoration is invisible, you haven't actually separated anything -- you've just moved the mutation from the raw node to a copy of the raw node. The attributes still end up as properties on the same object as the data. You can't decorate twice in a meaningful way because the second decoration's attribute getters would overwrite the first's.

### Strategy 3: Explicit wrapper with `.node`

A minimal wrapper that carries navigation and attributes, with a `.node` reference for data access.

```typescript
interface DNode<N extends KSNode = KSNode> {
    readonly node: N;            // raw node data (typed)
    readonly parent: DNode | undefined;
    readonly children: DNode[];
    readonly index: number;
    readonly isRoot: boolean;
    readonly prev: DNode | undefined;
    readonly next: DNode | undefined;
    readonly fieldName: string | undefined;  // which parent field I came from

    attr<T>(name: string): T;               // attribute access
    parentIs(kind: string, field?: string): boolean;
    childAt(field: string): DNode | undefined;
    childrenAt(field: string): DNode[];
}
```

**Equation syntax**:

```typescript
// Data: ctx.node.escapedText
// Navigation: ctx.parent, ctx.children
// Attributes: ctx.attr<Set<string>>('fileImports')
// Structural query: ctx.parentIs('VariableDeclaration', 'name')
```

**Assessment**: This is the Kiama model adapted for TypeScript. Every access is explicit about what it's doing. Data, navigation, and attributes have three different access patterns, and you can always tell which is which.

The verbosity is real but principled. `ctx.node.escapedText` is two tokens longer than `node.escapedText`. `ctx.attr('scope')` is more verbose than `node.scope`. But these are different *kinds* of access -- one reads intrinsic data, the other triggers lazy computation of a derived analysis result. Making them look different is a feature.

The key advantages over Strategies 1 and 2:

**Namespace separation.** Attributes live in the `attr()` namespace, not as properties on the same object as data. No collision possible between a data field and an attribute name. No need for `$` prefix conventions.

**True multi-decoration.** Two decorations of the same tree produce two independent `DNode` trees with independent `attr()` caches. You can run different AG specs on the same raw tree and compare results. This is exactly Silver's model.

**Testability.** To test an equation, construct a mock `DNode` with the right `.node`, `.parent`, and mock `attr()` responses. You don't need a real tree with real stamping.

**The attr() method replaces installLazy.** Instead of `Object.defineProperty` gymnastics, attribute caching is a simple Map with compute-on-miss:

```typescript
class DNodeImpl<N extends KSNode = KSNode> implements DNode<N> {
    private _cache = new Map<string, unknown>();
    private _defs: Map<string, AttrComputed>;

    attr<T>(name: string): T {
        if (this._cache.has(name)) return this._cache.get(name) as T;
        const def = this._defs.get(name);
        if (!def) throw new Error(`Unknown attribute: ${name}`);
        const value = def.compute(this);
        this._cache.set(name, value);
        return value as T;
    }
}
```

No `Object.defineProperty`. No getter-to-data-property conversion. No `configurable: true` vs `false` confusion. A Map.

**`parentIs` replaces identity checks.** The current pattern:
```typescript
parent.kind === 'PropertyAccessExpression' && parent.name === node
```
becomes:
```typescript
ctx.parentIs('PropertyAccessExpression', 'name')
```

This is more declarative. The equation says *what* it's checking (am I the `name` child of a PropertyAccessExpression?) rather than *how* (get parent, check its kind, compare its `.name` field to me by identity). And it works without child field remapping, without prototype tricks, without any coupling between the decoration layer and the raw node's property layout.

**`childAt` provides named child access through the decoration.** When an equation needs to access a specific child's attribute:

```typescript
// Current: node.type.someAttr  (chains data access with attribute access)
// Strategy 3: ctx.childAt('type')?.attr('someAttr')
```

More verbose, but explicit. You can see that `.type` is a structural navigation and `.someAttr` is an attribute evaluation. In the current code, `node.type.someAttr` looks like two property reads of the same kind, hiding the fact that one triggers lazy AG evaluation.

### Strategy 4: Context object with two-parameter equations

Like Strategy 3, but the equation signature is `(ctx: DNode, raw: KSIdentifier) => V`, with the raw node pre-cast to the dispatched type.

```typescript
equations: {
    isReference: {
        Identifier: (ctx: DNode, raw: KSIdentifier) => {
            if (ctx.parentIs('PropertyAccessExpression', 'name')) return false;
            const name = raw.escapedText;  // typed, no cast needed
            const imports = ctx.attr<Set<string>>('fileImports');
            return imports.has(name);
        },
        _: () => false,
    },
}
```

**Assessment**: This is Strategy 3 with better ergonomics for data access. Instead of `ctx.node.escapedText` (which requires casting `ctx.node` to `KSIdentifier`), you get `raw.escapedText` pre-typed. The AG engine can do this because it already dispatches on `node.kind` -- it knows the concrete type at dispatch time.

The tradeoff vs Strategy 3: two parameters instead of one. This is slightly noisier but gives you typed raw node access for free, eliminating the casts that currently litter equation bodies (`node as KSIdentifier`, `node as KSTypeAliasDeclaration`).

In practice, Strategy 4 is a refinement of Strategy 3. The `ctx` parameter provides navigation and attributes. The `raw` parameter provides typed data. Together they cover all three kinds of information an equation needs. The difference from Strategy 3 is only whether the raw node is accessed as `ctx.node` (untyped, needs casting) or as a separate typed parameter.

---

## Deep comparison: Strategy 3 vs Strategy 4

Since Strategies 1 and 2 don't achieve real separation, the choice is between 3 and 4. They share the same DNode type and the same `attr()`, `parentIs()`, `childAt()` API. The only difference is the equation signature.

### How each strategy handles the eight equation patterns in KSC

The binder and checker specs contain eight distinct access patterns. Here is each one in both strategies.

**Pattern 1: Read scalar data from current node**

```typescript
// Current:     (node as KSIdentifier).escapedText
// Strategy 3:  (ctx.node as KSIdentifier).escapedText
// Strategy 4:  raw.escapedText                          // typed, no cast
```

Strategy 4 wins. The cast is gone because dispatch pre-narrows the type.

**Pattern 2: Read attribute from current node**

```typescript
// Current:     (node as any).fileImports
// Strategy 3:  ctx.attr<Set<string>>('fileImports')
// Strategy 4:  ctx.attr<Set<string>>('fileImports')     // same
```

Identical. Both are more explicit than the current `(node as any).fileImports` -- you can see it's an attribute access, not a data read.

**Pattern 3: Navigate to parent and read its kind**

```typescript
// Current:     (node as any).$parent.kind
// Strategy 3:  ctx.parent?.node.kind
// Strategy 4:  ctx.parent?.node.kind                    // same
```

Identical. Slightly more verbose but clear.

**Pattern 4: Check which child field I am in my parent (the identity pattern)**

```typescript
// Current:     parent.kind === 'VariableDeclaration' && parent.name === node
// Strategy 3:  ctx.parentIs('VariableDeclaration', 'name')
// Strategy 4:  ctx.parentIs('VariableDeclaration', 'name')  // same
```

Identical, and strictly better than current. More declarative, no identity comparison, works without child field remapping.

**Pattern 5: Read attribute from parent**

```typescript
// Current:     (parent as any).kindAnnotations
// Strategy 3:  ctx.parent!.attr<KindDefinition[]>('kindAnnotations')
// Strategy 4:  ctx.parent!.attr<KindDefinition[]>('kindAnnotations')  // same
```

Identical.

**Pattern 6: Iterate children and read their data**

```typescript
// Current:     for (const stmt of cu.children) { if (stmt.kind === 'TypeAlias'...) }
// Strategy 3:  for (const c of ctx.children) { if (c.node.kind === 'TypeAlias'...) }
// Strategy 4:  for (const c of ctx.children) { if (c.node.kind === 'TypeAlias'...) }
```

Identical. The `.node` adds one token.

**Pattern 7: Walk up the tree**

```typescript
// Current:     let cur = (node as any).$parent; while (cur) { ... cur = cur.$parent; }
// Strategy 3:  let cur = ctx.parent; while (cur) { ... cur = cur.parent; }
// Strategy 4:  let cur = ctx.parent; while (cur) { ... cur = cur.parent; }
```

Identical, and slightly cleaner (no `$` prefix, no `as any`).

**Pattern 8: Access a specific child's attribute via named field**

```typescript
// Current:     (node as any).importClause?.name?.escapedText
// Strategy 3:  ctx.childAt('importClause')?.childAt('name')?.node.escapedText
// Strategy 4:  ctx.childAt('importClause')?.childAt('name')?.node.escapedText
```

This is the most verbose case. Three chained navigations through the decoration layer. But current code also often has ugly chains: `(ic.namedBindings as KSNamedImports).elements`. The chained `childAt` version is longer but each step is explicit about what it's doing.

However, most equations that drill into children to read data don't need the decoration layer at all -- they're reading raw data, not attributes. For pure data drilling, both strategies allow `ctx.node` fallback:

```typescript
// Strategy 3/4: when you just need data from children, use raw node:
const ic = (raw as KSImportDeclaration).importClause;
if (ic?.name) names.add(ic.name.escapedText);  // all data, no attributes
```

This is legal because the equation receives the raw node (Strategy 4 directly, Strategy 3 via `ctx.node`). You only need `childAt` when you need to access a *child's attribute*, not when you need the child's data.

### Verdict: Strategy 3 and 4 are nearly identical

Strategy 4's advantage is limited to Pattern 1 (typed raw node, no cast). For all other patterns, 3 and 4 behave identically. The choice is minor:

- Strategy 3 is simpler (one parameter). Use `ctx.node` for data, cast as needed.
- Strategy 4 is more ergonomic for production-dispatched equations. The raw parameter is pre-typed.

Both can coexist. The AG engine could pass `(ctx)` by default and `(ctx, rawTyped)` for production-dispatched equations. This is a compile-layer decision, not an architectural one.

---

## How the AG engine changes

### Current pipeline (implemented)

```
buildKSTree() -> raw tree (never mutated)
    |
buildContextTree(root, getChildren, getChildFields) -> DNode tree
    |
registerAttributes(dnodeRoot, compiled) -> registers AttrComputed on DNodes
    |
project(dnodeRoot) -> triggers evaluation via .attr(), returns results
```

Key design points:
1. `buildContextTree` creates the DNode wrapper tree with navigation and field metadata
2. `registerAttributes` registers `AttrComputed` objects on DNode instances (no `Object.defineProperty`)
3. `DNode.attr()` provides Map-based lazy caching with cycle detection
4. `compile.ts` produces `AttrComputed` with `compute(ctx: DNode): V`

### What compile.ts becomes

Currently, `compile()` produces an `AttributeDef` with `install(node, key)` that calls `installLazy`. With the decorated approach:

```typescript
interface AttrComputed<V = any> {
    compute(ctx: DNode): V;
}
```

For synthesized attributes:
```typescript
function compileSyn(name: string, decl: SynDecl, eq: unknown): AttrComputed {
    const dispatch = typeof eq === 'function'
        ? eq as (ctx: DNode) => any
        : makeContextDispatch(eq as Record<string, (ctx: DNode) => any>);

    return { compute: dispatch };
}
```

For inherited attributes:
```typescript
function compileInh(name: string, decl: InhDecl, eq: unknown): AttrComputed {
    const rootValue = decl.root;
    const parentEq = eq as ((parentCtx: DNode, childCtx: DNode) => any) | undefined;

    return {
        compute(ctx: DNode): any {
            if (ctx.isRoot) {
                return typeof rootValue === 'function' ? rootValue(ctx) : rootValue;
            }
            if (parentEq) {
                const result = parentEq(ctx.parent!, ctx);
                if (result !== undefined) return result;
            }
            return ctx.parent!.attr(name);  // auto-propagate
        },
    };
}
```

The auto-propagation `ctx.parent!.attr(name)` is cleaner than the current `(parent as any)[key]` because `attr()` is the explicit, validated attribute access path.

For collection attributes:
```typescript
function compileCollection(name: string, decl: CollectionDecl, eq: unknown): AttrComputed {
    const contribute = typeof eq === 'function' ? eq : makeContextDispatch(eq);
    return {
        compute(ctx: DNode): any {
            let result = contribute(ctx);
            for (const child of ctx.children) {
                result = decl.combine(result, child.attr(name));
            }
            return result;
        },
    };
}
```

Again, `child.attr(name)` instead of `(child as any)[key]`. Explicit, validated, no defineProperty.

---

## What changes in the spec API

### Current SpecInput

```typescript
interface SpecInput<N extends object, R = unknown> {
    name: string;
    declarations: Record<string, AttrDecl>;
    equations: Record<string, unknown>;  // (node: N) => V or production map
    deps?: string[];
    project?: (root: N) => R;
}
```

### Decorated SpecInput

```typescript
interface SpecInput<R = unknown> {
    name: string;
    declarations: Record<string, AttrDecl>;
    equations: Record<string, unknown>;  // (ctx: DNode) => V or production map
    deps?: string[];
    project?: (root: DNode) => R;
}
```

The `N` type parameter largely disappears. Equations receive `DNode` (which carries a `KSNode` inside). The node type is accessed via `ctx.node` -- the DNode is the universal equation parameter type.

This is actually a simplification. Currently, `SpecInput<N>` threads `N = KSNode` everywhere, but equations immediately cast `node as any` to access `$parent`, attributes, etc. The type parameter provides almost no safety. With DNode, navigation and attributes are properly typed on the context, and raw node access goes through `.node` with explicit casts to specific node types -- which is what happens today anyway.

---

## What `parentIs` enables beyond identity checks

The `parentIs(kind, field)` method enables a pattern that's cleaner than the current identity check, and enables future features.

### Current pattern (8 lines in isReference)

```typescript
const parent: any = (node as any).$parent;
if (!parent) return true;
if (parent.kind === 'PropertyAccessExpression' && parent.name === node) return false;
if (parent.kind === 'VariableDeclaration' && parent.name === node) return false;
if (parent.kind === 'Parameter' && parent.name === node) return false;
if (parent.kind === 'FunctionDeclaration' && parent.name === node) return false;
if (parent.kind === 'FunctionExpression' && parent.name === node) return false;
if (parent.kind === 'PropertyAssignment' && parent.name === node) return false;
if (parent.kind === 'TypeAliasDeclaration' && parent.name === node) return false;
```

### With parentIs (cleaner)

```typescript
if (!ctx.parent) return true;
if (ctx.parentIs('PropertyAccessExpression', 'name')) return false;
if (ctx.parentIs('VariableDeclaration', 'name')) return false;
if (ctx.parentIs('Parameter', 'name')) return false;
if (ctx.parentIs('FunctionDeclaration', 'name')) return false;
if (ctx.parentIs('FunctionExpression', 'name')) return false;
if (ctx.parentIs('PropertyAssignment', 'name')) return false;
if (ctx.parentIs('TypeAliasDeclaration', 'name')) return false;
```

Or, since all these check `field === 'name'`:

```typescript
if (!ctx.parent) return true;
const definingKinds = new Set([
    'PropertyAccessExpression', 'VariableDeclaration', 'Parameter',
    'FunctionDeclaration', 'FunctionExpression', 'PropertyAssignment',
    'TypeAliasDeclaration',
]);
if (ctx.fieldName === 'name' && definingKinds.has(ctx.parent.node.kind)) return false;
```

### Future: per-child inherited equations

JastAdd and Silver support per-child inherited attribute equations -- defining different inherited values for different children of a production. KSC currently lacks this. With `fieldName` tracked on each context, per-child equations become natural:

```typescript
// Future: inherited attribute with per-child dispatch
equations: {
    scope: {
        direction: 'inh',
        FunctionDeclaration: {
            body: (parentCtx) => parentCtx.attr('localScope'),
            _: (parentCtx) => parentCtx.attr('scope'),  // other children inherit parent scope
        },
    },
}
```

The engine uses `child.fieldName` to dispatch to the right equation. This is a natural extension of the `fieldName` tracking that `parentIs` already requires.

---

## Recommendation

**Strategy 3 (explicit wrapper with `.node`) is the long-term best design.**

Concretely, this means:
- A `DNode` type that carries `.node` (raw data), `.parent`/`.children` (navigation), and `.attr()` (attribute access)
- Each `DNode` knows its `.fieldName` in its parent (tracked during construction from schema metadata)
- Equations receive `DNode` and use `.node` for data, `.parent`/`.children` for navigation, `.attr()` for attributes
- `parentIs(kind, field)` replaces identity checks
- `childAt(field)` provides named child access through the decoration layer
- Attribute caching is a Map on the DNode, not Object.defineProperty on the raw node
- The raw tree is never modified
- Multiple decorations of the same tree are possible

Strategy 4's typed-raw-parameter refinement can be added later as an optimization in the compile layer, passing `(ctx, ctx.node as SpecificType)` for production-dispatched equations. It's not an architectural decision -- it's a convenience that doesn't change the DNode design.

The `.node` verbosity is the cost of explicit separation. It's the same cost Roslyn pays (green node delegation), Kiama pays (external `Tree` object), and rust-analyzer pays (typed wrapper methods). Every modern compiler that separates tree data from analysis pays it. The payoff is cleaner architecture, testability, multi-decoration, and a foundation for incremental re-analysis.

---

## Comparison with previous architectural decision (ag-node-attribution-redesign.md)

The previous redesign document (now superseded) established five principles, the first being "attributes live ON the nodes." The current system implements this via `installLazy` / `Object.defineProperty`.

The decorated tree approach reverses Principle 1: attributes live on the *decoration*, not on the node. This is a deliberate departure. The motivation for Principle 1 was debuggability (see attributes in the inspector) and API simplicity (`node.kindDefs` instead of `binder.kindDefs(node)`). The decorated approach preserves the debuggability (inspect the DNode to see its cached attributes) while gaining separation. The API trades `node.kindDefs` for `ctx.attr('kindDefs')` -- slightly more verbose, but explicit about what it's doing and composable across multiple analyses.

The previous redesign was correct that WeakMap-based external attributes (the pre-redesign approach) were too opaque. The decorated tree is not a return to WeakMaps. It's a third option: attributes on a *wrapper object* that exists alongside the raw node. The wrapper is inspectable, cacheable, and scoped to a specific analysis run.

---

## Implementation Status: COMPLETE

Strategy 4 has been implemented end-to-end. All backward compatibility with the old stampTree/installLazy approach has been fully removed. All 131 tests pass.

### Files changed

**New infrastructure:**
- `ag-interpreter/dnode.ts` — DNode class, AttrComputed interface, buildContextTree(), registerAttributes()

**Rewritten engine:**
- `ag-interpreter/compile.ts` — Produces AttrComputed (compute(ctx: DNode)) instead of old AttributeDef (install(node, key))
- `ag-interpreter/semantics.ts` — SealedSpec uses AttrComputed
- `ag-interpreter/interpret.ts` — interpret() returns { root: DNode, results: Map } using buildContextTree + registerAttributes. stampTree and StampedNode fully removed.
- `ag-interpreter/grammar.ts` — Grammar now carries optional getChildFields for schema-aware DNode construction
- `ag-interpreter/analyze.ts` — Dependency analysis uses DNode tree with tracking AttrComputed
- `ag-interpreter/serialize.ts` — Simplified: no stampTree dependency, no $agAttrs/NAV_KEYS, no includeAttributes/attributeFilter. deserializeTree returns plain data.
- `ag-interpreter/index.ts` — Exports DNode, AttrComputed, InterpretResult. No stampTree/StampedNode.

**Rewritten specs (Strategy 4 equation syntax):**
- `ksc-behavior/binder.ts` — Equations use (ctx: DNode, raw: N) pattern. Navigation via ctx.children, attrs via ctx.attr()
- `ksc-behavior/checker.ts` — parentIs() replaces 8 identity checks in isReference. ctx.attr() for all attribute access. ctx.parent for parent walking.

**Updated type vocabulary:**
- `ag-behavior/spec.ts` — ProductionEquations updated to (ctx, raw) signatures. SynDecl.uncached removed. SpecInput.project receives DNode.

**Updated orchestration:**
- `ksc-interpreter/evaluate.ts` — Uses new interpret() return type, passes getChildFields to grammar
- `ksc-interpreter/index.ts` — No stampTree re-export.
- `src/pipeline/serialize.ts` — Removed includeAttributes/attributeFilter options. deserializeKSTree returns plain data (no stamped navigation).

**Updated tests:**
- `test/grammar.test.ts` — Destructures { results } from interpret(), equations use DNode
- `test/binder.test.ts` — Navigates DNode tree, uses .attr() for attribute access
- `test/checker.test.ts` — Same DNode pattern with findDNodeByKind helper
- `test/convert.test.ts` — Uses buildContextTree + DNode for navigation tests instead of stampTree + $parent/$root
- `test/serialize.test.ts` — Deserialization tests check plain data structure, no $parent/$root assertions

### Key improvements achieved

1. **Raw tree never mutated** — stampTree fully removed. $parent/$children/$index/$root/$prev/$next are on DNode, not on raw nodes.
2. **Explicit access patterns** — Data: `ctx.node.escapedText`, Navigation: `ctx.parent`, Attributes: `ctx.attr('scope')`. Each is visually distinct.
3. **parentIs() replaces identity checks** — `ctx.parentIs('VariableDeclaration', 'name')` instead of `parent.kind === 'VarDecl' && parent.name === node`. More declarative, no object identity comparison.
4. **Map-based caching** — Simple Map with compute-on-miss replaces Object.defineProperty getter-to-data-property conversion.
5. **Multi-decoration possible** — Same raw tree can be decorated independently by different AG specs.
6. **Circular attribute support** — DNode.attr() skips cycle detection for circular attributes; AttrComputed manages its own WeakMap state and Magnusson-Hedin fixed-point.
7. **No backward compatibility** — All legacy code (stampTree, StampedNode, $agAttrs, NAV_KEYS, installLazy, uncached, includeAttributes/attributeFilter) has been fully removed.
