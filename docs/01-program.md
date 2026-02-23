# The Program Object

> The top-level coordinator. Creates the TypeScript program, runs the KindScript binder, and lazily creates the checker.

---

## Overview

`ks.Program` is the root object that orchestrates the entire KindScript compilation. It mirrors `ts.Program` in structure and lifecycle: it holds source files, compiler options, and provides access to the checker. The key difference is that it wraps a `ts.Program` internally and layers KindScript's binder and checker on top.

```
ks.createProgram(rootFiles, options)
  │
  ├─ ts.createProgram(rootFiles, options)   ← TypeScript does scan/parse/bind
  │     └─ ts.SourceFile[] + ts.Symbol tables + ts.TypeChecker
  │
  ├─ ksBind(tsProgram)                      ← KindScript binder runs
  │     └─ KindSymbolTable
  │
  └─ KSProgram                              ← returned to caller
        ├─ .getTSProgram()
        ├─ .getKindSymbolTable()
        └─ .getKindChecker()                ← lazy, memoized
```

---

## Interface

```ts
interface KSProgram {
  // ── Delegated to TypeScript ──
  getTSProgram(): ts.Program;
  getSourceFiles(): readonly ts.SourceFile[];
  getCompilerOptions(): ts.CompilerOptions;
  getTSTypeChecker(): ts.TypeChecker;

  // ── KindScript-specific ──
  getKindSymbolTable(): KindSymbolTable;
  getKindChecker(): KSChecker;
  getKindDiagnostics(sourceFile?: ts.SourceFile): KSDiagnostic[];
}
```

### `getTSProgram()`

Returns the underlying `ts.Program`. This is useful for accessing TypeScript's full API — module resolution, emit, syntactic diagnostics — without going through KindScript.

### `getKindSymbolTable()`

Returns the `KindSymbolTable` built during the bind phase. This is a `WeakMap<ts.Symbol, KindSymbol>` mapping each Kind-related TypeScript symbol to its KindScript metadata (declared properties, base type, members, filesystem path, value kind).

### `getKindChecker()`

Returns the `KSChecker`, created lazily on first call and memoized thereafter. The checker uses the KindSymbolTable and the TypeScript TypeChecker to compute properties and verify kind assignability.

### `getKindDiagnostics(sourceFile?)`

Convenience method. Calls `getKindChecker()` and runs checking for the given source file (or all source files if none specified). Returns an array of `KSDiagnostic` objects in the same format as `ts.Diagnostic`.

---

## Creation

```ts
function createProgram(
  rootNames: string[],
  options?: ts.CompilerOptions,
): KSProgram {
  // 1. Create the TypeScript program (scan, parse, bind happen here)
  const tsProgram = ts.createProgram(rootNames, options ?? {});

  // 2. Run the KindScript binder
  const kindSymbolTable = ksBind(tsProgram);

  // 3. Return the KSProgram (checker is lazy)
  let checker: KSChecker | undefined;

  return {
    getTSProgram: () => tsProgram,
    getSourceFiles: () => tsProgram.getSourceFiles(),
    getCompilerOptions: () => tsProgram.getCompilerOptions(),
    getTSTypeChecker: () => tsProgram.getTypeChecker(),
    getKindSymbolTable: () => kindSymbolTable,
    getKindChecker: () => {
      if (!checker) {
        checker = createKSChecker(tsProgram, kindSymbolTable);
      }
      return checker;
    },
    getKindDiagnostics: (sf?) => {
      const c = (checker ??= createKSChecker(tsProgram, kindSymbolTable));
      return sf ? c.checkSourceFile(sf) : c.checkProgram();
    },
  };
}
```

### Why the checker is lazy

TypeScript's `ts.Program.getTypeChecker()` is also lazy — the checker is only created when someone requests it. This avoids unnecessary work when the program is created only for syntactic analysis. KindScript follows the same pattern: if you only need the KindSymbolTable (e.g., for tooling or introspection), no checking overhead is incurred.

---

## Immutability

Like `ts.Program`, `KSProgram` is **immutable after creation**. All source files are fixed, the KindSymbolTable is built once, and the checker (once created) operates on a frozen snapshot of the program.

In a language service (IDE plugin) scenario, a new `KSProgram` is created on each file edit. TypeScript's structural sharing means unchanged `ts.SourceFile` nodes carry over from the previous program — only changed files are re-parsed. The KindScript binder must re-run (since Kind definitions may have changed), but it only needs to process Kind-related symbols, not the entire codebase.

---

## Relationship to `tsc` / `ksc`

| TypeScript | KindScript | Notes |
|---|---|---|
| `tsc` CLI | `ksc` CLI | Command-line entry point |
| `ts.createProgram()` | `ks.createProgram()` | Creates the program object |
| `ts.Program` | `ks.Program` | Top-level coordinator |
| `program.getTypeChecker()` | `program.getKindChecker()` | Lazy checker creation |
| `program.getSemanticDiagnostics()` | `program.getKindDiagnostics()` | Retrieve violations |

---

## What the Program Does NOT Do

- **No scanning or parsing** — delegated entirely to TypeScript
- **No emitting** — KindScript produces diagnostics, not JavaScript output
- **No module resolution** — uses TypeScript's resolver via `ts.TypeChecker`
- **No incremental compilation** (initially) — each `createProgram` call is a full run

---

## Entry Points

The `ksc` CLI creates a program and requests diagnostics:

```ts
// ksc check
const program = ks.createProgram(rootFiles, compilerOptions);
const diagnostics = program.getKindDiagnostics();

for (const d of diagnostics) {
  console.log(formatDiagnostic(d));
}

process.exit(diagnostics.length > 0 ? 1 : 0);
```

A language service plugin creates a program per request:

```ts
// TS Language Service Plugin
function getSemanticDiagnostics(fileName: string): ts.Diagnostic[] {
  const tsProgram = languageService.getProgram();
  const ksProgram = ks.createProgramFromTSProgram(tsProgram);
  const sourceFile = tsProgram.getSourceFile(fileName);
  return ksProgram.getKindDiagnostics(sourceFile);
}
```

Note the `createProgramFromTSProgram` variant — when running as a language service plugin, we receive an already-created `ts.Program` and wrap it rather than creating a new one. This avoids duplicate parsing.
