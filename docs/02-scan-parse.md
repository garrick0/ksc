# Scan & Parse

> Fully delegated to TypeScript. We call the compiler and consume the AST it produces.

---

## Overview

KindScript has no scanner or parser of its own. The entire scan and parse phase is a single call to `ts.createProgram()`, which internally runs TypeScript's scanner (tokenizer) and parser (AST builder) on every source file. We are consumers of the output.

This is a deliberate design choice. KindScript's user API (`Kind<Base, Props>`, `KSFile`, `KSDir`, `ks.file()`, `ks.dir()`) is expressed entirely as standard TypeScript syntax — type aliases, type references, generic type arguments, function calls. TypeScript's parser already handles all of this correctly. There is nothing for us to parse.

---

## What TypeScript Does

### Scanner

TypeScript's scanner (`scanner.ts`) converts raw source text into tokens. It operates on demand — the parser calls `scanner.scan()` to consume the next token.

For KindScript's purposes, the scanner's work is invisible. We never interact with tokens directly. Everything we need is in the AST.

### Parser

TypeScript's parser (`parser.ts`) builds the AST — a tree of `ts.Node` objects rooted at a `ts.SourceFile`. It uses recursive descent: functions like `parseStatement()`, `parseExpression()`, `parseTypeNode()` consume tokens and produce nodes.

For KindScript's user API, the parser produces the following AST structures:

#### Type alias declaration

```ts
type PureDomain = Kind<KSDir, { pure: true, noIO: true }>;
```

Parses to:

```
TypeAliasDeclaration
  ├── name: Identifier("PureDomain")
  ├── typeParameters: undefined
  └── type: TypeReferenceNode
        ├── typeName: Identifier("Kind")
        └── typeArguments: NodeArray [
              TypeReferenceNode
                └── typeName: Identifier("KSDir"),
              TypeLiteralNode
                └── members: [
                      PropertySignature { name: "pure",  type: TrueKeyword },
                      PropertySignature { name: "noIO",  type: TrueKeyword }
                    ]
            ]
```

The `TypeReferenceNode` preserves both type arguments — the base type (`KSDir`) and the property spec (`{ pure: true, noIO: true }`). These are the exact values the KindScript binder needs to extract.

#### Variable declaration with kind annotation

```ts
const domain: PureDomain = ks.dir('./src/domain');
```

Parses to:

```
VariableStatement
  └── declarationList: VariableDeclarationList
        └── declarations: [
              VariableDeclaration
                ├── name: Identifier("domain")
                ├── type: TypeReferenceNode
                │     └── typeName: Identifier("PureDomain")
                └── initializer: CallExpression
                      ├── expression: PropertyAccessExpression
                      │     ├── expression: Identifier("ks")
                      │     └── name: Identifier("dir")
                      └── arguments: [
                            StringLiteral("./src/domain")
                          ]
            ]
```

Key information we extract later:
- The type annotation (`PureDomain`) links this value to a Kind definition
- The `ks.dir()` call tells us this value represents a directory
- The string literal argument gives us the filesystem path

#### Composite kind with relational constraints

```ts
type CleanArch = Kind<{
  domain: DomainLayer;
  infrastructure: InfraLayer;
  application: AppLayer;
}, {
  noDependency: [["domain", "infrastructure"], ["domain", "application"]],
  noCycles: ["domain", "infrastructure", "application"],
}>;
```

Parses to:

```
TypeAliasDeclaration
  ├── name: Identifier("CleanArch")
  └── type: TypeReferenceNode
        ├── typeName: Identifier("Kind")
        └── typeArguments: [
              TypeLiteralNode                     ← Base type (object with members)
                └── members: [
                      PropertySignature { name: "domain",         type: TypeRef("DomainLayer") },
                      PropertySignature { name: "infrastructure", type: TypeRef("InfraLayer") },
                      PropertySignature { name: "application",    type: TypeRef("AppLayer") }
                    ],
              TypeLiteralNode                     ← PropertySpec
                └── members: [
                      PropertySignature { name: "noDependency", type: TupleType[...] },
                      PropertySignature { name: "noCycles",     type: TupleType[...] }
                    ]
            ]
```

The relational constraints (`noDependency`, `noCycles`) are stored as tuple types in the AST. The binder will need to extract the string literal values from these tuples.

---

## What We Get After Scan & Parse

After `ts.createProgram()` completes, we have:

| Artifact | Type | Contents |
|---|---|---|
| Source files | `ts.SourceFile[]` | Full AST for every `.ts` file in the program |
| Type checker | `ts.TypeChecker` | Resolves types, symbols, and type arguments |
| Symbol tables | `ts.SymbolTable` | Maps names to symbols at each scope |

The TypeChecker is particularly important. While the parser gives us AST nodes, the TypeChecker gives us resolved types — it follows type alias chains, resolves generic type arguments, and provides structural type information. The binder uses the TypeChecker extensively.

---

## Why No Custom Parsing

Several features of the user API were designed specifically to avoid custom parsing:

| Design choice | Parsing benefit |
|---|---|
| `Kind<Base, Props>` is a generic type alias | Standard `TypeReferenceNode` with `typeArguments` — parser handles it |
| Properties are object literal types `{ pure: true }` | Standard `TypeLiteralNode` with `PropertySignature` members |
| `ks.file()` / `ks.dir()` are function calls | Standard `CallExpression` with `StringLiteral` arguments |
| No custom syntax (decorators, pragmas, etc.) | No need to extend the parser or scanner |
| Relational constraints use tuple types `[["a", "b"]]` | Standard `TupleTypeNode` with `StringLiteral` elements |

The `__ks` phantom marker is a regular optional property — the parser handles it, the type checker sees it, and the binder can detect it structurally. No special treatment required.

---

## The `context.ts` File

KindScript expects architectural contracts to be defined in a `context.ts` file (or files). This is a normal TypeScript file that imports from the `kindscript` package and defines Kind types and kind-annotated values.

From the parser's perspective, `context.ts` is indistinguishable from any other `.ts` file. It uses standard TypeScript syntax — type aliases, variable declarations, function calls. The only thing that makes it special is that it contains `Kind<...>` type references and `ks.file()`/`ks.dir()` calls, which the KindScript binder knows how to find and interpret.

`context.ts` is excluded from production builds (via `tsconfig` paths or build tool configuration) but is fully visible to the TypeScript compiler during KindScript analysis.

---

## What Happens Next

The scan and parse phase produces raw AST nodes and symbols. The KindScript binder (next phase) walks these structures to:

1. Find type aliases that reference `Kind<...>` — these are Kind definitions
2. Find variable declarations annotated with Kind types — these are kind-annotated values
3. Extract `PropertySpec` from type arguments
4. Extract filesystem paths from `ks.file()`/`ks.dir()` call arguments
5. Build the `KindSymbolTable` that the checker will use
