# Research: LSP Testing Approaches Across Major Language Tools

How do TypeScript, rust-analyzer, gopls, Pyright, Biome, and others test their language servers end-to-end? This document surveys real-world testing infrastructure for static analysis tools and compilers, with a focus on realistic full-project analysis testing.

---

## Executive Summary

Every major language server project builds its own test infrastructure — **no standard LSP testing framework exists**. Microsoft maintainers confirmed this in [LSP issue #353](https://github.com/Microsoft/language-server-protocol/issues/353): "there is no standard output one can expect from any language server, there is no test suite for it."

The universal pattern across all projects is a **multi-tier testing strategy**:

| Tier | What it tests | Speed | Example |
|------|--------------|-------|---------|
| **Unit** | Analysis logic as pure functions (no LSP) | ~4ms/test | rust-analyzer IDE tests |
| **Protocol** | LSP wire format via in-memory connection | ~50-200ms/test | TypeScript tsserver tests |
| **Integration** | Full server lifecycle with fixture projects | ~1-5s/test | gopls integration tests |
| **E2E** | VS Code extension in real editor | ~10-30s/test | `@vscode/test-electron` |

All projects test **below** the LSP protocol layer for speed, then add protocol-level tests for wire-format correctness. Every project uses some form of **marker-based test fixtures** to embed expected diagnostics in source code.

---

## 1. TypeScript — The Gold Standard

TypeScript has the most mature and well-documented testing infrastructure, built over a decade.

### 1.1 Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Compiler tests | `tests/cases/compiler/` | JS output, .d.ts, diagnostics, types, symbols |
| Conformance | `tests/cases/conformance/` | Spec compliance |
| **Fourslash** | `tests/cases/fourslash/` | **IDE / language service features** |
| **tsserver** | `src/testRunner/unittests/tsserver/` | **76 files testing server protocol** |
| Project | `tests/cases/project/` | Multi-file compilation |

### 1.2 The Fourslash Test Format

TypeScript's crown jewel. A domain-specific testing language for IDE features, named for the `////` prefix on source lines.

**Anatomy of a fourslash test:**

```typescript
/// <reference path='fourslash.ts'/>

// Compiler options
// @strict: true

// Virtual file definitions
// @Filename: /src/utils.ts
//// export function greet(name: string) { return `Hello ${name}`; }

// @Filename: /src/main.ts
//// import { /*ref*/greet } from './utils';
//// greet("world");

// Verification (plain TypeScript calling the fourslash API)
verify.baselineGoToDefinition("ref");
```

**Key syntax:**
- `////` lines become virtual file content
- `// @Filename: /path` starts a new virtual file
- `// @option: value` sets compiler options
- `/*markerName*/` defines a named position marker
- `[|text|]` defines a range with `pos` and `end`

**Fourslash API — the verification DSL:**

```typescript
// Navigation
goTo.marker("name");
goTo.file("/path");
goTo.position(line, char);

// Diagnostics
verify.noErrors();
verify.getSemanticDiagnostics([{
  message: "Type 'string' is not assignable...",
  code: 2322,
  range: r
}]);
verify.errorExistsBetweenMarkers("start", "end");

// Completions
verify.completions({
  marker: "completion",
  includes: [{ name: "toFixed", kind: "method" }],
  excludes: ["toString"]
});

// Code fixes
verify.codeFix({
  description: "Add missing 'await'",
  newFileContent: "..."
});

// Hover info
verify.quickInfoIs("(method) Array<number>.push(...items: number[]): number");

// Refactoring
verify.refactorAvailable("Extract function");
```

**How it works internally:**
1. `fourslashRunner.ts` scans `tests/cases/fourslash/` and generates Mocha tests
2. `parseTestData()` extracts files, markers, ranges from the `////`-prefixed source
3. A virtual filesystem is populated — no disk I/O
4. A real `ts.LanguageService` is created against the VFS
5. Verification commands execute against the running language service

### 1.3 Baseline / Snapshot Testing

TypeScript's version of snapshot testing, used extensively for compiler and server tests.

**Directory structure:**
```
tests/baselines/
  reference/    # Committed expected outputs ("golden" files)
  local/        # Generated from latest run (gitignored)
```

**The `.errors.txt` baseline format** — annotated source with diagnostic positions:

```
tests/cases/compiler/example.ts(11,12): error TS2503: Cannot find namespace 'no'.

==== tests/cases/compiler/example.ts (1 errors) ====
    import m = no;
               ~~
!!! error TS2503: Cannot find namespace 'no'.
```

- `~~~` tildes mark the exact error span
- `!!! error TSXXXX:` prefixes error messages
- File headers show total error count

**Baseline workflow:**
1. Write/modify test → 2. `hereby runtests` generates `local/` → 3. Tests fail if `local/ ≠ reference/` → 4. Review diff → 5. `hereby baseline-accept` copies `local/` → `reference/` → 6. Commit

### 1.4 TSServer Protocol Tests

76 test files in `src/testRunner/unittests/tsserver/` that test the actual server protocol:

```typescript
// 1. Define virtual files
const aTs = { path: "/project/a.ts", content: `export const a = {};` };
const bTs = { path: "/project/b.ts", content: `import { a } from './a';\na.` };
const tsconfig = { path: "/project/tsconfig.json", content: `{}` };

// 2. Create virtual file system
const host = TestServerHost.createServerHost([aTs, bTs, tsconfig]);

// 3. Create test session (wraps real tsserver Session)
const session = new TestSession(host);

// 4. Open files
openFilesForSession([aTs, bTs], session);

// 5. Execute protocol commands
session.executeCommandSeq<ts.server.protocol.CompletionsRequest>({
  command: ts.server.protocol.CommandTypes.CompletionInfo,
  arguments: { file: bTs.path, line: 2, offset: 3 },
});

// 6. Verify via baseline (captures full request/response trace)
baselineTsserverLogs("completions", "basic", session);
```

**Key infrastructure:**
- `TestServerHost` — virtual filesystem with file watching
- `TestSession` — wraps real `Session`, executes commands synchronously
- `baselineTsserverLogs()` — captures full protocol trace as baseline

### 1.5 The `tests/cases/fourslash/server/` Split

TypeScript maintains a separate `server/` subdirectory for fourslash tests that run through the tsserver session layer rather than the language service directly. This catches bugs where the session layer's position conversion loses information ([issue #44260](https://github.com/microsoft/TypeScript/issues/44260)).

---

## 2. rust-analyzer — Two-Tier Architecture

### 2.1 IDE-Layer Unit Tests (Fast)

Tests live inside each crate (`ide`, `ide-diagnostics`, `ide-assists`, `ide-completion`).

**Fixture format** — multi-file inline strings:
```rust
// Single file with cursor
check(r#"fn foo() { f$0oo(); }"#, expect![["foo"]]);

// Multi-file
check(r#"
//- /lib.rs
pub fn greet() {}

//- /main.rs
use crate::gr$0eet;
"#, expect![["greet"]]);
```

**Diagnostic tests** — inline annotations:
```rust
check_diagnostics(r#"
fn main() {
    let x = Mutex::new(1);
    _ = x
      //^ error: assignment copies lock value
}
"#);
```

The `//^` (or `//~`) annotation marks expected diagnostic position and message. The test harness runs analysis, collects diagnostics, and verifies they match the annotations.

**Code assist tests** — before/after:
```rust
check_assist(
    extract_function,
    r#"fn main() { $0let x = 1 + 2;$0 }"#,  // selection marked by $0..$0
    r#"
fn main() { fun_name(); }
fn fun_name() { let x = 1 + 2; }
"#,
);
```

**Inline snapshot testing** — `expect_test` crate:
```rust
let completions = get_completions(fixture);
expect![[r#"
    fn foo() -> i32
    fn bar(x: &str)
"#]].assert_eq(&completions);
```

Run with `UPDATE_EXPECT=1` to auto-fill expectations into source code.

### 2.2 Slow Integration Tests (Full LSP)

Located in `crates/rust-analyzer/tests/slow-tests/`:

```rust
// Create project with Cargo.toml + source files
let server = Project::with_fixture(r#"
//- /Cargo.toml
[package]
name = "foo"

//- /src/main.rs
fn main() { println!("hello"); }
"#).server();

// Send real LSP requests
server.request::<Completion>(params, json!({
    "isIncomplete": false,
    "items": [{
        "label": "main",
        [..]  // wildcard — matches any additional fields
    }]
}));
```

**Key patterns:**
- Spawns real rust-analyzer in a separate thread
- Communicates via in-memory `Connection`
- JSON wildcard matching (`[..]` for text, `{...}` for objects)
- 120-300 second timeouts, skippable via `skip_slow_tests()`

### 2.3 rust-analyzer Philosophy (matklad)

From [How to Test](https://matklad.github.io/2021/05/31/how-to-test.html):
- **Test features, not code** — tests should survive reimplementation
- **One fixture format** shared across all tests
- **"Sans IO"** — separate computation from I/O for fast integrated tests
- A "Goto Definition" test completes in **4ms** despite running the full pipeline
- **Encapsulate in `check()`** — all tests call a single `check(input, expected)` function

---

## 3. gopls (Go) — Dual Test Systems

### 3.1 Marker Tests (Declarative)

Located in `gopls/internal/test/marker/testdata/` (29 subdirectories).

Tests use **txtar format** (Go's standard multi-file text archive):

```
This is the test description.

-- settings.json --
{"diagnosticsDelay": "0s"}

-- go.mod --
module example.com/test
go 1.21

-- main.go --
package main

import "fmt"

func main() {
    fmt.Printl("hello") //@ diag("Printl", re`undefined: fmt.Printl`)
}

-- @fix/main.go --
@@ -6 +6 @@
-    fmt.Printl("hello")
+    fmt.Println("hello")
```

**Marker types (~40 documented in `doc.go`):**

```go
// Value markers (bind names)
//@ loc(name, "identifier")
//@ item(name, "details", kind)

// Diagnostic markers
//@ diag("x", re"expected message regex")

// Navigation markers
//@ def(src, dst)           // go-to-definition
//@ refs(src, ...targets)   // find-all-references

// Completion markers
//@ complete(location, item1, item2)

// Code action markers with golden diffs
//@ codeaction("}", "refactor.rewrite.fillStruct", edit=golden)

// Hover markers
//@ hover("pos", "name", golden)

// Rename markers
//@ rename(loc, "newName", golden)
```

**Golden files** are embedded in the txtar with `@name` prefix, containing unified diffs:
```
-- @golden/main.go --
@@ -11 +11,3 @@
-var _ = basicStruct{}
+var _ = basicStruct{
+	foo: 0,
+}
```

### 3.2 Integration Tests (Programmatic)

Located in `gopls/internal/test/integration/`:

```go
func TestDiagnostics(t *testing.T) {
    const files = `
-- go.mod --
module mod.com
go 1.21

-- main.go --
package main

func main() {
    x := 1
}
`
    Run(t, files, func(t *testing.T, env *Env) {
        env.OpenFile("main.go")
        env.AfterChange(
            Diagnostics(env.AtRegexp("main.go", "x")),
        )
    })
}
```

**Key APIs:**
- `Run(t, files, testFunc, opts...)` — creates sandbox, spawns server, connects fake editor
- `env.AfterChange(...)` — waits for server state then asserts
- `env.AtRegexp("file.go", "pattern")` — regex-based location matching
- `Diagnostics(loc)` / `NoDiagnostics(ForFile("f.go"))` — diagnostic assertions
- `env.OpenFile()`, `env.RegexpReplace()`, `env.SaveBuffer()` — editor simulation
- Three execution modes: in-process, forwarded, separate process

---

## 4. Pyright (Python) — Three Layers

### 4.1 Fourslash Tests (256 files)

Located in `packages/pyright-internal/src/tests/fourslash/`:

```typescript
// @filename: test.py
//// def greet(name: str) -> str:
////     return f"Hello {name}"
////
//// result = greet(/*marker1*/42)

// @filename: helper.py
//// CONSTANT = "value"

{
    marker: {
        "marker1": {
            completions: []
        }
    }
}
```

**Verification modes:**
- `'exact'` — count must match
- `'included'` — must contain
- `'excluded'` — must not contain

### 4.2 Direct Provider Tests

```typescript
const state = parseAndGetTestState(code);
const provider = new CompletionProvider(state.program, state.filePath);
const result = provider.getCompletions(position);
// Assert on result directly
```

### 4.3 Full LSP Server Tests

```typescript
const server = await runPyrightServer({
    pythonVersion: "3.11",
    workspaceFolder: fixture
});
await initializeLanguageServer(server);
const diagnostics = await waitForDiagnostics(server, "test.py");
assert(diagnostics.length === 1);
assert(diagnostics[0].message.includes("expected type"));
```

Uses worker threads for isolation — the test server runs in a separate thread.

---

## 5. Biome — In-Process with Memory Filesystem

```rust
#[tokio::test]
async fn test_diagnostics() -> Result<()> {
    let fs = MemoryFileSystem::default();
    let mut server = ServerFactory::new_with_fs(Arc::new(fs)).create();

    server.initialize().await?;
    server.initialized().await?;

    let doc = server.open_document("test.js", "const x = 1;\nconst x = 2;").await?;

    let notification = wait_for_notification(&mut receiver, |n| {
        n.is_publish_diagnostics()
    }).await;

    assert_eq!(
        notification.diagnostics,
        vec![PublishDiagnosticsParams {
            uri: uri!("test.js"),
            diagnostics: vec![/* expected diagnostics */],
            ..Default::default()
        }]
    );

    server.shutdown().await?;
    Ok(())
}
```

**Key patterns:**
- `MemoryFileSystem` for complete filesystem virtualization
- `uri!()` macro for cross-platform URIs
- Full structural `assert_eq!` on diagnostic params
- 3-second timeout for notifications
- No snapshot testing — direct comparison

---

## 6. ESLint — Core-Level Testing Only

ESLint tests its analysis at the rule level, not the LSP level:

```javascript
ruleTester.run("no-unused-vars", rule, {
    valid: ["var foo = 5; console.log(foo);"],
    invalid: [{
        code: "var a = 10",
        errors: [{
            messageId: "unusedVar",
            data: { varName: "a" },
            line: 1,
            column: 5,
            suggestions: [{
                output: "",
                messageId: "removeVar"
            }]
        }]
    }]
});
```

The VS Code extension has minimal LSP-level test infrastructure — it delegates to the core library which is thoroughly tested at the analysis level.

---

## 7. Available Testing Libraries

### Node.js / TypeScript

| Library | Description | Use Case |
|---------|-------------|----------|
| `vscode-languageserver-protocol` + `vscode-jsonrpc` | Official LSP protocol types + JSON-RPC transport | Protocol-level server testing without VS Code |
| `ts-lsp-client` | Standalone LSP client for Node.js | Spawns server as subprocess, sends LSP requests |
| `@vscode/test-electron` | VS Code extension test runner | Full E2E tests inside Extension Development Host |
| `wdio-vscode-service` | WebdriverIO plugin for VS Code | UI-level testing (webviews, panels) |

### Other Languages

| Library | Language | Description |
|---------|----------|-------------|
| `pytest-lsp` | Python | Pytest plugin for E2E testing any LSP server via subprocess |
| `lsp-test` | Haskell | Functional test framework with parser combinators |
| `expect-test` | Rust | Inline snapshot testing (used by rust-analyzer) |
| `insta` | Rust | File-based snapshot testing |

### Debugging Tools

| Tool | Description |
|------|-------------|
| `lsp-devtools` | Python — intercepts/records LSP traffic, TUI inspector |
| `lsp-tester` | Go — diagnostic tool with client/server/proxy modes |

---

## 8. Cross-Project Comparison

| Aspect | TypeScript | rust-analyzer | gopls | Pyright | Biome |
|--------|-----------|--------------|-------|---------|-------|
| **Fixture format** | `////` fourslash | `//- /path` inline | txtar archives | `// @filename` fourslash | Inline strings + MemoryFS |
| **Position markers** | `/*name*/` | `$0` cursor, `//^` annotations | `//@ marker(args)` | `[|/*marker*/|]` | Explicit LSP positions |
| **Diagnostic verification** | Baseline `.errors.txt` with `~~~` spans | Inline `//^` annotation matching | `@diag("loc", re"msg")` | `verifyDiagnostics({ category, message })` | Full structural `assert_eq!` |
| **Snapshot testing** | Baseline `reference/` vs `local/` | `expect_test` inline snapshots | Golden files in txtar | No | No |
| **Code action testing** | `verify.codeFix({ newFileContent })` | `check_assist(before, after)` | `@codeaction(loc, kind, edit=golden)` | `verifyCodeActions(mode, map)` | Structural comparison |
| **Multi-file projects** | `// @Filename:` directives | `//- /path` in fixture strings | `-- path --` txtar headers | `// @filename:` directives | MemoryFS injection |
| **Virtual filesystem** | `TestServerHost` VFS | `ChangeFixture` database | `Sandbox` temp dirs | `TestHost` + `createFileSystem()` | `MemoryFileSystem` |
| **Server lifecycle** | `TestSession` (sync commands) | In-memory `Connection` + thread | Fake editor + sandbox | Worker threads | `tower::Service` + tokio |
| **Test count (approx)** | ~20,000+ fourslash | ~3,000 IDE + ~50 slow | ~500 marker + ~200 integration | ~256 fourslash + provider tests | ~100 LSP tests |

---

## 9. Common Themes and Best Practices

### 9.1 Universal Patterns

1. **Every project builds its own test infrastructure** — there is no off-the-shelf LSP testing framework
2. **IDE-layer testing (below LSP) is always faster and more prevalent** than full protocol tests
3. **Position markers embedded in source code** (varying syntax) are universal
4. **Virtual/in-memory filesystems** are used everywhere for isolation and speed
5. **Multi-file fixtures** use some form of embedded path comments or archive format
6. **Diagnostic assertions check position + message** (often via regex)
7. **Code action tests follow before/after pattern** comparing transformed source
8. **Full LSP server tests are the slowest tier** and are separated from unit tests

### 9.2 Lessons from matklad (rust-analyzer author)

From ["How to Test"](https://matklad.github.io/2021/05/31/how-to-test.html):

- **Test features, not code** — tests survive reimplementation
- **Invest in a universal fixture format** rather than fluent assertion libraries
- **Keep code "sans IO"** — separate computation from I/O for fast integrated tests
- **Encapsulate in `check()`** — one helper function per test kind, all tests become one-liners
- **Print test execution times** — IO dominates, not code volume

### 9.3 Realistic Full-Project Testing

How tools verify analysis works correctly on real-world project structures:

**TypeScript approach:** Project tests in `tests/cases/project/` define multi-file projects with `tsconfig.json`, `node_modules/`, and complex module resolution. Baseline files capture all diagnostics across all files.

**gopls approach:** Integration tests use txtar archives containing complete Go modules (`go.mod`, multiple packages, test files). The fake editor opens files, makes edits, and asserts diagnostics update correctly.

**rust-analyzer approach:** Slow tests create projects with `Cargo.toml` manifests and multi-crate workspaces. They verify that workspace-wide analysis (cross-crate imports, macro expansion, trait resolution) produces correct diagnostics.

**Common pattern for realistic project testing:**
1. Define a fixture project (multi-file, with config)
2. Open/analyze the entire project
3. Assert diagnostics appear at correct positions in correct files
4. Make edits, verify diagnostics update
5. Test cross-file interactions (imports, renames, references)

### 9.4 The Marker-Based Testing Pattern

The most widely adopted pattern across all tools:

```
// Embed expected results as comments in test source files
// Each tool has its own syntax, but the concept is identical

// TypeScript:    /*marker*/  and  [|range|]
// rust-analyzer: $0  and  //^ error: message
// gopls:         //@ diag("x", re"message")
// Pyright:       [|/*marker*/|]
```

**Why this works:**
- Test expectations live next to the code they describe
- No brittle line/column numbers to maintain
- Adding/removing lines doesn't break tests
- Tests are readable without external reference files
- The test harness parses markers, runs analysis, and verifies results match

---

## 10. Recommended Testing Strategy for KSC LSP

Given the KSC architecture (vitest, TypeScript, ports-and-adapters), here is a recommended multi-tier approach:

### Tier 1 — Unit Tests (fastest, what we already have)

Test diagnostic computation, code action generation, and diagnostic mapping as pure functions. The existing test suite (ts-host, analyzer, diagnostic-mapper, code-actions, debounce, uri) covers this well.

### Tier 2 — Protocol-Level Integration Tests (no VS Code needed)

Use `vscode-languageserver-protocol` + `vscode-jsonrpc` to spawn the server and send real LSP messages:

```typescript
import { spawn } from 'child_process';
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-languageserver-protocol/node';

const server = spawn('node', ['dist/server.cjs', '--stdio']);
const connection = createProtocolConnection(
  new StreamMessageReader(server.stdout),
  new StreamMessageWriter(server.stdin),
);
connection.listen();

// Send initialize, didOpen, wait for publishDiagnostics
```

### Tier 3 — Fixture-Based Full-Project Tests

Create test fixture directories with real TypeScript projects containing KindScript annotations:

```
test/lsp/fixtures/
  basic-project/
    tsconfig.json
    ksc.config.ts
    src/
      types.ts          # Kind definitions
      usage.ts          # Files with expected violations
      usage.expected    # Expected diagnostic positions
```

The test harness:
1. Points the LSP server at the fixture project
2. Analyzes all files
3. Verifies diagnostics appear at marked positions in source files
4. Optionally uses marker comments (`// @diag(line, "protobuf-getter", "message")`)

### Tier 4 — Marker-Based Tests (aspirational)

Adopt a simplified fourslash/twoslash pattern for KSC:

```typescript
// @filename: types.ts
//// import { Kind } from 'kindscript';
//// type User = Kind<{ name: string }>;

// @filename: usage.ts
//// import { User } from './types';
//// function process(user: User) {
////   const n = user./*diag:protobuf-getter*/name;
//// }
```

This requires building a small test harness (~100-200 lines) that parses markers, creates a virtual project, runs analysis, and verifies diagnostics match markers.

---

## Sources

### TypeScript
- [Fourslash API definitions](https://github.com/microsoft/TypeScript/blob/main/tests/cases/fourslash/fourslash.ts)
- [Orta's TypeScript Notes — Fourslash](https://github.com/orta/typescript-notes/blob/master/systems/testing/fourslash.md)
- [TypeScript CONTRIBUTING.md](https://github.com/Microsoft/TypeScript/blob/main/CONTRIBUTING.md)
- [tsserver unit tests](https://github.com/microsoft/TypeScript/tree/main/src/testRunner/unittests/tsserver)
- [PR #20763: Unified VFS](https://github.com/microsoft/TypeScript/pull/20763)
- [Issue #44260: Server/service test consistency](https://github.com/microsoft/TypeScript/issues/44260)

### rust-analyzer
- [Architecture docs](https://rust-analyzer.github.io/book/contributing/architecture.html)
- [matklad — How to Test](https://matklad.github.io/2021/05/31/how-to-test.html)
- [expect-test crate](https://github.com/rust-analyzer/expect-test)

### gopls
- [Marker test documentation](https://github.com/golang/tools/blob/master/gopls/internal/test/marker/doc.go)
- [Integration test infrastructure](https://github.com/golang/tools/tree/master/gopls/internal/test/integration)

### Pyright
- [Fourslash tests](https://github.com/microsoft/pyright/tree/main/packages/pyright-internal/src/tests/fourslash)
- [LSP server tests](https://github.com/microsoft/pyright/tree/main/packages/pyright-internal/src/tests/lsp)

### Libraries & Tools
- [vscode-languageserver-node Issue #262 — How to test](https://github.com/Microsoft/vscode-languageserver-node/issues/262)
- [LSP Issue #353 — Standard test suite](https://github.com/Microsoft/language-server-protocol/issues/353)
- [pytest-lsp](https://pypi.org/project/pytest-lsp/)
- [lsp-test (Haskell)](https://hackage.haskell.org/package/lsp-test)
- [ts-lsp-client](https://github.com/ImperiumMaximus/ts-lsp-client)
- [VS Code Testing Extensions Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Twoslash](https://www.typescriptlang.org/dev/twoslash/)
