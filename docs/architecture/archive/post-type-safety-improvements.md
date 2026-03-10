# Post-Type-Safety Improvements Plan

7 tasks following the type-safe kind references implementation.
Status legend: `[ ]` pending, `[~]` in progress, `[x]` done.

## Task 1: Tests for Exhaustive Switch Generation
**Status: [x]**

Add tests to `test/compile-analysis.test.ts` verifying that when `allKinds` is provided,
the generated evaluator contains exhaustive switches with `const _exhaustive: never` and
enumerates all kinds. Also test that without `allKinds`, the old `default:` pattern is used.

**Changes:**
- `test/compile-analysis.test.ts` — new `describe('exhaustive switch generation')` block

---

## Task 2: tsc Over Generated Code in CI
**Status: [x]**

Add a `typecheck` npm script that runs `tsc --noEmit` over the full project including
`generated/` and `specs/`. This makes the exhaustive switches an active safety net —
grammar drift becomes a CI failure, not a silent risk.

**Changes:**
- `tsconfig.json` — add `specs` to `include` array
- `package.json` — add `"typecheck": "tsc --noEmit"` script

---

## Task 3: Assembly Flattening (Extractor Simplification)
**Status: [x]**

The three-mode `FieldExtractorConfig` in `grammar/frontend/extractors.ts` (base + kindRules
+ autoDetectFields) adds abstraction for a single consumer. Flatten into a single
`Record<kind, Record<field, expression>>` computed directly in the spec's extractors.ts.
Delete `assembleFieldExtractors` and `FieldExtractorConfig`. The spec's `extractors.ts`
exports a pre-built `FIELD_EXTRACTORS` map.

**Changes:**
- `specs/ts-ast/frontend/extractors.ts` — compute flat map directly, export `FIELD_EXTRACTORS`
- `specs/ts-ast/grammar/spec.ts` — import `FIELD_EXTRACTORS` instead of `EXTRACTOR_CONFIG` + `assembleFieldExtractors`
- `grammar/frontend/extractors.ts` — delete file
- `grammar/index.ts` — remove `assembleFieldExtractors` and `FieldExtractorConfig` exports
- `test/field-extractors.test.ts` — update or remove tests for deleted assembly function

---

## Task 4: Production-Centric Equation Organization
**Status: [x]**

Reorganize `specs/ts-ast/kind-checking/equations.ts` to group equations by kind
(production-centric) and export per-kind objects. Update `spec.ts` to use
`pivotToAttrCentric` to reshape them into `AttrDecl.equations`/`parentEquations`.

**Changes:**
- `specs/ts-ast/kind-checking/equations.ts` — add per-kind equation objects + export them
- `specs/ts-ast/kind-checking/spec.ts` — import per-kind objects, use `pivotToAttrCentric`
- `analysis/pivot.ts` — extend to handle `parentEquations` pivot (currently only does `equations`)

---

## Task 5: Pivot for parentEquations
**Status: [ ]**

`pivotToAttrCentric` currently returns `{ attrName: { kind: fn } }` — this maps to
`SynAttr.equations`. But `InhAttr.parentEquations` uses the same shape. We need a way
to distinguish which attrs are syn (→ equations) and which are inh (→ parentEquations)
in the pivoted result. Add a `pivotToInhAttrCentric` variant or a direction parameter.

Actually, looking at spec.ts more carefully: `pivotToAttrCentric` result is just
`Record<attrName, Record<kind, Function>>`. The *consumer* (spec.ts) knows which attrs
are syn vs inh and puts the pivoted overrides into the right field. So no change needed
to pivot.ts — the spec just uses the result correctly.

This task is absorbed into Task 4.

---

## Task 6: Type-Level Regression Tests
**Status: [x]**

Add type-level tests proving that Layer 1 (IDE/tsc catches invalid kind refs) works.
Write `.ts` files with intentional errors (e.g., `equations: { Bogus: fn }` typed as
`Partial<Record<TSKind, Function>>`). These files should fail `tsc` — the test asserts
they do fail. Use vitest's ability to shell out to `tsc` and check exit code.

**Changes:**
- `test/type-safety.test.ts` — new test file with type-level regression tests

---

## Task 7: Kind-Specific Type Narrowing in Equations
**Status: [x]**

Equation functions currently manually cast `ctx.node as KSIdentifier` etc. With TSKind
available, explore generating typed equation wrappers where `ctx.node` is pre-narrowed
based on the equation's kind key. This eliminates manual casts in equations.ts.

**Approach:** Generate typed Ctx variants: `CtxFor<'Identifier'>` where `node: KSIdentifier`.
The generated evaluator calls `eq_fn(this as CtxFor<'Identifier'>)` instead of `eq_fn(this)`.
Equation functions declare `(ctx: CtxFor<'Identifier'>)` → `ctx.node` is already narrowed.

**Changes:**
- `analysis/ctx.ts` — add `CtxFor<K>` mapped type (extends Ctx with narrowed `node`)
- `analysis/compile.ts` — emit typed call expressions for per-kind equations
- `generated/ts-ast/grammar/node-types.ts` — already has `KindToNode` mapping
- `specs/ts-ast/kind-checking/equations.ts` — update equation signatures to use `CtxFor<K>`
- `test/compile-analysis.test.ts` — test typed equation call generation

---

## Execution Order

1. **Task 1** (tests) — immediate, verifies existing behavior
2. **Task 2** (tsc in CI) — immediate, activates safety net
3. **Task 3** (assembly flattening) — independent, simplification
4. **Task 4** (production-centric + pivot) — depends on nothing, spec-level restructure
5. **Task 6** (type-level regression) — depends on Task 2 for tsc setup
6. **Task 7** (kind-specific narrowing) — depends on Tasks 1-2 for safety net
