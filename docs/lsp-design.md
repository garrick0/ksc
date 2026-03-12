# KindScript Language Server — Design Document

## Goal

Build a standalone Language Server Protocol (LSP) server that surfaces KindScript
diagnostics (kind-checking violations, protobuf getter enforcement) as inline editor
squiggles, Problem panel entries, and quick-fix code actions in VS Code and other
LSP-compatible editors.

---

## Filesystem Structure

### Before

```
ksc/
├── package.json                               # workspaces: packages/*
├── tsconfig.json                              # include: [apps, src, packages]
├── apps/
│   ├── cli/                                   # ksc check, ksc codegen, ksc init
│   │   ├── bin.ts
│   │   ├── cli.ts
│   │   ├── dispatch.ts
│   │   ├── args.ts
│   │   ├── errors.ts
│   │   ├── format.ts
│   │   ├── commands/
│   │   │   ├── check.ts
│   │   │   ├── codegen.ts
│   │   │   └── init.ts
│   │   └── compose/
│   │       ├── compose-check.ts
│   │       ├── compose-codegen.ts
│   │       └── compose-init.ts
│   └── dashboard/                             # Vite + React SPA
│       ├── compose.ts
│       ├── vite.config.ts
│       └── app/...
├── packages/
│   ├── core-grammar/
│   ├── core-codegen/
│   └── core-evaluator/
├── src/
│   ├── api.ts
│   ├── application/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── check-program.ts
│   │   ├── check-project.ts
│   │   ├── parse-only.ts
│   │   ├── config.ts
│   │   ├── find-files.ts
│   │   ├── evaluation/
│   │   │   └── ts-kind-checking.ts
│   │   └── codegen/
│   │       ├── run-codegen.ts
│   │       ├── run-all-codegen.ts
│   │       └── codegen-targets.ts
│   └── adapters/...
├── examples/...
├── test/...
└── docs/...
```

### After

```
ksc/
├── package.json                               # workspaces: packages/*, apps/lsp
├── tsconfig.json                              # include: [apps, src, packages]
├── apps/
│   ├── cli/...                                # (unchanged)
│   ├── dashboard/...                          # (unchanged)
│   └── lsp/                                   # NEW — Language Server + VS Code extension
│       ├── package.json                       # workspace package: @kindscript/vscode
│       ├── tsconfig.json                      # composite, references root
│       ├── esbuild.js                         # bundles client + server separately
│       ├── .vscodeignore                      # excludes src/ from .vsix
│       │
│       ├── server/                            # Language server process
│       │   ├── server.ts                      # entry: createConnection, listen
│       │   ├── analyzer.ts                    # KindScript analysis wrapper (ts.Program → diagnostics)
│       │   ├── ts-host.ts                     # ts.LanguageServiceHost implementation
│       │   ├── diagnostic-mapper.ts           # KS Diagnostic → LSP Diagnostic conversion
│       │   ├── code-actions.ts                # quick-fix provider (protobuf getter rewrites)
│       │   └── debounce.ts                    # debounced re-analysis scheduler
│       │
│       ├── client/                            # VS Code extension (thin client)
│       │   └── extension.ts                   # activate/deactivate, spawn server
│       │
│       └── dist/                              # esbuild output (gitignored)
│           ├── server.js                      # bundled server
│           └── extension.js                   # bundled client
│
├── packages/...                               # (unchanged)
├── src/
│   ├── api.ts                                 # (unchanged)
│   └── application/
│       ├── index.ts                           # (unchanged)
│       ├── types.ts                           # (unchanged)
│       ├── check-program.ts                   # (unchanged — reused directly by analyzer.ts)
│       └── ...                                # (rest unchanged)
├── examples/...
├── test/
│   ├── ...                                    # (existing tests unchanged)
│   └── lsp/                                   # NEW — LSP integration tests
│       ├── analyzer.test.ts                   # analyzer: protobuf on/off, grouping, caching
│       ├── diagnostic-mapper.test.ts          # KS→LSP diagnostic conversion
│       ├── debounce.test.ts                   # scheduler: timing, cancel, dispose
│       └── code-actions.test.ts               # quick-fix response verification
└── docs/
    ├── lsp-design.md                          # this document
    └── ...
```

### New files — full inventory

```
apps/lsp/package.json                          workspace package manifest + VS Code extension manifest
apps/lsp/tsconfig.json                         TypeScript config (extends root)
apps/lsp/esbuild.js                            build script: bundles client + server
apps/lsp/.vscodeignore                         files excluded from .vsix
apps/lsp/.gitignore                            ignores dist/ and *.vsix

apps/lsp/server/server.ts                      LSP server entry point
apps/lsp/server/analyzer.ts                    wraps KindScript pipeline for server use
apps/lsp/server/ts-host.ts                     ts.LanguageServiceHost implementation
apps/lsp/server/diagnostic-mapper.ts           KS Diagnostic → LSP Diagnostic
apps/lsp/server/code-actions.ts                quick-fix code action provider
apps/lsp/server/debounce.ts                    analysis debounce utility

apps/lsp/client/extension.ts                   VS Code extension entry point

test/lsp/analyzer.test.ts                      analyzer integration tests (5 tests)
test/lsp/diagnostic-mapper.test.ts             diagnostic conversion tests (8 tests)
test/lsp/debounce.test.ts                      scheduler unit tests (5 tests)
test/lsp/code-actions.test.ts                  code action tests (6 tests)
```

**Note**: `src/application/lsp-check.ts` was removed from the plan per design decision #3 —
the analyzer calls `createProgramFromTSProgram()` directly, avoiding a new abstraction layer.

### Modified files

```
package.json                                   add "apps/lsp" to workspaces array
```

---

## Design Decisions

### 1. Monorepo placement

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| `apps/lsp/` in monorepo | Follows existing pattern (cli, dashboard). Shares tsconfig, deps. Easy to import from `src/application/`. | VS Code extension packaging requires its own `package.json` with extension metadata. |
| Separate repo | Clean boundary. Independent release cycle. | Cannot import from `src/` directly. Must consume `kindscript` npm package. Harder to develop in sync. |
| `packages/lsp/` workspace | Consistent with core packages. | Wrong abstraction level — `packages/` are libraries, not runnable shells. |

**Recommendation: `apps/lsp/`**

Consistent with `apps/cli/` and `apps/dashboard/`. The LSP is a runnable shell that
delegates to `src/application/` use cases, exactly like the CLI. Add `"apps/lsp"` to
the root `package.json` workspaces array so it gets its own `node_modules` resolution
and can declare VS Code extension dependencies.

---

### 2. TypeScript program management

This is the most consequential design decision. Our analysis requires a fully type-checked
`ts.Program` (for `typeString`, `symIsMethod`, symbol resolution). The LSP server must
create and maintain this independently of the editor's `tsserver`.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| `ts.createProgram()` on every change | Simple. Matches current `ksc check` pipeline exactly. | Slow — full parse + type-check on every keystroke. No incrementality. |
| `ts.createLanguageService()` | Incremental — only re-parses changed files. Caches SourceFiles via version tracking. Industry-proven (typescript-language-server uses this internally). | Must implement `ts.LanguageServiceHost`. More setup. |
| `ts.server.ProjectService` (or `@typescript-eslint/project-service`) | Highest-level API. Auto-detects tsconfig per file. Handles multi-project workspaces. | Heaviest abstraction. Less control. External dependency if using typescript-eslint's wrapper. |

**Recommendation: `ts.createLanguageService()`**

The language service API is designed for exactly this scenario — an interactive tool
that needs to re-check files as they change. It provides:

- **Incremental re-parsing**: only changed files are re-parsed (tracked via `getScriptVersion`)
- **Shared document registry**: `ts.createDocumentRegistry()` caches SourceFile objects
- **Program access**: `languageService.getProgram()` returns the current `ts.Program`,
  which we feed into `buildKSTree()` / `createProgramFromTSProgram()`
- **tsconfig integration**: the host reads `tsconfig.json` for compiler options

The implementation is a `ts.LanguageServiceHost` in `apps/lsp/server/ts-host.ts` that:
- Tracks open documents from LSP `textDocument/didOpen|didChange|didClose`
- Reads non-open files from disk
- Bumps a version string on each change
- Resolves compiler options from `tsconfig.json`

We avoid `ts.server.ProjectService` because it pulls in tsserver internals and is
designed for multi-project scenarios we don't need yet. If we later need multi-root
workspace support, we can upgrade.

---

### 3. Integration with existing pipeline

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| Call `createProgramFromTSProgram(deps, tsProgram, config)` directly | Reuses 100% of existing pipeline. Zero reimplementation. | Requires extracting `ts.Program` from the language service on each analysis run. |
| New use case `createProgramFromLanguageService()` | Can optimize for LS lifecycle (cache KS tree, track dirty files). | New code to maintain. Risk of diverging from CLI pipeline. |
| Reimplement detection in server | Could optimize per-file. | Defeats purpose of AG architecture. Maintenance nightmare. |

**Recommendation: Call `createProgramFromTSProgram()` directly**

The existing function does exactly what we need:

```
ts.LanguageService.getProgram() → ts.Program → createProgramFromTSProgram(deps, program, config)
                                                  → { getDiagnostics(), getKindDefinitions(), ... }
```

No new use case module needed initially. The server's `analyzer.ts` calls `getProgram()`
on the TS language service, then passes the result through the existing pipeline.

If performance becomes an issue on large codebases, we can later add a thin wrapper
(`src/application/lsp-check.ts`) that caches the KS tree and only re-converts changed
compilation units. But premature — start simple.

**Updated filesystem note**: Remove `src/application/lsp-check.ts` from the initial
implementation. Add it later if profiling shows conversion is the bottleneck.

---

### 4. Diagnostic model — push vs pull

**Options:**

| Option | LSP Version | How it works | Pros | Cons |
|--------|-------------|--------------|------|------|
| Push (`textDocument/publishDiagnostics`) | 3.0+ | Server sends diagnostics whenever ready | Universal support. Simple. | Server must track which files to push to. |
| Pull (`textDocument/diagnostic`) | 3.17+ | Client requests diagnostics per file | More efficient. Supports `resultId` caching. | Requires LSP 3.17. Slightly more complex. |

**Recommendation: Push diagnostics**

Universal support across all LSP clients. The server computes diagnostics after a
debounced file change and pushes them for all affected files. Pull diagnostics can
be added later as an optimization — the architecture doesn't change, just the trigger.

---

### 5. Diagnostic mapping

KindScript's `Diagnostic` type:

```typescript
{ node, message, kindName, property, pos, end, fileName }
```

LSP's `Diagnostic` type:

```typescript
{ range: { start: Position, end: Position }, severity, code, source, message, relatedInformation?, tags? }
```

**Mapping:**

| KS field | LSP field | Conversion |
|----------|-----------|------------|
| `pos`, `end` | `range` | `TextDocument.positionAt(pos)` → `{ line, character }` |
| `message` | `message` | Direct copy |
| `property` | `code` | Direct copy (e.g., `"protobuf-getter"`, `"noConsole"`) |
| — | `source` | Always `"kindscript"` |
| — | `severity` | `DiagnosticSeverity.Warning` for all (configurable later) |
| `fileName` | — | Used to group diagnostics per `textDocument/publishDiagnostics` |
| `kindName` | `relatedInformation` | Optional: link to the Kind definition site |

The `diagnostic-mapper.ts` module handles this conversion. It needs access to
`TextDocument` objects (from `vscode-languageserver-textdocument`) for `positionAt()`.
For non-open files, it reads content from disk and creates temporary TextDocument
instances.

---

### 6. Code actions (quick fixes)

**Options:**

| Option | Scope | Effort |
|--------|-------|--------|
| No code actions initially | Diagnostics only | 0 extra work |
| Protobuf getter fixes only | `user.name` → `user.getName()`, `user['name']` → `user.getName()` | 1–2 days |
| All violation fixes | Property-specific rewrites for each kind-checking property | Large, ongoing |

**Recommendation: Protobuf getter fixes in initial release**

These are mechanical, high-confidence rewrites:

| Violation pattern | Fix | Confidence |
|---|---|---|
| `expr.field` (read) | `expr.getField()` | High — capitalize first letter, prepend "get" |
| `expr.field = value` (write) | `expr.setField(value)` | High — capitalize first letter, prepend "set" |
| `expr['field']` (element read) | `expr.getField()` | High — same as property read |

The `code-actions.ts` module:

1. Receives `CodeActionParams` with the diagnostic range and the diagnostics
2. Filters for diagnostics with `source === "kindscript"` and `code === "protobuf-getter"`
3. Parses the field name from the diagnostic message (the message includes `'.name'`)
4. Generates a `TextEdit` replacing the violation range with the getter/setter call
5. Returns `CodeAction` with `kind: CodeActionKind.QuickFix` and `isPreferred: true`

For write violations (`expr.field = value`), the fix wraps the entire assignment
expression: `expr.setField(value)`. This requires the code action to inspect a
slightly larger range than the diagnostic covers. If the source text around the
diagnostic doesn't match the expected assignment pattern, the fix is omitted rather
than generating incorrect code.

---

### 7. File watching

**Options:**

| Option | How | Pros | Cons |
|--------|-----|------|------|
| Document sync only | `textDocument/didOpen|didChange|didClose` | Simple. Handles open files. | Misses changes from terminal, git, other tools. |
| Document sync + file watchers | Add `workspace/didChangeWatchedFiles` for `**/*.ts`, `**/tsconfig.json`, `**/ksc.config.ts` | Catches external changes. Handles config updates. | More setup. |

**Recommendation: Document sync + file watchers**

Cross-file analysis (protobuf type env, kind definitions) means a change in one file
can create or remove violations in other files. We need to know about changes to files
the user hasn't opened. File watchers catch:

- `.ts` file changes from terminal (`git checkout`, build tools, code generators)
- `tsconfig.json` changes (compiler options affect type resolution)
- `ksc.config.ts` changes (enable/disable protobuf checking, analysis depth)

Watcher registration (dynamic, in `onInitialized`):

```typescript
connection.client.register(DidChangeWatchedFilesNotification.type, {
  watchers: [
    { globPattern: '**/*.ts' },
    { globPattern: '**/*.tsx' },
    { globPattern: '**/tsconfig.json' },
    { globPattern: '**/ksc.config.ts' },
    { globPattern: '**/ksc.config.js' },
    { globPattern: '**/kindscript.config.ts' },
    { globPattern: '**/kindscript.config.js' },
  ]
});
```

---

### 8. Debounce strategy

**Options:**

| Option | Delay | Behavior |
|--------|-------|----------|
| No debounce | 0ms | Re-analyze on every keystroke. Wastes CPU. |
| Fixed debounce | 300ms | Wait 300ms after last change, then analyze. |
| Adaptive debounce | 300ms–2s | Short delay for small projects, longer for large. Scale based on last analysis duration. |

**Recommendation: Fixed 500ms debounce, adaptive later**

On each `textDocument/didChange` or `workspace/didChangeWatchedFiles`:

1. Mark the project as dirty
2. Cancel any pending analysis timer
3. Start a new 500ms timer
4. When timer fires: run full analysis, push diagnostics for all files

500ms balances responsiveness (feels instant to the developer) with CPU efficiency
(avoids analyzing mid-word). Can tune later based on user feedback.

The `debounce.ts` module exports a `Scheduler` class:

```typescript
class AnalysisScheduler {
  schedule(callback: () => void): void;   // debounced
  cancel(): void;
  dispose(): void;
}
```

---

### 9. Configuration

**Options:**

| Option | Source | Pros | Cons |
|--------|-------|------|------|
| Read `ksc.config.ts` from workspace | File-based, matches CLI | Consistent behavior between CLI and LSP | Requires config file resolution |
| VS Code extension settings | `contributes.configuration` in package.json | Familiar VS Code pattern. No file needed. | Different from CLI config |
| Both — extension settings override config file | Layered | Best of both worlds | More complexity |

**Recommendation: `ksc.config.ts` as primary, extension settings for overrides**

The server resolves `ksc.config.ts` using the existing `resolveConfig()` function from
`src/application/config.ts`. Extension settings provide overrides for editor-specific
preferences (like whether to show diagnostics as errors or warnings).

Extension settings in `package.json`:

```json
"contributes": {
  "configuration": {
    "title": "KindScript",
    "properties": {
      "kindscript.enable": {
        "type": "boolean",
        "default": true,
        "description": "Enable KindScript diagnostics"
      },
      "kindscript.severity": {
        "type": "string",
        "enum": ["error", "warning", "information", "hint"],
        "default": "warning",
        "description": "Diagnostic severity level"
      }
    }
  }
}
```

Config file changes (watched via file watchers) trigger a full re-analysis.

---

### 10. Transport

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| IPC (Node IPC) | Fast. No port conflicts. Default for VS Code. | VS Code specific transport. |
| stdio | Universal. Works with any LSP client. | Slightly slower than IPC. Must be careful with stdout. |
| Both — IPC for VS Code, stdio for other editors | Maximum compatibility | Minimal extra code |

**Recommendation: stdio with IPC option**

The server entry point detects the transport from command-line arguments:

```typescript
const connection = createConnection(ProposedFeatures.all);
// stdio by default, IPC if launched by VS Code extension with TransportKind.ipc
```

The VS Code client uses IPC (faster, no stdout conflicts). Other editors (Neovim,
Emacs, Helix) use stdio. The `vscode-languageserver` library handles both transparently
via `createConnection()`.

---

### 11. Server lifecycle

**Options:**

| Option | Behavior | Pros | Cons |
|--------|----------|------|------|
| Analyze on open | Only analyze open files | Fast startup | Misses cross-file issues in unopened files |
| Analyze workspace on init | Full project analysis at startup | Complete diagnostics immediately | Slow startup on large projects |
| Lazy + background | Analyze open files immediately, queue full project analysis | Responsive startup + complete coverage | More complex |

**Recommendation: Analyze on open + full project in background**

1. **On startup**: resolve `ksc.config.ts`, create `ts.LanguageService`, discover
   root files from tsconfig
2. **On first file open**: analyze the full project in the background (non-blocking),
   push diagnostics for all files as they're computed
3. **On subsequent changes**: debounced re-analysis of the full project (500ms)
4. **On file open**: if diagnostics are cached, return immediately; otherwise trigger
   analysis

This gives the user instant feedback on the file they're looking at while
progressively computing diagnostics for the rest of the project.

---

### 12. Build and packaging

**Options:**

| Option | Tool | Pros | Cons |
|--------|------|------|------|
| tsc only | TypeScript compiler | Simple. Already configured. | Large output. Slow VS Code extension load. |
| esbuild bundle | esbuild | Fast. Single-file output. Tree-shaking. | Extra build step. |
| webpack bundle | webpack | Mature. VS Code's own recommendation. | Slow. Complex config. |

**Recommendation: esbuild**

Bundle client and server into single files (`dist/extension.js`, `dist/server.js`).
This is the approach recommended by VS Code's own documentation and used by most
modern extensions.

`apps/lsp/esbuild.js`:

```javascript
const esbuild = require('esbuild');
const production = process.argv.includes('--production');

// Bundle server
await esbuild.build({
  entryPoints: ['server/server.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: 'dist/server.js',
  external: [],
  minify: production,
  sourcemap: !production,
});

// Bundle client
await esbuild.build({
  entryPoints: ['client/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: 'dist/extension.js',
  external: ['vscode'],  // provided at runtime by VS Code
  minify: production,
  sourcemap: !production,
});
```

The `vsce package` command creates a `.vsix` file from the bundled output.

---

### 13. Cross-editor support

The LSP server is editor-agnostic. The VS Code extension is a thin client. For
other editors:

| Editor | Setup |
|--------|-------|
| VS Code | Install extension (marketplace or `.vsix`) |
| Neovim (nvim-lspconfig) | `require('lspconfig').kindscript.setup({ cmd = { 'node', 'path/to/server.js', '--stdio' } })` |
| Emacs (lsp-mode / eglot) | Add server command to `lsp-clients` or `eglot-server-programs` |
| Helix | Add to `languages.toml` |
| Sublime Text (LSP package) | Add server config to LSP settings |

The server binary is distributed via npm (`npx kindscript-lsp --stdio`) or bundled
in the VS Code extension.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           VS Code                                        │
│                                                                          │
│  ┌─────────────────────────┐                                             │
│  │  Extension (client)     │                                             │
│  │  client/extension.ts    │                                             │
│  │                         │─── IPC ───┐                                 │
│  │  • spawns server        │           │                                 │
│  │  • registers watchers   │           │                                 │
│  │  • forwards settings    │           │                                 │
│  └─────────────────────────┘           │                                 │
│                                        │                                 │
│  ┌─────────────────────────┐           │                                 │
│  │  Problems Panel         │           │                                 │
│  │  ┌─────────────────┐   │           │                                 │
│  │  │ ⚠ kindscript     │   │           │                                 │
│  │  │  user.name → use │   │           │                                 │
│  │  │  getName()       │   │           │                                 │
│  │  └─────────────────┘   │           │                                 │
│  └─────────────────────────┘           │                                 │
└────────────────────────────────────────│─────────────────────────────────┘
                                         │
                 ┌───────────────────────┘
                 │
┌────────────────│─────────────────────────────────────────────────────────┐
│ Server Process │                                                         │
│                ▼                                                         │
│  ┌─────────────────────────┐     ┌──────────────────────────────────┐   │
│  │  server.ts              │     │  ts-host.ts                      │   │
│  │                         │     │                                  │   │
│  │  • createConnection()   │     │  ts.LanguageServiceHost impl:    │   │
│  │  • onInitialize         │     │  • getScriptVersion(fileName)    │   │
│  │  • onDidChangeContent   │     │  • getScriptSnapshot(fileName)   │   │
│  │  • onCodeAction         │     │  • getScriptFileNames()          │   │
│  │  • onDidChangeWatched   │     │  • getCompilationSettings()      │   │
│  └────────┬────────────────┘     └──────────────┬───────────────────┘   │
│           │                                      │                      │
│           ▼                                      ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  analyzer.ts                                                     │   │
│  │                                                                  │   │
│  │  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐  │   │
│  │  │ ts.Language   │───▶│ buildKSTree() │───▶│ evaluator        │  │   │
│  │  │ Service       │    │               │    │ .evaluate()      │  │   │
│  │  │ .getProgram() │    │ (convert.ts   │    │                  │  │   │
│  │  └──────────────┘    │  from src/)    │    │ (engine.ts       │  │   │
│  │                       └───────────────┘    │  from packages/) │  │   │
│  │                                            └────────┬─────────┘  │   │
│  └─────────────────────────────────────────────────────│────────────┘   │
│                                                         │               │
│           ┌─────────────────────────────────────────────┘               │
│           ▼                                                             │
│  ┌────────────────────┐    ┌───────────────────────┐                   │
│  │ diagnostic-mapper  │    │ code-actions.ts        │                   │
│  │                    │    │                        │                   │
│  │ KS Diagnostic →    │    │ protobuf violations →  │                   │
│  │ LSP Diagnostic     │    │ getText/setName fixes   │                   │
│  │ (positionAt, code, │    │                        │                   │
│  │  source, severity) │    │ CodeAction[]           │                   │
│  └────────────────────┘    └───────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘

REUSED FROM EXISTING CODEBASE (zero reimplementation):
  src/application/check-program.ts       createProgramFromTSProgram()
  src/application/evaluation/ts-kind-checking.ts   evaluator, translator, depGraph
  src/application/config.ts              resolveConfig()
  src/adapters/grammar/ast-translator/   buildKSTree()
  src/adapters/analysis/spec/            equations, projections, dispatch
  packages/core-evaluator/               AG engine
  packages/core-grammar/                 grammar types
```

---

## Module Specifications

### `apps/lsp/server/server.ts` — entry point

Responsibilities:
- Create LSP connection (`createConnection`)
- Initialize `TextDocuments` manager for document sync
- On `initialize`: resolve workspace root, load `ksc.config.ts`, create `ts.LanguageServiceHost` + `ts.LanguageService`, instantiate `Analyzer`
- On `initialized`: register file watchers (`**/*.ts`, `**/tsconfig.json`, `**/ksc.config.*`)
- On `documents.onDidChangeContent`: schedule debounced re-analysis
- On `connection.onDidChangeWatchedFiles`: bump file versions in host, schedule re-analysis
- On `connection.onCodeAction`: delegate to `code-actions.ts`
- On `connection.onDidChangeConfiguration`: update severity settings
- Listen

Exports nothing — this is the process entry point.

### `apps/lsp/server/analyzer.ts` — KindScript analysis wrapper

Responsibilities:
- Hold references to `ts.LanguageService`, `CheckDeps`, `KindScriptConfig`
- `analyze(): Map<string, KSDiagnostic[]>` — call `languageService.getProgram()`,
  then `createProgramFromTSProgram(deps, program, config)`, return diagnostics grouped
  by file name
- Cache the last result; return cached if project version hasn't changed
- Expose `updateConfig(config)` for when `ksc.config.ts` changes

Does NOT import LSP types — works purely with KindScript types. The server module
handles the KS→LSP diagnostic conversion.

### `apps/lsp/server/ts-host.ts` — TS LanguageServiceHost

Responsibilities:
- Implement `ts.LanguageServiceHost` interface
- Track document versions (Map<string, number>)
- For open documents: read content from `TextDocuments` manager
- For non-open files: read from disk via `ts.sys.readFile()`
- `getCompilationSettings()`: read from `tsconfig.json` via `ts.parseJsonConfigFileContent()`
- `getScriptFileNames()`: return all `.ts` files from tsconfig includes
- `bumpVersion(fileName)`: increment version counter (called on file change)
- `getProjectVersion()`: global version string, incremented on any file change

### `apps/lsp/server/diagnostic-mapper.ts` — diagnostic conversion

Responsibilities:
- Convert `KSDiagnostic[]` → `LSP.Diagnostic[]` for a given file
- Use `TextDocument.positionAt(offset)` for position mapping
- Set `source: "kindscript"`, `code: diagnostic.property`
- Set severity from extension settings (default: Warning)
- Optionally add `relatedInformation` linking to the Kind definition site

Pure function — no state.

### `apps/lsp/server/code-actions.ts` — quick fixes

Responsibilities:
- Receive `CodeActionParams` (range + diagnostics in that range)
- For each diagnostic with `source === "kindscript"` and `code === "protobuf-getter"`:
  - Parse field name from message (e.g., `'.name'` → `name`)
  - Determine if read or write (inspect source text around the diagnostic range)
  - Generate fix: `expr.name` → `expr.getName()` or `expr.name = value` → `expr.setName(value)`
  - Return `CodeAction` with `WorkspaceEdit` containing the `TextEdit`
- Mark fixes as `isPreferred: true` (for auto-fix-on-save)

### `apps/lsp/server/debounce.ts` — analysis scheduler

Responsibilities:
- `schedule(callback, delayMs)`: cancel pending timer, start new one
- `cancel()`: cancel pending timer without running callback
- `dispose()`: cleanup

### `apps/lsp/client/extension.ts` — VS Code client

Responsibilities:
- `activate(context)`: create `LanguageClient`, start it
- Server module path: `context.asAbsolutePath('dist/server.js')`
- Document selector: `[{ scheme: 'file', language: 'typescript' }, { scheme: 'file', language: 'typescriptreact' }]`
- Forward workspace configuration changes to server
- `deactivate()`: stop client

---

## Implementation Plan

### Phase 1: Minimal viable server (diagnostics only) — COMPLETE

**Goal**: See KindScript squiggles in VS Code.

1. [x] **Scaffold `apps/lsp/`** — `package.json`, `tsconfig.json`, `.vscodeignore`
2. [x] **Implement `ts-host.ts`** — LanguageServiceHost wrapping TextDocuments + disk reads
3. [x] **Implement `analyzer.ts`** — call `createProgramFromTSProgram()` with deps from
   `src/application/evaluation/ts-kind-checking.ts`
4. [x] **Implement `diagnostic-mapper.ts`** — KS Diagnostic → LSP Diagnostic conversion
5. [x] **Implement `debounce.ts`** — simple timer-based debounce
6. [x] **Implement `server.ts`** — wire everything together, push diagnostics on change
7. [x] **Implement `client/extension.ts`** — spawn server, register TS document selector
8. [x] **Add `esbuild.js`** — bundle client + server
9. [ ] **Test manually** — open the protobuf-enforcement example in VS Code, verify squiggles

**Implementation note**: Used `vscode-languageserver` v9.0.1 and `vscode-languageclient` v9.0.1
(v10 is not released yet — only next-channel prereleases available). Added `"type": "module"`
to `apps/lsp/package.json` for ESM compatibility with the root project.

### Phase 2: Code actions — COMPLETE

**Goal**: Lightbulb fixes for protobuf getter violations.

1. [x] **Implement `code-actions.ts`** — parse diagnostic messages, generate TextEdits
2. [x] **Register `onCodeAction` handler** in server.ts
3. [ ] **Test manually** — trigger quick fix on `user.name`, verify it becomes `user.getName()`
4. [x] **Handle write violations** — `user.name = 'x'` → `user.setName('x')`
5. [x] **Handle element access** — `user['name']` → `user.getName()`

### Phase 3: Robustness — COMPLETE

**Goal**: Handle real-world edge cases.

1. [x] **Config file watching** — re-resolve `ksc.config.ts` on change, re-analyze
2. [x] **tsconfig watching** — rebuild TS LanguageService on tsconfig change
3. [ ] **Multi-root workspaces** — one TS language service per workspace folder (deferred)
4. [x] **Error handling** — graceful degradation if analysis throws (analyzer.ts catches + keeps last good diagnostics)
5. [x] **Status reporting** — `connection.console.log` for analysis events
6. [x] **Write integration tests** (`test/lsp/`) — 24 tests across 4 test files

**Test results**: 433 total tests pass (409 existing + 24 new LSP tests).

Tests written:
- `test/lsp/analyzer.test.ts` — 5 tests: protobuf on/off, file grouping, cache clearing, getLastDiagnostics
- `test/lsp/diagnostic-mapper.test.ts` — 8 tests: position mapping, source/code/severity, multi-diag
- `test/lsp/debounce.test.ts` — 5 tests: schedule/cancel/dispose/re-schedule/custom-delay
- `test/lsp/code-actions.test.ts` — 6 tests: getter fix, setter fix, filtering, capitalization, multi-diag

### Phase 4: Polish and distribution — PARTIAL

**Goal**: Publish to VS Code marketplace.

1. [x] **Extension icon and README** — 128x128 PNG icon, marketplace README with feature docs
2. [x] **`vsce package`** — produces `kindscript-vscode-0.1.0.vsix` (3.92 MB)
3. [ ] **CI integration** — build + package on push
4. [x] **npm distribution** — `bin.kindscript-lsp` entry in package.json, shebang in bundled server
5. [ ] **Neovim/Emacs setup docs**

**Implementation notes**:
- Package name changed from `@kindscript/vscode` to `kindscript-vscode` (VS Code doesn't allow scoped names)
- Bundle outputs use `.cjs` extension to avoid ESM/CJS conflict (package.json has `"type": "module"`)
- Production server bundle: 3.7 MB (minified); dev: 10 MB
- esbuild build script renamed to `esbuild.cjs` (CommonJS required since it uses `require`)

---

## Risk Analysis

### Performance: full re-analysis on every change

**Risk**: The full pipeline (`buildKSTree` + `evaluate`) runs on the entire project on
every change. On large codebases (1000+ files), this could take seconds.

**Mitigation (immediate)**: The TS LanguageService handles the expensive part
(type-checking) incrementally. KS conversion + evaluation is typically fast (~100–300ms).
The 500ms debounce prevents re-analysis during rapid typing.

**Mitigation (future)**: Add incremental conversion to `buildKSTree` — only re-convert
changed SourceFiles, reuse cached KS nodes for unchanged files. This is a change to
`src/adapters/grammar/ast-translator/ts-ast/convert.ts`, not the LSP server.

### Double type-checking

**Risk**: The LS server creates its own TypeScript language service, duplicating work
that the editor's `tsserver` is already doing.

**Mitigation**: This is the fundamental cost of a standalone LSP. The TS language
service is incremental and caches aggressively, so steady-state cost is low (only
re-checks changed files). Memory is the bigger concern — two full TypeScript programs
in memory. For typical projects (<500 files) this is fine. For very large projects,
consider the TS plugin approach (Option 1 from the analysis document) as a lighter
alternative.

### Cross-file diagnostic staleness

**Risk**: Protobuf type env is project-wide. Changing an import in file A can create
violations in file B. If we only re-analyze file A, file B's diagnostics are stale.

**Mitigation**: Always run full-project analysis (not per-file). This is why we use
the existing pipeline (which evaluates the whole tree) rather than per-file analysis.
The debounce ensures we don't do this too frequently.

---

## Appendix: `apps/lsp/package.json` structure (as implemented)

```json
{
  "name": "kindscript-vscode",
  "displayName": "KindScript",
  "description": "Architectural enforcement for TypeScript — inline diagnostics and quick fixes",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "publisher": "kindscript",
  "icon": "icon.png",
  "engines": { "vscode": "^1.82.0" },
  "categories": ["Linters"],
  "activationEvents": ["onLanguage:typescript", "onLanguage:typescriptreact"],
  "main": "./dist/extension.cjs",
  "bin": {
    "kindscript-lsp": "./dist/server.cjs"
  },
  "contributes": {
    "configuration": {
      "title": "KindScript",
      "properties": {
        "kindscript.enable": {
          "type": "boolean",
          "default": true,
          "description": "Enable KindScript diagnostics"
        },
        "kindscript.severity": {
          "type": "string",
          "enum": ["error", "warning", "information", "hint"],
          "default": "warning",
          "description": "Diagnostic severity level"
        }
      }
    }
  },
  "scripts": {
    "build": "node esbuild.cjs",
    "build:production": "node esbuild.cjs --production",
    "package": "node esbuild.cjs --production && vsce package --no-dependencies",
    "vscode:prepublish": "node esbuild.cjs --production"
  },
  "dependencies": {
    "vscode-languageclient": "^9.0.1",
    "vscode-languageserver": "^9.0.1",
    "vscode-languageserver-textdocument": "^1.0.12"
  },
  "devDependencies": {
    "@types/vscode": "^1.82.0",
    "@vscode/vsce": "^3.0.0",
    "esbuild": "^0.25.0"
  }
}
```
