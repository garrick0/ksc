# Language Server Integration — Analysis of Options

## Context

KindScript's protobuf getter enforcement (and the broader kind-checking analysis) currently
runs via CLI (`ksc check`) and programmatic API (`createProgram()`). Both produce
`Diagnostic[]` with file name, position, end, message, and property name. The natural next
step is surfacing these diagnostics in VS Code as inline squiggles, Problem panel entries,
and eventually quick fixes.

This document analyzes the integration options, drawing on how other tools have solved this
and accounting for KindScript's specific architecture.

---

## What We Need to Surface

```
Diagnostic {
  node: KSNode;
  message: string;          // "Direct field access '.name' on protobuf type 'User' — use getter method instead"
  kindName: string;
  property: string;         // "protobuf-getter" | "noConsole" | "immutable" | ...
  pos: number;              // byte offset in file
  end: number;              // byte offset end
  fileName: string;         // absolute path
}
```

These map directly to LSP/VS Code diagnostics: `range` (from pos/end), `message`, `source`
("kindscript"), `code` (property name), `severity` (Error or Warning).

---

## KindScript's Analysis Pipeline — What an Integration Must Account For

```
ts.Program  →  buildKSTree()  →  KS AST  →  evaluator.evaluate()  →  { definitions, diagnostics }
   ↑                                              ↑
   │                                              │
  needs TypeScript's                         attribute grammar:
  type checker for                           lazy, memoized,
  typeString, symIsMethod,                   but NOT incremental
  resolvedFileName, etc.                     (full re-eval on change)
```

### Key characteristics

1. **Depends on `ts.Program`** — the converter calls `getTypeChecker()`, `getSymbolAtLocation()`,
   `typeToString()`, etc. Cannot run without a TypeScript program instance.

2. **Non-incremental conversion** — `buildKSTree()` walks all source files every time.
   No per-file caching or dirty tracking.

3. **Non-incremental evaluation** — AG evaluation is lazy + memoized within one run, but
   the entire tree must be rebuilt from scratch when any file changes. No attribute
   invalidation mechanism.

4. **Fast enough for batch** — the full pipeline runs in ~1–2 seconds on the test suite
   (409 tests, including multiple fixture compilations). Single-fixture runs take
   200–600ms including TypeScript compilation.

5. **Protobuf checking is cross-file** — `protobufTypes` is collected per-CompilationUnit,
   then broadcast via inherited `protobufTypeEnv` to every node. A change in imports
   can affect violations in other files.

---

## Option 1: TypeScript Language Service Plugin

### How it works

A TS plugin is a module loaded by `tsserver` (the process VS Code uses for TypeScript).
It receives the existing `LanguageService` and decorates methods like
`getSemanticDiagnostics()`. Users enable it in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "kindscript-ts-plugin", "protobuf": { "enabled": true } }]
  }
}
```

The plugin intercepts `getSemanticDiagnostics(fileName)`, runs our analysis, and appends
KindScript diagnostics alongside TypeScript's own diagnostics.

### Architecture

```
tsserver process
  └─ LanguageService
       └─ kindscript-ts-plugin (decorator)
            ├─ calls original.getSemanticDiagnostics(fileName)  → TS diagnostics
            ├─ calls tsProgram = info.project.getProgram()       → shared ts.Program
            ├─ calls buildKSTree(tsProgram)                      → KS AST
            ├─ calls evaluator.evaluate(ksTree.root)             → KS diagnostics
            ├─ filters diagnostics for this fileName
            └─ returns [...tsDiags, ...ksDiags]
```

### Advantages

- **Shares the `ts.Program`** — tsserver already has a fully type-checked program.
  No separate TypeScript project creation. No double type-checking. This is the
  single biggest advantage: we get `typeString`, `symIsMethod`, symbol resolution,
  etc. for free from the editor's existing TS work.

- **Zero-config activation** — just add to `tsconfig.json`. No separate extension
  install (though we'd likely publish one for discoverability).

- **Minimal code** — the plugin is ~100–200 lines of glue. All heavy lifting is
  done by the existing `buildKSTree()` + `evaluator.evaluate()` pipeline.

- **Diagnostics feel native** — they appear alongside TS errors in the same
  squiggle/tooltip UI. Source is "ts" (the standard TypeScript source label).

- **Already proven pattern** — `typescript-styled-plugin` (CSS-in-JS diagnostics),
  `ts-graphql-plugin` (GraphQL validation), Angular Language Service (rename
  delegation) all use this approach successfully.

### Disadvantages

- **Editor-only** — `tsc` does not load plugins. Cannot be used in CI. But we already
  have `ksc check` for that, so this is fine — the plugin is a complementary channel.

- **No custom source label** — diagnostics appear as source "ts". Users cannot filter
  KindScript diagnostics separately in the Problems panel. (Workaround: prefix messages
  with `[ksc]` or use a diagnostic code like `ksc(protobuf-getter)`.)

- **`getSemanticDiagnostics` is per-file** — but our analysis is cross-file (protobuf
  type env is project-wide). We'd need to run the full pipeline and cache results,
  returning only the relevant file's diagnostics for each call. tsserver calls this
  method frequently (on every keystroke with a debounce), so caching is essential.

- **Limited feature scope** — can decorate existing LS methods (diagnostics, completions,
  hover, code fixes) but cannot add new protocol methods or custom commands.

- **tsserver editors only** — works in VS Code, WebStorm, Sublime with TS plugin,
  Neovim with nvim-lspconfig's tsserver, but not in editors without tsserver.

### Performance strategy

The critical concern is that `getSemanticDiagnostics` is called frequently. We cannot
re-run the full pipeline on every keystroke. Strategy:

1. **Cache the KS evaluation result** (diagnostics grouped by file name).
2. **Invalidate on project version change** — tsserver exposes a project version that
   increments when any file changes. When version changes, mark cache dirty.
3. **Debounce re-evaluation** — when cache is dirty and `getSemanticDiagnostics` is
   called, schedule re-evaluation after a delay (e.g., 500ms). Return stale results
   until re-evaluation completes.
4. **Background re-evaluation** — run `buildKSTree` + `evaluate` on a microtask or
   `setImmediate` to avoid blocking the LS response loop.

### What this looks like in practice

```typescript
// kindscript-ts-plugin/index.ts
function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
  return {
    create(info: ts.server.PluginCreateInfo) {
      const original = info.languageService;
      const proxy = Object.create(null);

      // Copy all methods
      for (const k of Object.keys(original)) {
        (proxy as any)[k] = (original as any)[k].bind(original);
      }

      let cache: Map<string, ts.Diagnostic[]> | null = null;
      let lastVersion = -1;

      proxy.getSemanticDiagnostics = (fileName: string): ts.Diagnostic[] => {
        const tsDiags = original.getSemanticDiagnostics(fileName);
        const program = info.project.getProgram();
        if (!program) return tsDiags;

        const version = (info.project as any).getProjectVersion?.() ?? 0;
        if (version !== lastVersion) {
          cache = runKindScriptAnalysis(program, info.config);
          lastVersion = version;
        }

        return [...tsDiags, ...(cache?.get(fileName) ?? [])];
      };

      return proxy;
    },
  };
}
```

### Estimated effort

Small — 1–2 days. The pipeline already exists. The plugin is thin glue code plus
caching logic. Main work is mapping `Diagnostic` → `ts.Diagnostic` (pos/end offsets
to line/character, message formatting, category selection).

---

## Option 2: Standalone Language Server (LSP)

### How it works

A standalone Node.js process implements the Language Server Protocol. A VS Code extension
(the "client") spawns and communicates with this server. The server creates its own
TypeScript project, runs KindScript analysis, and pushes diagnostics to the client.

### Architecture

```
VS Code
  └─ Extension (language client)
       └─ IPC ──→ KindScript Language Server (separate process)
                    ├─ document sync (open/change/close)
                    ├─ ts.createProgram() or ts.createLanguageService() (own instance)
                    ├─ buildKSTree() + evaluator.evaluate()
                    ├─ connection.sendDiagnostics({ uri, diagnostics })
                    └─ code action handler (quick fixes)
```

### Advantages

- **Full control** — custom source label ("kindscript"), custom diagnostic codes,
  code actions, hover info, custom commands, status bar integration.

- **Cross-editor** — LSP works in VS Code, Neovim, Emacs, Sublime, Helix, Zed.
  One server implementation, many clients.

- **Build-time capable** — the same server binary can run in CI mode
  (`ksc check --lsp` or just `ksc check`).

- **Custom diagnostic source** — diagnostics appear as source "kindscript" in the
  Problems panel, cleanly separated from TypeScript errors. Users can filter.

- **Richer UI** — can provide hover info ("This is a protobuf type imported from
  user_pb.ts — use getName() instead"), related diagnostics (link to the import
  that marks this as a protobuf type), and diagnostic tags (Unnecessary, Deprecated).

- **Code actions** — can suggest auto-fixes: replace `user.name` with `user.getName()`,
  replace `user['name']` with `user.getName()`. This is the highest-value UX feature
  beyond diagnostics.

- **Proven at scale** — rust-analyzer, Sorbet, Flow, Biome, Prisma, GraphQL LS all
  use standalone LSP servers.

### Disadvantages

- **Must create own `ts.Program`** — cannot share the editor's TypeScript program.
  This means either:
  - Creating a second `ts.Program` (double memory, double type-checking time)
  - Using `ts.createLanguageService()` with a custom `LanguageServiceHost`
    (more setup, but incremental)
  - Using the new TypeScript `projectService` API (experimental)

  This is the fundamental cost of the standalone approach for a TypeScript-dependent
  analysis tool.

- **Document synchronization** — must handle `textDocument/didOpen`, `didChange`,
  `didClose`, `didSave` events. Must maintain an in-memory view of open files and
  sync with disk for non-open files.

- **Significant setup** — need two npm packages (client extension + server), VS Code
  extension manifest, activation events, build pipeline for `.vsix` packaging.

- **Complexity** — ~500–1000 lines of server code plus ~200 lines of client code,
  plus build/packaging infrastructure. Much more than the TS plugin approach.

### Performance strategy

1. **Use `ts.createLanguageService()`** instead of `ts.createProgram()` — the LS
   API is incremental. It maintains a `Program` that updates efficiently when files
   change (only re-parses and re-checks affected files).

2. **Debounce analysis** — on `textDocument/didChange`, wait 500ms–1s before
   re-running KindScript analysis. This avoids re-running on every keystroke.

3. **Incremental KS analysis** (future) — if we add dirty-tracking to `buildKSTree`,
   we could re-convert only changed files and re-evaluate only affected attributes.
   This is a significant engineering effort but would make the server fast on large
   codebases.

4. **Cache diagnostics per file** — only re-push diagnostics for files whose
   diagnostics actually changed.

### Estimated effort

Medium — 3–5 days for a working prototype, 1–2 weeks for production quality with
code actions and proper error handling. The heavy lifting is the TS language service
host setup and incremental update logic.

---

## Option 3: ESLint Custom Rules (via typescript-eslint)

### How it works

Publish an ESLint plugin (`eslint-plugin-kindscript`) with custom rules. Rules use
typescript-eslint's type-aware linting to access the TypeScript type checker. The
existing ESLint VS Code extension surfaces diagnostics.

### Architecture

```
ESLint (in VS Code extension or CLI)
  └─ @typescript-eslint/parser (parses TS → ESTree AST)
       └─ eslint-plugin-kindscript
            └─ rule: protobuf-getter
                 ├─ parserServices.getTypeChecker()
                 ├─ walk PropertyAccessExpression nodes
                 ├─ check typeString against protobuf patterns
                 └─ context.report({ node, message })
```

### Advantages

- **Zero infrastructure** — no language server, no VS Code extension. Just an npm
  package. Users add it to their ESLint config and it works.

- **Existing ecosystem** — ESLint VS Code extension handles diagnostics, code actions
  (auto-fix), severity configuration, ignore comments, per-file overrides.

- **CI integration for free** — `eslint .` runs the rules at build time.

- **Familiar to users** — developers already know ESLint config, `.eslintignore`,
  inline `// eslint-disable` comments, etc.

- **Type checker access** — typescript-eslint's `projectService` gives rules access
  to the full `ts.TypeChecker` via `parserServices.getTypeChecker()`.

- **Auto-fix support** — ESLint rules can provide `fix` functions that transform
  `user.name` → `user.getName()`.

### Disadvantages

- **Different AST** — ESLint uses ESTree, not KindScript's AST. We would need to
  reimplement the detection logic against ESTree nodes instead of reusing our existing
  equations. This is the fundamental impedance mismatch.

  However, for protobuf getter checking specifically, the ESTree approach might be
  simpler than the AG approach — we just need to visit `MemberExpression` nodes and
  check the object's type. No need for the full collect-propagate-check pattern
  because ESLint rules can directly call `getTypeChecker()`.

- **Cannot reuse KindScript evaluation** — the whole point of KindScript is attribute
  grammar evaluation with inherited/synthesized attributes. ESLint rules are
  visitor-based, not AG-based. Porting all KindScript analyses to ESLint rules
  would mean reimplementing them in a different paradigm.

- **Performance overhead** — typescript-eslint's `projectService` creates and manages
  a TypeScript program. Combined with ESLint's own overhead, this can be slow on
  large projects. Users already complain about typescript-eslint performance.

- **Diagnostics-only** — ESLint cannot provide hover info, go-to-definition,
  completions, or other language features. Limited to diagnostics + auto-fixes.

- **Configuration complexity** — users must configure ESLint + typescript-eslint +
  our plugin. Flat config vs legacy config, parser options, project service setup.
  This is a known pain point in the typescript-eslint ecosystem.

### When this makes sense

If we wanted to ship just the protobuf getter rule as a standalone lint check without
requiring the full KindScript infrastructure, an ESLint rule would be the simplest
distribution mechanism. But it would be a reimplementation, not a reuse of our AG pipeline.

### Estimated effort

Medium — 2–3 days for the protobuf-getter rule. But this is a reimplementation, not
an integration. Each new KindScript analysis would need its own ESLint rule.

---

## Option 4: Hybrid — TS Plugin + CLI

### How it works

Combine Option 1 (TS plugin for editor diagnostics) with the existing CLI (`ksc check`)
for build-time checking. The TS plugin reuses the editor's `ts.Program`; the CLI
creates its own. Both share the same analysis pipeline.

### Architecture

```
                    ┌─────────────────────────────┐
                    │  KindScript Analysis Core    │
                    │  buildKSTree + evaluate      │
                    └──────┬───────────┬───────────┘
                           │           │
              ┌────────────┴──┐  ┌─────┴────────────┐
              │  TS Plugin    │  │  CLI (ksc check)  │
              │  (editor)     │  │  (CI / terminal)  │
              │               │  │                   │
              │  shares       │  │  creates own      │
              │  ts.Program   │  │  ts.Program       │
              └───────────────┘  └───────────────────┘
```

This is the approach Angular and Vue/Volar use — a lightweight editor integration
that shares the TS program, plus a standalone tool for CI.

### Why this is the recommended approach

1. **Minimal new code** — the TS plugin is thin glue (~200 lines). The CLI already exists.

2. **No double type-checking** — the plugin reuses the editor's `ts.Program`.

3. **Both channels covered** — editor squiggles for developer experience, CLI for CI.

4. **Incremental path** — start with the TS plugin (Option 1), add a full LSP later
   if we need richer features (code actions, hover, custom source label).

5. **Separation of concerns** — the plugin only does diagnostics. The CLI does
   everything (diagnostics, codegen, init). No feature parity pressure.

---

## Option 5: VS Code Extension with Embedded Analysis (No LSP)

### How it works

A standard VS Code extension that runs KindScript analysis directly in the extension
host process. Uses the `vscode.languages.createDiagnosticCollection()` API to publish
diagnostics. Listens to file change events to trigger re-analysis.

### Architecture

```
VS Code Extension Host
  └─ kindscript extension
       ├─ vscode.workspace.onDidChangeTextDocument → debounced re-analysis
       ├─ ts.createProgram() (own instance)
       ├─ buildKSTree() + evaluate()
       └─ diagnosticCollection.set(uri, diagnostics)
```

### Advantages

- **Full VS Code API access** — status bar, output channel, webview panels,
  tree views, command palette, keybindings.

- **Custom source label** — diagnostics are tagged "kindscript".

- **Code actions** — can register `vscode.CodeActionProvider` for quick fixes.

- **Simpler than LSP** — no client-server split, no protocol overhead. One process.

### Disadvantages

- **VS Code only** — not cross-editor. No Neovim, Emacs, etc.

- **Must create own `ts.Program`** — same double-type-checking cost as Option 2.

- **Extension host performance** — the extension host is shared with all extensions.
  Heavy analysis can block the UI. (Mitigated by running analysis in a worker thread.)

- **Not reusable** — unlike LSP, cannot be used by other editors or tools.

### When this makes sense

If we want rich VS Code integration (webviews, tree views, custom panels) beyond
what LSP provides. But for diagnostics alone, the TS plugin is simpler and avoids
the double-type-checking cost.

---

## Comparison Matrix

| Dimension | TS Plugin | Standalone LSP | ESLint Rules | Hybrid (Plugin + CLI) | VS Code Extension |
|---|---|---|---|---|---|
| **Shares ts.Program** | Yes | No | Yes (via typescript-eslint) | Yes (plugin half) | No |
| **Editor diagnostics** | Yes | Yes | Yes | Yes | Yes |
| **CI / build-time** | No | Yes | Yes | Yes (CLI half) | No |
| **Custom source label** | No ("ts") | Yes | Yes ("eslint") | No (plugin) / Yes (CLI) | Yes |
| **Code actions / fixes** | Limited | Full | Yes (auto-fix) | Limited (plugin) | Full |
| **Cross-editor** | tsserver editors | Any LSP editor | ESLint-supported editors | tsserver + CLI | VS Code only |
| **Reuses KS pipeline** | Yes | Yes | No (reimplementation) | Yes | Yes |
| **Setup for users** | tsconfig entry | Extension install | ESLint config | tsconfig + CLI | Extension install |
| **Implementation effort** | 1–2 days | 1–2 weeks | 2–3 days per rule | 1–2 days | 3–5 days |
| **Maintenance burden** | Low | High | Medium | Low | Medium |

---

## What Other Tools Have Done

### Angular Language Service

**Approach**: Hybrid — TS plugin for rename delegation + standalone language service.

Angular's TS plugin (`@angular/language-service`) intercepts the TypeScript language
service to provide Angular-specific diagnostics in template files. The plugin shares
the editor's `ts.Program` and augments `getSemanticDiagnostics` to check Angular
templates. Build-time checking uses `ngc` (the Angular compiler CLI).

**Relevant lesson**: They started with a TS plugin for editor integration, which was
the simplest path. The plugin delegates to a richer Angular language service for
complex features.

### Vue / Volar

**Approach**: Dual — TS plugin (`@vue/typescript-plugin`) + standalone LSP
(`@vue/language-server`).

The TS plugin handles type checking integration for `.vue` files by generating virtual
TypeScript representations. The LSP server provides full language features (completions,
hover, diagnostics, code actions). Build-time checking uses `vue-tsc`.

**Relevant lesson**: For a tool that extends TypeScript analysis, the hybrid approach
lets you get type information cheaply via the TS plugin while providing full LSP
features for richer UX. They built the TS plugin first, then the LSP for features
that plugins cannot provide.

### Biome / Rome

**Approach**: Standalone LSP.

Biome runs as a long-lived daemon process. The VS Code extension communicates via LSP.
Biome does not depend on TypeScript's type checker — it has its own parser and analysis.
This makes the standalone LSP approach natural since there's no `ts.Program` to share.

**Relevant lesson**: Standalone LSP makes sense when you don't depend on TypeScript's
type checker. When you do (as KindScript does), you pay the cost of double analysis
unless you use a TS plugin.

### rust-analyzer

**Approach**: Standalone LSP.

The canonical example of a high-quality standalone language server. Incremental analysis
is the key engineering investment — rust-analyzer uses salsa (an incremental computation
framework) to avoid re-analyzing unchanged code. This is analogous to what KindScript
would need for a performant standalone LSP.

**Relevant lesson**: If going standalone, incremental computation is the critical
performance investment. rust-analyzer's salsa framework is conceptually similar to
an incremental attribute grammar evaluator.

### Sorbet (Ruby type checker)

**Approach**: Standalone LSP (`srb typecheck --lsp`).

Sorbet runs as an LSP server. Since Ruby has no built-in type checker to share,
standalone is the only option. Sorbet uses Watchman for file watching and maintains
its own project state.

**Relevant lesson**: When your analysis is the only type-level analysis (no existing
TS-like language service to share), standalone LSP is natural.

### typescript-eslint

**Approach**: ESLint plugin with type checker access.

typescript-eslint's `projectService` creates a TypeScript language service instance
that ESLint rules can query for type information. This is effectively a standalone
TS program instance inside ESLint's process.

**Relevant lesson**: Even within ESLint, type-aware rules need a `ts.Program`.
The performance cost is significant — typescript-eslint's typed linting is noticeably
slower than pure syntax linting. This cost would also apply to us if we took the
ESLint route.

---

## Recommendation

### Start with: Option 4 (Hybrid — TS Plugin + CLI)

**Phase 1: TS Plugin (1–2 days)**

Ship a TypeScript language service plugin (`kindscript-ts-plugin`) that:

1. Shares the editor's `ts.Program` (zero extra type-checking cost)
2. Runs `buildKSTree()` + `evaluator.evaluate()` on the shared program
3. Caches results, invalidating when project version changes
4. Returns KindScript diagnostics from `getSemanticDiagnostics(fileName)`
5. Reads plugin config from `tsconfig.json` (e.g., `{ "protobuf": { "enabled": true } }`)

This gives users inline squiggles and Problem panel entries with minimal effort.

**Phase 2: Quick Fixes via TS Plugin (1–2 days)**

Add `getCodeFixesAtPosition()` decoration to suggest replacements:
- `user.name` → `user.getName()`
- `user['name']` → `user.getName()`
- `user.name = 'x'` → `user.setName('x')`

This is the highest-value UX feature beyond basic diagnostics.

**Phase 3: VS Code Extension Wrapper (optional, 1 day)**

Wrap the TS plugin in a VS Code extension for discoverability on the marketplace.
The extension's only job is to add the plugin to the user's TS server configuration
automatically (via `typescript.tsserver.pluginPaths` setting). This avoids requiring
users to manually edit `tsconfig.json`.

**Phase 4: Standalone LSP (future, if needed)**

If we need features that TS plugins cannot provide — custom source labels, cross-editor
support beyond tsserver, custom protocol extensions, status bar integration — then
invest in a standalone LSP server. This is a larger effort (1–2 weeks) and should
only be undertaken when there's clear demand.

### Why not ESLint?

The ESLint approach requires reimplementing detection logic against ESTree instead of
reusing our AG pipeline. It's a parallel implementation, not an integration. It makes
sense for distributing a single rule (like protobuf-getter) to teams that don't want
the full KindScript toolchain, but it doesn't leverage the AG architecture that makes
KindScript's multi-attribute analyses composable.

### Why not standalone LSP first?

The standalone LSP's fundamental cost is creating and maintaining a separate `ts.Program`.
Since KindScript's analysis depends heavily on TypeScript type information (`typeString`,
`symIsMethod`, symbol resolution), this means double type-checking. The TS plugin avoids
this entirely. Start cheap, upgrade later if needed.

---

## Incremental Analysis — The Long Game

Regardless of which integration approach we choose, the biggest performance investment
for large codebases is incremental analysis. Today:

- `buildKSTree()` re-converts all files on every change
- `evaluator.evaluate()` re-evaluates all attributes on every change

For the TS plugin, this is acceptable on small-to-medium projects because the
shared `ts.Program` means we skip the most expensive step (TypeScript type checking).
The KS conversion + evaluation is fast (~100–500ms for typical projects).

For large codebases (1000+ files), we'd want:

1. **Incremental conversion** — only re-convert changed SourceFiles, reuse cached
   KS nodes for unchanged files.

2. **Incremental evaluation** — invalidate only attributes affected by the change.
   This is where AG theory meets practice: inherited attributes that depend on
   synthesized attributes from other files (like `protobufTypeEnv` depending on
   `protobufTypes` from all CUs) create cross-file invalidation chains.

   The research systems handle this differently:
   - **JastAdd**: incremental evaluation via dependency tracking and change propagation
   - **Silver**: module-level recompilation (coarser granularity but simpler)
   - **rust-analyzer/salsa**: fine-grained incremental computation with memoization
     and automatic invalidation

   For KindScript, the pragmatic approach is: re-evaluate the full tree but only
   re-convert changed files. This gets 80% of the benefit with 20% of the effort.

---

## Appendix: Key References

- [TypeScript Wiki — Writing a Language Service Plugin](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin)
- [VS Code — Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
- [typescript-eslint — Typed Linting](https://typescript-eslint.io/getting-started/typed-linting/)
- [typescript-styled-plugin](https://github.com/microsoft/typescript-styled-plugin) — reference TS plugin
- [ts-graphql-plugin](https://github.com/Quramy/ts-graphql-plugin) — reference TS plugin
- [Angular Language Service](https://github.com/angular/angular/tree/main/packages/language-service)
- [Volar.js framework](https://github.com/volarjs/volar.js) — reusable LS framework
- [rust-analyzer](https://github.com/rust-lang/rust-analyzer) — reference standalone LSP
- [Biome](https://biomejs.dev/) — standalone LSP for web tooling
- [Roslyn Analyzers](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/tutorials/how-to-write-csharp-analyzer-code-fix) — .NET's gold standard for analyzer integration
