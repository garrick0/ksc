# Grammar Bounded Context

`libs/grammar` is the generic grammar engine. It defines the contracts and utilities
used by concrete language packages, but it does not own any concrete TS or mock
adapters.

## Responsibilities

- define `Grammar<K>` and `AstTranslatorPort`
- compute grammar metadata
- provide tree traversal and construction utilities
- serialize trees
- support the parse-only pipeline

## Structure

```text
domain/
  base-types.ts
  dep-graph-types.ts
  ports.ts
  schema-shapes.ts

application/
  metadata.ts
  parse-only.ts
  ports/
  serialize-tree.ts
  tree-ops.ts
```

## Concrete Implementations

Concrete language adapters now live outside this package:

- `@ksc/language-ts-ast`
- `@ksc/language-mock`

Those packages implement the grammar and translator contracts defined here.

## Key Ports

### `Grammar<K>`

Provides:

- field definitions
- the set of all kinds
- file container metadata
- sum-type membership metadata

### `AstTranslatorPort<Input, Root, Opts>`

Provides:

- `convert(input, opts)` returning `{ root }`

## Design Rule

Do not add concrete language adapters back into `libs/grammar`. New languages should
be created under `libs/languages/*` and import the generic contracts from here.
