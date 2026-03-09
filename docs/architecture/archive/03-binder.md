# The KindScript Binder

> Convert config entries into KindSymbols for the checker.

---

## Overview

After TypeScript has scanned, parsed, and bound the source files, KindScript's binder runs. Its job is simple: iterate over the config entries, create a `KindSymbol` for each one, and return them for the checker to use.

The binder bridges KindScript's configuration (plain data) with the checker's internal representation (KindSymbols). It reads from the `KindScriptConfig` and writes an array of `KindSymbol` objects.

```
KindScript config                   Binder output
─────────────────                   ─────────────
defineConfig({                      BinderResult
  domain: { path, rules },   ──►     symbols: KindSymbol[]
  infra:  { path, rules },           targets: KindSymbol[]
})
```

---

## Data Structures

### KindSymbol

Each config entry becomes a `KindSymbol`:

```ts
interface KindSymbol {
  id: string;                         // Unique identifier ("sym-0", "sym-1", ...)
  name: string;                       // The config entry name
  declaredProperties: PropertySpec;   // The rules this entry declares
  members?: Map<string, KindSymbol>;  // Child members (composite entries only)
  path?: string;                      // Filesystem path for file/directory targets
  valueKind: 'file' | 'directory' | 'composite';
}
```

### BinderResult

```ts
interface BinderResult {
  symbols: KindSymbol[];   // All symbols, including composite members
  targets: KindSymbol[];   // Top-level config entries only (for checking)
}
```

The `targets` array is what the checker iterates over. The `symbols` array includes both top-level targets and their composite members (used by the dashboard export for introspection).

---

## Binder Algorithm

The binder iterates over config entries in a single pass:

### Step 1: Detect entry type

Each config entry is either a `TargetEntry` (has `path`) or a `CompositeEntry` (has `members`). The `isCompositeEntry()` type guard distinguishes them.

### Step 2: Create KindSymbols

For a **simple target** (file or directory):

```ts
function detectValueKind(path: string): 'file' | 'directory' {
  return /\.\w+$/.test(path) ? 'file' : 'directory';
}

// For each config entry with a path:
const sym: KindSymbol = {
  id: `sym-${nextId++}`,
  name: entryName,
  declaredProperties: entry.rules ?? {},
  path: entry.path,
  valueKind: detectValueKind(entry.path),
};
```

For a **composite target** (has members):

```ts
// 1. Create member symbols first
const members = new Map<string, KindSymbol>();
for (const [memberName, memberEntry] of Object.entries(entry.members)) {
  const memberSym: KindSymbol = {
    id: `sym-${nextId++}`,
    name: memberName,
    declaredProperties: memberEntry.rules ?? {},
    path: memberEntry.path,
    valueKind: detectValueKind(memberEntry.path),
  };
  members.set(memberName, memberSym);
  allSymbols.push(memberSym);
}

// 2. Create the composite symbol
const compositeSym: KindSymbol = {
  id: `sym-${nextId++}`,
  name: entryName,
  declaredProperties: entry.rules ?? {},
  valueKind: 'composite',
  members,
};
```

### Step 3: Return results

```ts
return { symbols: allSymbols, targets };
```

---

## What the Binder Produces

For a typical config:

```ts
const config = defineConfig({
  domain: { path: './src/domain', rules: { pure: true, noIO: true } },
  infra:  { path: './src/infrastructure' },
  app: {
    members: {
      domain: { path: './src/domain', rules: { pure: true } },
      infra:  { path: './src/infrastructure' },
    },
    rules: {
      noDependency: [['domain', 'infra']],
    },
  },
});
```

The binder produces:

| Symbol | ValueKind | Properties | Path | Members |
|---|---|---|---|---|
| `domain` | directory | `{ pure: true, noIO: true }` | `./src/domain` | — |
| `infra` | directory | `{}` | `./src/infrastructure` | — |
| `app.domain` | directory | `{ pure: true }` | `./src/domain` | — |
| `app.infra` | directory | `{}` | `./src/infrastructure` | — |
| `app` | composite | `{ noDependency: [["domain","infra"]] }` | — | `domain`, `infra` |

---

## How This Compares to TypeScript's Binder

| TypeScript Binder | KindScript Binder |
|---|---|
| Walks the AST once per source file | Iterates over config entries |
| Creates `ts.Symbol` for each declaration | Creates `KindSymbol` for each config entry |
| Populates `SymbolTable` on scope nodes | Returns a flat array of symbols |
| Builds control flow graph | Not needed (no narrowing) |
| Handles declaration merging | Not needed |
| Runs before the checker | Runs before the KS checker |
| Output is consumed by the checker | Output is consumed by the KS checker |

Key difference: TypeScript's binder creates symbols for *everything* in the AST. KindScript's binder creates entries only for explicitly configured targets — a much smaller and more predictable set.

---

## Why the Binder is Simple

The binder is ~89 lines of straightforward code. This is by design. Configuration is plain data (defined via `defineConfig()`), so the binder's job is a trivial mapping from config entries to internal KindSymbol objects. All the complexity lives in the checker, which walks the TypeScript AST to verify that source files satisfy the declared rules.
