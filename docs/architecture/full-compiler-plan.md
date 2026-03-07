# Full Compiler Plan: Eliminate the Generic Interpreter

**Status: COMPLETE** — All phases implemented. 131 tests passing.

**Goal**: Transform the AG system from a _specialized interpreter_ (generated KSCDNode + runtime equation extraction) into a _true compiler_ (all evaluation logic statically wired at build time, no generic interpreter modules in production).

## What Changed

### Phase 1: Decouple Equation State (`nextDefId`) — DONE

**Problem**: `binder.ts` had `let nextDefId = 0` inside `createBinderSpec()`, captured by closure. This forced creating fresh spec objects per `evaluate()` call.

**Solution**: Introduced `DefIdCounter` interface (`{ value: number }`). `tryExtractKindDef` now takes a `counter: DefIdCounter` instead of `nextId: () => string`. All binder equations extracted to module-level standalone functions (`eq_kindDefs_CompilationUnit`, `eq_defEnv_root`, `eq_defLookup`, `project_binder`). `createBinderSpec()` still exists for tests — it creates a local counter and references the standalone functions.

**Files**: `ksc-behavior/binder.ts`

### Phase 2: Static Equation Wiring — DONE

**Problem**: The evaluator called `createBinderSpec()` + `createCheckerSpec()` per `evaluate()`, then extracted equations at runtime via `extractEquations()`.

**Solution**: All checker equations also extracted to module-level standalone functions (`eq_valueImports_CompilationUnit`, `eq_fileImports`, `eq_localBindings_ArrowFunction`, etc.). The evaluator now imports these directly:

```typescript
import { eq_kindDefs_CompilationUnit, eq_defEnv_root, ... } from '../ksc-behavior/binder.js';
import { eq_valueImports_CompilationUnit, eq_fileImports, ... } from '../ksc-behavior/checker.js';
```

Deleted: `KSCEquations` interface, `extractEquations()` function, `_eqs` field on KSCDNode.

**Files**: `ksc-behavior/checker.ts`, `ksc-generated/evaluator.ts`

### Phase 3: Direct Attribute Methods on KSCDNode — DONE

**Problem**: String-based `attr('kindDefs')` dispatch.

**Solution**: KSCDNode now has direct typed methods: `kindDefs()`, `defEnv()`, `defLookup()`, `valueImports()`, `fileImports()`, `localBindings()`, `enclosingLocals()`, `isReference()`, `kindAnnotations()`, `noImportsContext()`, `importViolation()`, `allViolations()`. The `attr()` method delegates to these via switch.

The equation functions in `ksc-behavior/` still use `ctx.attr('...')` which goes through the switch — this is necessary because `createBinderSpec()`/`createCheckerSpec()` must also work with the generic `DNode` (used by tests). The performance win is that KSCDNode's `attr()` uses a constant-time switch rather than a Map lookup.

**Decision**: We kept `Ctx = DNode<KSNode, KSCAttrMap>` as the equation type instead of `KSCDNode`. This avoids circular imports and ensures equations work with both the generic interpreter (tests) and the compiled evaluator (production). KSCDNode is passed as `any` where the type boundary exists.

**Files**: `ksc-generated/evaluator.ts`

### Phase 4: Static Dependency Graph — DONE

**Problem**: `getDepGraph()` fell back to generic `compile()` + `analyzeDeps()` at runtime.

**Solution**: Static `KSC_STATIC_DEP_GRAPH` constant with edges derived from source analysis of equation `attr()` calls:

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

Removed: imports of `compile`, `analyzeDeps`, `AttrComputed`, `createBinderSpec`, `createCheckerSpec` from the evaluator.

**Files**: `ksc-generated/evaluator.ts`

### Phase 5: Standalone KSCDNode — DONE

**Problem**: KSCDNode extended DNode, inheriting unused `_defs` Map, `_cache` Map, and `_computing` Set per node.

**Solution**: KSCDNode is now a standalone class — no inheritance. It has its own:
- Navigation fields: `node`, `parent`, `children`, `index`, `isRoot`, `prev`, `next`, `fieldName`
- Structural queries: `parentIs()`, `childAt()`, `childrenAt()`
- Typed cache: 12 `private _c_*` fields (one per attribute)
- Cycle detection: own `_cyc` Set
- String-based `attr()` + `hasAttr()` + `attrNames` for serialization compatibility

Zero dependency on `ag-interpreter/dnode.ts`.

**Files**: `ksc-generated/evaluator.ts`

### Phase 6: Cleanup — DONE

**Removed**:
- `registerAttributes()` from `ag-interpreter/dnode.ts` (dead code)
- `registerAttributes` from `ag-interpreter/index.ts` exports

**Kept** (for `grammar.test.ts` and generic AG engine):
- `ag-interpreter/`: `dnode.ts`, `compile.ts`, `grammar.ts`, `semantics.ts`, `interpret.ts`, `analyze.ts`
- `ag-behavior/`: `spec.ts`, `index.ts`
- `createBinderSpec()` / `createCheckerSpec()` in `ksc-behavior/` — used by tests

**Production import chain** (verified — zero ag-interpreter imports):
```
src/program.ts
  → ksc-interpreter/evaluate.ts (re-export)
    → ksc-generated/evaluator.ts
      → ksc-behavior/binder.ts (standalone equation functions + types)
      → ksc-behavior/checker.ts (standalone equation functions + types)
      → ast-schema/generated/index.ts (getChildFields, KSNode)
      → ksc-behavior/types.ts (KindDefinition, CheckerDiagnostic, etc.)
      → ksc-behavior/attr-types.ts (KSCAttrMap)
```

Note: `ksc-behavior/binder.ts` and `ksc-behavior/checker.ts` have `import type { DNode }` from `ag-interpreter/dnode.js` — this is a type-only import erased at runtime, used by the `Ctx` type alias that makes equations compatible with both KSCDNode and generic DNode.

### Exhaustive Schema (getChildFields) — DONE

**Problem**: The evaluator's tree builder had a fallback to `getChildren()` for nodes not in the schema's `C` map (nodes with no named child fields, like `CompilationUnit`).

**Solution**: Made the schema exhaustive — every kind has an entry in the `C` map:
- Kinds with child/optChild/list fields → their field names (unchanged)
- `CompilationUnit` → `['children']` (uses the generic `KSNodeBase.children` array as its child container)
- All other kinds (true leaves) → `[]` (no children)

The codegen script (`ast-schema/codegen.ts`) was updated. The evaluator's `buildKSCTree` no longer imports or references `getChildren`. `getChildren` itself was updated to return `[]` for leaf nodes instead of falling back to `node.children`.

**Files**: `ast-schema/codegen.ts`, `ast-schema/generated/schema.ts` (regenerated), `ksc-generated/evaluator.ts`

## End State

- **Zero runtime compilation**: No `compile()`, `createSemantics()`, `makeDispatch()`, or `extractEquations()` on the hot path
- **Zero Map overhead per node**: Typed cache fields replace `Map<string, unknown>`
- **Zero base class waste**: No DNode `_defs`/`_cache`/`_computing` allocated per node
- **Static dep graph**: Constant, not computed on demand
- **Exhaustive schema**: Every AST kind has a `getChildFields` entry — no `getChildren` fallback needed
- **Clean module boundary**: Production code only touches `ksc-generated/`, `ksc-behavior/`, `ast-schema/`
- **Generic AG engine preserved**: `ag-interpreter/` + `ag-behavior/` remain as library code, tested by `grammar.test.ts`, available for future AG development
- **`evaluate()` function**: 4 lines — create counter, build tree, project binder, project checker
