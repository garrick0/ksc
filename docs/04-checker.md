# The KindScript Checker

> Infer properties from ASTs. Compare against declarations. Emit diagnostics.

---

## Overview

The checker is the core of KindScript's verification. It mirrors TypeScript's checker in structure: a set of functions that walk AST nodes, compute properties, and check assignability. The key difference: instead of computing *types*, we compute *property specs*.

For each target in the KindSymbol array, the checker:

1. **Resolves the value** — determines what AST to walk (function body, source file, directory tree)
2. **Computes properties** — walks the AST to infer which properties the value actually satisfies
3. **Checks assignability** — compares computed properties against the declared PropertySpec
4. **Emits diagnostics** — reports violations with source positions

```
value : Kind = expression
  │      │       │
  │      │       └─ getKindOfExpression(expression)
  │      │            → walks AST → computed: { pure: true, noIO: false, ... }
  │      │
  │      └─ getKindFromKindNode(annotation)
  │            → declared: { pure: true, noIO: true }
  │
  └─ checkKindAssignedTo(computed, declared)
       → pure:  true  satisfies true  → OK
       → noIO:  false satisfies true  → DIAGNOSTIC
```

---

## The Three Core Functions

### `getKindFromKindNode`

Extracts the declared `PropertySpec` from a type annotation that references a Kind. Analogous to TypeScript's `getTypeFromTypeNode`.

```ts
function getDeclaredProperties(sym: KindSymbol): PropertySpec {
  // Each KindSymbol carries its declared properties directly from the config
  return sym.declaredProperties;
}
```

For inline kinds (where `Kind<...>` is used directly as the type annotation rather than via a type alias), this function extracts the PropertySpec directly from the `TypeReferenceNode`'s type arguments, using the same extraction logic as the binder.

### `getKindOfExpression`

Computes the actual properties of a value by walking its AST. Analogous to TypeScript's `getTypeOfExpression`. This is the "kind inference" engine.

```ts
function getKindOfExpression(
  value: KindSymbol,
  program: ts.Program,
  checker: ts.TypeChecker,
): ComputedPropertySpec {
  switch (value.valueKind) {
    case 'function':
      return inferPropertiesFromFunction(value, checker);
    case 'file':
      return inferPropertiesFromFile(value.path!, program);
    case 'directory':
      return inferPropertiesFromDirectory(value.path!, program);
    case 'composite':
      return inferPropertiesFromComposite(value, program, checker);
  }
}
```

The `ComputedPropertySpec` has the same shape as `PropertySpec` but with computed boolean values and optional violation details:

```ts
interface ComputedPropertySpec {
  pure: boolean;
  noIO: boolean;
  noImports: boolean;
  noMutation: boolean;
  noConsole: boolean;
  immutable: boolean;
  static: boolean;
  noSideEffects: boolean;
  fanOut: number;

  // Violation details for diagnostics
  violations: PropertyViolation[];
}

interface PropertyViolation {
  property: string;           // e.g., "noImports"
  node: ts.Node;              // The AST node causing the violation
  message: string;            // Human-readable explanation
}
```

### `checkKindAssignedTo`

Compares computed properties against declared properties and emits diagnostics. Analogous to TypeScript's `checkTypeAssignableTo`.

```ts
function checkKindAssignedTo(
  computed: ComputedPropertySpec,
  declared: PropertySpec,
  errorNode: ts.Node,
  sourceFile: ts.SourceFile,
): KSDiagnostic[] {
  const diagnostics: KSDiagnostic[] = [];

  // Check each declared property
  if (declared.pure && !computed.pure) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      "Value is not pure", computed.violations));
  }
  if (declared.noIO && !computed.noIO) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      "Value performs IO", computed.violations));
  }
  if (declared.noImports && !computed.noImports) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      "Value has import declarations", computed.violations));
  }
  if (declared.noMutation && !computed.noMutation) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      "Value contains mutations", computed.violations));
  }
  if (declared.noConsole && !computed.noConsole) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      "Value uses console", computed.violations));
  }
  if (declared.immutable && !computed.immutable) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      "Value has mutable bindings at module scope", computed.violations));
  }
  if (declared.static && !computed.static) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      "Value uses dynamic imports", computed.violations));
  }
  if (declared.noSideEffects && !computed.noSideEffects) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      "Value has top-level side effects", computed.violations));
  }
  if (declared.maxFanOut !== undefined && computed.fanOut > declared.maxFanOut) {
    diagnostics.push(createDiagnostic(errorNode, sourceFile,
      `Value has ${computed.fanOut} dependencies, max is ${declared.maxFanOut}`,
      computed.violations));
  }

  return diagnostics;
}
```

---

## What Gets Walked Per Value Type

| Value Type | AST the Checker Walks | How It Gets the AST |
|---|---|---|
| Function | Function body (`Block`) | From the declaration's initializer node |
| Class | All method bodies | From the class declaration node |
| File target | Full `ts.SourceFile` | Matched by suffix against `program.getSourceFiles()` |
| Directory target | All files in the directory tree | Matched by path prefix against `program.getSourceFiles()` |
| Composite | Each member recursively + import graph | Resolve members from the object literal, then recurse |

### The Directory AST

For directories, KindScript constructs a virtual tree from the filesystem. Checking a directory property means checking every file in it:

```
DirNode('./src/domain')
├── FileNode('./src/domain/handler.ts')     → ts.SourceFile AST
├── FileNode('./src/domain/service.ts')     → ts.SourceFile AST
└── DirNode('./src/domain/models')
      ├── FileNode('./src/domain/models/user.ts')
      └── FileNode('./src/domain/models/order.ts')
```

A property like `noIO` holds for a directory only if it holds for every file in the tree.

---

## Property Inference — Intrinsic Properties

Each intrinsic property is inferred by walking the AST and looking for specific patterns.

### `noImports`

The simplest check. Walk top-level statements and look for import declarations.

```ts
function checkNoImports(sourceFile: ts.SourceFile): boolean {
  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) return false;
    if (ts.isImportEqualsDeclaration(stmt)) return false;
  }
  // Also check for dynamic import() expressions
  let hasDynamicImport = false;
  ts.forEachChild(sourceFile, function visit(node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      hasDynamicImport = true;
    }
    if (!hasDynamicImport) ts.forEachChild(node, visit);
  });
  return !hasDynamicImport;
}
```

### `noConsole`

Walk the entire AST looking for `console.*` property access expressions.

```ts
function checkNoConsole(node: ts.Node): boolean {
  let hasConsole = false;

  function visit(n: ts.Node) {
    if (hasConsole) return;
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
      const expr = ts.isPropertyAccessExpression(n) ? n.expression : n.expression;
      if (ts.isIdentifier(expr) && expr.text === 'console') {
        hasConsole = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return !hasConsole;
}
```

### `immutable`

Check for `let` or `var` declarations at module scope.

```ts
function checkImmutable(sourceFile: ts.SourceFile): boolean {
  for (const stmt of sourceFile.statements) {
    if (ts.isVariableStatement(stmt)) {
      const flags = stmt.declarationList.flags;
      if (!(flags & ts.NodeFlags.Const)) {
        return false; // let or var at module scope
      }
    }
  }
  return true;
}
```

### `static`

Check for dynamic `import()` expressions and `import.meta` references.

```ts
function checkStatic(node: ts.Node): boolean {
  let hasDynamic = false;

  function visit(n: ts.Node) {
    if (hasDynamic) return;
    // Dynamic import()
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
      hasDynamic = true;
      return;
    }
    // import.meta
    if (ts.isMetaProperty(n) && n.keywordToken === ts.SyntaxKind.ImportKeyword) {
      hasDynamic = true;
      return;
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return !hasDynamic;
}
```

### `noSideEffects`

Check for top-level expressions that have side effects: function calls, assignments outside of declarations, and non-declaration statements.

```ts
function checkNoSideEffects(sourceFile: ts.SourceFile): boolean {
  for (const stmt of sourceFile.statements) {
    // Allow: import, export, type alias, interface, const/let/var declarations, function/class declarations
    if (ts.isImportDeclaration(stmt)) continue;
    if (ts.isExportDeclaration(stmt)) continue;
    if (ts.isTypeAliasDeclaration(stmt)) continue;
    if (ts.isInterfaceDeclaration(stmt)) continue;
    if (ts.isVariableStatement(stmt)) continue; // initializers are not side effects
    if (ts.isFunctionDeclaration(stmt)) continue;
    if (ts.isClassDeclaration(stmt)) continue;
    if (ts.isEnumDeclaration(stmt)) continue;
    if (ts.isModuleDeclaration(stmt)) continue;

    // Anything else is a side effect (expression statements, for loops, etc.)
    return false;
  }
  return true;
}
```

### `noMutation`

Walk the AST looking for reassignment (`=`, `+=`, etc.) and property mutation.

```ts
function checkNoMutation(node: ts.Node): boolean {
  let hasMutation = false;

  function visit(n: ts.Node) {
    if (hasMutation) return;
    // Assignment expressions (excluding declarations)
    if (ts.isBinaryExpression(n) && isAssignmentOperator(n.operatorToken.kind)) {
      hasMutation = true;
      return;
    }
    // Prefix/postfix increment/decrement
    if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) {
      if (n.operator === ts.SyntaxKind.PlusPlusToken ||
          n.operator === ts.SyntaxKind.MinusMinusToken) {
        hasMutation = true;
        return;
      }
    }
    // delete expressions
    if (ts.isDeleteExpression(n)) {
      hasMutation = true;
      return;
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return !hasMutation;
}
```

### `noIO` and `pure`

These are the most complex checks because they require identifying specific API calls (filesystem, network, process) and potentially following call chains transitively. These should be implemented in later phases.

```ts
// Simplified noIO — check for known IO identifiers in call expressions
function checkNoIO(node: ts.Node, checker: ts.TypeChecker): boolean {
  const ioModules = new Set([
    'fs', 'fs/promises', 'path', 'net', 'http', 'https',
    'child_process', 'cluster', 'dgram', 'dns', 'tls',
  ]);

  let hasIO = false;

  function visit(n: ts.Node) {
    if (hasIO) return;
    // Check import declarations for IO modules
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      if (ioModules.has(n.moduleSpecifier.text)) {
        hasIO = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return !hasIO;
}
```

Full `pure` checking (transitive purity analysis) is a Phase 4 implementation goal and will require call graph construction and memoized traversal.

---

## Property Inference — Relational Properties

Relational properties operate on the import graph between members of a composite kind. They require a different kind of analysis: instead of walking individual ASTs, we build a dependency graph and analyze its edges.

### Building the Import Graph

For composite kinds, the checker builds a member-level dependency graph:

```ts
interface MemberDependencyGraph {
  members: Map<string, Set<string>>; // member name → set of file paths
  edges: Array<{ from: string; to: string; importPath: string; sourceFile: string }>;
}

function buildMemberDependencyGraph(
  composite: KindSymbol,
  program: ts.Program,
  checker: ts.TypeChecker,
): MemberDependencyGraph {
  // 1. Resolve each member to its set of file paths
  const members = new Map<string, Set<string>>();
  for (const [name, member] of composite.members!) {
    members.set(name, resolveFilesForMember(member, program));
  }

  // 2. For each file in each member, resolve its imports
  const edges: MemberDependencyGraph['edges'] = [];
  for (const [fromMember, files] of members) {
    for (const filePath of files) {
      const sf = program.getSourceFile(filePath);
      if (!sf) continue;

      for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt)) continue;
        if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;

        const resolved = resolveModuleSpecifier(
          stmt.moduleSpecifier.text, filePath, program
        );
        if (!resolved) continue;

        // Which member does this import target?
        for (const [toMember, toFiles] of members) {
          if (toMember === fromMember) continue;
          if (toFiles.has(resolved)) {
            edges.push({
              from: fromMember,
              to: toMember,
              importPath: resolved,
              sourceFile: filePath,
            });
          }
        }
      }
    }
  }

  return { members, edges };
}
```

### `noDependency`

Check that no edges exist between forbidden member pairs.

```ts
function checkNoDependency(
  graph: MemberDependencyGraph,
  forbidden: Array<[string, string]>,
): KSDiagnostic[] {
  const diagnostics: KSDiagnostic[] = [];

  for (const [from, to] of forbidden) {
    const violations = graph.edges.filter(e => e.from === from && e.to === to);
    for (const v of violations) {
      diagnostics.push(createDiagnostic(
        `Forbidden dependency: ${from} → ${to} (${v.sourceFile} → ${v.importPath})`
      ));
    }
  }

  return diagnostics;
}
```

### `noCycles`

Detect cycles among the listed members using Tarjan's algorithm or DFS.

```ts
function checkNoCycles(
  graph: MemberDependencyGraph,
  members: string[],
): KSDiagnostic[] {
  // Build adjacency list for listed members only
  const adj = new Map<string, Set<string>>();
  for (const m of members) adj.set(m, new Set());

  for (const edge of graph.edges) {
    if (members.includes(edge.from) && members.includes(edge.to)) {
      adj.get(edge.from)!.add(edge.to);
    }
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const next of adj.get(node) ?? []) {
      dfs(next, [...path]);
    }

    inStack.delete(node);
  }

  for (const m of members) dfs(m, []);

  return cycles.map(cycle =>
    createDiagnostic(`Circular dependency: ${cycle.join(' → ')} → ${cycle[0]}`)
  );
}
```

### `noTransitiveDependency`

Similar to `noDependency` but checks reachability rather than direct edges. Uses BFS/DFS from the source member to check if the target member is reachable.

### `noSiblingDependency`

Checks that no member imports from any other member at all. Equivalent to `noDependency` for all member pairs.

---

## Structural Properties

### `exhaustive`

Every file in the scope must be assigned to a member. The checker resolves all files in the composite's scope and checks coverage:

```ts
function checkExhaustive(
  composite: KindSymbol,
  graph: MemberDependencyGraph,
  scopePath: string,
): KSDiagnostic[] {
  const allFiles = getAllFilesInDirectory(scopePath);
  const assignedFiles = new Set<string>();

  for (const files of graph.members.values()) {
    for (const f of files) assignedFiles.add(f);
  }

  const unassigned = allFiles.filter(f => !assignedFiles.has(f));

  if (unassigned.length > 0) {
    return [createDiagnostic(
      `Files not assigned to any member: ${unassigned.join(', ')}`
    )];
  }

  return [];
}
```

### `scope`

Validates that the value's granularity matches the declared scope (`'folder'` or `'file'`).

---

## The Checker Entry Point

```ts
interface KSChecker {
  checkSourceFile(sourceFile: ts.SourceFile): KSDiagnostic[];
  checkProgram(): KSDiagnostic[];
}

function createKSChecker(
  tsProgram: ts.Program,
  targets: KindSymbol[],
): KSChecker {
  let memoizedDiags: KSDiagnostic[] | undefined;

  function checkProgram(): KSDiagnostic[] {
    if (memoizedDiags) return memoizedDiags;
    const diagnostics: KSDiagnostic[] = [];

    // For each target, resolve matching source files and check rules
    for (const target of targets) {
      const matchedFiles = resolveTargetFiles(target, tsProgram);

      for (const sf of matchedFiles) {
        // Run each declared rule's check function against the source file
        for (const [prop, value] of Object.entries(target.declaredProperties)) {
          if (!value) continue;
          const checkFn = propertyCheckRegistry.get(prop);
          if (checkFn) {
            diagnostics.push(...checkFn(sf, prop, value));
          }
        }
      }

      // For composites, also check relational properties
      if (target.valueKind === 'composite' && target.members) {
        const graph = buildMemberDependencyGraph(target, tsProgram);
        diagnostics.push(...checkRelationalProperties(target.declaredProperties, graph));
      }
    }

    memoizedDiags = diagnostics;
    return diagnostics;
  }

  return {
    checkSourceFile: (sf) => checkProgram().filter(d => d.file.fileName === sf.fileName),
    checkProgram,
  };
}
```

---

## Diagnostics

KindScript diagnostics follow the same format as TypeScript diagnostics:

```ts
interface KSDiagnostic {
  file: ts.SourceFile;
  start: number;              // Character offset in the source file
  length: number;             // Length of the highlighted span
  messageText: string;
  category: ts.DiagnosticCategory; // Error, Warning, Suggestion
  code: number;               // KS error codes (70001+)
}
```

Error codes:

| Code | Property | Message Pattern |
|---|---|---|
| KS70001 | noDependency | Forbidden dependency: {from} → {to} |
| KS70002 | noTransitiveDependency | Transitive dependency: {from} → ... → {to} |
| KS70003 | pure | Value is not pure: {reason} |
| KS70004 | noCycles | Circular dependency: {cycle} |
| KS70005 | scope | Value scope mismatch: expected {expected}, got {actual} |
| KS70006 | exhaustive | Files not assigned to any member: {files} |
| KS70007 | noIO | Value performs IO: {detail} |
| KS70008 | noImports | Value has import declarations |
| KS70009 | noConsole | Value uses console |
| KS70010 | immutable | Value has mutable bindings at module scope |
| KS70011 | static | Value uses dynamic imports |
| KS70012 | noSideEffects | Value has top-level side effects |
| KS70013 | noMutation | Value contains mutations |
| KS70014 | maxFanOut | Value has {n} dependencies, max is {max} |
| KS70015 | noSiblingDependency | Sibling dependency: {from} → {to} |

---

## Implementation Phases

The checker should be built incrementally. Each phase validates the full pipeline end-to-end while adding complexity to the inference logic.

### Phase 1: `noImports` (trivial)

A single loop over top-level statements. No recursion, no type resolution. Validates the entire end-to-end flow: bind → getKindOfExpression → checkKindAssignedTo → diagnostics.

### Phase 2: Shallow AST walks

`noConsole`, `immutable`, `static`, `noSideEffects` — all follow the same pattern: walk statements, check node kind, return boolean. These add recursive AST walking but no type resolution or cross-file analysis.

### Phase 3: Relational properties

`noDependency`, `noCycles`, `noTransitiveDependency`, `noSiblingDependency` — require building the import graph between composite members. This adds cross-file analysis and module resolution but no deep AST walking.

### Phase 4: Deep transitive analysis

`pure`, `noIO`, `noMutation` in their full form — require transitive call graph analysis. A function is only pure if everything it calls is also pure. This adds call graph construction, memoized traversal, and known-API classification (which Node.js APIs are IO, which are pure).

---

## How This Compares to TypeScript's Checker

| TypeScript Checker | KindScript Checker |
|---|---|
| `getTypeFromTypeNode` | `getKindFromKindNode` |
| `getTypeOfExpression` | `getKindOfExpression` |
| `checkTypeAssignableTo` | `checkKindAssignedTo` |
| Computes `ts.Type` (data shape) | Computes `ComputedPropertySpec` (behavioral properties) |
| Structural subtyping | Property satisfaction (computed ⊇ declared) |
| ~44,000 lines, monolithic closure | Much smaller — properties are independent checks |
| `nodeLinks[]` / `symbolLinks[]` caching | Can cache `ComputedPropertySpec` per symbol |
| Recursive type instantiation | Recursive directory tree walking |
| Control flow narrowing | Not needed |
| Error elaboration chains | Violation chains (which file, which statement, which call) |
