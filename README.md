# KindScript

**Architectural enforcement for TypeScript through the type system.**

KindScript checks TypeScript codebases against architectural rules declared as
phantom types. You annotate code with `Kind<{...}>` types that declare properties
like `noIO`, `noMutation`, or `noImports`. KindScript walks your source files and
reports violations as diagnostics.

## How It Works

### Declare kinds in your source code

```typescript
import type { Kind, PropertySet } from 'ksc';

type Pure = Kind<{ noIO: true; noMutation: true }>;

const handler: Pure = createHandler();
```

KindScript finds these `Kind<{...}>` type definitions, extracts the declared
properties, and checks that annotated code satisfies them.

### Check your project

```bash
ksc check
ksc check --config ksc.config.ts
ksc check --json
ksc check --depth parse|bind|check

ksc init
ksc codegen
```

Exit codes:

- `0` no violations
- `1` violations found
- `2` error

## Configuration

```typescript
import { defineConfig } from 'ksc';

export default defineConfig({
  analysisDepth: 'check',
});
```

## Programmatic API

```typescript
import { createProgram } from 'ksc/ts-kind-checking';
import { defineConfig } from 'ksc';

const config = defineConfig({ analysisDepth: 'check' });
const program = createProgram(rootFiles, config, { strict: true, noEmit: true });

const defs = program.getKindDefinitions();
const diags = program.getDiagnostics();
console.log(`${defs.length} kinds, ${diags.length} violations`);
```

## Package Exports

| Import path | What it exports |
|---|---|
| `ksc` | Lightweight source/config helpers |
| `ksc/ts-kind-checking` | Source-backed TS kind-checking programmatic API |

## Architecture

The `ksc` repo now lives under the shared `~/dev/ksc-ecosystem/` workspace and is
organized around generic engines plus concrete plugin packages.

```text
libs/
  grammar/             Generic grammar engine
  behavior/            Generic behavior engine
  evaluation/          Generic evaluator engine
  ag-ports/            Shared runtime contracts
  languages/*          Concrete language adapters
  analyses/*           Concrete analyses

apps/
  cli/                 Composition roots and command shell
packages/
  ksc/                 Public `ksc` package surface
```

Current concrete packages include:

- `@ksc/language-ts-ast`
- `@ksc/language-mock`
- `@ksc/analysis-ts-kind-checking`
- `@ksc/analysis-eslint-equiv`
- `@ksc/analysis-mock`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system overview and
[AGENTS.md](AGENTS.md) for the developer guide.

## Architecture Decisions

Key decisions are recorded in [docs/adr/](docs/adr/).

## Documentation

Committed architecture docs:

- [README.md](README.md)
- [AGENTS.md](AGENTS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [libs/grammar/README.md](libs/grammar/README.md)
- [libs/behavior/README.md](libs/behavior/README.md)
- [libs/evaluation/README.md](libs/evaluation/README.md)
- [apps/cli/README.md](apps/cli/README.md)

Working notes, analysis, and plans live in `.working/`.
