# Verification Attributes: Gaining Confidence in the AG System

## The Problem

KindScript's 8 kind-checking attributes compute results that are hard to manually verify:
- `kindDefs` extracts type aliases matching `Kind<{...}>` — correct? Did it miss any?
- `defEnv` inherits a map down the entire tree — does every node actually see the right environment?
- `contextFor(property)` propagates kind context through nested scopes — is copy-down working?
- `violationFor(property)` checks rules per node kind — are the 9 per-kind equation functions right?
- `allViolations` aggregates recursively — does it miss any subtree?

The existing test suite mostly verifies "the pipeline doesn't crash" and "some expected violations appear." The `nodeCount` collection attribute is the **only** attribute currently verified against an independent oracle (DFS count). That's one attribute out of eight.

The core question: **if an equation function silently returns the wrong value, would any test catch it?**

For most attributes, the answer is no.

## Verification Strategy: Dual-Computation Oracles

The strongest form of verification is: compute the same value two completely independent ways, then compare.

- **AG path**: attribute computed by the evaluator via dispatch + equations + caching
- **Oracle path**: same value computed by a simple DFS walk over the raw AST, with zero AG machinery

If both paths agree at every node in the tree (not just the root), we have high confidence that:
1. The evaluator engine dispatches correctly
2. Caching doesn't corrupt values
3. Inherited copy-down propagates faithfully
4. Per-kind equations return correct results
5. Parameterized attribute keying works

---

## Recommended Verification Attributes

### Tier 1 — High value, independently verifiable, tests core machinery

#### 1. `depth` (inherited)

**What it computes**: Distance from root. Root = 0, each child = parent + 1.

**Why it's valuable**: This is the simplest possible inherited attribute that actually
changes value as it propagates. It tests:
- Root value computation (depth = 0 at root)
- Copy-down with modification (parent equation: `parent.depth + 1`)
- Correct propagation to every node in the tree (not just leaf sampling)

**Oracle**: Trivial DFS walk tracking current depth.

**Verification test pattern**:
```typescript
it('depth matches at every node in the tree', () => {
  const { dnodeRoot } = buildAndEvaluate('kind-basic');

  const stack: Array<{ node: AGNode; expectedDepth: number }> = [
    { node: dnodeRoot, expectedDepth: 0 }
  ];
  let verified = 0;

  while (stack.length > 0) {
    const { node, expectedDepth } = stack.pop()!;
    expect(node.attr('depth')).toBe(expectedDepth);
    verified++;
    for (const child of node.children) {
      stack.push({ node: child, expectedDepth: expectedDepth + 1 });
    }
  }

  expect(verified).toBe(dnodeRoot.attr('nodeCount')); // every node checked
});
```

**What a failure would reveal**: Broken inherited propagation, wrong root value, or
copy-down not working — any of which would also affect `defEnv` and `contextFor`.

**Spec addition**: ~5 lines (root value 0, parent equation returning parent + 1).

---

#### 2. `height` (synthesized)

**What it computes**: Height of subtree. Leaf = 0, internal node = 1 + max(children heights).

**Why it's valuable**: This is the synthesized counterpart to `depth`. It tests:
- Synthesized default (0 for leaves)
- Child aggregation in synthesized equations (max over children + 1)
- Correct bottom-up computation at every node

**Oracle**: Post-order DFS computing height.

**Verification test pattern**:
```typescript
it('height matches at every node in the tree', () => {
  const { dnodeRoot } = buildAndEvaluate('kind-basic');

  function oracleHeight(node: AGNode): number {
    if (node.children.length === 0) return 0;
    return 1 + Math.max(...node.children.map(oracleHeight));
  }

  // Verify at every node
  const stack: AGNode[] = [dnodeRoot];
  while (stack.length > 0) {
    const node = stack.pop()!;
    expect(node.attr('height')).toBe(oracleHeight(node));
    stack.push(...node.children);
  }
});
```

**What a failure would reveal**: Broken synthesized child access, wrong default
equation, or caching corruption — any of which would also affect `kindDefs`,
`violationFor`, and `allViolations`.

**Spec addition**: ~5 lines (default 0, equation: 1 + max of children).

---

#### 3. `kindCount(kind)` (synthesized, parameterized)

**What it computes**: Count of descendant nodes (inclusive) with a given kind string.

**Why it's valuable**: This is the **most powerful single verification attribute** because
it exercises the most complex machinery:
- Parameterized synthesized dispatch (same mechanism as `violationFor`)
- Per-parameter caching (same mechanism as `contextFor` / `violationFor`)
- Can be verified for ALL 364 node kinds independently
- Oracle is trivial: DFS + filter

**Oracle**: For each kind K, count nodes where `node.kind === K` in subtree.

**Verification test pattern**:
```typescript
it('kindCount(k) matches DFS count for every kind in the grammar', () => {
  const { dnodeRoot } = buildAndEvaluate('kind-basic');

  // Build ground truth: DFS count per kind
  const kindCounts = new Map<string, number>();
  const stack: AGNode[] = [dnodeRoot];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const k = node.node.kind;
    kindCounts.set(k, (kindCounts.get(k) ?? 0) + 1);
    stack.push(...node.children);
  }

  // Verify root-level kindCount for every kind that appears
  for (const [kind, expected] of kindCounts) {
    expect(dnodeRoot.attr('kindCount', kind)).toBe(expected);
  }

  // Also verify at subtree level for several nodes
  // (verifies parameterized caching at non-root nodes)
});
```

**What a failure would reveal**: Broken parameterized dispatch, wrong caching key,
incorrect child aggregation — directly validates the same machinery that
`violationFor(property)` and `contextFor(property)` use.

**Spec addition**: ~8 lines (parameterized syn, default = self-match ? 1 : 0, equation
sums children).

---

#### 4. `ancestorKinds` (inherited, accumulating)

**What it computes**: Ordered list of node kinds from root down to (but not including)
the current node.

**Why it's valuable**: Unlike `defEnv` (which copies down unchanged), this attribute
**modifies on each propagation step**. It tests:
- Inherited parent equations that append to a value (not just pass-through)
- That parent equations receive the correct parent context
- The interaction between copy-down and modification

This is critical because `contextFor` uses the same parent-equation mechanism.
If `ancestorKinds` accumulates correctly, the parent-equation dispatch is working.

**Oracle**: Walk the parent chain from any node up to root, collect kinds.

**Verification test pattern**:
```typescript
it('ancestorKinds matches parent chain walk at every node', () => {
  const { dnodeRoot } = buildAndEvaluate('kind-basic');

  function oracleAncestors(node: AGNode): string[] {
    const ancestors: string[] = [];
    let cur = node.parent;
    while (cur) {
      ancestors.unshift(cur.node.kind);
      cur = cur.parent;
    }
    return ancestors;
  }

  const stack: AGNode[] = [dnodeRoot];
  while (stack.length > 0) {
    const node = stack.pop()!;
    expect(node.attr('ancestorKinds')).toEqual(oracleAncestors(node));
    stack.push(...node.children);
  }
});
```

**What a failure would reveal**: Broken parent equation value passing, incorrect
context in inherited computation — would directly implicate `contextFor` bugs.

**Spec addition**: ~8 lines (root value `[]`, parent equation appends parent's kind).

---

### Tier 2 — Cross-validates existing attributes

#### 5. `allViolations` exhaustive cross-check (no new attribute needed)

**What it verifies**: That `allViolations` at any node equals the union of all
`violationFor(property)` values at that node and all descendants.

**Why it's valuable**: `allViolations` is the **projection endpoint** — it's what users
see. If the recursive gather misses a subtree, violations silently disappear.
This test doesn't require a new attribute, just a new test pattern.

**Oracle**: Walk every node, call `violationFor(p)` for each property, collect non-nulls.

**Verification test pattern**:
```typescript
it('allViolations equals exhaustive violationFor scan', () => {
  const { dnodeRoot } = buildAndEvaluate('kind-violations');

  // Oracle: manually gather all violations via DFS
  const oracleViolations: Diagnostic[] = [];
  const stack: AGNode[] = [dnodeRoot];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const prop of PROPERTY_KEYS) {
      const v = node.attr('violationFor', prop);
      if (v) oracleViolations.push(v);
    }
    stack.push(...node.children);
  }

  const agViolations = dnodeRoot.attr('allViolations');

  // Same count
  expect(agViolations.length).toBe(oracleViolations.length);

  // Same set of (fileName, pos, property) triples
  const toKey = (d: Diagnostic) => `${d.fileName}:${d.pos}:${d.property}`;
  expect(new Set(agViolations.map(toKey)))
    .toEqual(new Set(oracleViolations.map(toKey)));
});
```

**What a failure would reveal**: `allViolations` equation skipping a subtree,
missing a property in its PROPERTY_KEYS loop, or double-counting.

---

#### 6. `defEnv` identity cross-check (no new attribute needed)

**What it verifies**: That every node in the tree sees the exact same `defEnv` Map
(same reference, since it's pure copy-down with no overrides).

**Why it's valuable**: `defEnv` is inherited with NO parent override equations — it
should be the same object everywhere due to caching. If any node sees a different
`defEnv`, copy-down or caching is broken.

**Verification test pattern**:
```typescript
it('defEnv is the same Map reference at every node', () => {
  const { dnodeRoot } = buildAndEvaluate('kind-basic');
  const rootEnv = dnodeRoot.attr('defEnv');

  const stack: AGNode[] = [...dnodeRoot.children];
  while (stack.length > 0) {
    const node = stack.pop()!;
    expect(node.attr('defEnv')).toBe(rootEnv); // Same reference
    stack.push(...node.children);
  }
});
```

---

#### 7. `leafCount` (collection)

**What it computes**: Number of leaf nodes (no children) in subtree.

**Why it's valuable**: Tests collection attributes with **conditional contribution**.
Unlike `nodeCount` (init = 1 always), `leafCount` contributes 1 only if the node is
a leaf. This exercises the collection `init` expression in a data-dependent way.

**Oracle**: DFS counting nodes with zero children.

**Spec addition**: ~4 lines (collection, init = `children.length === 0 ? 1 : 0`,
combine = sum).

---

### Tier 3 — Domain-level cross-validation

#### 8. `kindDefCount` — Independent kind definition extraction

**What it computes**: A synthesized attribute counting Kind definitions, BUT the
verification oracle doesn't use the AG system at all — it scans source text with a
regex or independent parser.

**Why it's valuable**: Cross-validates `kindDefs` against a completely independent
extraction method. If the AG system says "3 Kind definitions" but regex finds 4,
something is wrong in the equation, the AST translator, or both.

**Oracle**: For each fixture file, count occurrences of `type \w+ = Kind<` via
regex over raw source text.

**Verification test pattern**:
```typescript
it('kindDefs count matches regex extraction from source', () => {
  const fixtureDir = 'kind-basic';
  const { dnodeRoot } = buildAndEvaluate(fixtureDir);

  // AG path
  const agCount = dnodeRoot.children.reduce(
    (sum, cu) => sum + cu.attr('kindDefs').length, 0
  );

  // Oracle path: read raw source files, count Kind patterns
  const files = getRootFiles(fixtureDir);
  let regexCount = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf-8');
    const matches = src.match(/type\s+\w+\s*=\s*Kind\s*</g);
    regexCount += matches?.length ?? 0;
  }

  expect(agCount).toBe(regexCount);
});
```

**What a failure would reveal**: `tryExtractKindDef()` rejecting valid Kind patterns,
AST translator dropping TypeAliasDeclaration nodes, or `eq_kindDefs_CompilationUnit`
skipping valid children.

---

## Implementation Recommendation

### Phase 1: Quick wins (no new attributes needed)

Add these test patterns to `test/integration/kind-checking.test.ts`:

1. **nodeCount at every node** — extend existing test from root-only to full-tree DFS
2. **allViolations exhaustive cross-check** (Tier 2, #5 above)
3. **defEnv identity check** (Tier 2, #6 above)
4. **kindDefCount regex cross-check** (Tier 3, #8 above)

These require zero spec changes and can be implemented immediately. They will
either pass (increasing confidence) or fail (revealing real bugs).

**Estimated effort**: ~100 lines of test code. No production changes.

### Phase 2: Structural verification attributes

Add to the mock analysis spec first (for fast iteration), then to ts-kind-checking:

1. **`depth`** (inherited) — verifies inherited propagation
2. **`height`** (synthesized) — verifies synthesized aggregation
3. **`ancestorKinds`** (inherited, accumulating) — verifies parent equation modification

Each attribute gets:
- Spec declaration (~5-8 lines in spec.ts)
- Equation function (~3-5 lines in equations/)
- Verification test comparing AG value to oracle at **every node in the tree**

**Estimated effort**: ~200 lines (spec + equations + tests). Requires codegen run.

### Phase 3: Parameterized verification

1. **`kindCount(kind)`** (synthesized, parameterized) — verifies parameterized dispatch

This is the crown jewel: a single attribute that can verify correctness across all 364
node kinds with a trivial oracle. If this works, the same parameterized machinery
powering `contextFor` and `violationFor` is validated.

**Estimated effort**: ~80 lines (spec + equation + comprehensive test).

---

## What Each Phase Validates

| Mechanism | Phase 1 | Phase 2 | Phase 3 |
|-----------|---------|---------|---------|
| Synthesized dispatch | nodeCount (root→full tree) | height | kindCount |
| Inherited root value | defEnv identity | depth | — |
| Inherited copy-down | defEnv identity | depth | — |
| Inherited parent equation | — | ancestorKinds | — |
| Collection fold | nodeCount full-tree | leafCount | — |
| Parameterized caching | — | — | kindCount |
| Parameterized dispatch | — | — | kindCount |
| Recursive aggregation | allViolations cross-check | — | — |
| Equation correctness (domain) | kindDefCount regex | — | — |
| Caching correctness | defEnv reference check | all (every-node verification) | kindCount |

### Coverage after all 3 phases

Every major evaluator mechanism is verified by at least one oracle-backed test that
checks correctness at **every node in the tree**, not just spot-checks at the root.

The key insight: if `depth`, `height`, `ancestorKinds`, and `kindCount(kind)` all
match their oracles at every node across multiple fixtures, then the evaluator engine
(dispatch, caching, inherited propagation, synthesized aggregation, parameterized
keying) is working correctly. Any bug in these mechanisms would cause at least one
verification attribute to disagree with its oracle.

That means the remaining question is only "are the domain-specific equations correct?"
— which is a much smaller and more tractable surface to audit.

---

## Alternative: Property-Based / Invariant Testing

Instead of (or in addition to) new attributes, we could add **invariant assertions**
that must hold for any valid AG evaluation:

1. **`nodeCount >= 1`** at every node
2. **`nodeCount == 1 + sum(child.nodeCount)`** at every node
3. **`allViolations.length >= sum(child.allViolations.length)`** at every non-leaf
4. **`contextFor(p) != null` implies `parent.contextFor(p) != null` OR `parent.kind == 'VariableDeclaration'`**
5. **Every Diagnostic in allViolations has a valid `fileName`, `pos`, `property`, `kindName`**
6. **`defLookup(name) !== undefined` implies `defEnv.has(name)`**
7. **Every `KindDefinition.name` in `defEnv` came from some compilation unit's `kindDefs`**

These don't require new attributes but provide structural correctness guarantees.
They can be checked as post-conditions after every `buildAndEvaluate()` call via
a shared assertion helper.

---

## Summary

| Approach | Confidence Gain | Effort | Catches |
|----------|----------------|--------|---------|
| Phase 1 (cross-check tests only) | Medium | Low (~100 LOC) | Aggregation bugs, copy-down bugs, missing violations |
| Phase 2 (structural attrs) | High | Medium (~200 LOC) | Engine bugs in inh/syn dispatch, caching, propagation |
| Phase 3 (parameterized attr) | Very High | Medium (~80 LOC) | Parameterized dispatch/caching bugs |
| Invariant assertions | Medium | Low (~50 LOC) | Structural contract violations |

**Recommendation**: Do Phase 1 first (zero risk, immediate signal). If all tests pass,
the system is likely correct for the paths exercised by fixtures. Then Phase 2 + 3 to
get full-tree, every-node verification coverage across all evaluator mechanisms.

The combination of Phases 1-3 would mean: every evaluator mechanism is independently
verified by an oracle, at every node, across multiple fixtures. That's as close to
"proven correct" as you can get without formal verification.
