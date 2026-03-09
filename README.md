# KindScript

**Architectural enforcement for TypeScript, expressed as configuration.**

KindScript checks TypeScript codebases against architectural rules — purity, dependency direction, import restrictions, mutation constraints. Rules are declared in a config file via `defineConfig()`. The compiler walks your source files and reports violations as diagnostics.

## What Problem Does KindScript Solve?

Every team starts with architectural rules: "the domain layer must be pure," "infrastructure cannot leak into business logic," "no circular dependencies between modules." These rules live in wiki pages, onboarding docs, and the memories of senior engineers. They are enforced by code review — inconsistently, after the fact, at scale never.

KindScript makes architectural rules checkable. You declare them in a config file. The compiler verifies them against your actual codebase. Violations appear as errors — in your editor, in CI, alongside your regular TypeScript diagnostics.

## How It Works

### Configuration is plain data

KindScript uses `defineConfig()` to define architectural constraints. Each entry maps a name to a filesystem path and a set of rules to enforce.

```typescript
// kindscript.config.ts
import { defineConfig } from 'kindscript';

export default defineConfig({
  // All files in ./src/domain must be pure with no IO
  domain: { path: './src/domain', rules: { pure: true, noIO: true } },

  // This specific file must have no mutations
  handler: { path: './src/handler.ts', rules: { noMutation: true } },
});
```

### Compositional architecture

Entries compose. You can define architectural patterns as composite entries whose members are directories or files — with relational constraints between them.

```typescript
import { defineConfig } from 'kindscript';

export default defineConfig({
  app: {
    members: {
      domain:         { path: './src/domain',         rules: { pure: true, noIO: true } },
      infrastructure: { path: './src/infrastructure' },
      application:    { path: './src/application',    rules: { noConsole: true } },
    },
    rules: {
      noDependency: [['domain', 'infrastructure'], ['domain', 'application']],
      noCycles: ['domain', 'infrastructure', 'application'],
    },
  },
});
// KindScript checks:
//   domain is pure, has no IO
//   application has no console usage
//   domain does not import from infrastructure or application
//   no circular dependencies between the three layers
```

## Architectural Properties

KindScript verifies three categories of properties:

### Intrinsic Properties
Properties of a target's source files, computed by walking the AST:

| Property | What it checks |
|---|---|
| `pure` | No side effects: no IO, no mutation, no console, no imports of impure code |
| `noIO` | No filesystem, network, or process operations |
| `noImports` | No import statements |
| `noMutation` | No reassignment of variables or object properties |
| `noConsole` | No console.log/warn/error/etc. |
| `immutable` | No `let` or `var` at module scope |
| `static` | No dynamic imports or computed paths |
| `noSideEffects` | No top-level function calls or assignments at module scope |
| `maxFanOut` | Maximum number of dependencies allowed |

### Relational Properties
Properties between members, computed from the import graph:

| Property | What it checks |
|---|---|
| `noDependency` | Member A cannot import from member B |
| `noTransitiveDependency` | Member A cannot transitively reach member B |
| `noCycles` | No circular dependency chains among listed members |
| `noSiblingDependency` | No member may import from any sibling |

### Structural Properties
Shape constraints on how values relate to their scope:

| Property | What it checks |
|---|---|
| `exhaustive` | Every file in scope must be assigned to a member |
| `scope` | Whether the target operates at `'folder'` or `'file'` granularity |

## The Uniform Model

KindScript applies the same verification logic at every level:

```
target : rules
  │       │
  │       └─ Declared rules: { pure: true, noIO: true }
  │
  └─ Walk AST of matched source files
       │
       └─ Violation found? → Emit diagnostic with source position
```

What gets walked depends on the target type:

| Target Type | What the Checker Walks |
|---|---|
| File | The single matched source file AST |
| Directory | All source files under the path |
| Composite | Each member recursively + import graph between members |

## Programmatic API

```typescript
import { createProgram, defineConfig, extractASTData } from 'kindscript';

const config = defineConfig({ analysisDepth: 'check' });
const program = createProgram(rootFiles, config, { strict: true, noEmit: true });

// Kind definitions and violations
const defs = program.getKindDefinitions();
const diags = program.getDiagnostics();
console.log(`${defs.length} kinds, ${diags.length} violations`);

// Dashboard export for visualization
const data = extractASTData(program.getKSTree(), 'check');
```

See [`examples/programmatic-api.ts`](examples/programmatic-api.ts) for a complete working example.

## Integration

KindScript produces standard TypeScript diagnostics, so violations appear:
- **In your editor** — as red squiggles via the TypeScript Language Service Plugin
- **In CI** — via the `ksc check` command
- **Alongside TypeScript errors** — same diagnostic format, same error codes, same tooling

## Why "KindScript"?

In type theory, a *kind* is the type of a type. `Type` has kind `*`. `Array` has kind `* → *`. KindScript extends this idea: architectural rules describe the *behavior and relationships* of code units.

The name also reflects the design philosophy: KindScript is TypeScript. It uses TypeScript's compiler, TypeScript's AST, TypeScript's tooling. It adds a layer of architectural verification without introducing a new language, new syntax, or new build step.

## CLI

```bash
# Check your project
ksc check

# With options
ksc check --config kindscript.config.ts
ksc check --json
ksc check --depth parse|bind|check
ksc check --watch

# Generate a config scaffold
ksc init
```

**Exit codes:** 0 = no violations, 1 = violations found, 2 = error.

**Config file discovery:** KSC auto-detects config files in order of precedence:
1. `kindscript.config.ts`
2. `kindscript.config.js`
3. `ksc.config.ts`
4. `ksc.config.js`

Use `--config <path>` to override. Config is optional — KSC works without one.

## CI/CD Integration

```yaml
# GitHub Actions
- name: Check architecture
  run: npx ksc check

# With JSON output for machine parsing
- name: Check architecture (JSON)
  run: npx ksc check --json > ksc-report.json
```

The exit code tells CI whether violations were found (exit 1) or an error occurred (exit 2).

## AST Schema

KindScript uses a schema-first architecture for its AST. A single source of truth (`specs/ts-ast/grammar/nodes.ts`) declares all 364 node kinds (362 from TypeScript + 2 KSC-specific: `Program`, `CompilationUnit`), their typed fields, and 48 sum type memberships — mirroring TypeScript's full AST structure. A codegen step generates:

- **Typed interfaces** — `KSNode` union, per-node interfaces (e.g., `KSIfStatement`), sum type unions (`KSExpression`, `KSStatement`, etc.), type guards
- **Runtime schema** — `getChildren()`, field introspection, completeness checking for AG equations
- **Node definitions** — `defineNode()`/`defineLeaf()` calls with phantom-typed field descriptors

Every child field is typed to a specific node kind or sum type. Operator and token enums are decoded to human-readable string literals (`'extends' | 'implements'`, not raw numbers). The schema covers all 362 TypeScript SyntaxKinds with 0 verification errors.

## Project Structure

```
specs/                        Pluggable data specifications
  ts-ast/                     TypeScript AST target
    grammar/                  TS AST grammar (364 node kinds)
      nodes.ts, extractors.ts, spec.ts
    kind-checking/            Kind-checking analysis
      spec.ts                 AnalysisSpec: 5 structural + 8 property declarations
  mock/                       Mock target (testing)
    grammar/                  Mock grammar (5 node kinds)
      nodes.ts, spec.ts
    mock-analysis/            Mock analysis (1 attr)
      spec.ts

grammar/                      Grammar machinery + compilation
  builder.ts                  Scoped builder DSL (createGrammarBuilder, field helpers)
  export.ts                   Dashboard data extraction
  compile.ts                  Functor 1: compileGrammar(GrammarSpec) → 7 AST files
  verify.ts                   Grammar verification against TypeScript AST
  types.ts                    GrammarSpec, CompiledGrammar, GeneratedFile

analysis/                     Analysis machinery + compilation
  binder.ts, types.ts         Equation functions, domain types + spec interfaces
  ctx.ts                      Ctx interface (equation contract)
  compile.ts                  Functor 2: compileAnalysis(AnalysisSpec) → evaluator
  validate.ts                 Cross-functor validation
  violation.ts                Type-safe violation builder

app/                          Composition roots + shared lib
  index.ts                    Public API (npm package entry point)
  cli.ts                      ksc CLI (check, init)
  codegen/                    Codegen composition roots (one per grammar+analysis)
    ts-kind-checking.ts       TS AST + kind-checking → generated/ts-ast/
    mock.ts                   Mock grammar + mock analysis → generated-mock/mock/
    lib/codegen.ts            Shared codegen helpers + CLI runner
  lib/                        Shared code
    program.ts, config.ts, parse.ts, types.ts

generated/                    Machine-generated output (never edit, committed)
  ts-ast/                     Output grouped by grammar target
    grammar/                  Functor 1 output (node-types, schema, convert, etc.)
    kind-checking/            Functor 2 output (evaluator.ts, attr-types.ts)

test/                         Test suite (vitest, 262 tests)
dashboard/                    Interactive AST visualization (React + Vite)
examples/                     Usage examples (showcase, programmatic API)
```

### Separate Composition Roots

Each grammar+analysis combination has its own composition root that selects
specific data specs and wires them to the shared codegen pipeline.
Shared logic lives in `app/codegen/lib/codegen.ts`.

```
app/codegen/ts-kind-checking.ts  → specs/ts-ast/grammar/ + specs/ts-ast/kind-checking/
app/codegen/mock.ts              → specs/mock/grammar/   + specs/mock/mock-analysis/
```

### Specs vs Machinery Separation

`specs/` contains **pluggable data specifications** — pure declarative definitions
with no business logic. `grammar/` and `analysis/` contain **machinery** — DSLs,
equation functions, and framework code shared across all specs.

The nesting `specs/<target>/<analysis>/` makes the grammar dependency
structural — an analysis always lives under the grammar target it covers.

## Status

KindScript is a greenfield rewrite of an [earlier prototype](https://github.com/user/kindscript). The architecture uses a two-functor compilation model with attribute grammars — see `docs/tutorial-adding-an-attribute.md` for details.
