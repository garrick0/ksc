# Three-Object Separation: Grammar, Semantics, interpret()

## Status: COMPLETE

All phases implemented. 173 tests passing (98 KSC + 75 AG library).

- Phase 1: Grammar stripped to pure structure
- Phase 2: Declaration + Equation types, compile() function
- Phase 3: Semantics object, interpret(semantics, root)
- Phase 4: KSC specs migrated to SpecInput format
- Phase 5: Skipped (no backward compatibility needed — not in production)
- Phase 6: Collection attributes deferred (stretch goal)

Old files deleted: `syn.ts`, `inh.ts`, `match.ts`, `circular.ts`, `evaluate.ts`

## Motivation

The AG library previously entangled three concerns:

1. **Structure** (functor) — how to traverse the tree
2. **Behavior** (algebra) — what to compute at each node
3. **Orchestration** (interpreter) — stamping, validation, ordering, evaluation

The `Grammar` object owned all three: it held `getChildren` (structure), and its
`evaluate()`/`evaluateAll()` methods fused validation, topological sorting, tree
stamping, attribute installation, and result projection into a single call.

Meanwhile, `AttributeDef` fused a second set of concerns — the equation (what to
compute), the flow direction (syn/inh/circular), the caching strategy (lazy vs
uncached), and dispatch (match on kind) — into a single opaque `install()` closure.

This plan separated both entanglements. The result is three objects with one job each,
and attribute definitions decomposed into declaration + equation + strategy.

## Architecture

```
Grammar<N>                          <- pure structure (the functor)
  getChildren: (node: N) => N[]

Semantics<N>                        <- merged, validated algebra (sealed)
  grammar: Grammar<N>
  specs: ordered spec list (topo-sorted)
  declarations: all attribute declarations (direction, caching, metadata)
  compiled: all compiled AttributeDefs (ready to install)
  order: string[] (valid evaluation order)

interpret(semantics, root) -> Map<string, unknown>    <- the evaluator
  1. stamps tree using semantics.grammar.getChildren
  2. applies compiled attributes per spec in topo order
  3. projects results
```

Each object has exactly one concern:

| Object | Concern | Algebraic role |
|---|---|---|
| `Grammar<N>` | Structure | Functor F — shape of recursion |
| `Semantics<N>` | Behavior | Merged F-algebra — validated, sorted, sealed |
| `interpret()` | Orchestration | Catamorphism/evaluator — folds algebra over structure |

## Files Created/Modified

### New files
- `libs/ag/src/decl.ts` — Declaration types (SynDecl, InhDecl, CircularDecl, ParamSynDecl, AttrDecl)
- `libs/ag/src/spec.ts` — User-facing SpecInput interface
- `libs/ag/src/compile.ts` — Single fusion point: declaration + equation -> AttributeDef
- `libs/ag/src/semantics.ts` — createSemantics: validates, topo-sorts, compiles, seals
- `libs/ag/src/interpret.ts` — interpret: stamps tree, applies attributes, projects

### Rewritten files
- `libs/ag/src/grammar.ts` — Stripped to pure `{ getChildren }` interface
- `libs/ag/src/analyze.ts` — Updated to accept `ReadonlyMap<string, AttributeDef>`
- `libs/ag/src/types.ts` — Removed AGSpec/AGDomain; kept StampedNode, AttributeDef
- `libs/ag/src/index.ts` — Updated exports for new architecture
- `src/pipeline/binder.ts` — Returns SpecInput with separate declarations + equations
- `src/pipeline/checker.ts` — Returns SpecInput with separate declarations + equations
- `src/program.ts` — Three-object flow: createGrammar -> createSemantics -> interpret

### Deleted files
- `libs/ag/src/syn.ts` — Absorbed into compile.ts
- `libs/ag/src/inh.ts` — Absorbed into compile.ts
- `libs/ag/src/match.ts` — Production equations handled by compile.ts
- `libs/ag/src/circular.ts` — Magnusson-Hedin algorithm moved into compile.ts
- `libs/ag/src/evaluate.ts` — Replaced by semantics.ts + interpret.ts

### Updated tests (all passing)
- All 8 AG library test files (`libs/ag/test/*.test.ts`)
- All 9 KSC test files (`test/*.test.ts`)

## The Compile Step

The critical function is `compile()` in `libs/ag/src/compile.ts`. It reads a
declaration + equation pair and produces an `AttributeDef`:

```ts
export function compile<N extends object>(
  name: string,
  decl: AttrDecl,
  eq: unknown,
): AttributeDef<N>
```

Strategy selection is derived from the declaration:

| Declaration | Strategy |
|---|---|
| `{ direction: 'syn' }` | Lazy cached getter |
| `{ direction: 'syn', uncached: true }` | Recompute every access |
| `{ direction: 'syn', discriminant: 'kind' }` | Production dispatch + lazy |
| `{ direction: 'inh', root: V }` | Lazy with $parent traversal |
| `{ direction: 'circular', bottom: V }` | Magnusson-Hedin fixed-point |
| `{ direction: 'paramSyn' }` | Map-based parameterized cache |

## SpecInput Format

Users write specs with separate declarations and equations:

```ts
export function createBinderSpec(): SpecInput<KSNode, KindDefinition[]> {
  return {
    name: 'ksc-binder',
    declarations: {
      kindDefs:  { direction: 'syn' },
      defEnv:    { direction: 'inh', root: (root) => buildDefMap(root) },
      defLookup: { direction: 'syn' },
    },
    equations: {
      kindDefs: { CompilationUnit: (cu) => { /* ... */ }, _: () => [] },
      defLookup: (node) => (name: string) => (node as any).defEnv.get(name),
    },
    project: (root) => { /* ... */ },
  };
}
```

## End-to-End Wiring

```ts
// Structure
const grammar = createGrammar<KSNode>(getChildren);

// Behavior (validates, sorts, compiles -- no tree needed yet)
const semantics = createSemantics(grammar, [
  createBinderSpec(),
  createCheckerSpec(),
]);

// Orchestration (stamps tree, installs attributes, projects results)
const results = interpret(semantics, ksTree.root);
```
