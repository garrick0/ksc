> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# De-fusion Implementation Plan: Separating Domain from Rules

## Problem

The current `AttributeDef` fuses domain declarations and semantic rules into opaque closures. This prevents:

1. **Collection attributes** - Silver-style `collection attribute errors :: [Error] with ++` needs the domain (combiner, initial) separate from distributed contribution rules
2. **Extensibility** - `match('kind', {...})` is sealed; can't add equations from another module
3. **Completeness checking** - Can't detect missing equations for productions you care about
4. **Static introspection** - Need `analyzeDeps()` (runtime execution) to discover attribute structure

The fusion is already a spectrum, not binary:
- `syn`: fully fused (direction + caching + equation)
- `inh`: partially separated (rootValue is domain, eq is rule)
- `circular`: more separated (bottom/equals are domain, compute is rule)

## Target API: AGSpec2

```ts
// ── Input 1: Domain declarations ──
interface SynDecl<V> {
  direction: 'syn';
  cached?: boolean;  // default true
}

interface InhDecl<V> {
  direction: 'inh';
  initial: V | ((root: any) => V);
}

interface CircularDecl<V> {
  direction: 'circular';
  bottom: V;
  equals?: (a: V, b: V) => boolean;
}

interface CollectionDecl<V> {
  direction: 'collection';
  initial: V;
  combine: (a: V, b: V) => V;
}

type AttrDecl = SynDecl | InhDecl | CircularDecl | CollectionDecl;

// ── Input 2: Semantic rules ──
type Equation<N, V> = (node: N) => V;
type InhEquation<N, V> = (parent: N, child: N, idx: number) => V | undefined;
type ProductionRules<N, V> = Record<string, Equation<N, V>> & { _?: Equation<N, V> };

// ── The two-input spec ──
interface AGSpec2<N extends object, R = unknown> {
  name: string;
  declarations: Record<string, AttrDecl>;
  equations: Record<string, Equation<N, any> | InhEquation<N, any> | ProductionRules<N, any>>;
  deps?: string[];
  project?: (root: N) => R;
}
```

## Phases

### Phase 1: AttrDecl types

Define `SynDecl`, `InhDecl`, `CircularDecl` interfaces. Add `declarations` + `equations` to `AGSpec2`. Keep old `AGSpecInput` working via adapter.

**Files:**
- New: `libs/ag/src/decl.ts` (declaration types)
- New: `libs/ag/src/spec2.ts` (AGSpec2 interface)
- Modify: `libs/ag/src/index.ts` (exports)

**Unlocks:** Static introspection of attribute structure without running code.

### Phase 2: Compile step

`grammar.compile(spec)` reads declarations + equations, validates completeness (every declared attr has equations for required productions), and produces an internal `AttributeMap`. Replace `evaluateAll`'s ad-hoc validation.

**Files:**
- New: `libs/ag/src/compile.ts` (compile step)
- Modify: `libs/ag/src/grammar.ts` (add compile method to Grammar)

**Unlocks:** Equation completeness checking at "compile time".

### Phase 3: Open equations

Production rules are a `Map` that can be extended after initial spec creation. `spec.addEquation('kindDefs', 'NewProd', fn)`. Compile step merges all contributions.

**Files:**
- Modify: `libs/ag/src/spec2.ts` (mutable equation registry)
- Modify: `libs/ag/src/compile.ts` (merge contributed equations)

**Unlocks:** Extensibility / aspect weaving without replacing entire match().

### Phase 4: Collection attributes

Add `CollectionDecl` with `initial` + `combine`. Contribution rules use `contribute()` instead of `eq()`. Compile step wires the combiner. Replace `allViolations` DFS with a proper collection attribute.

**Files:**
- New: `libs/ag/src/collection.ts` (collection attribute factory)
- Modify: `libs/ag/src/compile.ts` (wire combiner)

**Unlocks:** Silver-style distributed aggregation from any production.

### Phase 5: Migrate KSC specs

Convert `createBinderSpec()` and `createCheckerSpec()` to `AGSpec2`. Remove old fused factories or keep as convenience wrappers that produce `{ declaration, equation }` pairs.

**Files:**
- Modify: `src/pipeline/binder.ts`
- Modify: `src/pipeline/checker.ts`
- Modify: `src/program.ts`

**Unlocks:** Real-world validation of the new API.

## Migration strategy

Adapter, not big bang. Each phase keeps existing tests passing:
- Phase 1 adds new types alongside `AGSpecInput`
- Phase 2 adds a compile step that accepts either format
- Only Phase 5 migrates the actual KSC specs
- Old `syn()`/`inh()`/`match()` factories can be kept as convenience wrappers that produce `{ decl, eq }` pairs

## What the binder looks like after

```ts
const binderSpec: AGSpec2<KSNode> = {
  name: 'ksc-binder',

  // Input 1: DOMAIN
  declarations: {
    kindDefs:  { direction: 'syn' },
    defEnv:    { direction: 'inh', initial: (root) => buildMap(root) },
    defLookup: { direction: 'syn' },
  },

  // Input 2: RULES
  equations: {
    kindDefs: {
      CompilationUnit: (cu) => { /* extract defs */ },
      _: () => [],
    },
    defEnv: undefined,  // auto-propagate
    defLookup: (node) => (name) => node.defEnv.get(name),
  },
};
```

## Relationship to existing strategies

| Strategy | Status | Effect on de-fusion |
|----------|--------|-------------------|
| 7. Grammar Object | Done | Unchanged - Grammar still owns tree structure |
| 1. Validation | Done | Enhanced - `compile()` replaces ad-hoc validation with declaration-aware checks |
| 3. Type Safety | Done | Enhanced - `MatchEquations` can validate against declared productions |
| 5. Dep Analysis | Done | Enhanced - `analyzeDeps` can use declarations for static analysis before runtime |
