# Compiler Dashboard Showcase — Implementation Plan

**Status: IMPLEMENTED** — All phases complete.

## Goal

Create a runnable example that compiles a KindScript project and opens the
compiler-dashboard visualization in a browser, populated with real data from
the compiler's parse, bind, and check stages.

Two modes, selected by flag:

| Flag | Mode | Data source |
|------|------|-------------|
| `--fixed` (default) | **Fixed commit** | Clones commit `afa024b` from `git@github.com:garrick0/ksc.git` into a temp folder, compiles it |
| `--live` | **Live codebase** | Runs the compiler against the current working directory |

---

## Architecture Overview

```
examples/showcase.ts          <- CLI entry point (tsx)
  |
  +- setupTempProject()       <- clone/cleanup for --fixed mode
  +- compile(rootDir, config) <- calls createProgram + exportDashboardData
  +- serveDashboard(data)     <- injects JSON into HTML, opens browser
  +- cleanup()                <- removes temp folder on exit
```

The key piece is `exportDashboardData()` — a function that takes a
`KSProgram` and serializes its internal state into the `DashboardExportData`
JSON format that `compiler-dashboard.html` consumes.

---

## Configuration

KindScript uses `defineConfig()` for configuration. The showcase creates a
config object that maps directory/file paths to rule sets:

```typescript
import { defineConfig } from '../src/config.js';

const config = defineConfig({
  domain: { path: './src/domain', rules: { noImports: true } },
  infra:  { path: './src/infra', rules: { noIO: true } },
});
```

---

## Compiler Pipeline

```
defineConfig({...})                    <- User config (plain data)
    |
    v
ksBind(config)                         <- Config -> KindSymbol[]
    |
    v
createProgram(rootFiles, config, opts) <- TS parse + KS bind
    |
    v
program.getKindDiagnostics()           <- KS checker walks ASTs
    |
    v
exportDashboardData(program)           <- Serialize to JSON
```

---

## Implementation Phases

```
Phase 0: Compiler changes                              Done
  +- KindSymbol with id, name, declaredProperties,
     path, valueKind, members
  +- KSDiagnostic with property field
  +- getAllKindSymbols() on KSProgram

Phase 1: exportDashboardData()                          Done
  +- src/export.ts with DashboardExportData type
  +- Parse stage: source files with declarations
  +- Bind stage: symbols with properties and resolved files
  +- Check stage: diagnostics with line/col + summary

Phase 2: Fixed commit showcase                          Done
  +- Temp folder management (clone + cleanup)
  +- Compile cloned project with local compiler
  +- Serve dashboard via HTTP with injected JSON
  +- npm scripts: showcase / showcase:fixed / showcase:live

Phase 3: Dashboard HTML adaptations                     Done
  +- __DASHBOARD_DATA_START/END__ markers for injection
  +- Handle real data edge cases
  +- Load JSON overlay still works standalone

Phase 4: Live mode                                      Done
  +- Root file discovery (fixtures -> all .ts)
  +- Compile cwd + serve

Phase 5: Commit update (deferred)
  +- Push, note new hash, update showcase
```

---

## File Inventory

| File | Action | Purpose |
|------|--------|---------|
| `src/config.ts` | Core | `defineConfig()`, `RuleSet`, `TargetEntry`, `CompositeEntry`, `KindScriptConfig` |
| `src/types.ts` | Core | `KindSymbol`, `KSProgram`, `KSDiagnostic`, `KSChecker` |
| `src/binder.ts` | Core | Config -> KindSymbol[] conversion (~89 lines) |
| `src/checker.ts` | Core | AST walking + rule verification |
| `src/program.ts` | Core | `createProgram(rootFiles, config, options)` |
| `src/export.ts` | Core | `exportDashboardData()` + `DashboardExportData` type |
| `src/index.ts` | Core | Re-exports |
| `test/export.test.ts` | Test | Tests for export function |
| `examples/showcase.ts` | Example | CLI entry point |
| `examples/showcase-utils.ts` | Example | Temp folder mgmt, browser opening, HTTP server |
| `docs/compiler-dashboard.html` | Viz | Dashboard with __DASHBOARD_DATA__ markers |
| `package.json` | Config | `tsx` dep, showcase scripts |
| `.gitignore` | Config | `.showcase-tmp/` |
