# Scan & Parse

> Fully delegated to TypeScript. We call the compiler and consume the AST it produces.

---

## Overview

KindScript has no scanner or parser of its own. The entire scan and parse phase is a single call to `ts.createProgram()`, which internally runs TypeScript's scanner (tokenizer) and parser (AST builder) on every source file. We are consumers of the output.

This is a deliberate design choice. KindScript's architectural constraints are defined in a config file via `defineConfig()`, and the rules are checked against standard TypeScript source files. TypeScript's parser already handles all of this correctly. There is nothing for us to parse.

---

## What TypeScript Does

### Scanner

TypeScript's scanner (`scanner.ts`) converts raw source text into tokens. It operates on demand — the parser calls `scanner.scan()` to consume the next token.

For KindScript's purposes, the scanner's work is invisible. We never interact with tokens directly. Everything we need is in the AST.

### Parser

TypeScript's parser (`parser.ts`) builds the AST — a tree of `ts.Node` objects rooted at a `ts.SourceFile`. It uses recursive descent: functions like `parseStatement()`, `parseExpression()`, `parseTypeNode()` consume tokens and produce nodes.

The checker walks these AST structures to verify rules. For example:

#### Function declarations (checked for noMutation, pure, etc.)

```ts
export function add(a: number, b: number): number {
  return a + b;
}
```

Parses to:

```
FunctionDeclaration
  ├── name: Identifier("add")
  ├── parameters: [Parameter("a"), Parameter("b")]
  └── body: Block
        └── statements: [ReturnStatement]
```

The checker walks the function body to verify rules like `noMutation` (no assignments) or `pure` (no IO, no side effects).

#### Variable declarations (checked for immutable, etc.)

```ts
export const PI = 3.14159;
```

Parses to:

```
VariableStatement
  └── declarationList: VariableDeclarationList (const)
        └── declarations: [
              VariableDeclaration
                ├── name: Identifier("PI")
                └── initializer: NumericLiteral(3.14159)
            ]
```

The checker verifies `immutable` by checking that module-scope declarations use `const` rather than `let` or `var`.

#### Import declarations (checked for noImports, noIO, etc.)

```ts
import * as fs from 'node:fs';
```

Parses to:

```
ImportDeclaration
  ├── importClause: ImportClause
  │     └── namedBindings: NamespaceImport
  │           └── name: Identifier("fs")
  └── moduleSpecifier: StringLiteral("node:fs")
```

The checker uses the `moduleSpecifier` string to detect `noImports` violations (any import) or `noIO` violations (imports from IO-related modules like `node:fs`, `node:http`, etc.).

---

## What We Get After Scan & Parse

After `ts.createProgram()` completes, we have:

| Artifact | Type | Contents |
|---|---|---|
| Source files | `ts.SourceFile[]` | Full AST for every `.ts` file in the program |
| Type checker | `ts.TypeChecker` | Resolves types, symbols, and type arguments |
| Symbol tables | `ts.SymbolTable` | Maps names to symbols at each scope |

The TypeChecker is particularly important. While the parser gives us AST nodes, the TypeChecker gives us resolved types — it follows type alias chains, resolves generic type arguments, and provides structural type information.

---

## Why No Custom Parsing

KindScript's configuration is defined externally via `defineConfig()`, not embedded in source files as special syntax. This means:

| Design choice | Parsing benefit |
|---|---|
| Config is plain data (`defineConfig({...})`) | No need to parse type-level annotations from source files |
| Rules reference paths (`'./src/domain'`) | Standard string values, no AST extraction needed |
| All checked files are standard `.ts` files | TypeScript's parser handles them completely |
| No custom syntax (decorators, pragmas, etc.) | No need to extend the parser or scanner |

---

## What Happens Next

The scan and parse phase produces raw AST nodes and symbols. The KindScript checker (after the binder creates KindSymbols from the config) walks these structures to:

1. Match config paths to actual source files in the program
2. Walk matched source files' ASTs to detect rule violations
3. Emit diagnostics with source positions for any violations found
