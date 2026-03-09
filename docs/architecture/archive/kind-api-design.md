# KindScript Configuration API Design

KindScript architectural constraints are defined as plain configuration data via `defineConfig()`. A config maps named entries to filesystem paths and rule sets. The checker walks TypeScript source files matched by those paths and verifies the declared rules.

Everything is a target. Files and directories are targets. Rules are properties of targets. The checker evaluates source files against their target's rules — uniformly, at every level.

## Core Principles

```
Config entry = Path + Rules
Target       = File or Directory matched by path
Checking     = Walk AST of target files, verify rules hold
```

- Configuration is data, not types — defined in `defineConfig({...})`
- No phantom types, no type-level encoding — rules are plain objects
- Files and directories are targets identified by path
- The checker does the same thing at every level: resolve target files, walk their ASTs, verify rules
- Composite entries group targets and add relational constraints between them

## Configuration API

### `defineConfig()` — the entry point

An identity function that provides type-safe autocompletion:

```ts
import { defineConfig } from 'kindscript';

export default defineConfig({
  domain: { path: './src/domain', rules: { pure: true, noIO: true } },
  infra:  { path: './src/infrastructure' },
});
```

### `RuleSet` — the rule vocabulary

Describes what rules a target must satisfy. Three categories:

- **Intrinsic** — properties of the target's source files (pure, noIO, noImports, etc.)
- **Relational** — constraints between composite members (noDependency, noCycles, etc.)
- **Structural** — shape constraints on the target's scope (exhaustive, scope)

```ts
interface RuleSet {
  // Intrinsic (evaluated per-file by walking the AST)
  readonly pure?: true;
  readonly noIO?: true;
  readonly noImports?: true;
  readonly noMutation?: true;
  readonly noConsole?: true;
  readonly immutable?: true;
  readonly static?: true;
  readonly noSideEffects?: true;
  readonly maxFanOut?: number;

  // Relational (evaluated between members via the import graph)
  readonly noDependency?: Array<[string, string]>;
  readonly noTransitiveDependency?: Array<[string, string]>;
  readonly noCycles?: string[];
  readonly noSiblingDependency?: true;

  // Structural
  readonly exhaustive?: true;
  readonly scope?: 'folder' | 'file';
}
```

### `TargetEntry` — a file or directory target

```ts
interface TargetEntry {
  readonly path: string;       // Relative path (e.g., './src/domain')
  readonly rules?: RuleSet;    // Rules to enforce
}
```

Path detection: if the path has a file extension (e.g., `./src/utils.ts`), it's a file target. Otherwise, it's a directory target. Directory targets check all `.ts` files under that path.

### `CompositeEntry` — grouped targets with relational constraints

```ts
interface CompositeEntry {
  readonly members: Record<string, TargetEntry>;
  readonly rules?: RuleSet;    // Relational rules between members
}
```

## Usage

### File and directory targets

```ts
import { defineConfig } from 'kindscript';

export default defineConfig({
  // Directory target: all files in ./src/domain must be pure with no IO
  domain: { path: './src/domain', rules: { pure: true, noIO: true } },

  // File target: this specific file must have no mutations
  handler: { path: './src/handler.ts', rules: { noMutation: true } },

  // Directory with no rules: tracked but unconstrained
  infra: { path: './src/infrastructure' },
});
```

### Composite targets (relational constraints between members)

Members are directory or file targets. Relational constraints reference member names by string.

```ts
import { defineConfig } from 'kindscript';

export default defineConfig({
  app: {
    members: {
      domain:         { path: './src/domain',         rules: { pure: true, noIO: true } },
      infrastructure: { path: './src/infrastructure' },
      application:    { path: './src/application',    rules: { noConsole: true } },
    },
    rules: {
      noDependency: [
        ['domain', 'infrastructure'],
        ['domain', 'application'],
      ],
      noCycles: ['domain', 'infrastructure', 'application'],
    },
  },
});
```

KindScript checks:
- `domain` → all files are pure and have no IO
- `application` → no files use `console.*`
- `domain` does not import from `infrastructure`
- `domain` does not import from `application`
- No circular dependency cycles between the three

## The Uniform Checker Model

The checker does the same thing at every level:

```
target : rules
  │       │
  │       └─ declared rules: { pure: true, noIO: true }
  │
  └─ resolve target path to source files
       → walk each file's AST
       → check for rule violations
       → emit diagnostics with source positions
```

What the checker walks for each target type:

| Target type | Source files checked | Example rule check |
|---|---|---|
| File | The single matched `ts.SourceFile` | Walk for IO calls → noIO |
| Directory | All `ts.SourceFile`s under the path | Walk all files for console calls → noConsole |
| Composite member | Same as file/directory | Per-member intrinsic rules |
| Composite (relational) | Import graph between members | Check noDependency between members |

## Type Summary

| Type | Purpose |
|---|---|
| `RuleSet` | Vocabulary of all supported rules |
| `TargetEntry` | A file or directory target with optional rules |
| `CompositeEntry` | A group of targets with relational rules |
| `KindScriptConfig` | Top-level config: `Record<string, ConfigEntry>` |
| `defineConfig()` | Identity function for type-safe config authoring |

## How KindScript Processes This

**Config file** is a normal `.ts` file that exports a `KindScriptConfig` object. It's consumed by the KindScript CLI or API.

**Binder**: Iterates over config entries, creates a `KindSymbol` for each one with its declared rules, path, and value kind (file/directory/composite).

**Checker**: For each KindSymbol target:
1. **Resolve the target** — match the config path against `ts.Program.getSourceFiles()` by suffix
2. **Walk the AST** — for each matched source file, walk the AST checking each declared rule
3. **Emit diagnostics** — report violations with source file, line, column, and the violated rule name
