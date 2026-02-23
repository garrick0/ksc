# The KindScript Binder

> The first KindScript-specific phase. Walk TypeScript's symbols, find Kinds, build the KindSymbolTable.

---

## Overview

After TypeScript has scanned, parsed, and bound the source files, KindScript's binder runs. Its job is to identify which TypeScript symbols represent Kind types or values annotated with Kind types, extract their `PropertySpec`, and build a side-channel symbol table that the checker will use.

The binder bridges TypeScript's world (AST nodes, symbols, types) with KindScript's world (kinds, properties, architectural constraints). It reads from TypeScript's data structures and writes to KindScript's own.

```
TypeScript output                    KindScript binder output
─────────────────                    ────────────────────────
ts.SourceFile[]                      KindSymbolTable
ts.Symbol tables          ──────►      WeakMap<ts.Symbol, KindSymbol>
ts.TypeChecker                         ├── Kind definitions
                                       └── Kind-annotated values
```

---

## The Kind Token: `__ks`

Every type produced by `Kind<Base, Props>` resolves structurally to `Base & { readonly __ks?: true }`. The `__ks` field is a phantom optional property — it has no runtime footprint but exists in the structural type.

This is the detection mechanism. Rather than string-matching on type names (fragile), we use TypeScript's own type checker to ask: "does this type have a property called `__ks`?" This is a structural check that works regardless of how the type was aliased, imported, or re-exported.

```ts
function isKindType(type: ts.Type, checker: ts.TypeChecker): boolean {
  return type.getProperty('__ks') !== undefined;
}
```

---

## Data Structures

### KindSymbol

Each Kind-related symbol gets a `KindSymbol` entry in the table:

```ts
interface KindSymbol {
  // ── Identity ──
  tsSymbol: ts.Symbol;            // Back-reference to the TypeScript symbol
  name: string;                   // The type alias or variable name

  // ── Kind metadata ──
  role: 'definition' | 'value';   // Is this a Kind type or a kind-annotated value?
  declaredProperties: PropertySpec; // The properties this Kind declares
  baseType: ts.Type;              // The Base in Kind<Base, Props>

  // ── For composite kinds ──
  members?: Map<string, KindSymbol>; // Child members (if base type is an object)

  // ── For values (role === 'value') ──
  kindDefinition?: KindSymbol;    // Link to the Kind definition this value is annotated with
  path?: string;                  // Filesystem path from ks.file() or ks.dir()
  valueKind: 'function' | 'file' | 'directory' | 'composite';
}
```

### KindSymbolTable

```ts
type KindSymbolTable = WeakMap<ts.Symbol, KindSymbol>;
```

A `WeakMap` keyed on `ts.Symbol` objects. This mirrors TypeScript's `symbolLinks[]` side-table pattern — it extends symbols with additional metadata without mutating TypeScript's own data structures.

Why WeakMap over an array side-table:
- Simpler — no need to manage numeric IDs
- Automatic garbage collection when symbols are no longer referenced
- Good enough performance for architectural checking (we're checking hundreds of symbols, not millions)
- We can switch to an array side-table later if profiling shows WeakMap is a bottleneck

---

## Binder Algorithm

The binder runs in four steps:

### Step 1: Walk type alias declarations

For each source file, iterate over top-level statements. For each `TypeAliasDeclaration`, use the TypeChecker to resolve the alias to its full type and check if it contains the `__ks` marker.

```ts
function findKindDefinitions(
  program: ts.Program,
  checker: ts.TypeChecker,
): Map<ts.Symbol, { baseType: ts.Type; properties: PropertySpec }> {
  const kindDefs = new Map();

  for (const sourceFile of program.getSourceFiles()) {
    for (const stmt of sourceFile.statements) {
      if (!ts.isTypeAliasDeclaration(stmt)) continue;

      const symbol = checker.getSymbolAtLocation(stmt.name);
      if (!symbol) continue;

      const type = checker.getDeclaredTypeOfSymbol(symbol);
      if (!isKindType(type, checker)) continue;

      // This is a Kind definition — extract its properties
      const { baseType, properties } = extractKindTypeArguments(stmt, checker);
      kindDefs.set(symbol, { baseType, properties });
    }
  }

  return kindDefs;
}
```

### Step 2: Extract PropertySpec from type arguments

Once we've identified a type alias as a Kind, we extract the `PropertySpec` from the second type argument. There are two approaches, and we use both:

**TypeChecker resolution** — for following type alias chains:

```ts
// If PureDomain = Kind<KSDir, { pure: true }>, and someone writes
// type MyDomain = PureDomain, we need to follow the chain to find Kind<...>
const type = checker.getDeclaredTypeOfSymbol(symbol);
// checker resolves aliases automatically
```

**AST node walking** — for extracting literal values:

```ts
function extractKindTypeArguments(
  decl: ts.TypeAliasDeclaration,
  checker: ts.TypeChecker,
): { baseType: ts.Type; properties: PropertySpec } {
  const typeNode = decl.type;

  // Find the TypeReferenceNode that points to Kind
  const kindRef = findKindReference(typeNode, checker);
  if (!kindRef || !kindRef.typeArguments) {
    return { baseType: checker.getTypeAtLocation(typeNode), properties: {} };
  }

  // typeArguments[0] = Base type
  const baseType = checker.getTypeAtLocation(kindRef.typeArguments[0]);

  // typeArguments[1] = PropertySpec (object literal)
  const properties = kindRef.typeArguments[1]
    ? extractPropertySpecFromNode(kindRef.typeArguments[1], checker)
    : {};

  return { baseType, properties };
}
```

Extracting the PropertySpec from the type literal node:

```ts
function extractPropertySpecFromNode(
  node: ts.TypeNode,
  checker: ts.TypeChecker,
): PropertySpec {
  const type = checker.getTypeAtLocation(node);
  const spec: PropertySpec = {};

  for (const prop of type.getProperties()) {
    const name = prop.getName();
    const propType = checker.getTypeOfSymbol(prop);

    switch (name) {
      // Boolean properties
      case 'pure':
      case 'noIO':
      case 'noImports':
      case 'noMutation':
      case 'noConsole':
      case 'immutable':
      case 'static':
      case 'noSideEffects':
      case 'exhaustive':
      case 'noSiblingDependency':
        spec[name] = true;
        break;

      // Numeric properties
      case 'maxFanOut':
        if (propType.isNumberLiteral()) {
          spec.maxFanOut = propType.value;
        }
        break;

      // String literal properties
      case 'scope':
        if (propType.isStringLiteral()) {
          spec.scope = propType.value as 'folder' | 'file';
        }
        break;

      // Tuple array properties — noDependency, noCycles, etc.
      case 'noDependency':
      case 'noTransitiveDependency':
        spec[name] = extractStringTuplePairs(propType, checker);
        break;

      case 'noCycles':
        spec.noCycles = extractStringArray(propType, checker);
        break;
    }
  }

  return spec;
}
```

### Step 3: Walk value declarations for kind-annotated variables

Beyond Kind type definitions, we need to find values annotated with Kind types — the actual things to check.

```ts
function findKindAnnotatedValues(
  program: ts.Program,
  checker: ts.TypeChecker,
  kindDefs: Map<ts.Symbol, ...>,
): Map<ts.Symbol, KindValueInfo> {
  const values = new Map();

  for (const sourceFile of program.getSourceFiles()) {
    for (const stmt of sourceFile.statements) {
      if (!ts.isVariableStatement(stmt)) continue;

      for (const decl of stmt.declarationList.declarations) {
        if (!decl.type) continue; // No type annotation

        // Resolve the type annotation
        const annotationType = checker.getTypeAtLocation(decl.type);
        if (!isKindType(annotationType, checker)) continue;

        // This value is annotated with a Kind type
        const symbol = checker.getSymbolAtLocation(decl.name);
        if (!symbol) continue;

        // Determine value kind and extract path
        const valueInfo = analyzeValueExpression(decl, checker);
        values.set(symbol, valueInfo);
      }
    }
  }

  return values;
}
```

Analyzing the value expression to determine its kind and path:

```ts
function analyzeValueExpression(
  decl: ts.VariableDeclaration,
  checker: ts.TypeChecker,
): KindValueInfo {
  const init = decl.initializer;

  // ks.file('./path') or ks.dir('./path')
  if (init && ts.isCallExpression(init)) {
    const expr = init.expression;
    if (ts.isPropertyAccessExpression(expr)) {
      const obj = expr.expression;
      const method = expr.name.text;

      if (ts.isIdentifier(obj) && obj.text === 'ks') {
        const pathArg = init.arguments[0];
        const path = ts.isStringLiteral(pathArg) ? pathArg.text : undefined;

        if (method === 'file') return { valueKind: 'file', path };
        if (method === 'dir')  return { valueKind: 'directory', path };
      }
    }
  }

  // Object literal — composite kind
  if (init && ts.isObjectLiteralExpression(init)) {
    return { valueKind: 'composite' };
  }

  // Function expression or arrow function
  if (init && (ts.isFunctionExpression(init) || ts.isArrowFunction(init))) {
    return { valueKind: 'function' };
  }

  // Identifier referencing a function
  return { valueKind: 'function' };
}
```

### Step 4: Build the KindSymbolTable

Assemble the final table from the two maps:

```ts
function ksBind(tsProgram: ts.Program): KindSymbolTable {
  const checker = tsProgram.getTypeChecker();
  const table: KindSymbolTable = new WeakMap();

  // Step 1 & 2: Find Kind definitions and extract PropertySpecs
  const kindDefs = findKindDefinitions(tsProgram, checker);

  for (const [symbol, { baseType, properties }] of kindDefs) {
    const members = extractMembers(baseType, checker, kindDefs);

    table.set(symbol, {
      tsSymbol: symbol,
      name: symbol.getName(),
      role: 'definition',
      declaredProperties: properties,
      baseType,
      members,
      valueKind: 'composite', // definitions don't have a value kind per se
    });
  }

  // Step 3: Find kind-annotated values
  const values = findKindAnnotatedValues(tsProgram, checker, kindDefs);

  for (const [symbol, valueInfo] of values) {
    // Resolve the Kind definition this value is annotated with
    const annotationType = checker.getTypeOfSymbol(symbol);
    const kindDefSymbol = findKindDefinitionForType(annotationType, kindDefs);

    table.set(symbol, {
      tsSymbol: symbol,
      name: symbol.getName(),
      role: 'value',
      declaredProperties: kindDefSymbol
        ? kindDefs.get(kindDefSymbol)!.properties
        : {},
      baseType: annotationType,
      kindDefinition: kindDefSymbol ? table.get(kindDefSymbol) : undefined,
      path: valueInfo.path,
      valueKind: valueInfo.valueKind,
    });
  }

  return table;
}
```

---

## Handling Composite Kinds

When the base type of a Kind is an object type, its properties are members:

```ts
type CleanArch = Kind<{
  domain: DomainLayer;       // ← member
  infrastructure: InfraLayer; // ← member
  application: AppLayer;      // ← member
}, { ... }>;
```

The binder recursively resolves each member:

```ts
function extractMembers(
  baseType: ts.Type,
  checker: ts.TypeChecker,
  kindDefs: Map<ts.Symbol, ...>,
): Map<string, KindSymbol> | undefined {
  if (!(baseType.flags & ts.TypeFlags.Object)) return undefined;

  const members = new Map<string, KindSymbol>();

  for (const prop of baseType.getProperties()) {
    const propType = checker.getTypeOfSymbol(prop);
    if (!isKindType(propType, checker)) continue;

    // This member's type is itself a Kind — find its definition
    const memberDef = findKindDefinitionForType(propType, kindDefs);
    if (memberDef) {
      members.set(prop.getName(), /* KindSymbol for this member */);
    }
  }

  return members.size > 0 ? members : undefined;
}
```

---

## Handling Inline Kinds

Users can write inline kinds without a separate type alias:

```ts
const handler: Kind<(req: Request) => Response, { noIO: true }> =
  (req) => new Response(req.url);
```

Here there's no `TypeAliasDeclaration` — the Kind is used directly as a type annotation on a variable declaration. The binder handles this in Step 3: when walking variable declarations, it resolves the type annotation, detects the `__ks` marker, and extracts the PropertySpec directly from the `TypeReferenceNode`'s type arguments.

---

## What the Binder Produces

For a typical `context.ts` file:

```ts
type DomainLayer = Kind<KSDir, { pure: true, noIO: true }>;
type InfraLayer  = Kind<KSDir>;
type CleanArch   = Kind<{
  domain: DomainLayer;
  infrastructure: InfraLayer;
}, {
  noDependency: [["domain", "infrastructure"]],
}>;

const app: CleanArch = {
  domain: ks.dir('./src/domain'),
  infrastructure: ks.dir('./src/infrastructure'),
};
```

The KindSymbolTable will contain:

| Symbol | Role | Properties | Members | Path |
|---|---|---|---|---|
| `DomainLayer` | definition | `{ pure: true, noIO: true }` | — | — |
| `InfraLayer` | definition | `{}` | — | — |
| `CleanArch` | definition | `{ noDependency: [["domain","infrastructure"]] }` | `domain`, `infrastructure` | — |
| `app` | value | (from `CleanArch`) | `domain`, `infrastructure` | — |
| `app.domain` | value | `{ pure: true, noIO: true }` | — | `./src/domain` |
| `app.infrastructure` | value | `{}` | — | `./src/infrastructure` |

---

## How This Compares to TypeScript's Binder

| TypeScript Binder | KindScript Binder |
|---|---|
| Walks the AST once per source file | Walks type aliases and variable declarations per source file |
| Creates `ts.Symbol` for each declaration | Creates `KindSymbol` for each Kind-related symbol |
| Populates `SymbolTable` on scope nodes | Populates `KindSymbolTable` (WeakMap) |
| Builds control flow graph | Not needed (no narrowing) |
| Handles declaration merging | Not needed (Kinds don't merge) |
| Runs before the checker | Runs before the KS checker |
| Output is consumed by the checker | Output is consumed by the KS checker |

Key difference: TypeScript's binder creates symbols for *everything*. KindScript's binder only creates entries for Kind-related symbols — a much smaller subset.

---

## Open Questions

### Do we need both definitions and values in the table?

**Yes.** Kind definitions tell the checker *what properties to verify*. Kind-annotated values tell the checker *what code to verify them against*. Without value entries, we wouldn't know which function bodies or directory trees to walk. Without definition entries, we wouldn't know what PropertySpec to check against.

TypeScript's binder similarly creates symbols for both type declarations and value declarations — the checker needs both to do its work.

### Can PropertySpec extraction fail?

Yes. If a type alias references `Kind` but the type arguments are malformed (e.g., a non-literal type in a boolean property position), the binder should emit a diagnostic and skip the symbol. For the initial implementation, we can be strict: only recognize literal values in PropertySpec positions.

### How do we handle re-exports and imports?

If `context.ts` imports a Kind definition from another file, the TypeScript TypeChecker follows the import chain automatically. `checker.getSymbolAtLocation()` resolves through imports to the original declaration. We don't need to handle this ourselves.
