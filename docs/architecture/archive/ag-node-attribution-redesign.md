> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# AG Redesign: Attributes ON Nodes + Specification-Driven Evaluation

## Current State

### How attributes are stored today

Every attribute in the AG library is a closure wrapping a `WeakMap`:

```typescript
// syn.ts — the backbone of the entire library
export function syn<N extends object, V>(compute: (node: N) => V): Attribute<N, V> {
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

`match`, `down`, `atRoot`, `coll`, `lookup`, and `chain` all delegate to `syn`. The tree structure (`createTree`) uses three more WeakMaps for parent/children/index. `circular` has its own WeakMap.

**Total external data structures for a typical KSC program:**
- 1 WeakMap for `kindDefs` attribute (via `match` → `syn`)
- 1 WeakMap for `defLookup` attribute (via `lookup` → `syn`)
- 1 closure-level `Map` inside `lookup` for the global definition map
- 3 WeakMaps for tree structure (parent, children, index)
- = **6 separate WeakMaps** holding data that conceptually belongs to the nodes

### What this means in practice

```typescript
const binder = createBinderAttributes(ksTree);
const defs = binder.kindDefs(someCompilationUnit);
```

You call an external function, passing a node. The function looks up the node in a hidden WeakMap. If the node has never been seen, it computes the value and stores it in the WeakMap. The node itself is unchanged — it has no idea it's been "attributed."

You cannot:
- Inspect a node in a debugger and see its attributes
- Iterate over a node's computed attributes
- Serialize an attributed tree
- Ask a node "what attributes have been computed for you?"
- Pass the attributed tree to another system that expects enriched nodes

### `synOnNode` exists but is unused

The library already has `synOnNode(key, compute)` which stamps values directly onto nodes:

```typescript
export function synOnNode<N extends object, V>(key: string, compute: (node: N) => V): Attribute<N, V> {
  return (node: N): V => {
    const record = node as Record<string, unknown>;
    if (key in record) return record[key] as V;
    const value = compute(node);
    record[key] = value;
    return value;
  };
}
```

KSC never uses it. Every attribute goes through `syn` (WeakMap). The JastAdd-style approach already exists in the library but was never adopted.

---

## How JastAdd Does It

JastAdd is a metacompiler — it reads `.jrag` attribute equation files and generates Java classes. The generated code stamps attribute values directly onto the AST node as instance fields.

### Generated code pattern (from JastAdd's `Attributes.tt` template)

```java
// Generated on the node class itself:
protected boolean type_computed = false;
protected Type type_value;

public Type type() {
    if (type_computed) return type_value;   // cache hit
    type_computed = true;
    type_value = /* equation RHS */;        // compute + stamp
    return type_value;
}
```

**Key properties:**
- The cache fields (`_computed`, `_value`) are **instance fields on the node class**
- There is no external map — the node IS the cache
- Evaluation is demand-driven (lazy) — nothing is computed until `node.type()` is called
- After first access, the value lives on the node forever
- The node class is the "attributed tree" — there's no separate attributed representation

### Memory layout

Each cached attribute adds two fields to the Java class:
- `boolean attrName_computed` — sentinel
- `Type attrName_value` — cached result

For a node with 5 cached attributes: 5 booleans + 5 object references = tiny overhead per node, no indirection through hash maps.

### What JastAdd's `.jrag` files are

They're **specifications** — named attribute equations organized by production:

```java
// This IS the spec:
syn lazy Type Expr.type();
eq Add.type() = getLeft().type().add(getRight().type());
eq Num.type() = new IntType();
eq Id.type()  = lookup(getName()).type();
```

JastAdd reads this spec and weaves it into the AST classes. The spec defines WHAT to compute. The generated code handles HOW (caching, demand-driven evaluation, circularity detection).

---

## How Silver Does It

Silver separates **undecorated trees** (bare AST, no attributes) from **decorated trees** (AST + computed attribute values).

### Undecorated → Decorated

```silver
-- Decoration: provide inherited attributes, get back a decorated tree
decorate expr with { env = myEnv; }

-- Access synthesized attributes on the decorated tree:
expr.type    -- triggers demand-driven evaluation
```

### Runtime implementation (`DecoratedNode.java`)

```java
public class DecoratedNode {
    // The underlying undecorated tree node
    protected final Node undecoratedNode;

    // Synthesized attributes: fixed-size array, indexed by attribute ID
    protected final Object[] synthesizedValues;

    // Inherited attributes: thunks that evaluate on demand
    protected Lazy[] inheritedAttributes;
    protected Object[] inheritedValues;
}
```

The decorated node wraps the undecorated node and adds arrays for attribute values. Attribute access is O(1) array indexing (each attribute has a compile-time integer ID).

### The key insight from Silver

**The undecorated tree is never mutated.** Instead, decoration produces a new layer that pairs the tree structure with computed values. This is conceptually clean but has memory overhead — every decoration creates new `DecoratedNode` objects.

---

## The "Weak Interpreter" Framing

An attribute grammar system can be understood as a **specification-driven evaluator** (a "weak interpreter") with three parts:

| Component | What it is | Analogy |
|-----------|-----------|---------|
| **AST** | The input data (the tree) | The "program" being interpreted |
| **AG Specification** | Named attributes + equations per production | The "language semantics" |
| **Evaluator** | The mechanism that computes attribute values | The "interpreter" |
| **Attributed Tree** | The output — tree with computed values on nodes | The "result" |

### Why "weak"?

It's not Turing-complete interpretation. The spec defines a fixed set of named attributes with equations. The evaluator's job is just: given a node and an attribute name, evaluate the equation (possibly recursively), cache the result on the node, and return it. The evaluation is **demand-driven** and **deterministic** — the same node always gets the same attribute value.

### The spec IS the algebra

An AG spec is equivalent to an algebra over the tree signature:
- Each production (node kind) is an operator
- Each attribute equation defines how that operator's semantics are computed
- Evaluating the AG is computing the unique homomorphism from the initial algebra (the tree) to the target algebra (the attribute values)

For synthesized-only attributes, this is exactly a catamorphism (fold). Adding inherited attributes extends it to a two-directional flow, but the principle is the same: the spec defines the algebra, the evaluator applies it.

---

## What We Want: Target State

### Principle 1: Attributes live ON the nodes

After attribution, `node.kindDefs` should be a real property on the node object. Not a WeakMap lookup. Not an external function call. A property.

```typescript
// BEFORE (current):
const defs = binder.kindDefs(compilationUnit);  // external function + WeakMap

// AFTER (target):
const defs = compilationUnit.kindDefs;  // property on the node
```

### Principle 2: Demand-driven, JastAdd-style

Attributes should be lazy — computed on first access, cached on the node. This is exactly JastAdd's pattern, implementable in JS with `Object.defineProperty`:

```typescript
// On first access: compute, replace getter with value, return
Object.defineProperty(node, 'kindDefs', {
  get() {
    const value = computeKindDefs(this);
    Object.defineProperty(this, 'kindDefs', { value, writable: false, configurable: false });
    return value;
  },
  configurable: true,
  enumerable: true,
});
```

First access triggers the getter → computes the value → replaces the getter with a plain data property → subsequent accesses are direct property reads with zero overhead. This is the **exact equivalent** of JastAdd's `if (type_computed) return type_value;` pattern.

### Principle 3: Specification as data

Attribute definitions should be declarative — a specification object, not scattered closures:

```typescript
const binderSpec = defineAttributes<KSNode>('kind', {
  kindDefs: {
    syn: {
      CompilationUnit: (cu) => extractKindDefs(cu),
      _: () => [],
    },
  },

  defLookup: {
    collection: {
      collect: (node) => {
        if (node.kind !== 'CompilationUnit') return [];
        return node.kindDefs.map(d => [d.name, d]);
      },
    },
  },
});
```

The spec names each attribute, declares its kind (syn, inherited, collection, circular), and provides the equations. This is the TypeScript equivalent of JastAdd's `.jrag` files.

### Principle 4: Evaluator takes AST + spec, returns attributed AST

```typescript
// The evaluator is the "weak interpreter"
applyAttributes(ksTree, binderSpec);

// After: every node in the tree has lazy getters installed
// Access triggers computation:
someCompilationUnit.kindDefs;  // computed on demand, cached on node
someNode.defLookup('NoImports');  // works from any node
```

The function `applyAttributes` walks the tree once, installing lazy property getters for every attribute defined in the spec. No values are computed yet — that happens on demand when a property is accessed.

### Principle 5: Tree navigation also on nodes

The tree structure (parent, children, index, siblings) should also be on the nodes, not in external WeakMaps:

```typescript
// BEFORE:
const parent = tree.parent(node);
const kids = tree.children(node);

// AFTER:
const parent = node.$parent;
const kids = node.$children;
```

These are installed during `createTree` by stamping onto the nodes. The `$` prefix avoids collision with AST node fields.

---

## How To Get There

### Step 1: Change `syn` to stamp onto nodes

Replace the WeakMap-based `syn` with a node-stamping approach. Since attributes need unique keys, the spec-based API naturally provides them (each attribute has a name in the spec).

**New core primitive:**

```typescript
function installLazy<N extends object, V>(
  node: N,
  key: string,
  compute: (node: N) => V,
): void {
  Object.defineProperty(node, key, {
    get() {
      const value = compute(this);
      Object.defineProperty(this, key, { value, writable: false, configurable: false });
      return value;
    },
    configurable: true,
    enumerable: true,
  });
}
```

This is the JastAdd `_computed/_value` pattern expressed as a JS property descriptor.

### Step 2: Change `createTree` to stamp navigation

Instead of building WeakMaps, stamp `$parent`, `$children`, `$index`, `$prev`, `$next`, `$root` directly onto each node during the eager traversal.

```typescript
function createTree<N extends object>(root: N, getChildren: (node: N) => N[]): void {
  const queue: N[] = [root];
  stamp(root, '$parent', undefined);
  stamp(root, '$index', -1);
  stamp(root, '$root', true);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const kids = getChildren(node);
    stamp(node, '$children', kids);
    for (let i = 0; i < kids.length; i++) {
      stamp(kids[i], '$parent', node);
      stamp(kids[i], '$index', i);
      stamp(kids[i], '$prev', i > 0 ? kids[i - 1] : undefined);
      stamp(kids[i], '$root', false);
      if (i > 0) stamp(kids[i - 1], '$next', kids[i]);
      queue.push(kids[i]);
    }
    if (kids.length > 0) stamp(kids[kids.length - 1], '$next', undefined);
  }
}
```

After this, `node.$parent`, `node.$children`, `node.$index` are all plain property accesses. No WeakMap lookup.

### Step 3: Define the spec format

```typescript
interface AGSpec<N extends object> {
  /** Discriminant field for per-production dispatch (e.g., 'kind') */
  discriminant: string;
  /** Named attribute definitions */
  attributes: Record<string, AttributeDef<N>>;
}

type AttributeDef<N> =
  | { type: 'syn'; equations: Record<string, (node: any) => any> & { _?: (node: N) => any } }
  | { type: 'collection'; collect: (node: N) => Iterable<[any, any]> }
  | { type: 'inherited'; default: (root: N) => any; match?: (node: N) => any }
  | { type: 'circular'; init: any; compute: (node: N) => any; equals?: (a: any, b: any) => boolean };
```

### Step 4: Implement `applyAttributes`

```typescript
function applyAttributes<N extends object>(tree: Tree<N>, spec: AGSpec<N>): void {
  // Walk every node in the tree
  const stack: N[] = [tree.root];
  while (stack.length > 0) {
    const node = stack.pop()!;

    // Install a lazy getter for each attribute
    for (const [name, def] of Object.entries(spec.attributes)) {
      installLazy(node, name, buildCompute(def, spec.discriminant, tree));
    }

    stack.push(...tree.children(node));
  }
}
```

This walks the tree once, installing lazy getters for every attribute on every node. No values are computed. When you later access `node.kindDefs`, the getter fires, computes the value, replaces itself with the cached result, and returns it.

### Step 5: Migrate KSC binder

```typescript
// BEFORE (current binder.ts):
export function createBinderAttributes(ksTree: KSTree): BinderAttributes {
  const kindDefs = match<KSNode, KindDefinition[]>('kind', { ... });
  const defLookup = lookup<KSNode, string, KindDefinition>(tree, ...);
  return { kindDefs, defLookup };
}

// AFTER (spec-based):
export const binderSpec = defineAttributes<KSNode>('kind', {
  kindDefs: {
    type: 'syn',
    equations: {
      CompilationUnit: (cu) => extractKindDefs(cu),
      _: () => [],
    },
  },
  defLookup: {
    type: 'collection',
    collect: (node) => {
      if (node.kind !== 'CompilationUnit') return [];
      return node.kindDefs.map(d => [d.name, d]);
    },
  },
});

// In program.ts:
applyAttributes(ksTree, binderSpec);
// Now: compilationUnit.kindDefs returns KindDefinition[]
// Now: anyNode.defLookup('NoImports') returns KindDefinition | undefined
```

---

## Comparison: Three Approaches

| | WeakMap (current) | JastAdd (generated) | **Target (spec + stamp)** |
|---|---|---|---|
| Where values live | External WeakMap closures | Instance fields on Java classes | Properties on JS objects |
| How values are accessed | `binder.kindDefs(node)` | `node.type()` | `node.kindDefs` |
| Computation trigger | Function call | Method call | Property access |
| Caching mechanism | WeakMap lookup | boolean + field | getter → data property |
| Spec format | Scattered closures | `.jrag` files | Spec object |
| Evaluation strategy | Demand-driven | Demand-driven | Demand-driven |
| Node mutation | None | N/A (generated class) | Stamps properties |
| Inspectable in debugger | No | Yes (fields visible) | Yes (properties visible) |
| Multiple AG specs | Yes (independent WeakMaps) | No (one generated class) | Yes (stamp different specs sequentially) |

---

## What Changes in the AG Library

| Module | Current | Target |
|--------|---------|--------|
| `syn.ts` | WeakMap cache | `installLazy` (property getter → data property) |
| `synOnNode.ts` | Explicit key string | Becomes the default (key comes from spec) |
| `tree.ts` | 3 WeakMaps (parent/children/index) | Stamps `$parent`, `$children`, `$index`, `$prev`, `$next` |
| `match.ts` | Delegates to `syn` | Builds equation lookup, passes to `installLazy` |
| `inh.ts` | Delegates to `syn` | Parent-defined equations, stamps result on node |
| `coll.ts` | Delegates to `syn` | Same walk, but stamps result on node |
| `lookup.ts` | Lazy Map + `syn` | Same Map, stamps lookup function on node |
| `circular.ts` | Own WeakMap | Getter that does fixed-point, then stamps |
| `chain.ts` | Delegates to `syn` | Stamps `$inAttr` and `$outAttr` on each node |
| **NEW: `stamp.ts`** | N/A | `installLazy`, `stampTree` |
| **NEW: `apply.ts`** | N/A | `applyAttributes` |
| **DELETED: `tree.ts`** | 3 WeakMaps | Replaced by `stamp.ts` |

---

## Implementation Status: COMPLETE

All phases implemented and verified on 2026-03-04.

### What was done

1. **`stamp.ts`** (NEW) — `installLazy` (Object.defineProperty lazy getter → data property) + `stampTree` (BFS traversal stamping `$parent`, `$children`, `$index`, `$root`, `$prev`, `$next`)
2. **`apply.ts`** (NEW) — `applyAttributes(root, defs)` walks tree installing lazy getters for all attributes
3. **`types.ts`** — Replaced `Attribute<N,V>`, `ParamAttribute<N,P,V>`, `Tree<N>` with `StampedNode`, `AttributeDef<N,V>`, `AttributeMap<N>`
4. **`syn.ts`** — All factories return `AttributeDef` with `install()` method. Removed `synOnNode` (all attributes now stamp onto nodes)
5. **`match.ts`** — Returns `AttributeDef` via `syn`
6. **`inh.ts`** — Parent-defined inherited attributes (`inh(rootValue, eq?)`), accesses `$parent`/`$root`/`$index` directly
7. **`coll.ts`** — No `tree` parameter, accesses `$children` directly
8. **`lookup.ts`** — No `tree` parameter, walks `$parent` to find root
9. **`circular.ts`** — Symbol-keyed per-node state (`CIRC_STATE`), stamps final value as data property
10. **`chain.ts`** — No `tree` parameter, captures key names during `install()` for cross-referencing
11. **`tree.ts`** — DELETED (replaced by `stamp.ts`)
12. **KSC pipeline** — `convert.ts` uses `stampTree`, `binder.ts` exports `applyBinderAttributes()`, `program.ts` accesses `(cu as any).kindDefs`, `export.ts` uses `$parent`

### Test results

- AG library: 55 tests passing (9 test files)
- KSC root: 38 tests passing (5 test files)
- TypeScript: clean (`tsc --noEmit`)

### Resolved questions

1. **Property name collisions**: Using `$` prefix for tree navigation (`$parent`, etc.). Attribute names use plain keys set by the caller in `applyAttributes`.
2. **Circularity detection**: `circular.ts` uses a Symbol-keyed state object (`CIRC_STATE`) on nodes to track iteration state per attribute.
3. **Type safety**: Using `as any` casts at use sites. This matches JastAdd's approach where attributes are only available after evaluation.
4. **Frozen objects**: Not supported. Node-stamping requires mutable nodes. Since we own the KSC AST, this is fine.
5. **Tree navigation prefix**: `$` prefix chosen (`$parent`, `$children`, `$index`, `$root`, `$prev`, `$next`). Non-enumerable to avoid cluttering serialization.
