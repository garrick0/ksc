# Tutorial: Adding an Attribute to KSC

This tutorial walks through adding a new attribute to the KindScript compiler using the **spec-driven workflow**. We cover two examples:

1. **Adding a property** (e.g., `noEval`) — the common case, just one file change
2. **Adding a structural attribute** (e.g., `nodeCount`) — for custom attribute logic

## Background: How Attributes Work

KSC uses **attribute grammars** (AGs) to compute properties over the AST. Each node in the tree can have attributes — values that are computed lazily and cached. There are three kinds:

| Kind | Direction | How it works |
|------|-----------|-------------|
| **syn** (synthesized) | bottom-up | Computed from the node itself and its children's attributes |
| **inh** (inherited) | top-down | Flows down from the parent node |
| **collection** | bottom-up | Each node contributes a value; contributions are combined up the tree |

All attributes are declared in the **analysis spec** (`specs/ts-ast/kind-checking/spec.ts`). A compilation functor (`compileAnalysis`) reads this spec and generates:
- `generated/ts-ast/kind-checking/dispatch.ts` — per-attribute dispatch functions (switch/case over kinds)
- `generated/ts-ast/kind-checking/attr-types.ts` — the `KSCAttrMap` interface

The evaluator itself is hand-written in `evaluator/engine.ts` — it consumes the generated dispatch functions via `createEvaluator()`. No manual wiring needed — everything flows from the spec.

## Example 1: Adding a Property (the common case)

Properties follow a standard pattern: a context flows down (inh), violations are detected (syn), and everything feeds into `allViolations`. The spec-driven workflow handles all of this mechanically — you just declare the property and its violation rules.

### Adding `noEval`

Suppose we want a property that flags uses of `eval()`.

**Step 1: Add the PropertyDecl to `analysis/spec.ts`**

```typescript
// Add to the properties array:
{
  name: 'noEval',
  annotationKey: 'noEval',
  violationAttr: 'evalViolation',
  violations: [
    violation({
      triggerKind: 'CallExpression',
      predicate: (_ctx, node) =>
        node.expression.kind === 'Identifier' &&
        node.expression.escapedText === 'eval',
      message: (_ctx, _node, def) =>
        `eval() violates ${def.name} (noEval)`,
    }),
  ],
}
```

**Step 2: Add `noEval` to `PropertySet` in `analysis/types.ts`**

```typescript
export interface PropertySet {
  // ... existing properties ...
  readonly noEval?: true;
}
```

And update `PROPERTY_KEYS` in the same file:

```typescript
export const PROPERTY_KEYS: ReadonlySet<string> = new Set<keyof PropertySet>([
  'noImports', 'noConsole', 'immutable', 'static',
  'noSideEffects', 'noMutation', 'noIO', 'pure',
  'noEval',  // ← add
]);
```

**Step 3: Regenerate**

```bash
npx tsx scripts/codegen-analysis.ts
```

This automatically derives 3 new attributes from your PropertyDecl:
- `noEvalContext` (inh) — propagates the kind annotation down the tree
- `evalViolation` (syn) — checks each node against the violation rules
- `allViolations` — updated to include `evalViolation`

**Step 4: Write tests and run**

```bash
npx vitest run --testTimeout=30000
```

That's it — one file for the rule, one for the type, regenerate. No context equations, no wiring.

### What the functor derives for you

From a single `PropertyDecl`, `compileAnalysis` mechanically generates:

| Generated attribute | Direction | Logic |
|---|---|---|
| `{name}Context` | inh | Root = null; at VariableDeclaration, checks `kindAnnotations` for `annotationKey`; otherwise inherits from parent |
| `{violationAttr}` | syn | If context is null → null; otherwise runs violation rules by `triggerKind` |
| `allViolations` | collection | Updated to include the new violation attr |

Plus: dependency graph edges, cache fields, switch dispatch cases, and cycle detection.

## Example 2: Adding a Structural Attribute

For attributes with custom logic that don't follow the property pattern, add a `StructuralAttr` to the spec.

### Adding `nodeCount`

`nodeCount` is a collection attribute: each node contributes `1`, combined by addition.

**Step 1: Add the StructuralAttr to `analysis/spec.ts`**

```typescript
// Add to the structural array:
{
  name: 'nodeCount',
  direction: 'collection',
  type: 'number',
  deps: [],
  equations: {
    contribute: ((_ctx: Ctx) => 1) as any,
    combine: ((acc: number, contrib: number) => acc + contrib) as any,
  },
  spec: 'checker',
}
```

The equations object uses `contribute` + `combine` for collections, `cases`/`default` for syn, or `root`/`rootValue` for inh.

**Step 2: Regenerate**

```bash
npx tsx scripts/codegen-analysis.ts
```

The generator produces a `nodeCount()` method on `KSCDNode` equivalent to:

```typescript
nodeCount(): number {
  let result = contribute(this);       // start with 1
  for (const child of this.children) {
    result = combine(result, child.nodeCount());  // add child counts
  }
  return result;  // total = 1 + sum of children
}
```

**Step 3: Write tests**

```typescript
describe('nodeCount', () => {
  it('root count equals total nodes', () => {
    const { dnodeRoot } = buildAndCheck('kind-basic');
    const rootCount = dnodeRoot.nodeCount();

    let manualCount = 0;
    const stack: KSCDNode[] = [dnodeRoot];
    while (stack.length > 0) {
      manualCount++;
      stack.push(...stack.pop()!.children as KSCDNode[]);
    }
    expect(rootCount).toBe(manualCount);
  });

  it('leaf nodes have nodeCount of 1', () => {
    const { dnodeRoot } = buildAndCheck('kind-basic');
    function findLeaf(d: KSCDNode): KSCDNode | undefined {
      if (d.children.length === 0) return d;
      for (const child of d.children as KSCDNode[]) {
        const leaf = findLeaf(child);
        if (leaf) return leaf;
      }
      return undefined;
    }
    expect(findLeaf(dnodeRoot)!.nodeCount()).toBe(1);
  });
});
```

## Equation Patterns Reference

### Synthesized (syn)

```typescript
// Universal — same for all node kinds
{ universal: (ctx: Ctx) => value }

// Production-specific — per-kind dispatch
{
  cases: {
    Identifier: (ctx: Ctx, raw: KSNode) => value,
    VariableDeclaration: (ctx: Ctx, raw: KSNode) => value,
  },
  default: (ctx: Ctx) => defaultValue,
}
```

### Inherited (inh)

```typescript
// Root value as constant
{ rootValue: initialValue }

// Root value as function
{ root: (rootCtx: Ctx) => value }
```

### Collection

```typescript
{
  contribute: (ctx: Ctx) => localValue,
  combine: (acc: T, contrib: T) => mergedValue,
}
```

### Extra arguments

Use `extraArgExprs` for cases that need additional data beyond `(ctx, raw)`:

```typescript
{
  cases: { CompilationUnit: eq_kindDefs_CompilationUnit },
  default: eq_kindDefs_default,
  extraArgExprs: { CompilationUnit: 'this._counter' },
}
```

## Commands

| Command | What it does |
|---------|-------------|
| `npx tsx scripts/codegen-analysis.ts` | Runs Functor 2 only (analysis → evaluator) |
| `npx tsx scripts/codegen-grammar.ts` | Runs Functor 1 only (grammar → AST types) |
| `npx tsx scripts/codegen-all.ts` | Runs both functors with cross-validation |
| `npx vitest run --testTimeout=30000` | Run all tests |

## Architecture

```
analysis/spec.ts     ← You edit this (properties + structural attrs)
        │
        ▼
compiler/analysis.ts   (Functor 2: pure function)
        │
        ├─→ generated/evaluator.ts    (generated)
        └─→ generated/attr-types.ts   (generated)
```

The spec is the single source of truth. The compilation functor derives:
- Full attribute list (structural + context + violation + allViolations)
- Dependency graph with topological sort
- All evaluator code (cache fields, methods, switch dispatch)
- The `KSCAttrMap` type interface
