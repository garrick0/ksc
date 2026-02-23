# KindScript

**Architectural enforcement for TypeScript, expressed as TypeScript.**

KindScript extends TypeScript's type system with *kinds* — types that carry additional architectural properties. Where TypeScript validates that values match their types, KindScript validates that code matches its architectural intent.

## What Problem Does KindScript Solve?

Every team starts with architectural rules: "the domain layer must be pure," "infrastructure cannot leak into business logic," "no circular dependencies between modules." These rules live in wiki pages, onboarding docs, and the memories of senior engineers. They are enforced by code review — inconsistently, after the fact, at scale never.

KindScript makes architectural rules checkable. You declare them in TypeScript's type system. The compiler verifies them against your actual codebase. Violations appear as errors — in your editor, in CI, alongside your regular TypeScript diagnostics.

## How It Works (From the User's Perspective)

### Everything is a value. Types describe values. Kinds describe architecture.

In TypeScript, a *type* describes the shape of a value: "this function takes a string and returns a number." In KindScript, a *kind* describes the architectural properties of a value: "this function is pure, performs no IO, and has no imports."

A kind wraps a normal TypeScript type and adds phantom properties that KindScript's checker verifies. TypeScript sees no structural difference — `Kind<Base, Properties>` resolves to `Base`. The additional properties exist only in the type arguments, invisible to TypeScript, visible to KindScript.

### Files and directories are values too

KindScript treats files and directories as first-class values, just like functions and classes. A file has a path, a filename, and an extension. A directory has a path and child nodes. You can annotate them with kinds and the checker will verify every declaration inside them.

```typescript
// context.ts — the architectural contract for your codebase
import { ks, Kind, KSFile, KSDir } from 'kindscript';

// A kind: a directory whose contents must be pure with no IO
type PureDomain = Kind<KSDir, { pure: true, noIO: true }>;

// Bind the kind to an actual directory
const domain: PureDomain = ks.dir('./src/domain');
// KindScript checks: every file in ./src/domain/ is pure and has no IO
```

### Compositional architecture

Kinds compose. You can define architectural patterns as composite kinds whose members are directories, files, or functions — with relational constraints between them.

```typescript
type DomainLayer = Kind<KSDir, { pure: true, noIO: true }>;
type InfraLayer = Kind<KSDir>;
type AppLayer = Kind<KSDir, { noConsole: true }>;

type CleanArchitecture = Kind<{
  domain: DomainLayer;
  infrastructure: InfraLayer;
  application: AppLayer;
}, {
  noDependency: [["domain", "infrastructure"], ["domain", "application"]],
  noCycles: ["domain", "infrastructure", "application"],
}>;

const app: CleanArchitecture = {
  domain: ks.dir('./src/domain'),
  infrastructure: ks.dir('./src/infrastructure'),
  application: ks.dir('./src/application'),
};
// KindScript checks:
//   domain is pure, has no IO
//   application has no console usage
//   domain does not import from infrastructure or application
//   no circular dependencies between the three layers
```

### Mixed-level composition

Members can be any value type — functions, files, directories, mixed together in the same composite kind.

```typescript
type CQRSQuery = Kind<{
  handler: Kind<Function, { pure: true, noIO: true }>;
  repository: Kind<KSFile, { noConsole: true }>;
  controller: Kind<KSFile, { noMutation: true }>;
}, {
  noDependency: [["handler", "repository"], ["handler", "controller"]],
}>;
```

## Architectural Properties

KindScript verifies three categories of properties:

### Intrinsic Properties
Properties of a value itself, computed by walking its AST:

| Property | What it checks |
|---|---|
| `pure` | No side effects: no IO, no mutation, no console, no imports of impure code |
| `noIO` | No filesystem, network, or process operations |
| `noImports` | No import statements |
| `noMutation` | No reassignment of variables or object properties |
| `noConsole` | No console.log/warn/error/etc. |
| `immutable` | No `let` or `var` at module scope |
| `static` | No dynamic imports or computed paths |
| `noSideEffects` | No top-level function calls or assignments at module scope |
| `maxFanOut` | Maximum number of dependencies allowed |

### Relational Properties
Properties between members, computed from the import graph:

| Property | What it checks |
|---|---|
| `noDependency` | Member A cannot import from member B |
| `noTransitiveDependency` | Member A cannot transitively reach member B |
| `noCycles` | No circular dependency chains among listed members |
| `noSiblingDependency` | No member may import from any sibling |

### Structural Properties
Shape constraints on how values relate to their scope:

| Property | What it checks |
|---|---|
| `exhaustive` | Every file in scope must be assigned to a member |
| `scope` | Whether the kind operates at `'folder'` or `'file'` granularity |

## The Uniform Model

KindScript applies the same verification logic at every level:

```
value : kind
  │      │
  │      └─ Declared properties: { pure: true, noIO: true }
  │
  └─ Computed properties (from AST walk): { pure: true, noIO: false }
       │
       └─ Are computed properties assignable to declared properties?
            pure:  true  ⊇ true  → OK
            noIO:  false ⊇ true  → VIOLATION
```

What gets walked depends on the value type:

| Value Type | What the Checker Walks |
|---|---|
| Function | Function body |
| Class | All method bodies |
| File (`KSFile`) | Full source file AST |
| Directory (`KSDir`) | All files recursively |
| Composite | Each member recursively + import graph between members |

This extends the TypeScript AST upward: TypeScript has `SourceFile → Class → Method → Block`. KindScript adds `Directory → File → Class → Method → Block`. Same tree, same walk.

## Integration

KindScript produces standard TypeScript diagnostics, so violations appear:
- **In your editor** — as red squiggles via the TypeScript Language Service Plugin
- **In CI** — via the `ksc check` command
- **Alongside TypeScript errors** — same diagnostic format, same error codes, same tooling

## Why "KindScript"?

In type theory, a *kind* is the type of a type. `Type` has kind `*`. `Array` has kind `* → *`. KindScript extends this idea: a kind is a type with additional properties. Where TypeScript's types describe the *shape* of values, KindScript's kinds describe the *behavior and relationships* of values.

The name also reflects the design philosophy: KindScript is TypeScript. It uses TypeScript's type system, TypeScript's compiler, TypeScript's tooling. It adds a layer of architectural verification without introducing a new language, new syntax, or new build step.

## Status

KindScript is a greenfield rewrite of an [earlier prototype](https://github.com/user/kindscript). The rewrite aligns the compiler's internal architecture directly with TypeScript's own compiler phases — scanner, parser, binder, checker — using the same names, same patterns, and same data flow model.
