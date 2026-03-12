# How Compilers and Static Analysis Tools Test Themselves

## Research Document — Compiler & Static Analysis Testing Infrastructure

This document surveys how production compilers, type checkers, linters, and attribute grammar systems
test themselves, with a focus on realistic end-to-end testing of full projects and accurate error reporting.

---

## Table of Contents

1. [TypeScript Compiler](#1-typescript-compiler)
2. [Rust Compiler (rustc) and rust-analyzer](#2-rust-compiler-rustc-and-rust-analyzer)
3. [LLVM/Clang](#3-llvmclang)
4. [GCC](#4-gcc)
5. [Roslyn (C#/.NET Compiler)](#5-roslyn-cnet-compiler)
6. [Flow (Facebook's JS Type Checker)](#6-flow-facebooks-js-type-checker)
7. [Sorbet (Stripe's Ruby Type Checker)](#7-sorbet-stripes-ruby-type-checker)
8. [Pyright (Microsoft's Python Type Checker)](#8-pyright-microsofts-python-type-checker)
9. [mypy (Python Type Checker)](#9-mypy-python-type-checker)
10. [ESLint and RuleTester](#10-eslint-and-ruletester)
11. [typescript-eslint](#11-typescript-eslint)
12. [Biome (formerly Rome)](#12-biome-formerly-rome)
13. [oxlint (oxc project)](#13-oxlint-oxc-project)
14. [SWC (Rust-based JS/TS Compiler)](#14-swc-rust-based-jsts-compiler)
15. [Babel](#15-babel)
16. [Tree-sitter](#16-tree-sitter)
17. [Attribute Grammar Systems (Silver, JastAdd, Spoofax)](#17-attribute-grammar-systems-silver-jastadd-spoofax)
18. [Cross-Cutting Patterns and Best Practices](#18-cross-cutting-patterns-and-best-practices)
19. [Comparison Matrix](#19-comparison-matrix)
20. [Recommendations for KindScript](#20-recommendations-for-kindscript)

---

## 1. TypeScript Compiler

TypeScript has one of the most sophisticated test infrastructures in the compiler world.
It uses **three distinct test categories**, a **virtual filesystem**, and a **baseline (golden file) system**.

### 1.1 Virtual Filesystem (`vfs.ts` / `fakes.ts`)

TypeScript's test harness includes a complete **virtual filesystem** (`src/harness/vfs.ts`) and
a **fake `ts.System`** (`src/harness/fakes.ts`). The fake System wraps the VFS and implements
the full `ts.System` interface:

```typescript
// From src/harness/fakes.ts
export class System implements ts.System {
    public readonly vfs: vfs.FileSystem;
    public readonly args: string[] = [];
    public readonly output: string[] = [];
    public readonly newLine: string;
    public readonly useCaseSensitiveFileNames: boolean;

    constructor(vfs: vfs.FileSystem, { executingFilePath, newLine = "\r\n", env }: SystemOptions = {}) {
        this.vfs = vfs.isReadonly ? vfs.shadow() : vfs;
        this.useCaseSensitiveFileNames = !this.vfs.ignoreCase;
        this.newLine = newLine;
    }

    public readFile(path: string): string | undefined {
        const content = this.vfs.readFileSync(path, "utf8");
        return content === undefined ? undefined : Utils.removeByteOrderMark(content);
    }

    public writeFile(path: string, data: string, writeByteOrderMark?: boolean): void {
        this.vfs.mkdirpSync(vpath.dirname(path));
        this.vfs.writeFileSync(path, writeByteOrderMark ? Utils.addUTF8ByteOrderMark(data) : data);
    }

    public fileExists(path: string): boolean { /* delegates to vfs */ }
    public directoryExists(path: string): boolean { /* delegates to vfs */ }
    public getCurrentDirectory(): string { return this.vfs.cwd(); }
    public realpath(path: string): string { return this.vfs.realpathSync(path); }
    // ... full ts.System implementation
}
```

**Key design**: The VFS supports `shadow()` — creating a copy-on-write overlay. Tests can start
from a shared base filesystem and make mutations without affecting other tests.

The harness also provides a `ParseConfigHost` backed by the VFS, so `tsconfig.json` resolution
works identically to production.

The `@typescript/vfs` npm package exposes a simpler Map-based VFS for external use:
- `createDefaultMapFromNodeModules()` — populates with lib files from local node_modules
- `createSystem()` — creates a `ts.System` backed by the Map
- `createVirtualCompilerHost()` — creates a `ts.CompilerHost` from the system
- `createVirtualTypeScriptEnvironment()` — full language service over the VFS

### 1.2 Baseline (Golden File) Testing

TypeScript's primary testing mechanism is **baseline comparison**. Tests produce output,
which is compared against committed "reference" baselines.

**Directory structure:**
```
tests/
  baselines/
    reference/         # Expected output (committed to git)
      compiler/
        test1.errors.txt
        test1.js
        test1.types
        test1.symbols
    local/             # Actual output (generated, gitignored)
      compiler/
        test1.errors.txt
        ...
  cases/
    compiler/          # Test source files
      test1.ts
    conformance/       # Spec conformance tests
    fourslash/         # IDE feature tests
    projects/          # Multi-file project tests
```

**Baseline types** (each test can generate multiple baselines):
| Baseline | Content |
|----------|---------|
| `.errors.txt` | Compiler diagnostics with line/column annotations |
| `.js` | Emitted JavaScript output |
| `.types` | Type information for every expression |
| `.symbols` | Symbol table information |
| `.sourcemap` | Source map output |
| `.d.ts` | Declaration file output |

**Accepting baselines**: When a test legitimately changes behavior:
```bash
npx hereby baseline-accept    # Copy local/ → reference/
```

This makes the new output the expected output. The diff appears in git, making
behavioral changes visible in code review.

### 1.3 Compiler Tests (`tests/cases/compiler/`)

A `.ts` file that gets compiled. The harness automatically runs the compiler and generates
baselines. Compiler options can be set per-test via comment directives:

```typescript
// @target: ES6
// @module: commonjs
// @strict: true

function greet(name: string): string {
    return `Hello, ${name}`;
}
```

Multi-file tests use `// @filename: file2.ts` to define multiple files in a single test case.

### 1.4 Fourslash Tests (`tests/cases/fourslash/`)

Fourslash tests verify **IDE features** (completions, go-to-definition, quick info, refactoring).
They use a rich DSL with markers and ranges:

```typescript
/// <reference path="fourslash.ts" />

//// namespace /*check*/Mod {
//// }
////
//// interface MyInterface {
////     /*insert*/
//// }

edit.disableFormatting();
verify.quickInfoAt("check", "namespace Mod");

goTo.marker('insert');
edit.insert("x: number;\n");

verify.quickInfoAt("check", "namespace Mod");
```

**Key elements:**
- `////` lines define the source code (four slashes = content)
- `/*name*/` defines named markers (cursor positions)
- `[|text|]` defines ranges (selections)
- The imperative section uses `verify.*`, `goTo.*`, `edit.*` APIs
- `FourSlashData` tracks markers, ranges, files, and global options

TypeScript has **1000+ fourslash test files**. There are also file-level metadata options
like `@Filename`, `@emitThisFile`, `@resolveReference`, `@symlink`.

**Twoslash** is a lighter-weight public version of fourslash for documentation:
- `// @errors: 2588` — expect specific compiler error codes
- `// @filename: helper.ts` — create virtual files
- `// ^?` — query the type at a position
- Inline tsconfig options via `// @strict: true`

### 1.5 Project Tests

For testing multi-file projects, project references, and incremental compilation:

- **`tests/cases/projects/`** — full project directories with `tsconfig.json`
- **Incremental tests** — tests that modify files and verify incremental compilation behavior
- The VFS enables simulating file changes without touching disk

### 1.6 Test Runner

TypeScript uses **Mocha** as the test framework. Tests are discovered by scanning test case
directories. Each test case file becomes one or more Mocha `it()` blocks. The task runner
is **Hereby** (successor to Jake).

---

## 2. Rust Compiler (rustc) and rust-analyzer

### 2.1 `compiletest` — rustc's Test Driver

Rust uses `compiletest`, a custom test driver supporting multiple test modes:

| Mode | Purpose |
|------|---------|
| `ui` | Check diagnostics, errors, warnings (most common) |
| `run-pass` | Code that should compile and run successfully |
| `compile-fail` | Code that should fail to compile |
| `run-fail` | Code that should compile but fail at runtime |
| `incremental` | Test incremental compilation |
| `codegen` | Test LLVM IR output (uses FileCheck) |
| `assembly` | Test assembly output (uses FileCheck) |
| `mir-opt` | Test MIR optimization dumps |
| `crashes` | Track ICE (internal compiler error) bugs |

### 2.2 UI Tests — The Gold Standard

UI tests are the primary mechanism. Each test is a `.rs` file with `//~` annotations
and a corresponding `.stderr` golden file.

**Annotation syntax:**
```rust
fn main() {
    let x: i32 = "hello"; //~ ERROR mismatched types
    let y: bool = 42;     //~^ ERROR mismatched types
                           //~| NOTE expected `bool`, found `i32`
}
```

- `//~ ERROR message` — error on this line
- `//~^ ERROR message` — error on the line above (add `^` for each additional line up)
- `//~| NOTE additional` — continuation of previous diagnostic (same line as previous)
- `//~v ERROR message` — error on the line below

**Directives** (use `//@ ` prefix):
- **Outcome**: `//@ check-pass`, `//@ build-pass`, `//@ run-pass`, `//@ check-fail`, `//@ run-fail`
- **Config**: `//@ compile-flags: -Awarnings`, `//@ edition:2021`, `//@ rustc-env: KEY=VALUE`
- **Normalization**: `//@ normalize-stderr: "regex" -> "replacement"`
- **Revisions**: `//@ revisions: foo bar` runs test multiple times with `--cfg`; use `//[foo]~ ERROR` for revision-specific annotations
- **Conditional**: `//@ ignore-windows`, `//@ only-x86_64`, `//@ needs-unwind`
- **Dependencies**: `//@ aux-build: helper.rs`, `//@ aux-crate: name`
- **Rustfix**: `//@ run-rustfix` validates that suggested fixes apply correctly

**The `.stderr` file** contains the full expected compiler output:

```
error[E0308]: mismatched types
 --> test.rs:2:19
  |
2 |     let x: i32 = "hello";
  |            ---   ^^^^^^^ expected `i32`, found `&str`
  |            |
  |            expected due to this
```

**Output normalization**: Paths become `$DIR`, stdlib paths become `$SRC_DIR`, hashes become
`[HASH]`, line numbers can become `LL` with `-Z ui-testing`, CRLF → LF.

**Blessing** (updating expected output):
```bash
./x.py test --bless tests/ui/type-mismatch.rs
```

### 2.3 rust-analyzer — Inline Snapshot + Virtual FS Testing

rust-analyzer uses a fundamentally different approach optimized for IDE-speed testing.

**Virtual filesystem**: Tests create an `AnalysisHost` with in-memory `FileSet` objects.
Files get `FileId` values and `VfsPath` entries like `/main.rs`. No disk I/O means tests
run in **~4ms debug / ~500μs release**.

**Fixture format**: Multi-file projects declared inline with `//-` metadata:
```rust
//- /main.rs
fn main() { foo$0() }
//- /lib.rs crate:mylib deps:std
pub fn foo() {}
```

Metadata: `crate:<name>`, `deps:<crate1>,<crate2>`, `edition:2021`, `cfg:<opts>`,
`new_source_root:local|library`.

**Cursor markers**: `$0` marks cursor position (single = position, two = range).

**`expect-test` inline snapshot testing**: The `expect!` macro stores expected output
inline in the source code:

```rust
#[test]
fn test_hover() {
    check(
        r#"fn foo$0() {}"#,
        expect![[r#"
            *foo*
            ```rust
            fn foo()
            ```
        "#]],
    );
}
```

Running `UPDATE_EXPECT=1 cargo test` auto-updates the inline snapshots by patching
the source file. The macro captures `file!()` and `line!()` at compile time to know
its own source position.

**Testing philosophy** (from matklad):
- Most tests follow a data-driven `check()` pattern — a helper exercises the API, tests pass different inputs
- Tests exercise the **complete compilation pipeline** despite being "unit-like"
- No mocks — the VFS is just an in-memory data structure
- A typical test takes ~4ms because the pipeline is IO-free

---

## 3. LLVM/Clang

### 3.1 `lit` (LLVM Integrated Tester) + FileCheck

LLVM uses `lit` as its test runner with `FileCheck` for output verification.

**RUN lines** define how to execute the test:
```llvm
; RUN: opt %s -S | FileCheck %s
```

Substitutions: `%s` (source file), `%S` (source dir), `%t` (temp file).
Conditional: `; REQUIRES: asserts`, `; UNSUPPORTED: windows`, `; XFAIL: *`.

**FileCheck directives:**
```llvm
define i32 @add(i32 %a, i32 %b) {
; CHECK-LABEL: add:
; CHECK: addl
; CHECK-NOT: subl
; CHECK-NEXT: retq
  %result = add i32 %a, %b
  ret i32 %result
}
```

- `CHECK:` — match pattern in order
- `CHECK-NEXT:` — must be on the very next line
- `CHECK-NOT:` — must NOT appear between surrounding checks
- `CHECK-SAME:` — must be on same line as previous match
- `CHECK-DAG:` — match in any order within a region
- `CHECK-LABEL:` — divides input into independent blocks
- Variable capture: `[[VAR:pattern]]` captures, `[[VAR]]` substitutes
- Numeric variables: `[[#%d,REG:]]` captures numbers, `[[#REG+1]]` for arithmetic
- Regex: `{{regex}}` within patterns
- Multiple prefixes: `--check-prefixes=X32,X64`
- Auto-generation: `update_test_checks.py` generates CHECK lines automatically

### 3.2 Clang's `-verify` Mode

Clang has a built-in diagnostic verification mode using inline comment annotations:

```c
// RUN: %clang_cc1 -fsyntax-only -Wunused-variable -verify %s

int main() {
    int b;       // expected-warning{{unused variable 'b'}}
    int a __attribute__((unused));  // no warning
    return Y;    // expected-error{{use of undeclared identifier 'Y'}}
}
```

**Advanced features:**
- **Line offsets**: `expected-error@+2` (2 lines below), `expected-error@-1` (1 line above), `@:42` (absolute line)
- **Diagnostic groups**: `// RUN: ... -verify=expected,pedantic` then `pedantic-warning{{...}}`
- **Occurrence counts**: `expected-error 2 {{message}}`
- **Regex matching**: `expected-error-re {{pattern.*}}`
- The `VerifyDiagnosticConsumer` class processes comments and compares against emitted diagnostics

```c
// Multiple diagnostic groups:
int i3[] = {};
// expected-warning{{zero size arrays are an extension}}
// pedantic-warning{{use of an empty initializer is a C23 extension}}
```

---

## 4. GCC

GCC uses **DejaGnu**, a Tcl/Expect-based test framework.

**Test directives** are embedded in comments:
```c
/* { dg-do compile } */        // action: preprocess, compile, assemble, link, run
/* { dg-error "regex" } */     // expect error on this line (regex substring match)
/* { dg-warning "regex" } */   // expect warning
/* { dg-bogus "pattern" } */   // assert this pattern does NOT appear
/* { dg-options "-O2 -Wall" } */ // compiler flags
/* { dg-final { scan-assembler "pattern" } } */            // post-compilation checks
/* { dg-final { scan-tree-dump-times "pattern" N "pass" } } */ // optimizer behavior
```

**Outcomes**: PASS, FAIL, XFAIL (expected failure), XPASS (unexpected pass).
XFAIL requires bug database references.

**Test organization**: `gcc.dg/` (C), `g++.dg/` (C++), `gcc.c-torture/` (run at multiple
optimization levels), `gfortran.dg/`, `gnat.dg/`.

---

## 5. Roslyn (C#/.NET Compiler)

### 5.1 In-Memory Compilation

Roslyn's test infrastructure creates compilations entirely in memory via
`Microsoft.CodeAnalysis.Testing`:

```csharp
var test = new CSharpAnalyzerTest<MyAnalyzer, DefaultVerifier>
{
    TestCode = @"
class [|Type1|] { }   // [| |] marks expected diagnostic location
",
};
await test.RunAsync();
```

### 5.2 Diagnostic Markup Syntax

| Syntax | Purpose |
|--------|---------|
| `[|code|]` | Simple — marks where a single diagnostic should appear |
| `{|RuleId:code|}` | Rule-specific — when testing multiple rules |
| `{|#0:code|}` | Indexed — for precise diagnostic ordering |

### 5.3 Code Fix Testing

```csharp
var test = new CSharpCodeFixTest<MyAnalyzer, MyCodeFix, DefaultVerifier>
{
    TestCode = "class [|Type1|] { }",
    FixedCode = "class TYPE1 { }",
};
await test.RunAsync();
```

The framework: creates in-memory compilation from `TestCode`, runs the analyzer, verifies
diagnostics match markup, applies the code fix, verifies `FixedCode` matches output.
No filesystem needed.

### 5.4 Configuration

```csharp
test.TestState.AdditionalFiles.Add(("helper.cs", "class Helper { }"));
test.TestState.AnalyzerConfigFiles.Add((".editorconfig", "root = true\n..."));
test.ReferenceAssemblies = ReferenceAssemblies.Net.Net80;
test.TestState.OutputKind = OutputKind.ConsoleApplication;  // enable top-level statements
```

**Editor support**: `/* lang=c#-test */` comments or `[StringSyntax("c#-test")]` attributes
enable syntax highlighting in test code strings.

---

## 6. Flow (Facebook's JS Type Checker)

### 6.1 Test Directory Structure

Each test is a **self-contained project directory** under `tests/`:

```
tests/
  react/
    react.js         # Source file(s)
    .flowconfig      # Flow configuration (project root)
    react.exp        # Expected output (golden file)
  constructor/
    .flowconfig
    assign.js
    constructor.js
    invalid.js
    constructor.exp
```

### 6.2 `.exp` Files (Expected Output)

The `.exp` file contains the full `flow check` output — all errors with file paths,
line numbers, column numbers, error messages, and error codes:

```
Error -------- filename.js:LINE:COLUMN

Error description here. [incompatible-type]
```

The file ends with a summary like `Found 5 errors`.

### 6.3 Multi-File Testing

Each test directory **is** a project — the `.flowconfig` defines the project root.
Multiple `.js` files in the same directory are analyzed together, enabling cross-file
import/export testing. The `.flowconfig` can use `[include]`, `[libs]`, `[declarations]`
sections to control analysis scope.

### 6.4 Test Runner

Flow uses `runtests.sh`:
```bash
./runtests.sh          # run all tests
./runtests.sh -t react # run specific test
./runtests.sh -r       # re-record failing tests (update .exp files)
./runtests.sh -q       # quiet output
```

This is a **whole-program output snapshot** approach — the entire compiler output is
captured and compared.

---

## 7. Sorbet (Stripe's Ruby Type Checker)

### 7.1 Test Organization

Tests live in `test/testdata/`, organized in subdirectories at any depth.
Any `.rb` file added to this tree **automatically becomes a test** (called a "test_corpus test").

### 7.2 Inline Error Annotations

Sorbet uses **inline `# error:` comments** directly in test files:

```ruby
1 + ''  # error: `String` doesn't match `Integer`
```

For multiple errors or precise location, the **caret syntax** (`^^^`) points to
specific character ranges on the line above:

```ruby
rescue Foo, Bar => baz
     # ^^^ error: Unable to resolve constant `Foo`
          # ^^^ error: Unable to resolve constant `Bar`
```

### 7.3 Multi-Phase Expectation Tests

Any test can have `.exp` files named `<name>.rb.<phase>.exp` containing pretty-printed
internal data structures from `sorbet -p <phase>`. Available phases include CFG,
name-tree, resolve, etc.

**Two layers of testing**: inline `# error:` annotations for user-facing diagnostics,
and `.exp` snapshot files for internal compiler state.

### 7.4 LSP Testing

Sorbet tests LSP features with `def:` and `usage:` annotations:

```ruby
a = 10
# ^ def: a 1

a = 20
# ^ def: a 2

b = a + 10
#    ^ usage: a 2
```

The test runner verifies "Find Definition" and "Find All References" return correct
locations. Version numbers track redefinitions. The label `(nothing)` indicates
no result expected.

---

## 8. Pyright (Microsoft's Python Type Checker)

### 8.1 Test Infrastructure

Pyright uses Jest. Tests are in `packages/pyright-internal/src/tests/`:
- `checker.test.ts` — fundamental type rules
- `typeEvaluator*.test.ts` (4+ files) — inference and evaluation
- `*Service.test.ts` — IDE integration
- `parser.test.ts` — syntax parsing

### 8.2 Sample File Testing

Sample files in `packages/pyright-internal/src/tests/samples/` use descriptive names
with numeric suffixes (e.g., `assignment1.py` through `assignment12.py`,
`genericType1.py` through `genericType47.py`).

Type inference is validated with `reveal_type`:
```python
reveal_type(x, expected_text="int")
```

Test `.ts` files reference samples and validate diagnostic counts:
```typescript
test('assignment1', () => {
    const results = typeAnalyzeSampleFiles(['assignment1.py']);
    validateResults(results, {
        errors: [/* expected error ranges */],
    });
});
```

### 8.3 Fourslash Tests

Pyright also uses a **fourslash-style format** (borrowed from TypeScript) for testing
language services — completions, hover, go-to-definition.

### 8.4 Multi-File Testing

Subdirectories like `package1/`, `project1/` through `project6/`, and `stubs/`
provide organized multi-file test suites with `pyrightconfig.json` files.

---

## 9. mypy (Python Type Checker)

### 9.1 Test Case Format

mypy uses a custom data-driven test format with `[case]` sections in `.test` files:

```
[case testSimpleAssignment]
x: int = "hello"  # E: Incompatible types in assignment (expression has type "str", variable has type "int")
[builtins fixtures/primitives.pyi]
```

**Annotations:**
- `# E:` — expected error with message
- `# E:col:` — error at specific column
- `# N:` — expected note
- `# W:` — expected warning
- `# flags: --strict` — pass CLI flags

### 9.2 Sections

- `[case testName]` — defines a test case (supports `-skip`, `-xfail`, `-writescache`)
- `[file path.py]` — additional source files
- `[file path.py.N]` — modified version for incremental step N
- `[out]` / `[out2]` / `[outN]` — expected output per pass
- `[builtins fixtures/...]` — load builtin type stubs
- `[delete path.py.N]` — delete file before step N
- `[stale module1, module2]` — modules expected to have changed interfaces
- `[rechecked module1, module2]` — modules expected to be re-analyzed

### 9.3 Incremental Testing

Each test runs at least twice (cold cache, warm cache). Between steps, `*.py.N` files
replace `*.py`, `[delete]` directives remove files. Expected output per step is in
`[outN]` sections. `[stale]` and `[rechecked]` track which modules should be re-analyzed.

### 9.4 Multi-File Testing

Multiple files embedded in a single test case:

```
[case testMultiFileImport]
from helper import greet
greet(42)  # E: Argument 1 to "greet" has incompatible type "int"; expected "str"
[file helper.py]
def greet(name: str) -> None: ...
```

### 9.5 Test Infrastructure

`DataDrivenTestCase` (pytest Item subclass) writes files to a temp directory, invokes
`build.build()`, captures errors, compares via `assert_string_arrays_equal()`.
`--update-data` flag auto-updates expected output in source files.

**Normalization**: OS-specific path separators → forward slashes, absolute paths → `$PWD`.

---

## 10. ESLint and RuleTester

### 10.1 `RuleTester` Pattern

```javascript
const { RuleTester } = require("eslint");
const ruleTester = new RuleTester({
    languageOptions: { ecmaVersion: 2015 }
});

ruleTester.run("no-var", rule, {
    valid: [
        "const JOE = 'schmoe';",
        {
            code: "let moo = 'car';",
            languageOptions: { sourceType: "module", ecmaVersion: 2026 },
        },
    ],
    invalid: [
        {
            code: "var foo = bar;",
            output: "let foo = bar;",           // expected autofix result
            errors: [{ messageId: "unexpectedVar" }],
        },
        {
            code: "var x = 1; var y = 2;",
            output: null,                        // null = unfixable
            errors: [
                { messageId: "unexpectedVar", line: 1, column: 1 },
                { messageId: "unexpectedVar", line: 1, column: 12 },
            ],
        },
    ],
});
```

**Error specification options:**
- `message` (string/RegExp) or `messageId` (string)
- `data` (object) — placeholder values for messageId templates
- `line`, `column`, `endLine`, `endColumn` — 1-based positions
- `type` — AST node type string
- `suggestions` — array of `{ messageId, desc, output }` for suggested fixes
- `output` on invalid cases tests autofix; `output: null` asserts unfixable

### 10.2 Multi-File Limitations

`RuleTester` is fundamentally **single-file**. For cross-file analysis, plugins use
**pre-existing fixture directories**:

```
tests/
  files/                    # ~135 fixture items
    bar.js
    jsx/MyComponent.jsx
    cycles/
      a.js → b.js
    node_modules/package/index.js
    alternate-root/
    typescript-*/
    export-star*/           # incremental complexity testing
    monorepo/
```

Test cases reference fixtures by path; resolvers find them on disk. A `rest()` wrapper
injects resolver settings (`node` or `webpack`) so same cases run against different resolvers.

---

## 11. typescript-eslint

### 11.1 Type-Aware Rule Testing

typescript-eslint forks ESLint's RuleTester with TypeScript program creation:

```typescript
const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            projectService: { allowDefaultProject: ['*.ts*'] },
            tsconfigRootDir: __dirname,
        },
    },
});
```

### 11.2 Fixture Projects with `getFixturesRootDir()`

`getFixturesRootDir()` resolves `'fixtures'` relative to the test file's `__dirname`.
The fixtures directory contains:

- A `tsconfig.json` with `strict: true`, `target: "es5"`, `jsx: "preserve"`, libs `["es2015", "es2017", "esnext"]`
- **Variant tsconfigs** for specific compiler options: `tsconfig-with-dom.json`, `tsconfig.exactOptionalPropertyTypes.json`, `tsconfig.noImplicitThis.json`, `tsconfig.noUncheckedIndexedAccess.json`
- **Source files**: `file.ts`, `deprecated.ts`, `errors.ts`, `react.tsx`, `class.ts`
- **Subdirectories** for cross-file rules: `consistent-type-exports/`, `unstrict/`

This allows rules to be tested under different TypeScript strictness settings.

### 11.3 Multi-File Type-Aware Testing

For rules like `consistent-type-exports` that need to resolve imports across files,
test cases reference real fixture files via import paths. The TypeScript project service
resolves these during testing.

### 11.4 Additional Features

- **Multi-pass fix testing**: `output: ['const e = 1;', 'const f = 1;']`
- **Vitest integration**: Requires `RuleTester.afterAll = vitest.afterAll; RuleTester.it = vitest.it;`

---

## 12. Biome (formerly Rome)

### 12.1 Insta Snapshot Testing (Rust)

Biome is written in Rust and uses `insta` for snapshot testing. Test discovery is
**auto-generated** from fixture files:

```rust
// crates/biome_js_analyze/tests/spec_tests.rs
tests_macros::gen_tests! {
    "tests/specs/**/*.{cjs,cts,js,mjs,jsx,tsx,ts,json,jsonc,svelte,vue}",
    crate::run_test,
    "module"
}
```

This generates a test function for **every fixture file** matching the glob.

### 12.2 Directory Convention

```
tests/specs/{group}/{ruleName}/
  valid.js          # Code that should NOT trigger the rule
  invalid.js        # Code that should trigger the rule
  __snapshots__/    # Insta snapshot files
    ruleName.snap
```

The system validates that the `{group}/{rule}` combination exists in the Biome rule registry.

### 12.3 How It Works

1. `analyze_and_snap()` parses the fixture, builds a semantic model, runs analysis rules, collects diagnostics + code actions
2. Validates that code fixes produce valid syntax trees (re-parses mutated code)
3. Captures output as an `insta` snapshot
4. Snapshot format includes: diagnostic message, source location with ASCII art, rule name, suggested fixes

**Multi-rule testing**: `tests/multiple_rules/` with `///! lint/group/rule` comments enabling specific rules.

### 12.4 Workflow

```bash
cargo test -p biome_js_analyze              # generates .snap.new files
cargo insta review                          # interactive diff review
cargo insta accept                          # accept all new snapshots
```

### 12.5 Quick Test Pattern

```rust
#[ignore]  // toggled during development
#[test]
fn quick_test() {
    const SOURCE: &str = "let x: number = 'hello';";
    // parse, filter rules, run analyze(), print diagnostics
}
```

### 12.6 Parser Conformance

Biome runs against external conformance suites in CI:
- **Test262** (JavaScript spec)
- **Microsoft TypeScript test suite**
- **Babel TypeScript and JSX test suites**
- **CommonMark** (Markdown)

A CI workflow compares conformance between PR branch and `main`, posting diffs as PR comments.

---

## 13. oxlint (oxc project)

### 13.1 Inline Tests with Custom Tester

oxlint tests live **inline in the rule module file**:

```rust
#[cfg(test)]
mod tests {
    use serde_json::json;
    use crate::tester::Tester;

    #[test]
    fn test() {
        let pass = vec![
            ("typeof foo == 'undefined'", Some(json!(["smart"]))),
            ("a === b", Some(json!(["always"]))),
        ];

        let fail = vec![
            ("typeof foo == 'undefined'", None),
            ("a == b", None),
        ];

        let fix = vec![
            ("null==null", "null === null", None),
            ("a == b", "a === b", None),
        ];

        Tester::new(Eqeqeq::NAME, Eqeqeq::PLUGIN, pass, fail)
            .expect_fix(fix)
            .test_and_snapshot();
    }
}
```

### 13.2 Tester Builder API

- `.expect_fix(fix)` — fix test cases (source, expected, config)
- `.test_and_snapshot()` — runs all tests, captures diagnostics as snapshots
- `.test()` — runs without snapshot generation
- `.with_snapshot_suffix("eslint")` — names snapshot files
- `.with_import_plugin()`, `.with_jest_plugin()` — enables plugins
- `.change_rule_path()` — adjusts virtual file paths

### 13.3 Snapshot Format

```
  ⚠ eslint(no-debugger): `debugger` statement is not allowed
    ╭─[no_debugger.tsx:1:10]
  1 │ if (foo) debugger
    ·          ────────
    ╰────
  help: Remove this `debugger` statement
```

Rendered with `GraphicalReportHandler` (Unicode coloring disabled for determinism).

### 13.4 Mock Filesystem

The `Tester` uses a `TesterFileSystem` for isolation — tests never touch real filesystem.

---

## 14. SWC (Rust-based JS/TS Compiler)

### 14.1 `#[fixture]` Macro

SWC uses a custom proc macro that generates tests from fixture files:

```rust
#[testing::fixture("tests/fixture/**/input.ts")]
#[testing::fixture("tests/fixture/**/input.tsx")]
fn fixture(input: PathBuf) {
    let output = input.with_file_name("output.js");
    test_fixture(
        Syntax::Typescript(TsConfig { .. }),
        &|t| (tr(), properties(t, true)),
        &input,
        &output,
        FixtureTestConfig::default(),
    );
}
```

Each discovered file becomes a **separate Rust test** (individually runnable).
Hidden files (starting with `.`) are `#[ignore]`d. Paths relative to `Cargo.toml`.

### 14.2 `test!` Macro (Inline)

For simple cases:
```rust
test!(
    Default::default(),
    |_| visit_mut_pass(TransformVisitor),
    boo,
    r#"foo === bar;"#
);
```

Running `UPDATE=1 cargo test` updates snapshots.

### 14.3 Execution Tests

Files named `exec.js`/`exec.ts` are **executed** — the test verifies original and
transpiled code produce identical console output.

### 14.4 Conformance

SWC's parser passes "almost all" tc39/test262 conformance tests.

---

## 15. Babel

### 15.1 Fixture-Based Testing

Babel uses `babel-plugin-tester` with a fixture directory convention:

```
__fixtures__/
  my-transform/
    basic-case/
      code.js         # Input source code
      output.js       # Expected transformed output (formatted with Prettier)
      options.json    # Per-fixture Babel options (optional)
    another-case/
      code.js
      output.js
```

- `code.js` — input, `output.js` — expected output
- `exec.js` — alternative to code.js, code is actually executed
- **Snapshot mode**: `snapshot: true` uses Jest snapshots instead of `output.js`
  (captures both input and output for readability)

### 15.2 Ecosystem E2E Testing — The Gold Standard

Babel maintains **integration tests against real-world projects** in CI:

```yaml
# .github/workflows/e2e-tests.yml
jobs:
  e2e-publish:
    # Publish to local Verdaccio npm registry
    steps:
      - run: ./scripts/integration-tests/publish-local.sh
  e2e-tests:
    matrix:
      target: [babel, create-react-app, angular-cli, prettier]
    steps:
      - run: ./scripts/integration-tests/e2e-${{ matrix.target }}.sh
```

**Process:**
1. Publish Babel packages to a **local Verdaccio npm registry**
2. Clone the target project (e.g., Create React App)
3. Update `@babel/*` dependencies to point at local versions
4. Apply compatibility patches for breaking changes
5. Run the project's own test suite
6. If tests pass, Babel changes are safe

**Active targets:** Babel itself, Create React App, Angular CLI, Prettier, Vue CLI.
**Disabled:** React Native, Next.js, Ember (still maintained, just not run in CI).

**Philosophy** (from their Jest e2e test): "The goals are: (1) Check that TypeScript
compilation isn't completely broken (2) Make sure we don't accidentally break the
consumer's usage of the Babel API."

---

## 16. Tree-sitter

### 16.1 Test Corpus Format

Tree-sitter uses a simple text-based format in `test/corpus/*.txt`:

```
================================================================================
Variable Declaration
================================================================================

let x = 42;

--------------------------------------------------------------------------------

(program
  (lexical_declaration
    (variable_declarator
      name: (identifier)
      value: (number))))
```

- `===` lines delimit test name
- Source code follows
- `---` separates input from expected S-expression parse tree
- Named nodes only; anonymous tokens (punctuation) omitted
- Field names can be labeled (`name:`, `value:`)

### 16.2 Test Attributes

- `:skip` — skip test
- `:error` — assert parse tree contains an error (omit expected output)
- `:fail-fast` — stop on failure
- `:language(LANG)` — specify parser for multi-language repos
- `:platform(linux)` — OS-specific

### 16.3 Highlight Tests

Separate from parse tests, `test/highlight/` files validate syntax highlighting:
```java
int x = 5;
// <- type.builtin
//  ^ variable
```

### 16.4 Real-World Corpus Testing

Tree-sitter CI parses entire open-source repos (e.g., elasticsearch, guava, RxJava)
to ensure the parser handles real code without errors.

### 16.5 Running Tests

```bash
tree-sitter test                    # Run all tests
tree-sitter test -f "Variable"     # Filter by name
tree-sitter test -u                # Update expected output
```

---

## 17. Attribute Grammar Systems (Silver, JastAdd, Spoofax)

### 17.1 Silver (MELT Group, UMN)

Silver has a purpose-built testing library implemented **as an attribute grammar itself**
in the `silver:testing` grammar package.

**`equalityTest` — Primary Testing Primitive:**
```silver
-- From test/silver_features/Main.sv
mainTestSuite silver_tests;

equalityTest( toInteger(0.1), 0, Integer, silver_tests );
equalityTest( "abc" == "abc", true, Boolean, silver_tests );
equalityTest( 1 / 3, 0, Integer, silver_tests );
```

Four arguments: `(actual, expected, Type, testSuiteName)`.

**Testing AG-specific features — construct, decorate, assert:**
```silver
-- From test/silver_features/Collections.sv
synthesized attribute colSyn::String with ++;
inherited attribute colInh::String with ++;

nonterminal ColNT with colSyn, colInh;

abstract production colLeaf
top::ColNT ::=
{ top.colSyn := "(" ++ top.colInh ++ ")"; }

-- Test: decorate a tree and check the attribute value:
equalityTest(
  decorate colLeaf() with { colInh = "x"; }.colSyn,
  "(x)",
  String, silver_tests
);

-- Test with tree composition + aspect contributions:
equalityTest(
  colNode(colLeaf(), colLeaf()).colSyn,
  "( a  c )( d  e ) b ",
  String, silver_tests
);

-- Test forwarding:
equalityTest(
  colFwdNode(colLeaf()).colSyn,
  "( a  c )( d  e ) b  q ",
  String, silver_tests
);
```

**This is the canonical AG testing pattern**: construct a tree, decorate it (provide inherited
attributes), query synthesized attributes, assert values.

**`wrongCode` — Negative Compilation Tests:**
```silver
wrongCode "Type of first and second expressions do not match" {
    equalityTest( intTestProd(0), 0, Integer, silver_tests );
}
```

Verifies that code **fails to compile** with the specified error message.

**Test Runner**: Silver has a `.test` file format parsed by `silver:testing:bin`.
Directives: `run: <command>`, `fail run: <command>` (expects nonzero exit),
`skip`, `test suite <jarname>`. The runner reports pass/fail counts.

**Test organization**: `test/silver_features/`, `test/stdlib/`, `test/flow/`,
`test/copper_features/`, each with a `Main.sv` declaring `mainTestSuite`.

### 17.2 JastAdd

JastAdd is a Java-based AG system. Its testing uses:

**Programmatic tree construction + JUnit assertions:**
```java
Program p = new Program(new ClassDecl("Foo"), new ClassDecl("Bar"));
assertEquals("Foo", p.getClassDecl(0).name());
assertTrue(p.getClassDecl(0).isReachable());
```

Since JastAdd generates Java classes with attribute accessor methods, testing is
standard JUnit.

**ExtendJ (JastAdd-based Java compiler) regression tests:**
- Each test is a **directory** with `Test.java` and a first-line result directive:
  `// .result=COMPILE_FAIL`, `// .result=COMPILE_ERR_OUTPUT`, `// .result=EXEC_PASS`
- For `COMPILE_ERR_OUTPUT`, a `compile.err.expected` file contains expected errors with line/column
- Tests run via Ant; most can be cross-validated against `javac`

### 17.3 Spoofax / SPT (Spoofax Testing Language)

Spoofax has the most sophisticated purpose-built test framework of any language workbench.
**SPT** is a full DSL for testing language definitions:

```spt
module my-tests
language MiniJava
start symbol Exp

fixture [[
  class Main {
    public static void main(String[] args) {
      System.out.println([[...]]);
    }
  }
]]

test simple addition [[ 1 + 2 ]] parse succeeds

test plus is left associative [[
  1 + 2 + 3
]] parse to [[ (1 + 2) + 3 ]]

test duplicate classes [[
  class [[A]]{}
  class [[A]]{}
]] 2 errors at #1, #2
```

**Expectations:**
- **Parse**: `parse succeeds`, `parse fails`, `parse ambiguous`, `parse to [[fragment]]`
- **Analysis**: `analysis succeeds`, `N errors`, `> N errors`, `N errors at #1, #2`, `error like "message"`, `error like "message" at #1`
- **Name resolution**: `resolve #1`, `resolve #1 to #2`
- **Transformation**: `transform "strategy"`, `run strategy(|#1, "arg") to [[expected]]`

**Key design**: `[[...]]` selections enable positional assertions without line/column numbers.
Tests are language-agnostic — SPT works with any Spoofax language definition.

### 17.4 Patterns for AG Testing

| What to Test | How |
|---|---|
| Synthesized attributes | Build tree, query `.attrName()`, assert value |
| Inherited attributes | Build tree with parent, query child's `.attrName()` |
| Collection attributes | Build tree with contributors, query `.attrName()` |
| Circular attributes | Build tree with cycles, query after fixpoint |
| Rewrites/forwarding | Build tree, verify rewritten structure |
| Attribute dependency graph | Test topo sort, cycle detection on the graph data structure |
| Error detection | Run analysis, collect diagnostics, check messages + locations |
| Full programs | Parse → convert → evaluate → check projections |
| Negative compilation | Verify invalid specs are rejected (Silver `wrongCode`) |

---

## 18. Cross-Cutting Patterns and Best Practices

### 18.1 The Five Testing Approaches

| Approach | Who Uses It | Pros | Cons |
|----------|------------|------|------|
| **Baseline/Golden files** | TypeScript, rustc, Flow, mypy | Full output captured; diffs in PRs; easy to update | Files accumulate; hard to know what's important |
| **Inline annotations** | Clang, rustc, mypy, Sorbet, GCC | Test and expectation co-located; obvious what's tested | Limited to diagnostics; harder for complex output |
| **Snapshot testing** | Biome, rust-analyzer, Babel, oxlint, SWC | Auto-generated; low friction to add tests | Can lead to rubber-stamping updates |
| **Structured assertions** | ESLint RuleTester, Roslyn, Silver, Pyright | Precise control; type-safe | Verbose; hard to see full picture |
| **Ecosystem/corpus testing** | Babel, TypeScript, Biome, tree-sitter | Catches real-world regressions | Slow; flaky; hard to reproduce |

**Hybrid approaches** (most mature tools): Sorbet uses inline `# error:` AND `.exp` phase snapshots.
Rust uses `//~` annotations AND `.stderr` golden files. This gives both locality and completeness.

### 18.2 Virtual Filesystem Patterns

| Tool | VFS Approach |
|------|-------------|
| **TypeScript** | Full `vfs.FileSystem` with shadow (copy-on-write), implements `ts.System` |
| **rust-analyzer** | `vfs` crate with `FileId`/`FileSet`, no disk I/O, ~4ms tests |
| **Roslyn** | In-memory compilations via `CSharpAnalyzerTest`, source strings |
| **oxlint** | `TesterFileSystem` for isolation |
| **ESLint/typescript-eslint** | Real filesystem fixtures in `tests/files/` |
| **Sorbet** | Test files loaded from `test/testdata/` |

**When to use a VFS:**
- Module resolution / config loading needs testing
- Hermetic, fast tests (no disk I/O)
- Copy-on-write for incremental/watch mode testing

**When real files are fine:**
- Single-file analysis
- Tests don't modify files
- The filesystem layout is part of what you're testing

### 18.3 Error Location Testing

Every serious tool tests error **locations**, not just messages:

| Approach | Example |
|----------|---------|
| **Line/column in assertion** | ESLint: `errors: [{ line: 3, column: 5 }]` |
| **Inline markers** | Clang: `// expected-error{{msg}}` on the line |
| **Caret positioning** | Sorbet: `# ^^^ error:` pointing to specific range above |
| **Baseline with underlines** | rustc `.stderr`: source + `^^^^^^^` underlines |
| **Markup in source** | Roslyn: `[|highlighted code|]` |
| **Position markers** | TypeScript fourslash: `/*marker*/`, rust-analyzer: `$0` |
| **Selection markers** | SPT: `[[selected text]]` with `#1`, `#2` references |

### 18.4 Updating Expectations

| Tool | Update Command |
|------|---------------|
| TypeScript | `npx hereby baseline-accept` |
| rustc | `./x.py test --bless` |
| rust-analyzer | `UPDATE_EXPECT=1 cargo test` |
| Biome | `cargo insta review` |
| SWC | `UPDATE=1 cargo test` |
| tree-sitter | `tree-sitter test -u` |
| Flow | `runtests.sh -r` |
| mypy | `--update-data` |
| Jest/vitest | `-u` flag |

### 18.5 Matklad's Testing Philosophy

From [How to Test](https://matklad.github.io/2021/05/31/how-to-test.html) — one of the
best guides for compiler/tool testing:

1. **Test features, not code**: Tests should remain valid even if implementation is replaced entirely
2. **The `check()` function pattern**: Encapsulate API in a single `check` function; individual tests just pass different inputs — dramatically reduces friction for adding tests
3. **Data-driven over code-driven**: Structure as "input in, expected output out" — enables property testing and fuzzing as natural extensions
4. **Sans-IO architecture**: Keep computation free from IO — the single most important choice for test speed. A full pipeline runs in milliseconds when IO-free
5. **Evaluate on two axes**:
   - **Purity** (no IO, single-threaded) — determines speed and reliability
   - **Extent** (how much code exercised) — determines confidence
   - Ideal: high-purity AND high-extent. Don't limit extent through mocking
6. **Use inline snapshot tests**: Handle frequent output changes gracefully
7. **Coverage marks**: Test *why* behavior occurs, not just *what*

### 18.6 Snapshot Testing Best Practices

1. **Keep snapshots small** — large snapshots lead to rubber-stamping
2. **Snapshots don't verify correctness** — they only verify output hasn't changed
3. **Best use cases**: Error messages, AST transforms, generated code
4. **Custom serializers**: Normalize paths, remove environment-specific data
5. **Normalization is critical**: Replace absolute paths with `$DIR`, normalize line endings, mask timestamps

### 18.7 Advanced Techniques

**Differential Testing**: Feed same input to multiple implementations; flag disagreements.
No manual specification of expected output needed.

**Equivalence Modulo Inputs (EMI)**: Mutate dead code regions while preserving semantics,
compare outputs across compilers. Found **147+ confirmed bugs** in GCC and LLVM.

**Grammar-Based Fuzzing (CSmith)**: Generate random valid programs, compare outputs
across compilers. Found **325+ bugs** in GCC and LLVM.

**Property-Based Testing**: Verify invariants rather than specific outputs:
- "Parsing then pretty-printing should be idempotent"
- "Every well-typed program evaluates without type errors"
- "Analysis is deterministic — running twice produces same result"
- "nodeCount always >= 1"

---

## 19. Comparison Matrix

| Feature | TS | rustc | r-a | Clang | Roslyn | Flow | Sorbet | ESLint | Biome | oxlint | Silver |
|---------|-----|-------|-----|-------|--------|------|--------|--------|-------|--------|--------|
| Virtual filesystem | VFS+shadow | No | VFS+FileId | No | In-memory | No | No | Fixtures | No | MockFS | No |
| Baseline/golden | .errors.txt | .stderr | No | No | No | .exp | .exp (phases) | No | Snapshots | Snapshots | No |
| Inline annotations | Fourslash | `//~` | `$0` | `-verify` | Markup | No | `# error:` | No | No | No | `wrongCode` |
| Structured assertions | No | No | expect! | No | Code API | No | No | RuleTester | No | Tester | equalityTest |
| Multi-file testing | @filename | aux-build | //-  | Multi-file | In-memory | Dir-based | testdata/ | Fixtures | N/A | MockFS | Programs |
| IDE feature testing | Fourslash | No | expect! | No | Full | Yes | def:/usage: | No | No | No | No |
| Ecosystem testing | User tests | Crater | No | No | VS integ. | No | No | No | Conformance | Manual | No |
| Auto-update | baseline-accept | --bless | UPDATE_EXPECT | No | No | -r | No | No | insta review | insta | No |
| Incremental testing | Yes | Yes | Yes | No | Yes | No | No | No | No | No | No |

---

## 20. Recommendations for KindScript

Based on this research, here are the testing approaches most relevant to KindScript,
ordered from most impactful to most aspirational.

### 20.1 Tier 1: Attribute Computation Tests (Silver-style)

Like Silver's `equalityTest`, test attribute values by constructing trees and checking results.
This is the most natural fit for an AG system.

```typescript
// Build a tree from source
const program = createProgram(parseSource(`
  type Foo = { bar: string };
  const x: Foo = { bar: 42 };
`));

// Check specific attributes
expect(program.projections.definitions).toHaveLength(1);
expect(program.projections.diagnostics).toContainEqual(
  expect.objectContaining({
    message: expect.stringMatching(/type mismatch/),
    node: expect.objectContaining({ kind: "PropertyAssignment" }),
  })
);
```

### 20.2 Tier 2: Fixture-Based Snapshot Testing

For full-program testing, use vitest snapshots with fixture directories.
`toMatchFileSnapshot()` is particularly useful (avoids escape issues, preserves syntax highlighting):

```
test/fixtures/
  kind-checking/
    basic-types/
      input.ts           # Source code
      expected.txt       # Expected diagnostics (vitest file snapshot)
    generics/
      input.ts
      expected.txt
    multi-file/
      tsconfig.json
      main.ts
      helper.ts
      expected.txt
```

Each test: parse → evaluate → collect diagnostics → snapshot comparison.
Update with `vitest -u`.

### 20.3 Tier 3: Inline Error Annotation Tests (Clang/mypy-style)

For compact diagnostic testing, annotate expected errors in source:

```typescript
// test/annotated/basic.ts
type Foo = { bar: string };
const x: Foo = { bar: 42 }; // @error: type mismatch
const y: Foo = { bar: "ok" }; // no error
```

A test harness parses `// @error:` comments and verifies diagnostics appear on the
correct lines with matching messages. This is the most ergonomic format for writing
lots of small test cases quickly.

### 20.4 Tier 4: Real-World Corpus Testing

Test against real TypeScript projects to catch regressions:

```typescript
const realProjects = [
  "path/to/small-ts-project",
  "path/to/medium-ts-project",
];

for (const project of realProjects) {
  test(`analyze ${project}`, () => {
    const result = checkProject(project);
    expect(result.diagnostics).toMatchSnapshot();
  });
}
```

### 20.5 Virtual Filesystem Consideration

For KindScript, a full VFS may be overkill initially. TypeScript's VFS is needed because
TypeScript is a full compiler with file resolution, module loading, and watch mode.
KindScript receives a `ts.Program` from TypeScript's own compilation, so the filesystem
layer is already abstracted.

**Recommended approach**: Use real fixture directories for now (like eslint-plugin-import),
with TypeScript's own `ts.createProgram` pointed at fixture `tsconfig.json` files.
If test isolation or speed becomes an issue, consider adopting TypeScript's VFS pattern.

### 20.6 The `check()` Pattern (matklad)

Structure all tests around a single `check()` helper to minimize boilerplate:

```typescript
function checkDiagnostics(source: string, expected: string[]) {
  const program = createProgram(source);
  const diagnostics = program.projections.diagnostics.map(d => d.message);
  expect(diagnostics).toEqual(expected);
}

test('basic type mismatch', () => {
  checkDiagnostics(`
    type Foo = { bar: string };
    const x: Foo = { bar: 42 };
  `, ['type mismatch for property bar']);
});

test('valid assignment', () => {
  checkDiagnostics(`
    type Foo = { bar: string };
    const x: Foo = { bar: "ok" };
  `, []);
});
```

### 20.7 Testing Priority Summary

| Priority | What | Why | Pattern |
|----------|------|-----|---------|
| **P0** | Attribute computation correctness | Core AG functionality | Silver equalityTest |
| **P0** | Diagnostic accuracy (message + location) | User-facing output | Inline annotations |
| **P1** | Full-program evaluation | Integration confidence | Fixture snapshots |
| **P1** | Codegen output stability | Prevent regressions | Golden file comparison |
| **P2** | Multi-file projects | Real-world scenarios | Fixture directories with tsconfig |
| **P2** | Edge cases and error handling | Robustness | Property: "never crashes" |
| **P3** | Real-world corpus | Ecosystem confidence | Snapshot against real repos |

---

## Sources

### TypeScript
- [TypeScript Contributing Guide](https://github.com/microsoft/TypeScript/wiki/Contributing)
- [TypeScript VFS](https://www.npmjs.com/package/@typescript/vfs)
- [TypeScript Twoslash](https://www.typescriptlang.org/dev/twoslash/)
- [TypeScript fakes.ts source](https://github.com/microsoft/TypeScript/blob/main/src/harness/fakes.ts)
- [TypeScript fourslash notes](https://github.com/orta/typescript-notes/blob/master/systems/testing/fourslash.md)

### Rust
- [Rust Compiler UI Tests](https://rustc-dev-guide.rust-lang.org/tests/ui.html)
- [Rust Compiletest](https://rustc-dev-guide.rust-lang.org/tests/compiletest.html)
- [Rust Test Directives](https://rustc-dev-guide.rust-lang.org/tests/directives.html)
- [rust-analyzer Architecture](https://rust-analyzer.github.io/book/contributing/architecture.html)
- [expect-test](https://github.com/rust-analyzer/expect-test)
- [matklad: How to Test](https://matklad.github.io/2021/05/31/how-to-test.html)
- [matklad: Unit and Integration Tests](https://matklad.github.io/2022/07/04/unit-and-integration-tests.html)

### LLVM/Clang/GCC
- [LLVM Testing Guide](https://llvm.org/docs/TestingGuide.html)
- [LLVM FileCheck](https://llvm.org/docs/CommandGuide/FileCheck.html)
- [Clang VerifyDiagnosticConsumer](https://clang.llvm.org/doxygen/classclang_1_1VerifyDiagnosticConsumer.html)

### .NET/Roslyn
- [Roslyn Analyzer Testing](https://github.com/dotnet/roslyn-sdk/blob/main/src/Microsoft.CodeAnalysis.Testing/README.md)
- [Testing Roslyn Analyzers Guide](https://www.meziantou.net/how-to-test-a-roslyn-analyzer.htm)

### Type Checkers
- [Flow GitHub](https://github.com/facebook/flow)
- [Sorbet GitHub](https://github.com/sorbet/sorbet)
- [Pyright GitHub](https://github.com/microsoft/pyright)
- [Pyright Testing Framework (DeepWiki)](https://deepwiki.com/microsoft/pyright/8-testing-framework)
- [mypy test-data README](https://github.com/python/mypy/blob/master/test-data/unit/README.md)

### Linters
- [ESLint RuleTester](https://eslint.org/docs/latest/integrate/nodejs-api#ruletester)
- [typescript-eslint Rule Tester](https://typescript-eslint.io/packages/rule-tester/)
- [Biome Development Workflow (DeepWiki)](https://deepwiki.com/biomejs/biome/8.1-development-workflow)
- [Biome GitHub](https://github.com/biomejs/biome)
- [oxlint GitHub](https://github.com/nicolo-ribaudo/oxc)

### Compilers/Transforms
- [SWC #[fixture] docs](https://rustdoc.swc.rs/testing/attr.fixture.html)
- [babel-plugin-tester](https://github.com/babel-utils/babel-plugin-tester)
- [Babel e2e workflow](https://github.com/babel/babel/blob/main/.github/workflows/e2e-tests.yml)

### Parsers
- [Tree-sitter Writing Tests](https://tree-sitter.github.io/tree-sitter/creating-parsers/5-writing-tests.html)

### Attribute Grammars
- [Silver GitHub](https://github.com/melt-umn/silver)
- [MELT Silver](https://melt.cs.umn.edu/silver/index.html)
- [JastAdd Reference Manual](https://jastadd.cs.lth.se/releases/jastadd2/2.1.8/reference-manual.php)
- [ExtendJ Regression Tests](https://extendj.org/regtests.html)
- [SPT Reference](https://spoofax.dev/references/spt/)
- [SPT Test Expectations](https://spoofax.dev/references/spt/test-expectations/)

### Research
- [A Survey of Compiler Testing (2019)](https://www.software-lab.org/publications/csur2019_compiler_testing.pdf)
- [Kent C. Dodds: Effective Snapshot Testing](https://kentcdodds.com/blog/effective-snapshot-testing)
- [Insta Snapshot Testing](https://insta.rs/)
- [Jane Street: Testing with Expectations (ppx_expect)](https://blog.janestreet.com/testing-with-expectations/)
