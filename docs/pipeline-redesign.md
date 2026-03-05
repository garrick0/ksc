# Pipeline Redesign: Eliminating the Collector

## Problem

The current pipeline is **Parse → Collect → Bind → Check**, where the collector does two passes:

- **Pass 1**: Walk all source files, find `type X = Kind<{...}>` definitions
- **Pass 2**: Walk all source files again, find `const x: Pure & T = ...` annotations

Pass 1 is legitimate discovery work — finding kind definitions is analogous to how TS's binder discovers type declarations. But Pass 2 is an anti-pattern: it manually pattern-matches on annotation shapes (`VariableStatement` → check `declarationList` → check `type` → handle intersections...), with TODO stubs for function declarations and class declarations. This is exactly the imperative "walk and match" work that an attribute grammar approach replaces.

In the AG model, you don't pre-scan for annotations. Each node has attributes that are evaluated on demand. The question "does this variable have a kind annotation?" is just another attribute computation — `resolveKindAnnotation(node)` — evaluated when the checker needs it, memoized, composed with other attributes.

The collector is hand-rolling attribute evaluation as an eager, imperative pre-pass. Instead of declaring "a variable's kind is determined by looking at its type annotation and resolving references," it writes procedural traversal code with special cases per node type.

## New Pipeline

```
Old:  Parse → Collect → Bind → Check
New:  Parse → Bind → Check
```

### Binder (absorbs collector Pass 1)

The binder walks source files to find kind definitions — `type X = Kind<{...}>` declarations. These are bindings: named definitions registered in a lookup table. This is what binders do.

**Input**: `ts.Program`
**Output**: `KindDefinition[]` + lookup `Map<string, KindDefinition>`

The binder does NOT find annotations. It doesn't need to know which values reference which kinds — that's the checker's job.

### Checker (replaces collector Pass 2 + old stub)

The checker is the interpreter runtime. It walks the AST and evaluates attributes on demand:

1. **`resolveKindAnnotation(node)`** — given a declaration node, determine if its type annotation references a known kind. This is a demand-driven attribute, not a pre-collected list. It handles intersections, parenthesized types, import resolution — the same logic currently in `findKindReferencesInType`, but invoked lazily per-node instead of eagerly for all nodes.

2. **Property interpreters** — for each annotated node, evaluate declared properties against computed properties:
   - `computeNoImports(sf)` → does the source file have non-type-only imports?
   - Future: `computeNoMutation(node)`, `computeNoIO(node)`, etc.

3. **Equation checking** — compare declared (from kind definition) vs computed (from interpreter). Mismatches produce diagnostics.

The checker produces two things:
- **`KindSymbol[]`** — all resolved annotations (discovered during the check walk)
- **`KSDiagnostic[]`** — all violations + unresolved kind references

### KSProgram API

```
getKindDefinitions()  → from binder (eager, computed at program creation)
getKindSymbols()      → from checker (lazy, triggers annotation discovery)
getKindDiagnostics()  → from checker (lazy, triggers full check)
getKindChecker()      → the checker instance
```

The checker is created lazily. First call to `getKindSymbols()` or `getKindDiagnostics()` triggers the full check pass, which discovers annotations and evaluates properties in a single walk.

## What moves where

### Collector → Binder

- `tryExtractKindDefinition()` — moves to binder
- `extractPropertiesFromTypeLiteral()` — moves to binder (renamed from `extractRulesFromTypeLiteral`)
- `PROPERTY_KEYS` — moves to binder (renamed from `RULE_KEYS`)
- Kind definition discovery loop (Pass 1) — becomes the binder's main logic

### Collector → Checker

- `findKindReferencesInType()` — moves to checker as `resolveKindAnnotation()`
- Annotation pattern matching (Pass 2) — replaced by the checker's AST walk
- Import resolution via `ts.TypeChecker` — stays, used by `resolveKindAnnotation()`

### Deleted

- `collector.ts` — eliminated entirely
- `CollectorResult` type — eliminated
- `KindAnnotation` type — eliminated (was the intermediate between collector and binder; the checker goes directly from AST node → KindSymbol)
- `ksCollect()` export — removed from public API

## Types

### Modified

```ts
// Binder output (simplified — no more symbols, just definitions)
interface BinderResult {
  definitions: KindDefinition[];
  definitionsByName: Map<string, KindDefinition>;
}

// KindSymbol — now produced by checker, not binder
// KindSymbol.kind → KindSymbol.definition (rename)
interface KindSymbol {
  id: string;
  name: string;
  definition: KindDefinition;  // was: kind
  node: ts.Node;
  sourceFile: ts.SourceFile;
}

// KSChecker — now also provides symbols
interface KSChecker {
  getSymbols(): KindSymbol[];
  getDiagnostics(sourceFile?: ts.SourceFile): KSDiagnostic[];
}
```

### Renamed

```
RuleSet       → PropertySet
.rules        → .properties
RULE_KEYS     → PROPERTY_KEYS
KindSymbol.kind → KindSymbol.definition
```

### Deleted

```
CollectorResult
KindAnnotation
ksCollect()
```

## noImports: end-to-end

With the new pipeline, checking `noImports` works like this:

1. **Binder** finds `type NoImports = Kind<{ noImports: true }>`, registers it
2. **Checker** walks source files:
   - Encounters `const add: NoImports & ((a: number, b: number) => number) = ...`
   - Evaluates `resolveKindAnnotation(addDecl)` → finds `NoImports` in type annotation → resolves to the KindDefinition → creates a KindSymbol
   - Declared properties: `{ noImports: true }`
   - Evaluates `computeNoImports(sourceFile)` → checks for non-type-only import declarations → returns `true` (file only has `import type`)
   - Declared matches computed → no diagnostic
3. For a violation: file has `import { foo } from './bar'` → `computeNoImports` returns `false` → diagnostic produced

The `computeNoImports` function checks whether a source file has any non-type-only import declarations. `import type { X }` is fine. `import { X }` or `import './foo'` are violations.

## File changes summary

| File | Action |
|---|---|
| `src/pipeline/collector.ts` | **Delete** |
| `src/pipeline/binder.ts` | **Rewrite** — absorb definition discovery from collector |
| `src/pipeline/checker.ts` | **Create** — demand-driven annotation resolution + property evaluation |
| `src/pipeline/types.ts` | **Update** — remove CollectorResult/KindAnnotation, rename rules→properties, update KSChecker |
| `src/api/kinds.ts` | **Update** — RuleSet → PropertySet |
| `src/program.ts` | **Update** — remove collector import, use new binder + checker |
| `src/index.ts` | **Update** — remove collector exports, rename types |
| `src/dashboard/export.ts` | **Update** — rules → properties, remove scope, use KindSymbol.definition |
| `test/collector.test.ts` | **Rewrite** → `test/binder.test.ts` absorbs definition tests |
| `test/binder.test.ts` | **Rewrite** — tests binder (definitions only) + checker (annotations + diagnostics) |
| `test/checker.test.ts` | **Create** — noImports end-to-end tests |
| Fixture: `test/fixtures/kind-violations/` | **Create** — annotated values that violate noImports |
