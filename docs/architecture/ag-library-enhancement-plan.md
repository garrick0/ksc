> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# AG Library Enhancement Plan: Bridging the Library-Generator Gap

## Goal

Close ~80% of the gap between KSC's runtime AG library and JastAdd's code
generator by applying three strategies from the prior-art research:

- **Strategy 7** - Shared grammar object (extract `children` from AGSpec)
- **Strategy 1** - Registration phase with validation (`.seal()`)
- **Strategy 3** - Type-level completeness checking (TS `satisfies`)
- **Strategy 5** - Proxy-based dependency analysis (`analyzeDeps()`)

## Current State

100 tests passing. Core files:

- `libs/ag/src/grammar.ts` - Grammar object + `createGrammar()` + `AGSpecInput`
- `libs/ag/src/analyze.ts` - Runtime dependency analysis via prototype-chained clones
- `libs/ag/src/index.ts` - Exports (updated)
- `src/pipeline/binder.ts` - Binder spec (uses `AGSpecInput`)
- `src/pipeline/checker.ts` - Checker spec (uses `AGSpecInput`)
- `src/program.ts` - Orchestrator (uses `Grammar`)
- `test/grammar.test.ts` - Tests for grammar, validation, and dep analysis

---

## Phase 1: Shared Grammar Object (Strategy 7)

**Status: COMPLETE**

Created `Grammar<N>` object that owns the tree structure. Specs use `AGSpecInput`
(no `children` field). `grammar.evaluate()` and `grammar.evaluateAll()` are the
preferred API. Old `evaluate(spec, root)` still works for backward compat.

Key files: `libs/ag/src/grammar.ts`, updated binder/checker/program.

---

## Phase 2: Registration + Validation (Strategy 1)

**Status: COMPLETE**

`grammar.evaluateAll()` now validates:
- Duplicate attribute names across specs → throws
- Unknown dependencies → throws
- Circular spec dependencies → throws

Tests in `test/grammar.test.ts` (Grammar — validation suite).

---

## Phase 3: Type-Level Completeness (Strategy 3)

**Status: COMPLETE**

Enhanced `match()` signature with `MatchEquations<N, V>` mapped type.
Purely type-level change — zero runtime cost.

What it provides:
- **Key validation**: Equation keys are checked against `N`'s discriminant union
  values. Typos like `ComipilationUnit` are caught at compile time.
- **Type narrowing**: Each equation callback receives the narrowed union member
  (e.g., `CompilationUnit: (cu) => ...` narrows `cu` to `KSCompilationUnit`).
- **Graceful degradation**: When `N` has no `kind` field, the mapped type
  becomes `{}` and only `_` matters — equivalent to pre-enhancement behavior.

---

## Phase 4: Runtime Dependency Analysis (Strategy 5)

**Status: COMPLETE**

`analyzeDeps(getChildren, specs, sampleRoot)` discovers cross-attribute
dependencies at runtime using prototype-chained clones with tracking getters.

Key design decisions:
- **Prototype clones** (`Object.create(node)`) instead of Proxy — `installLazy`
  closures capture the real node, making Proxies ineffective. Clones avoid
  mutating original nodes while allowing `installLazy`'s `configurable: false`
  caching on the ephemeral clone.
- **Tracking getters return `undefined`** — we only need to know which attributes
  are read, not their values. This avoids triggering any real computation in
  non-target attributes.
- **Parent clones** for inherited attributes — `inh` attributes read from
  `$parent`, so we create a parent clone with tracking getters too.

Returns: `{ deps: DepGraph, order: string[], cycles: string[][] }`

Tests: synthetic dep discovery, cycle detection, real KSC binder+checker analysis
(12 attributes, correct evaluation order, no cycles).

---

## Test Plan

- All 90 original tests pass (backward compat confirmed)
- 10 new tests in `test/grammar.test.ts`:
  - Grammar evaluation (3 tests)
  - Validation: duplicates, cycles, unknown deps (3 tests)
  - Backward compat: toAGSpec (1 test)
  - Dep analysis: synthetic, cycles, real KSC (3 tests)
- **100 tests total, all passing.**

---

## Progress Log

- [x] Phase 1: Shared Grammar Object — DONE
- [x] Phase 2: Registration + Validation — DONE
- [x] Phase 3: Type-Level Completeness — DONE
- [x] Phase 4: Runtime Dependency Analysis — DONE

**All 4 phases complete. 100 tests passing.**

### Implementation Notes

**Phase 4 required two iterations** due to `installLazy`'s `configurable: false`
caching. The first approach (save/restore descriptors on original nodes) failed
because:
1. `installLazy` replaces its configurable getter with a non-configurable data
   property on first access
2. Subsequent analysis iterations couldn't override the cached property to
   install tracking getters
3. Cleanup couldn't delete non-configurable properties

The solution: **prototype-chained clones** (`Object.create(node)`). Each
per-attribute analysis run creates ephemeral clones. `Object.defineProperty`
calls land on the clone, not the original. Property reads that aren't overridden
(kind, $children, $parent) fall through via prototype chain. No cleanup needed.
