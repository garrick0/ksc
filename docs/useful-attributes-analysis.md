# Useful Attributes for Users — Analysis & Validation Strategies

## Context

KindScript currently computes 8 attributes focused on kind-checking (enforcing `Kind<{...}>`
property constraints). The system has rich node data available — 364 node kinds, 16 symbol
flags per Identifier, `typeString` at check depth, `localCount` on scope containers,
`isExported` on declarations, `resolvesToImport`/`resolvedFileName`/`importModuleSpecifier`
on Identifiers — but the AG system only exploits a fraction of this for the 8 existing attributes.

The fixtures show users enforcing **layered architecture constraints** — pure computation
layers vs infrastructure layers, mutable vs immutable tiers, import-free vs import-heavy
zones. The attributes below extend this architectural enforcement into new dimensions that
users have no way to check today.

Each attribute includes:
- What it computes and why users want it
- AG direction and rough spec shape
- A concrete validation oracle (external source of truth or orthogonal computation method)

---

## 1. `cyclomaticComplexity` — Function Complexity Metric

### What it computes
McCabe cyclomatic complexity for each function body: the number of linearly independent
paths through the code. Starts at 1, increments for each `if`, `else if`, `for`, `while`,
`do`, `case`, `catch`, `&&`, `||`, `??`, and ternary `?:`.

### Why users want it
Users enforcing purity constraints are already saying "this function must be well-behaved."
The natural next question is "and it must be simple." A `maxComplexity` kind property
(e.g., `Kind<{ maxComplexity: 10 }>`) would let users enforce complexity budgets at the
annotation site, with the same violation mechanism used for `noMutation` etc.

Even without a new property, exposing `cyclomaticComplexity` as an attribute enables:
- Dashboard visualization of hotspots
- CI gates on function complexity
- Per-layer complexity budgets (domain layer: max 5, infra layer: max 15)

### AG direction
**Synthesized**, computed on `FunctionDeclaration`, `ArrowFunction`, `FunctionExpression`,
`MethodDeclaration`, `GetAccessor`, `SetAccessor`. Default: 0 for non-function nodes.

The equation walks the function's subtree counting decision points. This is a local
computation — no inherited context needed.

### Validation oracle
**Orthogonal DFS counter**: Walk the raw AST (not the AG tree) and count decision-point
node kinds in the function body. The set of decision kinds is static and well-defined:

```typescript
const DECISION_KINDS = new Set([
  'IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement',
  'WhileStatement', 'DoStatement', 'CaseClause', 'CatchClause',
  'ConditionalExpression', // ternary
]);
// Plus BinaryExpression where operatorToken is '&&', '||', '??'

function oracleComplexity(fnNode: KSNode): number {
  let complexity = 1;
  // DFS over function body, count DECISION_KINDS + short-circuit operators
  return complexity;
}
```

**Cross-validation against ESLint**: The `complexity` ESLint rule computes the same
metric. Run ESLint with `"complexity": ["error", 0]` on the same files — every function
gets reported with its complexity. Compare ESLint values against AG values per function.

**Strength**: Two independent oracles (DFS counter + ESLint). ESLint's implementation is
battle-tested across millions of codebases, making it a very high-confidence reference.

---

## 2. `maxNestingDepth` — Control Flow Nesting Depth

### What it computes
Maximum nesting depth of control-flow constructs within a function body.
Top-level statements in the function = depth 0. Each `if`/`for`/`while`/`try`/`switch`
body increments depth by 1.

### Why users want it
Deeply nested code is a readability and maintenance hazard independent of complexity count.
A function with `if/for/if/for` (depth 4) is harder to reason about than one with four
sequential `if` statements (depth 1), even though both have complexity ~5.

Enables a `Kind<{ maxNesting: 3 }>` property — "this function must not have deeply nested
control flow." Particularly useful in domain layers where code should be flat and
declarative.

### AG direction
**Synthesized**, computed on function-like nodes. The equation does a DFS tracking current
nesting depth, returns the maximum observed.

### Validation oracle
**Orthogonal DFS**: Walk the raw AST, track depth when entering/leaving nesting constructs:

```typescript
const NESTING_KINDS = new Set([
  'IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement',
  'WhileStatement', 'DoStatement', 'TryStatement', 'SwitchStatement',
  'CaseClause', 'DefaultClause',
]);

function oracleMaxNesting(fnBodyNode: KSNode): number {
  let maxDepth = 0;
  function walk(node: KSNode, depth: number) {
    if (NESTING_KINDS.has(node.kind)) depth++;
    maxDepth = Math.max(maxDepth, depth);
    for (const child of getChildren(node)) walk(child, depth);
  }
  walk(fnBodyNode, 0);
  return maxDepth;
}
```

**Strength**: Trivially independent computation. No external tooling needed. Can verify
at every function node in the tree.

---

## 3. `accessesThis` — Function Uses `this` Keyword

### What it computes
Boolean: whether a function body contains any `ThisKeyword` node that is **not** inside a
nested function (i.e., `this` refers to the function's own `this`, not a nested closure's).

### Why users want it
Users enforcing functional programming constraints want to guarantee that functions are
pure data transformers, not methods that depend on object state. Current properties like
`noMutation` don't catch `this.foo` reads — they only catch assignments.

A `noThis` kind property would enforce: "this function must not reference `this` at all."
This is distinct from `noMutation` (which allows `this.foo` reads) and distinct from
`noSideEffects` (which focuses on statement-level effects).

Practical use cases:
- Enforcing stateless utility functions
- Preventing accidental `this` binding bugs in arrow functions
- Ensuring React functional components don't use class patterns

### AG direction
**Synthesized**, computed on function-like nodes. The equation searches the function's
subtree for `ThisKeyword` nodes, stopping at nested function boundaries (since nested
functions have their own `this`).

### Validation oracle
**Orthogonal DFS with boundary tracking**: Walk the raw AST from the function node,
counting `ThisKeyword` nodes, but don't descend into nested `FunctionDeclaration`,
`FunctionExpression`, `MethodDeclaration`, `GetAccessor`, or `SetAccessor` nodes
(Arrow functions don't rebind `this`, so DO descend into those).

```typescript
function oracleAccessesThis(fnBody: KSNode): boolean {
  const THIS_BOUNDARY = new Set([
    'FunctionDeclaration', 'FunctionExpression', 'MethodDeclaration',
    'GetAccessor', 'SetAccessor', 'Constructor',
  ]);
  function walk(node: KSNode): boolean {
    if (node.kind === 'ThisKeyword') return true;
    if (THIS_BOUNDARY.has(node.kind)) return false; // don't descend
    return getChildren(node).some(walk);
  }
  return walk(fnBody);
}
```

**Cross-validation against ESLint**: The `no-invalid-this` and `class-methods-use-this`
rules track `this` usage. With a custom ESLint rule or by analyzing the
`class-methods-use-this` report, you can identify which functions use `this`.

**Strength**: Extremely simple oracle. The `this`-boundary semantics (arrow functions
inherit `this`, regular functions don't) is well-defined in the ES spec, making the
oracle unambiguous.

---

## 4. `throwsException` — Function Contains Throw Statements

### What it computes
Boolean: whether a function body contains any `ThrowStatement` node (including in nested
blocks like `if`/`try`, but NOT inside nested function definitions).

### Why users want it
Exception-safe code is critical in:
- Error boundary design (React error boundaries catch child throws)
- Promise chains (unexpected throws become rejections)
- Pure function enforcement (throwing is a side effect)
- Library APIs that promise "never throws" contracts

A `noThrow` kind property would enforce: "this function must not contain throw statements."
Combines naturally with `noSideEffects` for truly pure functions.

### AG direction
**Synthesized**, computed on function-like nodes. Default `false`.

### Validation oracle
**Orthogonal DFS**: Walk function body, return true if any `ThrowStatement` found (stop
at nested function boundaries).

```typescript
function oracleThrows(fnBody: KSNode): boolean {
  const FN_BOUNDARY = new Set([
    'FunctionDeclaration', 'FunctionExpression', 'ArrowFunction',
    'MethodDeclaration', 'GetAccessor', 'SetAccessor', 'Constructor',
  ]);
  function walk(node: KSNode): boolean {
    if (node.kind === 'ThrowStatement') return true;
    if (FN_BOUNDARY.has(node.kind)) return false;
    return getChildren(node).some(walk);
  }
  return walk(fnBody);
}
```

**Strength**: Dead simple oracle. ThrowStatement is a single node kind — no ambiguity.

---

## 5. `importSources` — Module Dependencies Per File

### What it computes
For each `CompilationUnit` (source file): a `Set<string>` of module specifiers from all
import declarations. E.g., `{'./utils', 'fs', 'lodash'}`.

### Why users want it
Users enforcing layered architectures want to answer:
- "Does this domain-layer file import from `fs`?" (violates noIO)
- "Does this file depend on any third-party packages?"
- "What's the import graph across the project?"

While `noIO` and `noImports` catch violations at the usage site (where the imported name
appears), `importSources` gives a **file-level summary** of all dependencies. This enables:
- Module dependency visualization in the dashboard
- File-level import budgets ("this file may only import from `./internal/*`")
- Layered architecture enforcement at the file level, not just function level

### AG direction
**Synthesized**, computed on `CompilationUnit` nodes. The equation iterates direct children
looking for `ImportDeclaration` nodes and collects their module specifiers.

### Validation oracle
**TS compiler module resolution**: The TS compiler tracks resolved modules per source file.
`ts.Program` exposes `getResolvedModule(sourceFile, moduleSpecifier)` for each import.
The oracle:

1. For each source file in the TS program, iterate its `ts.SourceFile.statements`
2. Filter for `ts.ImportDeclaration` nodes
3. Extract `moduleSpecifier.text` from each
4. Compare this set against the AG-computed `importSources` attribute

```typescript
function oracleImportSources(sourceFile: ts.SourceFile): Set<string> {
  const sources = new Set<string>();
  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      sources.add(stmt.moduleSpecifier.text);
    }
  }
  return sources;
}
```

**Strength**: The TS compiler's own AST is the ground truth for what imports exist. This
oracle is trivially correct — it's reading the same syntax the AG translator converted.
Disagreement means a conversion or equation bug.

---

## 6. `exportedNames` — Public API Surface Per File

### What it computes
For each `CompilationUnit`: a `Set<string>` of exported binding names.
E.g., `{'add', 'multiply', 'MathConfig'}`.

### Why users want it
API surface control:
- "This internal module should export at most 5 symbols"
- "This barrel file must re-export everything from its children"
- Dashboard visualization of module API surfaces
- Detecting accidental exports

### AG direction
**Synthesized**, computed on `CompilationUnit` nodes. The equation iterates children looking
for declaration nodes with `isExported === true`, collecting their names. Already have
`isExported` stamped on all declaration nodes, so this is just aggregation.

### Validation oracle
**`ts.TypeChecker.getExportsOfModule(moduleSymbol)`**: Returns all symbols exported from a
module. The oracle:

```typescript
function oracleExportedNames(checker: ts.TypeChecker, sourceFile: ts.SourceFile): Set<string> {
  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (!symbol) return new Set();
  const exports = checker.getExportsOfModule(symbol);
  return new Set(exports.map(e => e.getName()));
}
```

**Strength**: The TS type checker is the authoritative source for what a module exports,
handling re-exports, `export * from`, `export default`, namespace exports, and all the
edge cases. If the AG value disagrees with the checker, the AG is wrong.

---

## 7. `parameterCount` — Function Parameter Count

### What it computes
Number of parameters on each function-like declaration.

### Why users want it
Enforcing interface simplicity:
- "Functions in this layer must have at most 3 parameters" (encourages options objects)
- Code review automation — flag functions with too many parameters
- Combines with complexity metrics for holistic "simplicity score"

A `maxParams: N` kind property would enforce parameter count limits at annotation sites.

### AG direction
**Synthesized**, computed on function-like nodes. The equation counts children where
`fieldName === 'parameters'` (i.e., the parameters list length).

### Validation oracle
**TS compiler signature API**: `ts.TypeChecker.getSignaturesOfType()` returns call
signatures, each with a `getParameters()` method returning the parameter symbols.

```typescript
function oracleParamCount(checker: ts.TypeChecker, fnNode: ts.FunctionLikeDeclaration): number {
  const sig = checker.getSignatureFromDeclaration(fnNode);
  return sig ? sig.getParameters().length : 0;
}
```

**Alternative oracle**: Simply count `Parameter` child nodes of the function node in the
raw TS AST. This is even simpler and equally authoritative.

**Strength**: Two independent oracles available (type checker signatures + raw AST child
counting). Complete confidence.

---

## 8. `hasAnyType` — Expression Types Containing `any`

### What it computes
Boolean per expression node: whether the TypeScript-inferred type is or contains `any`.
For non-expression nodes: `false`.

(A more detailed variant `anyCount` could count HOW MANY expressions in a subtree have
`any` type.)

### Why users want it
Type safety is the #1 reason people use TypeScript. `any` is the escape hatch that defeats
the type system. Users enforcing safe-code constraints want to know:
- "Are there any `any`-typed expressions in this function?"
- "What percentage of expressions have concrete types vs `any`?"
- A `noAny` kind property enforcing "no `any` in this scope"

This is particularly powerful because `any` can silently leak through generic instantiation,
function return types, and third-party library types — places where manual inspection fails.

### AG direction
**Synthesized** on expression nodes. The equation checks whether the node's `typeString`
(already stamped at check depth) is or contains `'any'`. For subtree aggregation, a
collection attribute `anyCount` could fold over children.

However, `typeString` is a display string — checking for `'any'` substring is fragile
(matches `'ReadonlyArray<any>'`, `'Company'`). A more robust approach stamps a boolean
`isAnyType` during conversion by checking `type.flags & ts.TypeFlags.Any`.

### Validation oracle
**`ts.TypeChecker.getTypeAtLocation()` + `TypeFlags.Any` check**:

```typescript
function oracleHasAny(checker: ts.TypeChecker, node: ts.Node): boolean {
  try {
    const type = checker.getTypeAtLocation(node);
    return (type.flags & ts.TypeFlags.Any) !== 0;
  } catch { return false; }
}
```

Run this on every expression node in the TS program, compare against the AG attribute
at the corresponding KS node.

**Cross-validation**: Run TypeScript with `noImplicitAny: true` and compare
`getSemanticDiagnostics()` — every diagnostic about implicit `any` should correspond to
a node where `hasAnyType` is true. (Not a perfect oracle since `noImplicitAny` only
catches *implicit* any, not explicit `any` annotations, but it provides a partial check.)

**Strength**: The TypeFlags check is the ground truth for what the TS compiler considers
`any`. Any disagreement is definitively a bug.

---

## 9. `isAsyncScope` — Inside an Async Function

### What it computes
Boolean per node: whether this node is inside an `async` function body. Root and
top-level module code are `false` (unless top-level await is in play).

### Why users want it
Enforcing sync/async layering:
- "Domain logic must be synchronous" — no async leaking into pure computation
- "This utility must work in sync contexts" — preventing accidental async dependencies
- Architecture enforcement: sync core, async shell (ports & adapters for async boundaries)

A `syncOnly` kind property would generate violations for any async function bodies in scope.
This catches a category that `noSideEffects` doesn't — `await fetch()` is a side effect,
but `noSideEffects` only checks ExpressionStatements, not await expressions inside returns.

### AG direction
**Inherited**. Root value: `false`. Parent equation on function-like nodes: if the
function has an `async` modifier, children get `true`; otherwise `undefined` (copy-down
from grandparent).

This is interesting because arrow functions inside an async function are NOT themselves
async (unless marked), but they ARE in an async scope. The inherited direction naturally
handles this — `isAsyncScope` copies down through arrows.

### Validation oracle
**Parent chain walk + modifier check**: Walk up from each node to the nearest enclosing
function-like node, check if it has the `Async` modifier flag.

```typescript
function oracleIsAsyncScope(node: ts.Node): boolean {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) {
      const mods = ts.getModifiers(current);
      return mods?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    }
    current = current.parent;
  }
  return false;
}
```

**Strength**: Simple, deterministic oracle. The `async` keyword is syntactic — no type
inference involved. Zero ambiguity.

---

## 10. `closureCaptures` — Variables Captured from Outer Scope

### What it computes
For each function-like node: a `Set<string>` of identifier names that are:
1. Referenced inside the function body
2. Declared OUTSIDE the function (i.e., in an enclosing scope)
3. Not global/built-in names

E.g., for `const outer = 1; const fn = () => outer + 1;`, `fn` captures `{'outer'}`.

### Why users want it
This is the deepest purity check possible without type-level analysis:
- "This function captures mutable state from an outer scope" — a correctness hazard
- "This function closes over 12 variables" — a maintainability hazard
- Enables a `noClosure` or `maxCaptures: N` kind property
- Critical for concurrency safety — closures over mutable state cause race conditions

Extends `noImports` (which blocks imported bindings) to also block **any** outer binding.
The combination `noImports + noCaptures` guarantees the function depends only on its
parameters — true mathematical function behavior.

### AG direction
**Synthesized**, computed on function-like nodes. The equation:
1. Collects all Identifier nodes in the function body (stop at nested function boundaries)
2. For each, check if `isDefinitionSite === false` (it's a reference, not a declaration)
3. Check if the referenced name resolves to a declaration outside this function

The tricky part is determining "declared outside this function." The `resolvesToImport`
flag covers the import case. For local outer bindings, the equation could use an inherited
attribute carrying the set of locally-declared names, or could walk the parent chain.

### Validation oracle
**`ts.TypeChecker.getSymbolAtLocation()` + declaration location check**:

```typescript
function oracleCaptures(checker: ts.TypeChecker, fnNode: ts.FunctionLikeDeclaration): Set<string> {
  const captures = new Set<string>();
  const fnStart = fnNode.getStart();
  const fnEnd = fnNode.getEnd();

  function walk(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const sym = checker.getSymbolAtLocation(node);
      if (sym?.valueDeclaration) {
        const declPos = sym.valueDeclaration.getStart();
        // Declared outside this function?
        if (declPos < fnStart || declPos > fnEnd) {
          // Not a global/built-in
          if (sym.valueDeclaration.getSourceFile().fileName !== 'lib.d.ts') {
            captures.add(node.text);
          }
        }
      }
    }
    // Don't descend into nested function declarations
    if (ts.isFunctionLike(node) && node !== fnNode) return;
    ts.forEachChild(node, walk);
  }
  ts.forEachChild(fnNode.body!, walk);
  return captures;
}
```

**Strength**: The TS type checker's symbol resolution is the ground truth for what each
identifier resolves to. This oracle is authoritative and handles all the hard cases
(shadowing, destructuring, re-exports, namespace imports) that a naive name-matching
approach would get wrong.

---

## 11. `localBindingCount` — Variables Declared in a Function

### What it computes
For each function-like node: the number of local variable/const/let declarations
(parameters + body declarations) in the function.

### Why users want it
Enforcing simplicity:
- "This function declares 27 local variables" — probably needs refactoring
- Combines with `parameterCount` for total binding budget
- Per-layer limits: "domain functions max 5 locals, infra max 15"

### AG direction
**Synthesized**, computed on function-like nodes. The equation counts `VariableDeclaration`
descendants (stopping at nested function boundaries) plus parameter count.

### Validation oracle
**`localCount` stamped field**: The AST already stamps `localCount` on scope container
nodes — this is `node.locals.size` from the TS compiler. The AG attribute should match
this value.

```typescript
function oracleLocalBindingCount(fnNode: KSNode): number {
  // localCount is already stamped by the converter
  return (fnNode as any).localCount;
}
```

**Strength**: The stamped field IS the TS compiler's own count. This is the strongest
possible oracle — it's the TS compiler's internal data already sitting on the node. Any
disagreement between the AG attribute and the stamped field is definitively a bug in the
equation.

**Additional oracle**: `ts.TypeChecker.getSymbolsInScope(fnBody, ts.SymbolFlags.Variable)`
returns all variable symbols visible at a point. Filtering to those declared within the
function gives an independent count.

---

## 12. `typeNarrowingDepth` — How Many Type Guards Apply

### What it computes
At each node: how many type-narrowing conditions are active in the control flow path to
reach this node. E.g., inside `if (x !== null) { if (typeof x === 'string') { HERE } }`,
the narrowing depth is 2.

### Why users want it
Understanding type narrowing is one of the hardest parts of TypeScript. Visualizing "how
many guards are active here" helps developers understand:
- Why a type is what it is at a given point
- Where narrowing is too deep (suggesting a type redesign)
- Dashboard visualization of type narrowing flow

### AG direction
**Inherited**. Increments when entering the "then" branch of a narrowing condition
(type guard, truthiness check, `instanceof`, `in`, discriminant check). Copy-down
otherwise.

### Validation oracle
**`ts.TypeChecker.getTypeAtLocation()` at successive points**: Compare the type at the
function entry vs the type at the current point. Each narrowing step should produce a
strictly narrower type. Count the number of narrowing steps by comparing types at each
enclosing `if`/`switch` boundary.

This oracle is imperfect (TS narrows types in ways that don't always correspond to
syntactic nesting), but it provides a useful cross-check: the AG-computed narrowing depth
should be <= the number of enclosing narrowing constructs, and the type at a deeply
narrowed point should be at least as specific as the type at a less-narrowed point.

**Strength**: Medium. Type narrowing is complex and the TS compiler's internal CFA is not
directly exposed. But the observable effects (type changes at different points) provide
partial validation.

---

## Comparison Matrix

| Attribute | User Value | AG Complexity | Oracle Confidence | Implementation Priority |
|-----------|-----------|---------------|-------------------|------------------------|
| `cyclomaticComplexity` | Very High | Low | Very High (ESLint cross-check) | **1** |
| `importSources` | High | Low | Very High (TS AST) | **2** |
| `accessesThis` | High | Low | Very High (DFS) | **3** |
| `throwsException` | High | Low | Very High (DFS) | **3** |
| `closureCaptures` | Very High | Medium | Very High (TS symbol resolution) | **4** |
| `maxNestingDepth` | High | Low | Very High (DFS) | **5** |
| `isAsyncScope` | High | Low | Very High (modifier check) | **5** |
| `parameterCount` | Medium | Very Low | Very High (TS signatures) | **6** |
| `exportedNames` | Medium | Low | Very High (TS exports API) | **6** |
| `localBindingCount` | Medium | Low | Very High (stamped field) | **7** |
| `hasAnyType` | High | Low (needs new stamp) | Very High (TypeFlags) | **8** |
| `typeNarrowingDepth` | Medium | High | Medium (CFA not exposed) | **9** |

---

## Recommended Implementation Order

### Wave 1 — Quick wins, very high oracle confidence

**`cyclomaticComplexity`**, **`accessesThis`**, **`throwsException`**

These three share key properties:
- Simple synthesized equations that walk function bodies
- Trivially verifiable by DFS oracle (zero ambiguity)
- High user value — enable new kind properties (`maxComplexity`, `noThis`, `noThrow`)
- `cyclomaticComplexity` has ESLint as an additional battle-tested oracle

### Wave 2 — File-level analysis attributes

**`importSources`**, **`exportedNames`**

Both are file-level aggregations that enable architectural enforcement at the module
boundary. Both have authoritative TS compiler oracles. They also enable new projections
(dependency graph, API surface map) valuable for the dashboard.

### Wave 3 — Scope and capture analysis

**`closureCaptures`**, **`localBindingCount`**, **`isAsyncScope`**, **`parameterCount`**

These require more interaction between the equation and node properties but have extremely
strong oracles. `closureCaptures` in particular is the most powerful purity attribute
possible — it catches the exact class of bugs that `noImports` + `noMutation` miss
(closing over mutable outer state).

`localBindingCount` is uniquely valuable because the `localCount` stamped field is already
on the nodes — the AG attribute can be validated against data that's literally already
there, with zero additional TS compiler calls needed.

### Wave 4 — Type-level analysis

**`hasAnyType`**, **`maxNestingDepth`**, **`typeNarrowingDepth`**

`hasAnyType` requires a new boolean stamp during conversion (checking `TypeFlags.Any`),
so it has a wider blast radius. But it enables the single most-requested TypeScript
analysis: "where is `any` hiding in my code?"

---

## How New Attributes Flow Into the Existing System

Each new attribute can be surfaced through the existing infrastructure at three levels:

### 1. As a new Kind property (violation-based)
Add the property to `PropertySet`, add to `PROPERTY_KEYS`, add per-kind violation
equations. Example: `Kind<{ maxComplexity: 10 }>` generates a violation when
`cyclomaticComplexity > 10`.

This requires extending PropertySet to support numeric thresholds (currently only
`true`), but the AG machinery already supports parameterized attributes.

### 2. As a new projection
Add a projection function to `analysisProjections`. Example:
```typescript
complexityReport: (root) => root.children.flatMap(cu =>
  findFunctions(cu).map(fn => ({
    name: fn.node.name,
    complexity: fn.attr('cyclomaticComplexity'),
    file: fn.findFileName(),
  }))
)
```

This adds a new field to the `KSProgramInterface` result without changing the violation
system.

### 3. As dashboard data
The dashboard already visualizes the AST tree. Attributes like `cyclomaticComplexity`,
`closureCaptures`, and `isAsyncScope` can be rendered as node annotations, color-coded
overlays, or aggregate statistics.

---

## Summary

The most impactful attributes share a pattern: they compute something that TypeScript
developers **intuitively know matters** (complexity, purity, exception safety, API surface)
but have no systematic way to enforce today. KindScript's AG system is uniquely positioned
to compute these because:

1. It already has a decorated tree with lazy evaluation and caching
2. The TS AST converter already stamps rich compiler metadata on nodes
3. The kind-checking system already has the violation → diagnostic pipeline
4. The attribute grammar formalism naturally expresses both local checks (synthesized)
   and contextual checks (inherited)

Every recommended attribute has at least one validation oracle with "very high" confidence,
meaning if the attribute disagrees with the oracle at any node, it's definitively a bug.
This addresses the original concern about attribute correctness — each new attribute is
both useful to users AND self-validating.
