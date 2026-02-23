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
import { createProgram, defineConfig, exportDashboardData } from 'kindscript';

const config = defineConfig({
  domain: { path: './src/domain', rules: { pure: true, noIO: true } },
});

const program = createProgram(rootFiles, config, { strict: true });
const diagnostics = program.getKindDiagnostics();

// Dashboard export for visualization
const data = exportDashboardData(program, { includeSource: true });
```

## Integration

KindScript produces standard TypeScript diagnostics, so violations appear:
- **In your editor** — as red squiggles via the TypeScript Language Service Plugin
- **In CI** — via the `ksc check` command
- **Alongside TypeScript errors** — same diagnostic format, same error codes, same tooling

## Why "KindScript"?

In type theory, a *kind* is the type of a type. `Type` has kind `*`. `Array` has kind `* → *`. KindScript extends this idea: architectural rules describe the *behavior and relationships* of code units.

The name also reflects the design philosophy: KindScript is TypeScript. It uses TypeScript's compiler, TypeScript's AST, TypeScript's tooling. It adds a layer of architectural verification without introducing a new language, new syntax, or new build step.

## Status

KindScript is a greenfield rewrite of an [earlier prototype](https://github.com/user/kindscript). The rewrite aligns the compiler's internal architecture directly with TypeScript's own compiler phases — scanner, parser, binder, checker — using the same names, same patterns, and same data flow model.
