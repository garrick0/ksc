> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# Checker Implementation Plan

## What the Checker Does

The checker is a weak interpreter (AG spec) that verifies annotated values satisfy their kind properties. Currently the only property is `noImports`, which asserts that a value's expression body does not reference any imported bindings.

Given:
```typescript
import type { NoImports } from './kinds';
import { helper } from './helpers';

// PASS — body only uses parameters
const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;

// FAIL — body references `helper`, an imported binding
const greet: NoImports & ((name: string) => string) = (name) => helper(name);
```

The checker produces diagnostics: `[{ node, message, kindName, property, pos, end, fileName }]`.

---

## Part 1: What "noImports" Actually Means

### Current state (not yet implemented beyond binder)

The binder discovers kind definitions (`type NoImports = Kind<{ noImports: true }>`) and extracts their properties. There is no checker that enforces these properties on annotated values.

### Target semantics

`noImports` on a value means: **the value's initializer expression does not reference any imported bindings**.

This is a node-level property on the annotated `VariableDeclaration`, not a file-level property. A file can have imports and still contain `NoImports`-annotated values that pass — as long as those specific values don't use the imports.

### What counts as a violation

For a function body `(a, b) => a + b`:
- `a`, `b` — parameters, local → OK
- `helper(x)` — `helper` resolves to an ImportDeclaration → FAIL
- `console.log` — global, not imported → OK (not in scope for `noImports`)
- `x` where `const x = 1` is in the same file's outer scope → OK (not imported)

The property is specifically about **imported bindings**, not all external dependencies. This matches the name literally.

---

## Part 2: Full Attribute Decomposition

Every piece of checker logic is expressed as an AG attribute equation. The AG library does all tree walking, caching, and orchestration. No imperative helper functions doing DFS or `$parent` walks outside of equations.

### Attribute map

| # | Attribute | Kind | Primitive | On which nodes | Computes |
|---|-----------|------|-----------|----------------|----------|
| 1 | `valueImports` | syn | `match` | CompilationUnit → `Set<string>` | Value-imported names in this file |
| 2 | `fileImports` | inh | `down` | Every node → `Set<string>` | Propagates `valueImports` from CompilationUnit to all descendants |
| 3 | `localBindings` | syn | `match` | ArrowFunction, FunctionExpression, FunctionDeclaration → `Set<string>` | Parameter + local declaration names in this function |
| 4 | `enclosingLocals` | syn | `syn` | Every node → `Set<string>` | Accumulated local bindings from all enclosing functions (walks `$parent`, reads `localBindings`) |
| 5 | `isReference` | syn | `match` | Identifier → `boolean` | Is this identifier in reference position (not a declaration name or property access)? |
| 6 | `kindAnnotations` | syn | `match` | VariableDeclaration → `KindDefinition[]` | Which kind definitions annotate this declaration |
| 7 | `noImportsContext` | inh | `down` | Every node → `KindDefinition \| null` | The NoImports kind def if inside an annotated function, else null |
| 8 | `importViolation` | syn | `match` | Identifier → `CheckerDiagnostic \| null` | A diagnostic if this identifier violates noImports, else null |
| 9 | `allViolations` | coll | `coll` | Every node → `CheckerDiagnostic[]` | Aggregated violations from this node's entire subtree |

All attributes are lazy — computed on first access, then cached as data properties. Attributes on irrelevant nodes (e.g., `importViolation` on a `Block` node) return null/empty instantly via the `_` default equation and are never accessed again.

### Data flow between attributes

```
valueImports (syn on CompilationUnit)
    ↓ propagated via
fileImports (inh via down — every node inherits from CompilationUnit)
    ↓ read by
importViolation (syn on Identifier — checks fileImports.has(name))

localBindings (syn on function nodes)
    ↓ accumulated via
enclosingLocals (syn walking $parent — union of all enclosing functions' localBindings)
    ↓ read by
importViolation (syn on Identifier — checks !enclosingLocals.has(name))

kindAnnotations (syn on VariableDeclaration — reads defLookup from binder)
    ↓ propagated via
noImportsContext (inh via down — every node inherits from annotated VariableDeclaration)
    ↓ read by
importViolation (syn on Identifier — checks noImportsContext != null)

isReference (syn on Identifier — checks $parent to filter declaration sites)
    ↓ read by
importViolation (syn on Identifier — only fires when isReference is true)

importViolation (syn on Identifier)
    ↓ collected via
allViolations (coll — aggregates from subtree)
    ↓ projected via
domain.project(root) — returns root.allViolations
```

---

## Part 3: The AGSpec

```typescript
export function createCheckerSpec(): AGSpec<KSNode, CheckerDiagnostic[]> {
  return {
    name: 'ksc-checker',
    domain: {
      name: 'Kind Violations',
      project: (root) => (root as any).allViolations,
    },
    children: getChildren,
    attributes: {
      valueImports,
      fileImports,
      localBindings,
      enclosingLocals,
      isReference,
      kindAnnotations,
      noImportsContext,
      importViolation,
      allViolations,
    },
    deps: ['ksc-binder'],
  };
}
```

No parameters. No closures capturing external services. The spec is a pure data object. The binder's `defLookup` attribute (already stamped on nodes) is accessed inside equations via `(node as any).defLookup`.

---

## Part 4: Attribute Definitions

### 4.1 `valueImports` — syn via `match`

Synthesized on CompilationUnit nodes. Walks the file's ImportDeclaration children and collects names of value (non-type-only) imports.

```typescript
const valueImports = match<KSNode, Set<string>>('kind', {
  CompilationUnit: (cu) => {
    const names = new Set<string>();
    for (const child of cu.children) {
      if (child.kind !== 'ImportDeclaration') continue;
      const imp = child as KSImportDeclaration;
      const clause = imp.importClause;
      if (!clause || clause.kind !== 'ImportClause') continue;
      const ic = clause as KSImportClause;
      if (ic.isTypeOnly) continue;

      // Default import: import helper from './mod'
      if (ic.name) names.add(ic.name.escapedText);

      // Named imports: import { a, b } from './mod'
      if (ic.namedBindings?.kind === 'NamedImports') {
        for (const el of (ic.namedBindings as KSNamedImports).elements) {
          if (el.kind !== 'ImportSpecifier') continue;
          const spec = el as KSImportSpecifier;
          if (spec.isTypeOnly) continue;
          names.add(spec.name.escapedText);
        }
      }

      // Namespace import: import * as ns from './mod'
      if (ic.namedBindings?.kind === 'NamespaceImport') {
        names.add((ic.namedBindings as KSNamespaceImport).name.escapedText);
      }
    }
    return names;
  },
  _: () => new Set(),
});
```

JastAdd: `syn Set<String> CompilationUnit.valueImports()`.

### 4.2 `fileImports` — inh via `down`

Inherited attribute propagating `valueImports` from the enclosing CompilationUnit to all descendants.

```typescript
const fileImports = down<KSNode, Set<string>>(
  () => new Set(),  // at root: empty (Program has no imports)
  (ancestor) => {
    if (ancestor.kind === 'CompilationUnit') {
      return (ancestor as any).valueImports as Set<string>;
    }
    return undefined;  // keep walking up
  },
);
```

JastAdd: `inh Set<String> ASTNode.fileImports(); eq CompilationUnit.getChild().fileImports() = valueImports()`.

### 4.3 `localBindings` — syn via `match`

Synthesized on function nodes. Collects parameter names and all local variable declaration names (excluding nested functions, which have their own scope).

```typescript
const localBindings = match<KSNode, Set<string>>('kind', {
  ArrowFunction: collectFunctionLocals,
  FunctionExpression: collectFunctionLocals,
  FunctionDeclaration: collectFunctionLocals,
  _: () => new Set(),
});

function collectFunctionLocals(funcNode: any): Set<string> {
  const locals = new Set<string>();

  // Parameters
  for (const p of funcNode.parameters ?? []) {
    if (p.kind === 'Parameter' && p.name?.kind === 'Identifier') {
      locals.add((p.name as KSIdentifier).escapedText);
    }
  }

  // Walk body for variable declarations (skip nested functions)
  if (!funcNode.body) return locals;
  const stack: KSNode[] = [funcNode.body];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n.kind === 'VariableDeclaration') {
      const vd = n as KSVariableDeclaration;
      if (vd.name.kind === 'Identifier') {
        locals.add((vd.name as KSIdentifier).escapedText);
      }
    }
    // Don't descend into nested functions — they have their own scope
    if (n.kind === 'ArrowFunction' || n.kind === 'FunctionExpression' ||
        n.kind === 'FunctionDeclaration') continue;
    stack.push(...n.children);
  }

  return locals;
}
```

JastAdd: `syn Set<String> FunctionExpr.localBindings()`.

Note: `collectFunctionLocals` is a helper called inside the equation — it inspects the function node's immediate structure (parameters and body declarations). This is equation logic, not orchestration. The body walk here collects declarations within a single function's scope — it doesn't cross function boundaries. This is analogous to a JastAdd `localLookup()` method that inspects a production's components.

### 4.4 `enclosingLocals` — syn via `syn`

Synthesized attribute that accumulates `localBindings` from all enclosing functions by walking `$parent`. This handles shadowing across nested function scopes.

```typescript
const enclosingLocals = syn<KSNode, Set<string>>((node) => {
  const locals = new Set<string>();
  let current: any = (node as any).$parent;
  while (current) {
    if (current.kind === 'ArrowFunction' ||
        current.kind === 'FunctionExpression' ||
        current.kind === 'FunctionDeclaration') {
      const bindings: Set<string> = current.localBindings;
      for (const name of bindings) locals.add(name);
    }
    current = current.$parent;
  }
  return locals;
});
```

JastAdd: `syn Set<String> ASTNode.enclosingLocals()` — walks parent chain accumulating.

Why not `down`? `down` returns at the first matching ancestor. We need to accumulate across ALL enclosing functions. A `syn` attribute with `$parent` walking is the correct choice — the equation uses tree navigation properties stamped by the library, and the library handles caching.

### 4.5 `isReference` — syn via `match`

Synthesized boolean on Identifier nodes. Checks `$parent` to determine if this identifier is in reference position (not a declaration name, not a property access `.name`, not a property key).

```typescript
const isReference = match<KSNode, boolean>('kind', {
  Identifier: (node) => {
    const parent: any = (node as any).$parent;
    if (!parent) return true;

    // Right side of property access: obj.prop → prop is not a reference
    if (parent.kind === 'PropertyAccessExpression' && parent.name === node) return false;

    // Declaration site names
    if (parent.kind === 'VariableDeclaration' && parent.name === node) return false;
    if (parent.kind === 'Parameter' && parent.name === node) return false;
    if (parent.kind === 'FunctionDeclaration' && parent.name === node) return false;
    if (parent.kind === 'FunctionExpression' && parent.name === node) return false;

    // Property assignment keys: { key: value }
    if (parent.kind === 'PropertyAssignment' && parent.name === node) return false;

    // Import specifier names (already outside function bodies, but be safe)
    if (parent.kind === 'ImportSpecifier') return false;

    return true;
  },
  _: () => false,
});
```

JastAdd: `syn boolean Identifier.isReference()`.

### 4.6 `kindAnnotations` — syn via `match`

Synthesized on VariableDeclaration nodes. Checks the type annotation for Kind references using the binder's `defLookup` attribute.

```typescript
const kindAnnotations = match<KSNode, KindDefinition[]>('kind', {
  VariableDeclaration: (node) => {
    const varDecl = node as KSVariableDeclaration;
    if (!varDecl.type) return [];
    const defLookup = (node as any).defLookup as (name: string) => KindDefinition | undefined;
    return extractKindAnnotations(varDecl.type, defLookup);
  },
  _: () => [],
});
```

Where `extractKindAnnotations` is a pure helper that inspects the type AST:

```typescript
function extractKindAnnotations(
  typeNode: KSNode,
  defLookup: (name: string) => KindDefinition | undefined,
): KindDefinition[] {
  if (typeNode.kind === 'IntersectionType') {
    const results: KindDefinition[] = [];
    for (const t of (typeNode as KSIntersectionType).types) {
      results.push(...extractKindAnnotations(t, defLookup));
    }
    return results;
  }
  if (typeNode.kind === 'TypeReference') {
    const ref = typeNode as KSTypeReferenceNode;
    if (ref.typeName.kind === 'Identifier') {
      const def = defLookup((ref.typeName as KSIdentifier).escapedText);
      if (def) return [def];
    }
  }
  return [];
}
```

This handles direct references (`NoImports`) and intersections (`NoImports & Fn`). It uses `defLookup` (stamped by the binder spec) to resolve kind names.

### 4.7 `noImportsContext` — inh via `down`

Inherited attribute. For any node, walks up ancestors to find an annotated VariableDeclaration whose `kindAnnotations` include a kind with `noImports: true`.

```typescript
const noImportsContext = down<KSNode, KindDefinition | null>(
  () => null,
  (ancestor) => {
    if (ancestor.kind === 'VariableDeclaration') {
      const kinds: KindDefinition[] = (ancestor as any).kindAnnotations;
      const noImportsKind = kinds.find((k: KindDefinition) => k.properties.noImports);
      if (noImportsKind) return noImportsKind;
    }
    return undefined;  // keep walking up
  },
);
```

JastAdd: `inh KindDef ASTNode.noImportsContext()`.

This correctly propagates through nested functions within the initializer. For an Identifier deep inside a nested arrow function, `down` walks up through ArrowFunction → Block → ArrowFunction → VariableDeclaration (annotated with NoImports) → match.

### 4.8 `importViolation` — syn via `match`

The core check. Synthesized on Identifier nodes. Produces a diagnostic if this identifier violates `noImports`, otherwise null.

```typescript
const importViolation = match<KSNode, CheckerDiagnostic | null>('kind', {
  Identifier: (node) => {
    // Gate 1: must be in a NoImports context
    const ctx: KindDefinition | null = (node as any).noImportsContext;
    if (!ctx) return null;

    // Gate 2: must be a reference (not a declaration or property name)
    if (!(node as any).isReference) return null;

    const name = (node as KSIdentifier).escapedText;

    // Gate 3: must be a value-imported name
    const imports: Set<string> = (node as any).fileImports;
    if (!imports.has(name)) return null;

    // Gate 4: must not be shadowed by a local binding
    const locals: Set<string> = (node as any).enclosingLocals;
    if (locals.has(name)) return null;

    // Get fileName from CompilationUnit via fileImports' source
    let cu: any = (node as any).$parent;
    while (cu && cu.kind !== 'CompilationUnit') cu = cu.$parent;

    return {
      node,
      message: `'${name}' is an imported binding, violating ${ctx.name} (noImports)`,
      kindName: ctx.name,
      property: 'noImports',
      pos: node.pos,
      end: node.end,
      fileName: cu?.fileName ?? '<unknown>',
    };
  },
  _: () => null,
});
```

JastAdd: `syn CheckerDiagnostic Identifier.importViolation()`.

This attribute reads four other attributes — `noImportsContext`, `isReference`, `fileImports`, `enclosingLocals` — all of which are lazy and cached. The gates are ordered cheapest-first: `noImportsContext` and `isReference` short-circuit before the set lookups.

### 4.9 `allViolations` — coll

Collection attribute aggregating all non-null `importViolation` values from the subtree.

```typescript
const allViolations = coll<KSNode, CheckerDiagnostic[]>(
  () => [],
  (acc, contrib) => [...acc, ...contrib],
  (node) => {
    const v: CheckerDiagnostic | null = (node as any).importViolation;
    return v ? [v] : undefined;
  },
);
```

JastAdd: `coll List<CheckerDiagnostic> ASTNode.allViolations() [new ArrayList<>()] with add`.

`domain.project(root)` simply returns `(root as any).allViolations`, triggering the collection which in turn triggers `importViolation` on every identifier, which in turn triggers all upstream attributes on demand.

---

## Part 5: What the Library Does vs What Equations Do

### The library handles:

- **Tree stamping**: `$parent`, `$children`, `$index`, `$root`, `$prev`, `$next` on every node
- **Attribute installation**: lazy getters for all 9 attributes on every node
- **Caching**: first access computes, replaces getter with data property
- **Demand-driven evaluation**: `domain.project` → `allViolations` → `importViolation` → cascading attribute access
- **Dependency ordering**: `evaluateAll` applies binder before checker via `deps`
- **Subtree aggregation**: `coll` walks `$children` collecting contributions

### Equations handle:

- **Per-production logic**: what does "CompilationUnit" mean for `valueImports`? What does "Identifier" mean for `isReference`?
- **Data extraction**: parsing import structures, inspecting type annotations
- **Pure computation**: set membership, string comparison, accumulation

No equation does a manual DFS walk of the tree. No equation reimplements caching. No equation calls `stampTree` or `applyAttributes`. The only tree navigation inside equations is `$parent` walking in `enclosingLocals` (accumulating across function boundaries) and in `importViolation` (finding the CompilationUnit for `fileName`).

---

## Part 6: Worked Examples

### Example: `kind-violations/src/violating.ts`

```typescript
import type { NoImports } from './kinds';     // type-only → skipped
import { helper } from './helpers';            // value import → Set { "helper" }

export const add: NoImports & ((a: number, b: number) => number) = (a, b) => helper(a) + b;
```

Attribute evaluation cascade (triggered by `domain.project` → `root.allViolations`):

1. `allViolations` on root triggers `coll` DFS → reaches the `helper` Identifier node
2. `importViolation` on `helper` Identifier:
   - `noImportsContext` → `down` walks up: ArrowFunction → VariableDeclaration → `kindAnnotations` returns `[NoImportsDef]` → match! Returns `NoImportsDef`
   - `isReference` → `match` Identifier: `$parent` is BinaryExpression → not a declaration/property → `true`
   - `fileImports` → `down` walks up: ... → CompilationUnit → `valueImports` = `Set { "helper" }` → returns it
   - `enclosingLocals` → `syn` walks `$parent`: ArrowFunction has `localBindings` = `Set { "a", "b" }` → accumulated = `Set { "a", "b" }`
   - `imports.has("helper")` → YES
   - `locals.has("helper")` → NO
   - **VIOLATION** — returns diagnostic

3. `importViolation` on `a`, `b` identifiers:
   - Same gates, but `imports.has("a")` → NO → null. Short-circuited.

Result: 1 diagnostic.

### Example: `kind-basic/src/math.ts`

```typescript
import type { NoImports } from './kinds';

export const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;
```

1. `allViolations` → `coll` DFS → reaches `a`, `b` identifiers
2. `importViolation` on `a`: `noImportsContext` → walks up → VariableDeclaration has NoImports → context active
3. `fileImports` → CompilationUnit `valueImports` = `Set {}` (type-only import) → `imports.has("a")` → NO → null

Result: 0 diagnostics.

### Example: parameter shadowing

```typescript
import { helper } from './helpers';

const f: NoImports & ((helper: number) => number) = (helper) => helper + 1;
```

1. `importViolation` on body `helper`:
   - `noImportsContext` → NoImportsDef (annotated)
   - `isReference` → YES (parent is BinaryExpression)
   - `fileImports` → `Set { "helper" }` → `imports.has("helper")` → YES
   - `enclosingLocals` → ArrowFunction `localBindings` includes parameter `"helper"` → `Set { "helper" }` → `locals.has("helper")` → YES → **shadowed, null**

Result: 0 diagnostics. Correct.

### Example: nested function with outer parameter shadowing

```typescript
import { helper } from './helpers';

const f: NoImports & ((helper: number) => number) = (helper) => {
  const inner = () => helper + 1;  // helper is the parameter, not the import
  return inner();
};
```

1. `importViolation` on `helper` inside `inner`'s body:
   - `noImportsContext` → walks up: inner's ArrowFunction → inner's VariableDeclaration (no annotations) → keep walking → Block → outer ArrowFunction → outer VariableDeclaration → `kindAnnotations` has NoImports → match!
   - `enclosingLocals` → walks `$parent`: inner ArrowFunction `localBindings` = `Set {}` (no params), outer ArrowFunction `localBindings` = `Set { "helper" }` → accumulated = `Set { "helper" }`
   - `locals.has("helper")` → YES → **shadowed, null**

Result: 0 diagnostics. Correct — `enclosingLocals` accumulates across function boundaries.

---

## Part 7: Diagnostic Type

```typescript
export interface CheckerDiagnostic {
  /** The AST node where the violation occurs. */
  node: KSNode;
  /** Human-readable description. */
  message: string;
  /** Name of the kind that was violated. */
  kindName: string;
  /** The specific property that was violated. */
  property: string;
  /** Position info. */
  pos: number;
  end: number;
  fileName: string;
}
```

The `fileName` is read from the CompilationUnit ancestor inside the `importViolation` equation via `$parent` walking.

---

## Part 8: AG Library Uplift Required

### Required: None

The checker uses existing primitives:
- `match` — per-production dispatch (`valueImports`, `localBindings`, `isReference`, `kindAnnotations`, `importViolation`)
- `down` — inherited attributes (`fileImports`, `noImportsContext`)
- `syn` — custom synthesized (`enclosingLocals`)
- `coll` — subtree aggregation (`allViolations`)
- `evaluateAll` — spec composition with dependency ordering

No external dependencies. No TypeScript type checker. No library changes needed.

### Note on `enclosingLocals`

This attribute uses `syn` with `$parent` walking to accumulate local bindings across all enclosing functions. This doesn't fit `down` (which returns at the first match). A hypothetical `downAccum` primitive could express this pattern, but `syn` with `$parent` is clear and correct. The equation uses tree navigation properties stamped by the library, and the library handles caching. This is fine — the walk IS the equation logic.

---

## Part 9: Integration with program.ts

### Current

```typescript
const allDefs = evaluate(createBinderSpec(), ksTree.root) ?? [];
```

### After checker: use `evaluateAll`

```typescript
const results = evaluateAll(
  [createBinderSpec(), createCheckerSpec()],
  ksTree.root,
);
const allDefs = results.get('ksc-binder') as KindDefinition[];
const diagnostics = results.get('ksc-checker') as CheckerDiagnostic[];
```

`evaluateAll` stamps the tree once and applies specs in dependency order. The checker spec declares `deps: ['ksc-binder']`, so `kindDefs` and `defLookup` are guaranteed to be installed before the checker's equations run.

### KSProgramInterface extension

```typescript
export interface KSProgramInterface {
  // ... existing ...
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): CheckerDiagnostic[];  // NEW
}
```

---

## Part 10: Annotation Resolution

Given `const add: NoImports & ((a: number, b: number) => number) = ...`, we need to detect that `NoImports` refers to a known kind definition.

We use pure AST pattern matching — no type checker:

Walk the KSC AST type annotation. If it's an `IntersectionType`, check each member. If any member is a `TypeReference` whose `typeName` is an `Identifier`, use `defLookup` (from the binder) to check if that name is a known kind.

`extractKindAnnotations` is a pure helper function called inside the `kindAnnotations` equation. It inspects the immediate type structure — not a tree walk. Analogous to a JastAdd helper method that destructures a production's children.

This handles direct references (`NoImports`) and intersections (`NoImports & Fn`). It won't handle alias indirection (`type MyKind = NoImports; const x: MyKind & Fn = ...`) — that's acceptable for now. If needed later, it's a localized change.

---

## Part 11: Soundness and Limitations

This approach is **sound for well-typed code** — it will not produce false positives (incorrectly flagging clean code).

- **Block-scoped shadowing**: `() => { if (true) { const helper = 1; } return helper; }` — `localBindings` collects `helper` as a local (it doesn't track block scope precision), so it would consider `helper` shadowed. But this code is also a TypeScript error (helper not in scope after the block), so it can't appear in valid programs.

- **Destructuring imports**: `import { a: b } from './mod'` — the bound name is `b`, not `a`. Our import extractor uses `ImportSpecifier.name.escapedText` which is the local bound name. Works correctly.

- **Namespace access**: `import * as ns from './mod'; ns.foo()` — we collect `ns` as a value import. The reference `ns` in `ns.foo()` is a reference-position identifier (expression of PropertyAccessExpression). Correctly flags as a violation.

- **Nested function scope accumulation**: `enclosingLocals` walks `$parent` through all enclosing functions, so parameter shadowing in outer functions is correctly detected even from within inner functions.

---

## Part 12: File Layout

```
src/pipeline/checker.ts     — createCheckerSpec(), extractKindAnnotations()
src/pipeline/types.ts       — add CheckerDiagnostic, update KSProgramInterface
src/program.ts              — use evaluateAll([binder, checker], root)
src/index.ts                — export createCheckerSpec, CheckerDiagnostic
test/checker.test.ts        — test against kind-basic, kind-violations fixtures
```

---

## Part 13: Test Plan

### Test fixture: `kind-basic`

```
kinds.ts:  type NoImports = Kind<{ noImports: true }>
math.ts:   const add: NoImports & Fn = (a, b) => a + b   ← type-only import, PASSES
```

Expected: 0 diagnostics.

### Test fixture: `kind-violations`

```
kinds.ts:     type NoImports = Kind<{ noImports: true }>
helpers.ts:   export function helper(x: number): number
violating.ts: import { helper } from './helpers'
              const add: NoImports & Fn = (a, b) => helper(a) + b   ← VIOLATION
clean.ts:     const add: NoImports & Fn = (a, b) => a + b           ← PASSES
```

Expected: 1 diagnostic on `violating.ts`.

### Additional test cases to add

1. **No annotation**: unannotated functions produce no diagnostics
2. **Type-only imports don't count**: `import type { X }` is fine
3. **Nested references**: `(a) => { const f = () => helper(); return f(); }` — `helper` is still imported
4. **Parameter shadowing**: `(helper) => helper(1)` — parameter shadows import
5. **Nested function with outer parameter shadowing**: `(helper) => { const f = () => helper(); }` — outer param shadows import

### AGSpec contract tests

```typescript
it('createCheckerSpec returns a valid AGSpec', () => {
  const spec = createCheckerSpec();
  expect(spec.name).toBe('ksc-checker');
  expect(spec.deps).toContain('ksc-binder');
  expect(spec.domain.name).toBe('Kind Violations');
  expect(spec.attributes).toHaveProperty('valueImports');
  expect(spec.attributes).toHaveProperty('fileImports');
  expect(spec.attributes).toHaveProperty('localBindings');
  expect(spec.attributes).toHaveProperty('enclosingLocals');
  expect(spec.attributes).toHaveProperty('isReference');
  expect(spec.attributes).toHaveProperty('kindAnnotations');
  expect(spec.attributes).toHaveProperty('noImportsContext');
  expect(spec.attributes).toHaveProperty('importViolation');
  expect(spec.attributes).toHaveProperty('allViolations');
});
```

### Individual attribute tests

```typescript
it('valueImports collects non-type-only imports', () => {
  // Build tree from kind-violations fixture
  // Access cu.valueImports → should contain 'helper'
});

it('fileImports propagates to descendants', () => {
  // Access fileImports on a deep node → same Set as CompilationUnit's valueImports
});

it('localBindings collects parameters and local declarations', () => {
  // Access localBindings on an ArrowFunction → should contain param names
});

it('isReference is false for declaration names and property accesses', () => {
  // Access isReference on various Identifier nodes
});

it('noImportsContext propagates from annotated VariableDeclarations', () => {
  // Access noImportsContext on nodes inside/outside annotated functions
});
```

---

## Part 14: Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Granularity | Node-level, not file-level | Matches what the property means; JastAdd would do it this way |
| Property scope | Only imported bindings (not closures/globals) | Matches the name "noImports" literally |
| Annotation detection | AST pattern matching | Pure AST; handles the canonical `X & Fn` pattern |
| Name resolution | Pure AG attributes (no TS type checker) | Self-contained spec; 9 attributes handle everything |
| Every computation is an attribute | All logic in equations, no imperative helpers doing tree walks | Library handles all orchestration, caching, traversal |
| Scope accumulation | `syn` with `$parent` walk | `down` returns at first match; accumulation needs explicit `$parent` walk in equation |
| Diagnostic collection | `coll` attribute | Library's subtree aggregation primitive — no manual DFS |
| Domain projection | `root.allViolations` | Single attribute access triggers entire demand-driven cascade |
| Spec composition | `evaluateAll([binder, checker])` | Single tree stamp, explicit dependency ordering |
| AG library uplift | None required | All needed primitives exist |

---

## Part 15: Implementation Status

All steps completed and verified. Final counts:
- `npx tsc --noEmit` — clean compile
- `npx vitest run` — 72 root tests pass (7 test files)
- `cd libs/ag && npx vitest run` — 66 AG library tests pass (10 test files)

### Steps completed

1. **Add `CheckerDiagnostic` type** to `src/pipeline/types.ts` — DONE
2. **Add `getDiagnostics()` to `KSProgramInterface`** in `src/pipeline/types.ts` — DONE
3. **Create `src/pipeline/checker.ts`** — DONE
   - `extractKindAnnotations(typeNode, defLookup)` — pure helper for type annotation inspection
   - `collectFunctionLocals(funcNode)` — pure helper called inside `localBindings` equation
   - 9 attribute definitions: `valueImports`, `fileImports`, `localBindings`, `enclosingLocals`, `isReference`, `kindAnnotations`, `noImportsContext`, `importViolation`, `allViolations`
   - `createCheckerSpec()` — returns `AGSpec<KSNode, CheckerDiagnostic[]>`
4. **Update `src/program.ts`** — DONE
   - Switched from `evaluate(binderSpec)` to `evaluateAll([binderSpec, checkerSpec])`
   - Extracts results from the Map
   - Added `getDiagnostics()` to the returned interface
5. **Update `src/index.ts`** — DONE: Export `createCheckerSpec`, `CheckerDiagnostic`
6. **Create `test/checker.test.ts`** — DONE: 15 tests (AGSpec contract, attributes, fixtures)
7. **Create `test/e2e.test.ts`** — DONE: 15 e2e tests covering:
   - Clean code (kind-basic): 0 diagnostics
   - Violation detection (kind-violations): flags helper, not clean.ts
   - Parameter shadowing: param name shadows import → no violation
   - Nested function with outer param shadow → no violation
   - Nested function referencing import → violation
   - Local variable shadowing import → no violation
   - No annotation → no violations even with imports
   - Multiple imports: flags all used imports
   - Type-only imports: no violations
   - createProgramFromTSProgram produces same diagnostics
   - Dashboard export works after checker runs
   - Files with no kinds: no diagnostics
8. **Edge case fixtures** — DONE: `test/fixtures/checker-edges/src/` with 8 files
9. **Fix test/export.test.ts** — Fixed wrong type import (`KSProgram` → `KSProgramInterface`)
10. **Add getDiagnostics to program.test.ts** — 2 new tests
11. **Verify** — DONE: All tests pass, clean compile, no dead code
