> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# Plan: Magnusson-Hedin Circular Attribute Evaluation

**Status: COMPLETE**

Upgrade `libs/ag/src/circular.ts` from per-attribute fixed-point iteration (Kiama-style) to the Magnusson-Hedin algorithm (JastAdd-style) with global cycle tracking.

## Implementation Summary

- **`libs/ag/src/circular.ts`**: Rewritten with `CycleEntry` tracking and global iteration loop. All circular attributes encountered during a cycle are registered in `cycleEntries` and re-evaluated together each iteration until global convergence. Length-snapshot technique handles late-discovered cycle members.
- **`libs/ag/test/circular.test.ts`**: 6 new tests added (inter-attribute, cross-node, three-way, mixed with syn, caching verification, liveness-style with custom equality). All 11 tests pass.
- **`libs/ag/DESIGN.md`**: Updated circular evaluation section to reflect Magnusson-Hedin algorithm.
- **No API changes**: `circular(init, compute, options?)` signature unchanged.
- **85/85 AG tests pass**, no regressions in root project tests (1 pre-existing serialize test failure unrelated to this change).

---

## 1. Current State

**File**: `libs/ag/src/circular.ts` (102 lines)

The current implementation uses module-level `inCircle`/`changed` flags and drives a `do...while(changed)` loop on a **single** attribute:

```typescript
// Module-level state
let inCircle = false;
let changed = false;

// Inside the getter:
if (inCircle) {
  return state[key].value;  // Return current approximation, don't participate
}

inCircle = true;
do {
  changed = false;
  const newValue = compute(node);          // Only THIS attribute's equation
  if (!equals(state[key].value, newValue)) {
    state[key].value = newValue;
    changed = true;
  }
} while (changed);
```

### What works

Single-attribute self-reference: an attribute whose equation references itself on the same node (e.g., `counter` that increments until cap). The driver re-evaluates its own equation each iteration and sees its own updated value.

### What breaks

**Inter-attribute circular dependencies** — attribute A on node X depends on attribute B on node Y, which depends back on A on node X:

1. A is accessed → becomes the driver, `inCircle = true`, `A.value = init_A`
2. A's equation accesses B on node Y
3. B sees `inCircle = true` → initializes to `init_B`, returns it, **never participates in the loop**
4. A's equation computes based on `init_B` (bottom), possibly converges
5. A stamps its final value. B is stuck at `init_B` forever.
6. Later access to B finds it already initialized with `ready: false` but `inCircle` is now false → B drives its OWN loop, but A is already cached as a frozen data property.

**Result**: premature convergence with incorrect values.

### What also breaks

**Cross-node same-attribute circular dependencies** — e.g., liveness analysis where `node.liveAfter` depends on `successor.liveAfter` across a CFG cycle. Same problem: only the first-accessed node's equation iterates.

---

## 2. Target: Magnusson-Hedin Algorithm

JastAdd's `circular` modifier uses the Magnusson-Hedin fixed-point algorithm (from "Circular Reference Attributed Grammars — their Evaluation and Applications", Magnusson & Hedin, 2007).

### Core idea

When a circular attribute triggers a fixed-point cycle, **all circular attributes encountered during that cycle** are tracked and re-evaluated together each iteration. The cycle converges when **no attribute in the entire cycle changes**.

### Algorithm

```
access circular attribute A on node X:
  if A.X is ready:
    return cached value

  if in_cycle:
    if A.X not yet initialized:
      A.X.value = bottom
      register (A, X) in cycle_entries
    return A.X.value                     // return current approximation

  // First circular access — become the cycle driver
  in_cycle = true
  A.X.value = bottom
  cycle_entries = [(A, X)]

  // Discovery + iteration: evaluate driver equation (discovers other cycle members)
  // Then iterate ALL members together
  do:
    changed = false
    for each (attr, node) in cycle_entries:
      new_value = attr.compute(node)     // may discover MORE cycle members
      if new_value != attr_state.value:
        attr_state.value = new_value
        changed = true
  while changed

  // All converged — cache as frozen data properties
  for each (attr, node) in cycle_entries:
    stamp data property on node
    mark ready

  in_cycle = false
  cycle_entries = []
  return A.X.value
```

### Key differences from current

| Aspect | Current (Kiama-style) | Target (Magnusson-Hedin) |
|---|---|---|
| Driver loop evaluates | Single attribute's equation | ALL cycle members' equations |
| Nested circular access | Returns approximation, never re-evaluated | Returns approximation AND registered in cycle |
| `changed` flag tracks | Single attribute | Any attribute in cycle |
| Post-convergence | Stamps single attribute | Stamps all cycle members |
| Inter-attribute cycles | Broken (premature convergence) | Correct (joint convergence) |
| Cross-node cycles | Broken | Correct |

### Monotonicity requirement

Same as current: the user must ensure compute functions are **monotone over a lattice of finite height**. Non-monotone functions may cause infinite loops. Neither JastAdd nor this library verifies monotonicity statically.

---

## 3. Implementation Plan

### 3.1 Add `CycleEntry` tracking type

```typescript
interface CycleEntry {
  node: any;
  key: string;
  compute: (node: any) => any;
  equals: (a: any, b: any) => boolean;
}
```

### 3.2 Replace module-level state

```typescript
// Before
let inCircle = false;
let changed = false;

// After
let inCycle = false;
let changed = false;
let cycleEntries: CycleEntry[] = [];
```

### 3.3 Rewrite the getter logic

The getter needs three paths:

1. **Ready** — return cached value (unchanged)
2. **In cycle, already initialized** — return current approximation (unchanged)
3. **In cycle, NOT initialized** — initialize to bottom, register in `cycleEntries`, return bottom (new)
4. **Not in cycle** — become driver, run Magnusson-Hedin loop (rewritten)

The driver loop:

```typescript
// Initialize driver
state[key] = { value: init, ready: false };
cycleEntries = [{ node, key, compute, equals }];
inCycle = true;

try {
  // Discovery pass: evaluate driver equation to find cycle members
  const firstValue = compute(node);
  if (!equals(state[key].value, firstValue)) {
    state[key].value = firstValue;
  }

  // Iterate all cycle members until global convergence
  do {
    changed = false;
    for (const entry of cycleEntries) {
      const entryState = (entry.node as any)[CIRC_STATE][entry.key];
      const newValue = entry.compute(entry.node);
      if (!entry.equals(entryState.value, newValue)) {
        entryState.value = newValue;
        changed = true;
      }
    }
  } while (changed);

  // Stamp all converged values
  for (const entry of cycleEntries) {
    const entryState = (entry.node as any)[CIRC_STATE][entry.key];
    entryState.ready = true;
    Object.defineProperty(entry.node, entry.key, {
      value: entryState.value,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  }

  return state[key].value;
} finally {
  inCycle = false;
  cycleEntries = [];
}
```

### 3.4 Handle growing cycle membership

During the `do...while` iteration loop, re-evaluating cycle members may discover NEW circular attributes (ones not accessed during the discovery pass). These get added to `cycleEntries` mid-iteration. This is correct — they'll be evaluated in the next iteration of the outer loop. The cycle only converges when ALL members (including late-discovered ones) stabilize.

One subtlety: we should NOT iterate over entries that were just added in the current pass (they were already evaluated when first accessed and returned bottom). Use an index-based loop or snapshot the length:

```typescript
do {
  changed = false;
  const len = cycleEntries.length;  // snapshot
  for (let i = 0; i < len; i++) {
    const entry = cycleEntries[i];
    // ... evaluate and check for change
  }
  // If new entries were added (len < cycleEntries.length),
  // changed should be true because their equations produced
  // bottom values that other equations depend on
  if (cycleEntries.length > len) changed = true;
} while (changed);
```

### 3.5 Edge case: discovery may trigger convergence

After the discovery pass, the driver should check whether any cycle entries changed. If none did and no new members appeared, the cycle is already converged. This is handled naturally by the `do...while` loop checking `changed` after the first full iteration.

---

## 4. API Changes

**None.** The public API stays identical:

```typescript
circular<N extends object, V>(
  init: V,
  compute: (node: N) => V,
  options?: { equals?: (a: V, b: V) => boolean },
): AttributeDef<N, V>
```

The change is purely in the internal evaluation algorithm. Existing code that uses `circular` for single-attribute self-reference will continue to work identically (the cycle has one member, iterated alone).

---

## 5. Test Plan

### 5.1 Existing tests (must still pass)

All 5 tests in `libs/ag/test/circular.test.ts`:
- `converges on a self-referencing attribute` — single-node counter
- `handles immediate convergence` — init is already fixed point
- `supports custom equality` — Set-based convergence
- `caches the result after convergence` — data property stamping
- `evaluates independently per node` — two separate trees

### 5.2 New tests to add

**Inter-attribute circular dependency** (the primary motivation):
```typescript
it('handles inter-attribute circular dependencies', () => {
  // Attribute A depends on B, B depends on A
  // Both should converge together
  const n = node('x');
  stampTree(n, (nd) => nd.kids);

  applyAttributes(n, {
    a: circular<Node, number>(0, (nd) => {
      const b = (nd as any).b;
      return b < 10 ? b + 1 : b;
    }),
    b: circular<Node, number>(0, (nd) => {
      const a = (nd as any).a;
      return a < 10 ? a + 1 : a;
    }),
  });

  expect((n as any).a).toBe(10);
  expect((n as any).b).toBe(10);
});
```

**Cross-node circular dependency**:
```typescript
it('handles cross-node circular dependencies', () => {
  // Parent depends on child's circular attr, child depends on parent's
  const child = node('child');
  const parent = node('parent', child);
  stampTree(parent, (nd) => nd.kids);

  applyAttributes(parent, {
    val: circular<Node, number>(0, (nd) => {
      if (nd.name === 'parent') {
        return Math.min((nd.kids[0] as any).val + 1, 5);
      }
      return Math.min(((nd as any).$parent as any).val + 1, 5);
    }),
  });

  expect((parent as any).val).toBe(5);
  expect((child as any).val).toBe(5);
});
```

**Liveness analysis** (classic motivating example):
```typescript
it('computes liveness analysis over a CFG cycle', () => {
  // Simplified: three nodes forming a cycle via successor pointers
  // liveAfter(n) = union of liveBefore(successor(n))
  // liveBefore(n) = (liveAfter(n) - def(n)) + use(n)
  // This requires all nodes to converge simultaneously
});
```

**Late-discovered cycle members**:
```typescript
it('handles cycle members discovered during iteration', () => {
  // A depends on B, B depends on C, but C is only accessed
  // after A's first evaluation changes B's value
});
```

**Mixed circular and non-circular**:
```typescript
it('circular attributes can depend on non-circular attributes', () => {
  // A non-circular syn attr feeding into a circular one
  // Should work fine — the non-circular attr caches on first access
});
```

### 5.3 Regression: evaluate.test.ts

The `'throws on circular dependencies'` test in evaluate.test.ts tests circular SPEC dependencies (topological sort), not circular attributes. Unaffected.

---

## 6. Files to Change

| File | Change |
|---|---|
| `libs/ag/src/circular.ts` | Rewrite getter logic with Magnusson-Hedin algorithm |
| `libs/ag/test/circular.test.ts` | Add inter-attribute and cross-node tests |
| `libs/ag/DESIGN.md` | Update "Circular Attributes" section |

No changes needed to: `types.ts`, `stamp.ts`, `apply.ts`, `syn.ts`, `index.ts`, or any consumer code.

---

## 7. Risks and Mitigations

### Risk: Infinite loops from non-monotone functions
**Mitigation**: Same as current — user responsibility. Could add an optional `maxIterations` safety valve (JastAdd has this too). Not in scope for this change but worth considering.

### Risk: Performance regression for single-attribute case
**Mitigation**: The `cycleEntries` array adds negligible overhead (one entry, one iteration per loop). The discovery pass is new work but replaces the first iteration of the old loop. Net impact: ~zero for single-attribute cases.

### Risk: Module-level state prevents concurrent evaluation
**Mitigation**: Same limitation as current. JavaScript is single-threaded so this is fine for synchronous evaluation. If async evaluation is ever needed, would need to move to a stack-based or context-object approach.

### Risk: Growing cycle entries during iteration
**Mitigation**: Snapshot the length before iterating; force another iteration if new entries appeared. This handles the case where re-evaluating A's equation discovers C for the first time.

---

## 8. JastAdd Implementation Reference

For reference, JastAdd's generated code for a circular attribute looks approximately like:

```java
// Generated by JastAdd for: syn Set<Variable> Stmt.liveAfter()
//   circular [new HashSet<>()] = computeLive();
public Set<Variable> liveAfter() {
  if (liveAfter_computed) return liveAfter_value;

  ASTState state = state();
  if (!state.IN_CIRCLE) {
    // We are the cycle driver
    state.IN_CIRCLE = true;
    liveAfter_value = new HashSet<>();  // bottom
    do {
      state.CHANGE = false;
      Set<Variable> new_value = computeLive();
      if (!new_value.equals(liveAfter_value)) {
        liveAfter_value = new_value;
        state.CHANGE = true;
      }
    } while (state.CHANGE);
    liveAfter_computed = true;
    state.IN_CIRCLE = false;
    return liveAfter_value;
  } else {
    // Inside a cycle — return current approximation
    if (!liveAfter_initialized) {
      liveAfter_value = new HashSet<>();
      liveAfter_initialized = true;
    }
    return liveAfter_value;
  }
}
```

The key insight we're adding: JastAdd's `state.CHANGE` flag is **shared across all circular attributes in the same ASTState**, so when attribute B changes inside A's loop iteration, `CHANGE` becomes true and A's loop continues. Our current `changed` module-level flag ALSO does this — but only the driver's equation is re-evaluated, so B's change is never picked up.

The fix: iterate ALL registered cycle entries each loop iteration, not just the driver.
