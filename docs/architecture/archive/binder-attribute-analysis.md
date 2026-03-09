# KSC Binder & Checker Attribute Analysis

> Comprehensive review of all 12 KSC attributes, comparison with TypeScript's binder,
> identified issues, and recommended fixes.
>
> Generated from runtime analysis against all test fixtures (121 tests passing).

---

## 1. Attribute Inventory

KSC evaluates 12 attributes across two phases: **binder** (3 attributes) and **checker** (9 attributes).

| # | Attribute | Direction | Phase | Type | Productions |
|---|-----------|-----------|-------|------|-------------|
| 1 | `kindDefs` | syn | binder | `KindDefinition[]` | CompilationUnit |
| 2 | `defEnv` | inh | binder | `Map<string, KindDefinition>` | root → all |
| 3 | `defLookup` | syn | binder | `(name: string) => KindDefinition \| undefined` | universal |
| 4 | `valueImports` | syn | checker | `Set<string>` | CompilationUnit |
| 5 | `fileImports` | inh | checker | `Set<string>` | CU children → all |
| 6 | `localBindings` | syn | checker | `Set<string>` | ArrowFunction, FunctionExpression, FunctionDeclaration |
| 7 | `enclosingLocals` | syn | checker | `Set<string>` | universal |
| 8 | `isReference` | syn | checker | `boolean` | Identifier |
| 9 | `kindAnnotations` | syn | checker | `KindDefinition[]` | VariableDeclaration |
| 10 | `noImportsContext` | inh | checker | `KindDefinition \| null` | VariableDeclaration → descendants |
| 11 | `importViolation` | syn | checker | `CheckerDiagnostic \| null` | Identifier |
| 12 | `allViolations` | collection | checker | `CheckerDiagnostic[]` | all nodes (bottom-up) |

### Dependency Graph

```
kindDefs → (leaf)
defEnv → kindDefs
defLookup → defEnv
valueImports → (leaf)
fileImports → valueImports
localBindings → (leaf)
enclosingLocals → localBindings
isReference → (leaf)
kindAnnotations → defLookup
noImportsContext → kindAnnotations
importViolation → noImportsContext, isReference, fileImports, enclosingLocals
allViolations → importViolation
```

11 edges, topologically sorted. No cycles.

---

## 2. TypeScript Binder Comparison

TypeScript's binder (`src/compiler/binder.ts`) performs the following responsibilities. Here's how each maps to KSC:

### Responsibilities TypeScript's binder handles

| TS Binder Responsibility | KSC Equivalent | Coverage |
|--------------------------|---------------|----------|
| **Symbol table creation** — creates Symbol objects for all declarations, links to source nodes | `kindDefs` — creates KindDefinition objects for `type X = Kind<{...}>` declarations only | **Partial** — KSC only creates "kind" symbols, not all symbols |
| **Scope chain** — builds containment hierarchy (sourceFile → function → block), tracks which symbols are visible where | `enclosingLocals` — walks parent chain collecting localBindings from enclosing functions | **Partial** — flat name set, no scope objects, no block-scope boundaries |
| **Import binding** — registers import declarations as symbols in the file scope | `valueImports` — collects value-import names per CompilationUnit | **Equivalent** — same information, different representation |
| **Declaration binding** — binds `const`, `let`, `var`, function params, class members, etc. | `localBindings` — collects parameter names and VariableDeclaration names within function bodies | **Good** — handles simple + destructured bindings, misses catch/for-in vars |
| **Flow control analysis** — unreachable code, narrowing, assignment analysis | None | **N/A** — not needed for kind property checking |
| **Container assignment** — sets `node.parent`, marks container nodes | Built into KSCDNode tree construction (parent, children, fieldName) | **Equivalent** |
| **JSDoc parsing** — processes JSDoc comments for type information | None | **N/A** — not relevant to kinds |

### Key Difference: Scope Model

TypeScript builds a **hierarchical scope chain** where each container (function, block, module) has a `locals` map. Name resolution walks up the chain.

KSC uses a **flat model**: `enclosingLocals` collects ALL locals from ALL enclosing functions into a single `Set<string>`. This works for the noImports check (where we just need to know "is this name shadowed by any local?") but wouldn't support:
- Block-scoped shadowing within a function (see Remaining Issue #1 below)
- Multiple scopes with the same name at different levels
- Proper lexical scoping rules

---

## 3. Per-Attribute Analysis

### 3.1 `kindDefs` (syn, binder)

**What it does:** Scans CompilationUnit children for `type X = Kind<{...}>` declarations. Extracts the kind name, properties, and assigns unique IDs.

**Implementation:** `eq_kindDefs_CompilationUnit` iterates ctx.children, filters for TypeAliasDeclaration nodes, calls `tryExtractKindDef` to match the `Kind<{...}>` pattern.

**Verified against TS:** TS binder creates symbols for ALL declarations. KSC only creates KindDefinition objects for the specific `Kind<...>` pattern. This is intentional — KSC isn't a general-purpose binder.

**Status:** ✅ Working correctly. Tested with kind-basic fixture (finds `NoImports`, extracts `noImports: true` property, assigns unique IDs, ignores non-Kind type aliases).

### 3.2 `defEnv` (inh, binder)

**What it does:** Collects all KindDefinitions across all CompilationUnits and propagates them as a `Map<string, KindDefinition>` downward from the root to all nodes.

**Implementation:** `eq_defEnv_root` iterates root's children (CUs), collecting their `kindDefs` into a map. As an inherited attribute, this propagates to all descendants.

**Status:** ✅ Working correctly. Every node in the tree can access every kind definition. Cross-file kind resolution works.

**Note:** If two files define the same kind name, the last one wins (Map.set overwrites). No duplicate detection.

### 3.3 `defLookup` (syn, universal)

**What it does:** Creates a lookup function `(name: string) => KindDefinition | undefined` from `defEnv`.

**Implementation:** `eq_defLookup` reads `ctx.attr('defEnv')` and returns a closure over `env.get`.

**Status:** ✅ Working correctly. Convenience wrapper — every node gets the same function since defEnv is the same everywhere.

### 3.4 `valueImports` (syn, checker)

**What it does:** Collects the set of value-imported names from ImportDeclarations in a CompilationUnit.

**Implementation:** `eq_valueImports_CompilationUnit` walks `raw.children` (the source file's top-level statements), filters ImportDeclarations, skips type-only imports, collects names from import clauses (default import, named imports, namespace imports).

**Verified against TS:** Using TS's internal `sourceFile.locals` map, filtered for import declarations:

```
TS violating.ts import bindings: [NoImports, helper]
KSC valueImports:                [helper]
```

The difference is expected: TS includes `NoImports` because `import type { NoImports }` still creates a symbol. KSC correctly excludes it because `isTypeOnly` is true on the ImportClause. KSC's behavior is correct for the noImports check — type-only imports don't create runtime references.

**Status:** ✅ Working correctly for current use case.

### 3.5 `fileImports` (inh, checker)

**What it does:** Propagates the file's valueImports downward to all descendants. Root gets an empty set. Children of CompilationUnit nodes get their parent's valueImports.

**Implementation:** `eq_fileImports` checks if `parentCtx.node.kind === 'CompilationUnit'` — if so, returns the CU's `valueImports`. Otherwise returns `undefined` (inherit from parent).

**Subtlety:** The CompilationUnit itself does NOT have its imports in `fileImports` — only its descendants do. This is correct: the CU is where imports are *declared*, its children are where imports are *used*.

**Status:** ✅ Working correctly.

### 3.6 `localBindings` (syn, checker)

**What it does:** For function-like nodes (ArrowFunction, FunctionExpression, FunctionDeclaration), collects the names of parameters and body-level variable declarations.

**Implementation:** `collectFunctionLocals` iterates parameters and walks the body collecting VariableDeclaration names. Uses `collectBindingNames` to recursively extract identifiers from destructuring patterns (ObjectBindingPattern, ArrayBindingPattern). Stops at nested function boundaries.

**Verified against TS:** For `local-shadow.ts`:
```
Arrow[0] (outer): localBindings = [a, helper]   // param 'a' + inner 'const helper'
Arrow[1] (inner): localBindings = [x]            // param 'x'
```

**Status:** ✅ Working correctly (destructuring support added, see Fixed Issues below).

### 3.7 `enclosingLocals` (syn, universal)

**What it does:** Walks up the parent chain, collecting `localBindings` from all enclosing function-like ancestors.

**Implementation:** `eq_enclosingLocals` walks `ctx.parent` chain, checks for function kinds, unions all their `localBindings`.

**Status:** ✅ Correct for tested cases. See Remaining Issue #1 for block-scope limitation.

### 3.8 `isReference` (syn, checker)

**What it does:** For Identifier nodes, determines whether the identifier is in a *reference* position (reading a value) vs a *definition* position (declaring a name).

**Implementation:** `eq_isReference_Identifier` returns `true` unless the parent is one of the known definition-site or type-position patterns:
- `PropertyAccessExpression:name` — property access `.foo`
- `VariableDeclaration:name` — declaration `const foo`
- `Parameter:name` — function parameter
- `FunctionDeclaration:name` — function name
- `FunctionExpression:name` — named function expression
- `PropertyAssignment:name` — `{ foo: ... }`
- `ImportSpecifier` — any child of import specifier
- `TypeAliasDeclaration:name` — type alias name
- `TypeReference:typeName` — type annotation references (added, see Fixed Issues)
- `BindingElement:name` — destructured binding names (added, see Fixed Issues)
- `PropertySignature:name` — interface/type member names (added, see Fixed Issues)

**Status:** ✅ Working correctly. See Remaining Issues #3, #4 for minor gaps.

### 3.9 `kindAnnotations` (syn, checker)

**What it does:** For VariableDeclaration nodes, extracts Kind definitions from the type annotation (handling intersection types like `NoImports & ((a: number) => number)`).

**Implementation:** `eq_kindAnnotations_VariableDeclaration` reads the variable's `type` node, recursively walks IntersectionType and TypeReference nodes, uses `defLookup` to resolve kind names.

**Status:** ✅ Working correctly for VariableDeclaration. See Remaining Issue #2 for class property limitation.

### 3.10 `noImportsContext` (inh, checker)

**What it does:** Propagates a `KindDefinition | null` downward from VariableDeclaration nodes that have a kind annotation with `noImports: true`. Inside such a declaration's initializer, all descendants see the non-null context.

**Implementation:** `eq_noImportsContext` checks if `parentCtx.node.kind === 'VariableDeclaration'`, and if so, looks for a noImports kind in `kindAnnotations`. Returns `undefined` to inherit from parent.

**Verified:** In `nested-violation.ts`, the `helper` identifier 13 levels deep correctly sees `noImportsContext = NoImports`:
```
chain: Identifier ← CallExpression ← ArrowFunction ← VariableDeclaration ← ... ← CompilationUnit ← Program
```

**Status:** ✅ Working correctly for VariableDeclaration.

### 3.11 `importViolation` (syn, checker)

**What it does:** For Identifier nodes, checks if all conditions are met for a violation: noImportsContext is non-null, isReference is true, name is in fileImports, name is not in enclosingLocals.

**Implementation:** `eq_importViolation_Identifier` checks all four conditions and produces a `CheckerDiagnostic` with position info.

**Status:** ✅ Working correctly.

### 3.12 `allViolations` (collection, checker)

**What it does:** Bottom-up collection of all `importViolation` diagnostics from the entire tree.

**Implementation:** `eq_allViolations_contribute` wraps each node's `importViolation` in an array. `eq_allViolations_combine` concatenates child results.

**Status:** ✅ Working correctly.

---

## 4. Fixed Issues

### Fixed: Destructuring patterns not collected as local bindings (was P1)

**Problem:** `collectFunctionLocals` only handled simple `Identifier` names for parameters and variable declarations. Destructuring patterns (`ObjectBindingPattern`, `ArrayBindingPattern`) were silently ignored, meaning destructured names that shadow imports would produce false-positive violations.

**Fix:** Added `collectBindingNames` helper that recursively walks binding patterns:
```typescript
function collectBindingNames(nameNode: KSNode, names: Set<string>): void {
  if (nameNode.kind === 'Identifier') {
    names.add((nameNode as KSIdentifier).escapedText);
  } else if (nameNode.kind === 'ObjectBindingPattern' || nameNode.kind === 'ArrayBindingPattern') {
    for (const el of (nameNode as any).elements) {
      if (el.kind === 'BindingElement') collectBindingNames(el.name, names);
    }
  }
}
```

Both `collectFunctionLocals` parameter iteration and body VariableDeclaration collection now use `collectBindingNames` instead of direct Identifier checks.

**Tests added:** 3 new e2e tests for destructured-param, destructured-local, and array-destructured shadowing.

### Fixed: `isReference` returned true for type-position identifiers (was P2)

**Problem:** Identifiers inside `TypeReference` nodes (type annotations) returned `isReference = true` even though they're in type position and don't create runtime references.

**Fix:** Added three exclusions to `eq_isReference_Identifier`:
```typescript
if (ctx.parentIs('TypeReference', 'typeName')) return false;
if (ctx.parentIs('BindingElement', 'name')) return false;
if (ctx.parentIs('PropertySignature', 'name')) return false;
```

The `BindingElement:name` and `PropertySignature:name` exclusions were also needed — discovered during destructuring testing. `BindingElement:name` identifiers appear inside type-level binding patterns (e.g., the `helper` in `({helper}: {helper: number})` within a FunctionType annotation). `PropertySignature:name` identifiers appear inside type-level object types (the `helper` in `{helper: number}`). Both are definition sites, not value references.

---

## 5. Remaining Issues

### Remaining Issue #1: No block-scope awareness

**Severity:** Low-Medium — subtle false negative

**What happens:** `collectFunctionLocals` collects ALL variable declarations in a function body (stopping at nested functions) into a single flat set. It does not track which block scope each declaration belongs to. This means a `const` inside an `if` block is treated as though it shadows across the entire function.

**Concrete example:**
```typescript
import { helper } from './lib';
const f: NoImports & ((a: number) => number) = (a) => {
  if (a > 0) {
    const helper = 42;  // block-scoped to the if-body
    return helper;       // ← safe, uses local
  }
  return helper(a);      // ← SHOULD violate, but doesn't
};
```

`collectFunctionLocals` for the arrow produces `{a, helper}` — it finds the `const helper = 42` in the if-body. So `enclosingLocals` at the `helper(a)` call site includes `helper`, and no violation is reported. But the block-scoped `const helper = 42` only shadows within the `if` block — the `helper(a)` call is OUTSIDE that block and should be a violation.

**Why this matters:** This is a false negative — a real import usage goes unreported. However, it requires a specific pattern: a block-scoped local with the same name as an import, AND the import being used outside that block. In practice this is uncommon because:
1. Reusing an import's name for a block-scoped variable is unusual
2. If you shadow an import in a block, you typically don't also use the import elsewhere in the same function

**What a fix would require:**

Option A — **Scope-chain model (proper fix):**
- Replace the flat `Set<string>` in `localBindings` with a scope-aware structure
- Track which block/scope each declaration belongs to
- At each reference site, walk up the scope chain to find the innermost binding
- This is essentially rebuilding a simplified version of TS's scope resolution
- Would require a new attribute (e.g., `scopeChain`) or significantly reworking `enclosingLocals`

Option B — **Reference-site upward walk (targeted fix):**
- Instead of pre-collecting all locals, at each potential violation site, walk up from the reference to the enclosing function
- At each block boundary, check if a declaration for the name exists
- Only consider the name "shadowed" if a declaration is found in a scope that encloses the reference
- More targeted but still requires understanding block boundaries

Option C — **Conservative approach (simplest):**
- Only count function-scoped declarations (parameters, `var` declarations) as shadowing
- Block-scoped declarations (`let`/`const`) would NOT shadow — if the import is used anywhere in the function, flag it
- This would fix the false negative but introduce a false positive for the legitimate block-scoped shadow case
- Simple to implement: filter `collectFunctionLocals` body scan to only `var` declarations

**Recommendation:** For v1, the current behavior is acceptable. Option B is the best long-term fix. Option C is a reasonable intermediate step if false negatives are more concerning than false positives.

### Remaining Issue #2: Kind annotations only detected on VariableDeclaration

**Severity:** Low — design limitation

**What happens:** `eq_kindAnnotations` only fires on `VariableDeclaration` nodes. Kind annotations on class properties are not detected.

**What works:**
```typescript
// ✅ All three are detected — they all use VariableDeclaration
const f: NoImports & (() => number) = () => 42;
let g: NoImports & (() => number) = () => 42;
var h: NoImports & (() => number) = () => 42;
```

**What doesn't:**
```typescript
// ❌ PropertyDeclaration — not a VariableDeclaration
class Calculator {
  add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;
}

// ❌ FunctionDeclaration — no intersection type syntax for return types
// (This is a fundamental limitation of the annotation syntax, not just the checker)
function add(a: number, b: number): number { return a + b; }
```

**Why it's this way:** The KSC kind annotation design uses intersection types (`NoImports & T`) on the value's type annotation. This syntax naturally applies to variable declarations where you write `const x: NoImports & SomeType = ...`. For function declarations, there's no natural place to put an intersection type — you'd have to annotate the return type, which doesn't semantically mean the same thing.

Class properties (`PropertyDeclaration`) have the exact same annotation syntax as variable declarations. Adding support would be straightforward:
1. Add `eq_kindAnnotations_PropertyDeclaration` — same logic as the VariableDeclaration case
2. Add a `PropertyDeclaration` check in `eq_noImportsContext`

**When to fix:** When/if users want to annotate class properties with Kind types.

### Remaining Issue #3: Missing `isReference` exclusions for rare declaration names

**Severity:** Very Low — no practical impact

**What happens:** Two `parentKind:name` patterns in the test fixtures lack explicit `isReference` exclusions:
- `TypeParameter:name` — generic type parameter names (e.g., `R` in `<R extends PropertySet>`)
- `InterfaceDeclaration:name` — interface declaration names (e.g., `PropertySet` in `interface PropertySet`)

These identifiers return `isReference = true`, but this does NOT cause violations because:
1. They appear in type-only contexts
2. Type parameter names and interface names are never in `valueImports` (they're locally declared)
3. Even if an interface name happens to match an import, the interface declaration is a re-declaration in the local scope, which would need its own handling

**Concrete non-impact:**
```typescript
import { PropertySet } from './lib';          // value import
interface PropertySet { noImports?: true; }    // re-declaration
// TypeScript itself would error on this (duplicate identifier),
// so KSC doesn't need to worry about it
```

**Fix (trivial if desired):**
```typescript
if (ctx.parentIs('TypeParameter', 'name')) return false;
if (ctx.parentIs('InterfaceDeclaration', 'name')) return false;
```

### Remaining Issue #4: Function expression self-reference name not collected

**Severity:** Very Low — extremely rare edge case

**What happens:** In `const f = function myFunc() { myFunc(); }`, the name `myFunc` is bound in the function expression's own scope (visible only inside the function body). `collectFunctionLocals` does not include this name.

**Impact:** If a named function expression's name happens to shadow an import, a false-positive violation would occur:
```typescript
import { myFunc } from './lib';
const f: NoImports & (() => void) = function myFunc() {
  myFunc();  // ← would be flagged as import reference, but it's actually the self-reference
};
```

**Why it's very low priority:**
1. Named function expressions are uncommon in modern TS (arrow functions are preferred)
2. Named function expressions that shadow imports are even rarer
3. Using a named function expression *for self-reference* that also shadows an import is extremely unlikely

**Fix (trivial if desired):** In `collectFunctionLocals`, check if the function node has a `name` property:
```typescript
if (funcNode.kind === 'FunctionExpression' && funcNode.name?.kind === 'Identifier') {
  locals.add(funcNode.name.escapedText);
}
```

---

## 6. Verification Summary

### Test coverage

All 121 tests pass across 10 test files:
- `binder.test.ts` — 11 tests: kindDefs discovery, properties, IDs, defLookup, caching
- `checker.test.ts` — 12 tests: violations, clean files, individual attributes, position info
- `e2e.test.ts` — 16 tests: full pipeline, edge cases (shadowing, nesting, multiple imports, type-only, destructuring)
- Other test files — serialization, conversion, schema, program API

### Fixture coverage

| Fixture | Files | Definitions | Violations | Tests |
|---------|-------|-------------|------------|-------|
| kind-basic | 3 | NoImports | 0 | Clean annotated code |
| kind-violations | 4 | NoImports | 1 (helper) | Import violation |
| checker-edges | 12 | NoImports | 3 | Shadowing, nesting, multiple imports, type-only, destructuring |
| checker-clean | 2 | (none) | 0 | No kinds at all |

### Runtime verification

Direct runtime analysis confirmed:
- `valueImports` matches TS import bindings (excluding type-only — correct)
- `localBindings` correctly collects parameters, body-level variables, and destructured bindings
- `enclosingLocals` correctly unions locals from all enclosing functions
- `isReference` correctly distinguishes definition sites, type positions, and value reference sites
- `noImportsContext` propagates correctly through 13 levels of nesting
- `fileImports` correctly available on CU children but empty on CU itself (inh semantics)
- `allViolations` correctly aggregates all violations bottom-up

---

## 7. Conclusion

The KSC binder/checker implements a **focused subset** of TypeScript's binder functionality — just enough to support the `noImports` kind property. It does not attempt to be a general-purpose scope resolver or symbol table.

**What it does well:**
- Kind definition discovery is complete and correct
- Cross-file kind resolution works
- Import collection handles all import forms (named, default, namespace, type-only)
- Shadowing works for parameters, simple locals, and destructured bindings
- Nested function boundaries are respected
- Type-position identifiers correctly excluded from violation checking
- Violation reporting includes accurate position info

**Remaining gaps (all low priority for v1):**
- Block-scope awareness (false negative in rare pattern — see Remaining Issue #1)
- Class property annotations (design limitation — see Remaining Issue #2)
- Two trivial `isReference` exclusions (no practical impact — see Remaining Issue #3)
- Function expression self-reference (extremely rare — see Remaining Issue #4)

For a v1 targeting the `noImports` property, the implementation is solid. The block-scope gap (Remaining Issue #1) is the only one that could matter in practice, and even then only in unusual code patterns.
