# Kind Type API Design

KindScript kinds are TypeScript types with an extended property space. A kind wraps a normal TS type and declares additional properties that KindScript's checker verifies. The TS type system sees no structural difference between a kind and its base type.

Everything is a value. Functions, classes, files, and directories are all values. Types are assigned to values. Kinds are types with additional properties. The checker evaluates values against their kinds — uniformly, at every level.

## Core Principles

```
Kind  = Base type  + Properties (phantom)
Value = Expression : Kind
```

- No kind name parameter — the type alias IS the name, like TS types
- No members parameter — members are the base type's members, like TS types
- Files and directories are values with types, just like functions and classes
- `Kind<Base, Properties>` resolves structurally to `Base` — transparent to TS
- Properties exist only in the AST as type arguments — KS reads them, TS ignores them
- The checker does the same thing at every level: `getKindOfExpr(value, declaredKind)`

## Provided Types

### `KSFile<Path>` — a file value type

Represents a source file. KindScript provides this as a base type. Path is a string literal carried as a phantom parameter; filename and extension are computed by TS template literal types.

```ts
type ExtractFilename<P extends string> = P extends `${string}/${infer F}` ? F : P;
type ExtractExtension<P extends string> = P extends `${string}.${infer E}` ? `.${E}` : '';

type KSFile<Path extends string = string> = {
  readonly path: Path;
  readonly filename: ExtractFilename<Path>;
  readonly extension: ExtractExtension<Path>;
  readonly __ks?: true;
};
```

### `KSDir<Path>` — a directory value type

Represents a directory. A directory is a node whose children are files and subdirectories.

```ts
type ExtractDirname<P extends string> = P extends `${string}/${infer N}` ? N : P;

type KSDir<Path extends string = string> = {
  readonly path: Path;
  readonly name: ExtractDirname<Path>;
  readonly __ks?: true;
};
```



### `PropertySpec<Members>` — the property vocabulary

Describes what properties a kind requires. Parameterized by `Members` so relational properties can reference member names with type safety.

Three categories:
- **Intrinsic** — properties of the value itself (pure, noIO, noImports, etc.)
- **Relational** — properties between members (noDependency, noCycles, etc.)
- **Structural** — shape constraints on the value's scope (exhaustive, scope)

```ts
type PropertySpec<Members = {}> = {
  // Intrinsic (evaluated per-value by walking the AST)
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
  readonly noDependency?: ReadonlyArray<
    readonly [keyof Members & string, keyof Members & string]
  >;
  readonly noTransitiveDependency?: ReadonlyArray<
    readonly [keyof Members & string, keyof Members & string]
  >;
  readonly noCycles?: ReadonlyArray<keyof Members & string>;
  readonly noSiblingDependency?: true;

  // Structural
  readonly exhaustive?: true;
  readonly scope?: 'folder' | 'file';
};
```

### `Kind<Base, Properties>` — the wrapper

Takes a base TS type and a phantom property spec. Resolves structurally to `Base`. The conditional on `_Properties` extracts member names from `Base` when it's an object type, giving relational properties `keyof` checking for free.

```ts
type Kind<
  Base = unknown,
  _Properties extends PropertySpec<
    Base extends Record<string, unknown> ? Base : {}
  > = {},
> = Base & {
  readonly __ks?: true;
};
```

### `ks` — the fluent builder (runtime, for context.ts)

KindScript provides a builder object for constructing file and directory values. These are real runtime functions, used in `context.ts` (which is executed by the KS CLI and excluded from production builds). The builder returns typed values that carry path information in their types.

```ts
// The builder API
declare const ks: {
  file<P extends string>(path: P): KSFile<P>;
  dir<P extends string>(path: P): KSDir<P>;
};

// Implementation (in kindscript library)
const ks = {
  file<P extends string>(path: P): KSFile<P> {
    return { path, filename: basename(path), extension: extname(path) } as KSFile<P>;
  },
  dir<P extends string>(path: P): KSDir<P> {
    return { path, name: basename(path) } as KSDir<P>;
  },
};
```

## Usage

### Files as values with kinds

```ts
// context.ts
import { ks, Kind, KSFile } from 'kindscript';

// A file type with a naming constraint (pure TS template literal)
type ServiceFile = KSFile & { readonly filename: `${string}.service.ts` };

// A kind: a service file that must be pure with no IO
type PureService = Kind<ServiceFile, { pure: true, noIO: true }>;

// Create a file value, annotate with a kind
const userService: PureService = ks.file('./src/domain/user.service.ts');
// TS checks: filename 'user.service.ts' matches `${string}.service.ts` — OK
// KS checks: is ./src/domain/user.service.ts pure? has no IO? — verifies body
```

### Directories as values with kinds

```ts
// context.ts
import { ks, Kind, KSDir } from 'kindscript';

type PureDomain = Kind<KSDir, { pure: true, noIO: true }>;
type InfraDir = Kind<KSDir>;

const domain: PureDomain = ks.dir('./src/domain');
const infrastructure: InfraDir = ks.dir('./src/infrastructure');
// KS checks: every file in ./src/domain/ is pure and has no IO
// KS treats the directory as a node whose children are file ASTs
```

### Functions as values with kinds

```ts
// In any .ts file — functions are already values
type PureFn = Kind<Function, { pure: true, noIO: true }>;

const calculateTotal: PureFn = (items: Item[]) =>
  items.reduce((sum, i) => sum + i.price, 0);
// KS checks: walk calculateTotal's body. Pure? No IO? — verifies
```

### Composite kinds (relational constraints between members)

Members are values — functions, files, directories. Relational constraints reference member names via `keyof`. The base type's structure defines the members.

```ts
// context.ts
import { ks, Kind, KSDir } from 'kindscript';

// Layer kinds
type DomainLayer = Kind<KSDir, { pure: true, noIO: true }>;
type InfraLayer = Kind<KSDir>;
type AppLayer = Kind<KSDir, { noConsole: true }>;

// Architecture: an object whose members are directory values
type CleanArch = Kind<{
  domain: DomainLayer;
  infrastructure: InfraLayer;
  application: AppLayer;
}, {
  noDependency: [["domain", "infrastructure"], ["domain", "application"]],
  noCycles: ["domain", "infrastructure", "application"],
}>;

// Instantiate with real directory values
const app: CleanArch = {
  domain: ks.dir('./src/domain'),
  infrastructure: ks.dir('./src/infrastructure'),
  application: ks.dir('./src/application'),
};
// KS checks:
//   domain → pure? noIO? ✓ (all files in ./src/domain)
//   application → noConsole? ✓ (all files in ./src/application)
//   domain does not import from infrastructure? ✓
//   domain does not import from application? ✓
//   no cycles between the three? ✓
```

### Mixed-level composition (CQRS example)

Members can be any value type — functions, files, directories, mixed.

```ts
// context.ts
import { ks, Kind, KSFile } from 'kindscript';

// Leaf kinds
type HandlerFn = Kind<Function, { pure: true, noIO: true }>;
type RepoFile = Kind<KSFile, { noConsole: true }>;
type ControllerFile = Kind<KSFile, { noMutation: true }>;

// Composite kind: members are functions and files
type CQRSQuery = Kind<{
  handler: HandlerFn;
  repository: RepoFile;
  controller: ControllerFile;
}, {
  noDependency: [["handler", "repository"], ["handler", "controller"]],
}>;

// Instantiate
const createOrder: CQRSQuery = {
  handler: processOrder,
  repository: ks.file('./src/repos/order.repo.ts'),
  controller: ks.file('./src/api/order.controller.ts'),
};
// KS checks:
//   processOrder body → pure? noIO? ✓
//   order.repo.ts → noConsole? ✓
//   order.controller.ts → noMutation? ✓
//   handler does not import from repository? ✓
//   handler does not import from controller? ✓
```

### Inline kinds (no separate type alias needed)

```ts
const handler: Kind<(req: Request) => Response, { noIO: true }> =
  (req) => new Response(req.url);

const config: Kind<KSDir, { immutable: true, static: true }> =
  ks.dir('./src/config');
```

## The Uniform Checker Model

The checker does the same thing at every level:

```
value : kind = expression
  │      │       │
  │      │       └─ getKindOfExpr(expression)
  │      │            → walks the AST (function body / file source / directory tree)
  │      │            → computes properties: { pure: true, noIO: false, ... }
  │      │
  │      └─ declared kind's PropertySpec: { pure: true, noIO: true }
  │
  └─ isKindAssignable(computed, declared)
       → computed.pure satisfies declared.pure? ✓
       → computed.noIO satisfies declared.noIO? ✗ → diagnostic
```

What the checker walks for each value type:

| Value type | AST the checker walks | Example property check |
|---|---|---|
| Function | Function body (BlockStatement) | Walk body for IO calls → noIO |
| Class | All method bodies | Walk each method for mutations → noMutation |
| File (`KSFile`) | Full TS SourceFile AST | Walk all declarations for imports → noImports |
| Directory (`KSDir`) | Virtual node → children are file ASTs | Walk all files for console calls → noConsole |
| Composite | Each member recursively + import graph | Check noDependency between members |

The directory AST is constructed by KS from the filesystem:

```
DirNode('./src/domain')
├── FileNode('./src/domain/handler.ts')     → full TS AST
├── FileNode('./src/domain/service.ts')     → full TS AST
└── DirNode('./src/domain/models')
      ├── FileNode('./src/domain/models/user.ts')
      └── FileNode('./src/domain/models/order.ts')
```

This extends the TS AST upward — TS has `SourceFile → Class → Method → Block`, KS adds `Directory → File → Class → Method → Block`. Same tree, same walk, same property computation.

## Type Summary

| Type | Parameters | Resolves To | Purpose |
|---|---|---|---|
| `KSFile<Path>` | `Path` = string literal | Object with path/filename/extension | Value type for source files |
| `KSDir<Path>` | `Path` = string literal | Object with path/name | Value type for directories |
| `PropertySpec<M>` | `M` = member type for relational key checking | (standalone, not instantiated) | Vocabulary of all supported properties |
| `Kind<Base, Props>` | `Base` = any TS type, `Props` = phantom `PropertySpec` | `Base & { __ks?: true }` (≈ `Base`) | Wrap a type with KS properties |
| `ks.file(path)` | `path` = string literal | `KSFile<path>` | Runtime file value constructor |
| `ks.dir(path)` | `path` = string literal | `KSDir<path>` | Runtime directory value constructor |

## What Was Removed

| Old | New | Why |
|---|---|---|
| `Kind<Name, Members, Constraints, Path, Bindings>` | `Kind<Base, Properties>` | Name = type alias. Members = base type's members. Path/Bindings = use `ks.file()`/`ks.dir()`. |
| `KindRef` | `{ readonly __ks?: true }` | Simplified phantom marker. |
| `Annotate<K, Path, Members>` | Removed | Values carry their own paths via `ks.file()`/`ks.dir()`. |
| `Locate<K, Path, Bindings>` | Removed | Same reason — paths are on values, not on types. |
| `CodeRegion<Name, Expr>` | Removed | A file/directory value IS the code region. |
| `Constraints<Members>` | `PropertySpec<Members>` | Clearer name — it's a spec of properties. |
| `Extend<Base, Additions>` | TS intersection: `Kind<A & B, {...}>` | Normal TS type composition. |
| `Restrict<Base, Removals>` | TS `Omit`: `Kind<Omit<A, 'x'>, {...}>` | Normal TS type manipulation. |

## How KS Processes This

**context.ts** is a normal `.ts` file. TS parses it, binds it, type-checks it. It's excluded from production builds but fully visible to the TS compiler. The `ks.file()` and `ks.dir()` calls appear as `CallExpression` nodes in the AST with string literal arguments.

**Parser**: TS parses everything normally. `Kind<Base, Properties>` is a `TypeReference` with two type arguments. `ks.file('./path')` is a `CallExpression`.

**Post-parse**: KS walks type aliases for `Kind<>` references and extracts `PropertySpec` from the second type argument. Walks variable declarations for `ks.file()`/`ks.dir()` calls and extracts paths from string literal arguments.

**Binder**: TS binds normally. KS builds a `WeakMap<ts.Symbol, PropertySpec>` mapping kind-annotated symbols to their declared properties.

**Checker**: KS walks declarations annotated with Kind types. For each value:

1. **Resolve the value** — function body, file AST (from path), or directory tree (from path)
2. **Compute properties** — walk the AST using `ts.TypeChecker.getSymbolAtLocation()` to detect imports, IO, mutations, etc.
3. **Check assignability** — do the computed properties satisfy the declared `PropertySpec`?
4. **Emit diagnostics** — report violations with source positions
