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
libs/                     Generic machinery (ports — no adapter imports)
  grammar/                Grammar type system + runtime utilities
  analysis/               Analysis compilation + equation framework
  evaluator/              Hand-written AG evaluator engine

adapters/                 Pluggable implementations (organized by lib/port/target)
  grammar/
    grammar/ts-ast/       Grammar<TSNodeKind> — 364 node kinds
    grammar/mock/         Grammar<MockKind> — 5 node kinds (testing)
    ast-translator/ts-ast/  AstTranslatorPort<ts.Program, KSProgram>
  analysis/
    spec/ts-kind-checking/  AnalysisDecl<TSNodeKind> + AnalysisProjections<KSCProjections>
    spec/mock/            AnalysisDecl<MockKind> + AnalysisProjections<MockProjections>

packages/                 npm library entry points
  kindscript/             Lightweight: phantom types + config
  core/                   Heavyweight: full programmatic API

apps/                     Runnable applications
  cli/                    ksc CLI (check, codegen, init, watch)
  dashboard/              AST visualization (Vite + React + D3 SPA)
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
