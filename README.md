# KindScript

**Architectural enforcement for TypeScript through the type system.**

KindScript checks TypeScript codebases against architectural rules declared as phantom types. You annotate code with `Kind<{...}>` types that declare properties like `noIO`, `noMutation`, or `noImports`. The compiler walks your source files and reports violations as diagnostics.

## How It Works

### Declare kinds in your source code

```typescript
import type { Kind, PropertySet } from 'kindscript';

// A "Pure" kind: no IO, no mutation
type Pure = Kind<{ noIO: true; noMutation: true }>;

// Annotate a variable with this kind
const handler: Pure = createHandler();
```

KindScript finds these `Kind<{...}>` type definitions, extracts the declared properties, and checks that annotated code satisfies them.

### Check your project

```bash
# Check the project
ksc check

# With options
ksc check --config kindscript.config.ts
ksc check --json
ksc check --depth parse|bind|check
ksc check --watch

# Generate a config scaffold
ksc init

# Run analysis codegen (regenerate dispatch tables)
ksc codegen
```

**Exit codes:** 0 = no violations, 1 = violations found, 2 = error.

**Config file discovery:** KSC auto-detects config files in order of precedence:
`kindscript.config.ts` → `kindscript.config.js` → `ksc.config.ts` → `ksc.config.js`.
Use `--config <path>` to override. Config is optional — KSC works without one.

### Configuration

```typescript
// ksc.config.ts
import { defineConfig } from 'kindscript';

export default defineConfig({
  analysisDepth: 'check', // 'parse' | 'bind' | 'check'
});
```

## Programmatic API

```typescript
import { createProgram } from 'kindscript/ts-kind-checking';
import { defineConfig } from 'kindscript';

const config = defineConfig({ analysisDepth: 'check' });
const program = createProgram(rootFiles, config, { strict: true, noEmit: true });

// Kind definitions and violations
const defs = program.getKindDefinitions();
const diags = program.getDiagnostics();
console.log(`${defs.length} kinds, ${diags.length} violations`);
```

See [`examples/programmatic-api.ts`](examples/programmatic-api.ts) for a complete working example.

### npm Package — Subpath Exports

| Import path | What it exports |
|---|---|
| `kindscript` | Lightweight: `Kind`, `PropertySet`, `defineConfig`, `KindScriptConfig` |
| `kindscript/ts-kind-checking` | `createProgram`, `parseOnly`, `KSProgramInterface`, `KindDefinition`, `Diagnostic` |

`kindscript` is zero-heavyweight-deps — use it for source annotations and config files.
`kindscript/ts-kind-checking` pulls in the full evaluator, grammar, and AST translator for the TS kind-checking analysis.

## Architecture

KindScript uses a **ports-and-adapters** architecture with a declarative **attribute grammar** engine.

```
packages/                 Workspace packages (core machinery — ports live here)
  core-grammar/           Grammar type system, runtime utilities, generic tree serialization
  core-codegen/           Analysis compilation + equation framework
  core-evaluator/         Hand-written AG evaluator engine

src/adapters/             Pluggable implementations (organized by lib/port/target)
  grammar/
    grammar/ts-ast/       Grammar<TSNodeKind> — 364 node kinds
    grammar/mock/         Grammar<MockKind> — 5 node kinds (testing)
    ast-translator/ts-ast/  AstTranslatorPort<ts.Program, KSProgram>
    extraction/ts-ast/    extractASTData — TS-specific tree serialization (uses serializeNode)
  analysis/
    spec/ts-kind-checking/  AnalysisDecl<TSNodeKind> + AnalysisProjections<KSCProjections>
    spec/mock/            AnalysisDecl<MockKind> + AnalysisProjections<MockProjections>

src/application/          Use cases + npm entry points
  evaluation/             Evaluation wiring (EvaluationTarget composition)
  codegen/                Codegen pipeline + target definitions

apps/                     Runnable applications
  cli/                    ksc CLI — per-command composition roots (lazy-loaded)
    compose/              Wires adapters → pure command handlers per command
  dashboard/              AST visualization (Vite + React + D3 SPA)
    compose.ts            Extraction composition root (parseOnly + extractASTData)
```

The `K` type parameter links grammar and analysis at composition boundaries — TypeScript prevents mismatched grammar/spec pairs.

### AST Schema

KindScript uses a schema-first architecture. A single source of truth (`adapters/grammar/grammar/ts-ast/nodes.ts`) declares all 364 node kinds, their typed fields, and 48 sum type memberships — mirroring TypeScript's full AST structure. Grammar types are derived at the type level with no codegen. Runtime metadata is computed by pure utility functions.

### Analysis Codegen

The only codegen in the system compiles `AnalysisDecl` definitions into dispatch tables:

```
ksc codegen  →  ts-kind-checking → adapters/analysis/spec/ts-kind-checking/generated/
             →  mock             → adapters/analysis/spec/mock/generated/
```

### Architecture Decisions

Key design decisions are recorded in [`docs/adr/`](docs/adr/):

- **ADR-001**: Analysis adapters are explicitly coupled to their grammar — domain types use concrete node types, not generics
- **ADR-002**: Typed equation records (`EquationFn<T>`, `EquationMap<K,T>`) replace raw `Function` in attribute declarations
- **ADR-003**: Typed projection functions receive `TypedAGNode<M>` for type-safe attribute access

## CI/CD Integration

```yaml
# GitHub Actions
- name: Check architecture
  run: npx ksc check

# With JSON output for machine parsing
- name: Check architecture (JSON)
  run: npx ksc check --json > ksc-report.json
```

## Status

KindScript is under active development. The architecture uses an attribute grammar engine — see `docs/tutorial-adding-an-attribute.md` for details on the internal design.
