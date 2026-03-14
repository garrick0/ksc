# CLI Application

`apps/cli` is the runnable shell for KindScript. It owns command dispatch, CLI-only
formatting, and thin composition over the reusable `ksc` package APIs.

## Commands

```bash
ksc check
ksc check --json
ksc check --depth parse|bind|check
ksc check --config path/to/config.ts

ksc codegen

ksc init
```

Exit codes:

- `0` success
- `1` violations found
- `2` error

## Structure

```text
commands/
  check.ts
  codegen.ts
  init.ts

harness/
  args.ts
  dispatch.ts
  errors.ts
  format.ts

wiring/
  grammar/
    ts-ast.ts
    mock.ts
  codegen/
    targets.ts
```

## Responsibilities

- parse CLI arguments
- format output
- lazy-load command implementations
- compose CLI behavior over reusable package-owned APIs

## Codegen Wiring

`wiring/codegen/targets.ts` defines `CodegenTarget<K>` objects by pairing:

- a grammar from `libs/languages/*`
- an analysis declaration from `libs/analyses/*`
- an output folder inside that analysis package

## Runtime Wiring

The CLI does not assemble evaluator targets directly anymore. Reusable concrete
TS kind-checking program/project APIs live under `packages/ksc`, and the CLI
calls those package-owned entry points.

## Design Rule

Keep command handlers pure. Put environment-specific and package-specific wiring in
`apps/cli/wiring/*`.
