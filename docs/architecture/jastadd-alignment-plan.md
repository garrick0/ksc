> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# Plan: Align @ksc/ag to JastAdd Nomenclature

**Status: COMPLETE**

Remove non-JastAdd primitives (`lookup`, `chain`, `coll`) and replace their usages with the JastAdd pattern: composable `syn` + `inh` + `match` for name resolution and aggregation. This aligns @ksc/ag's API surface to JastAdd's core primitives only.

## 1. What to Remove

### 1.1 `lookup()` — not a JastAdd concept

**Files:**
- `libs/ag/src/lookup.ts` — delete
- `libs/ag/test/lookup.test.ts` — delete
- `libs/ag/src/index.ts` — remove export

**Consumer:** `src/pipeline/binder.ts` — uses `lookup()` for `defLookup` attribute. Replace with the JastAdd pattern: `inh` to propagate a global definition map, `syn` to provide a lookup function.

### 1.2 `chain()` — Kiama concept, not JastAdd

**Files:**
- `libs/ag/src/chain.ts` — delete
- `libs/ag/test/chain.test.ts` — delete
- `libs/ag/src/index.ts` — remove export

**Consumers:** None in production code. Only used in its own test file.

### 1.3 `coll()` — semantics don't match JastAdd

Our `coll()` is a subtree DFS fold (every node gets its own collected value). JastAdd's `coll` is directed contributions via `contributes...to...for` — fundamentally different semantics under the same name. Remove to avoid misleading nomenclature.

**Files:**
- `libs/ag/src/coll.ts` — delete
- `libs/ag/test/coll.test.ts` — delete
- `libs/ag/src/index.ts` — remove export

**Consumers:**
1. `src/pipeline/checker.ts` — uses `coll` for `allViolations` (aggregates diagnostics from subtree). Replace with `syn` + DFS walk (which is what `coll` already does internally).
2. `libs/ag/test/evaluate.test.ts` — uses `coll` in one test case. Replace with `syn` + DFS.

## 2. What to Keep (Already JastAdd-aligned)

| Primitive | JastAdd Equivalent | Status |
|---|---|---|
| `syn` | `syn T A.x()` | Keep |
| `uncached` | `uncache A.x()` modifier | Keep |
| `paramSyn` | `syn T A.x(P param)` | Keep |
| `inh` | `inh T A.x()` + `eq Parent.getChild().x()` | Keep |
| `circular` | `syn T A.x() circular [init]` | Keep (Magnusson-Hedin) |
| `match` | Per-production equations (implicit in .jrag) | Keep |
| `stampTree` | Tree construction (JastAdd does this via generated code) | Keep |
| `applyAttributes` | Attribute installation (JastAdd does this via generated code) | Keep |
| `evaluate` / `evaluateAll` | Orchestration | Keep |

## 3. Binder Migration: JastAdd Pattern for Name Resolution

Replace `lookup()` in `binder.ts` with the JastAdd scoped env pattern:

### Current (using lookup):
```typescript
const defLookup = lookup<KSNode, string, KindDefinition>((node) => {
  if (node.kind !== 'CompilationUnit') return [];
  const defs: KindDefinition[] = (node as any).kindDefs;
  return defs.map((d) => [d.name, d] as [string, KindDefinition]);
});
// attributes: { kindDefs, defLookup }
```

### Target (JastAdd pattern: syn + inh):
```typescript
// Step 1: kindDefs stays as-is (match — collects defs per CompilationUnit)
// Already a syn via match.

// Step 2: defEnv — inh attribute propagating definition map to all nodes
// Root computes the global map from all CompilationUnit kindDefs.
// All descendants inherit it unchanged.
const defEnv = inh<KSNode, Map<string, KindDefinition>>(
  (root) => {
    const map = new Map<string, KindDefinition>();
    for (const cu of (root as any).$children ?? []) {
      for (const def of (cu as any).kindDefs ?? []) {
        map.set(def.name, def);
      }
    }
    return map;
  },
  // No eq function — auto-propagate to all descendants
);

// Step 3: defLookup — syn providing a lookup function from the inherited env
const defLookup = syn<KSNode, (name: string) => KindDefinition | undefined>(
  (node) => {
    const env: Map<string, KindDefinition> = (node as any).defEnv;
    return (name: string) => env.get(name);
  },
);
// attributes: { kindDefs, defEnv, defLookup }
```

This introduces one new attribute (`defEnv`) and keeps `defLookup` with the same external interface (a function `(name) => def | undefined`), so the checker's usage of `defLookup` is unchanged.

## 4. Checker Migration: Replace `coll` with `syn` + DFS

Replace the `allViolations` coll attribute with a syn that does the same DFS walk:

### Current:
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

### Target:
```typescript
const allViolations = syn<KSNode, CheckerDiagnostic[]>((node) => {
  const results: CheckerDiagnostic[] = [];
  const stack: KSNode[] = [node];
  while (stack.length > 0) {
    const n = stack.pop()!;
    const v: CheckerDiagnostic | null = (n as any).importViolation;
    if (v) results.push(v);
    const kids: KSNode[] = (n as any).$children ?? [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return results;
});
```

Same semantics. `coll` was just a `syn` wrapper doing this DFS internally.

## 5. Evaluate Test Migration

Replace the `coll` test in `evaluate.test.ts` with a `syn` + DFS equivalent:

```typescript
// Replace coll import with syn
import { syn } from '../src/syn.js';

// Replace coll usage:
sum: syn<TNode, number>((node) => {
  let total = 0;
  const stack: TNode[] = [node];
  while (stack.length > 0) {
    const n = stack.pop()!;
    total += n.value;
    stack.push(...((n as any).$children ?? []));
  }
  return total;
}),
```

## 6. DESIGN.md Update

Update `libs/ag/DESIGN.md` to:
- Remove `chain` from API section, file structure, and roadmap
- Remove `coll` from API section, file structure, and roadmap
- Remove `lookup` from API section, file structure, and roadmap
- Add a "Name Resolution Pattern" section showing the JastAdd inh+syn pattern
- Note why these were removed (JastAdd alignment)

## 7. Implementation Order

1. Write plan document (this file)
2. Migrate binder: replace `lookup` with `inh` + `syn` pattern
3. Migrate checker: replace `coll` with `syn` + DFS
4. Migrate evaluate.test.ts: replace `coll` with `syn` + DFS
5. Delete `lookup.ts`, `chain.ts`, `coll.ts` and their tests
6. Update `index.ts` exports
7. Update `DESIGN.md`
8. Run all tests to verify
9. Update this plan with completion status

## 8. Risk Assessment

**Low risk.** All three removed primitives are thin wrappers:
- `lookup` = `syn` + walk-to-root + DFS + Map
- `coll` = `syn` + DFS fold
- `chain` = two `installLazy` calls with sibling/parent cross-references

The replacements are more explicit (users see the DFS walk) but functionally identical. No behavioral changes for any consumer.

**Test coverage:**
- Binder tests (`test/binder.test.ts`) — 12 tests verify defLookup behavior, will validate migration
- Checker tests (`test/checker.test.ts`) — 14 tests verify allViolations and individual attributes
- AG evaluate tests (`libs/ag/test/evaluate.test.ts`) — collection test case migrated
- No chain consumers exist outside its own test

---

## Implementation Summary

- `src/pipeline/binder.ts`: Replaced `lookup()` with `inh` (`defEnv`) + `syn` (`defLookup`). New `defEnv` inherited attribute propagates a `Map<string, KindDefinition>` from root to all descendants. `defLookup` is a syn attribute that returns a lookup function from the inherited env. Same external interface — checker's usage of `defLookup` unchanged.
- `src/pipeline/checker.ts`: Replaced `coll` for `allViolations` with `syn` + explicit DFS walk. Identical semantics.
- `libs/ag/test/evaluate.test.ts`: Replaced `coll` test case with `syn` + DFS.
- Deleted: `libs/ag/src/lookup.ts`, `libs/ag/src/chain.ts`, `libs/ag/src/coll.ts` and their test files.
- `libs/ag/src/index.ts`: Removed exports for `chain`, `coll`, `lookup`.
- `libs/ag/DESIGN.md`: Complete rewrite — removed all non-JastAdd concepts, added Name Resolution Pattern section, updated file structure and design principles.
- **72/72 AG library tests pass, 84/84 non-serialize root tests pass.** 6 serialize test failures are pre-existing (documented in prior work).

## Progress Log

- [x] Step 1: Plan document written
- [x] Step 2: Binder migration (lookup -> inh + syn)
- [x] Step 3: Checker migration (coll -> syn + DFS)
- [x] Step 4: Evaluate test migration (coll -> syn + DFS)
- [x] Step 5: Delete removed files (lookup.ts, chain.ts, coll.ts + tests)
- [x] Step 6: Update index.ts exports
- [x] Step 7: Update DESIGN.md
- [x] Step 8: All tests pass (84/84 non-serialize, 72/72 AG)
