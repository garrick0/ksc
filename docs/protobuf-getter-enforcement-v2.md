# Protobuf Getter Enforcement — Config-Only, Attribute-Based Detection

## Implementation Status

**FULLY IMPLEMENTED.** All 4 attributes are live, codegen passes, 409/409 tests pass (19 new protobuf tests).

| Phase | Status | Detail |
|-------|--------|--------|
| 1. Equation module | Done | `equations/protobuf.ts` — toggle, patterns, 7 equation functions (PropertyAccess + ElementAccess) |
| 2. Barrel re-export | Done | `equations/index.ts` — re-exports all protobuf symbols |
| 3. Spec declaration | Done | `spec.ts` — 4 new AttrDecl entries, pivoted per-kind equations |
| 4. Projections merge | Done | `projections.ts` — conditional merge of `allProtobufViolations` |
| 5. Codegen | Done | 12 attributes, 9 dep edges, dispatch.ts regenerated (2317 lines) |
| 6. Test fixtures | Done | `test/fixtures/protobuf-getter/` — person_pb.ts, handler.ts, namespace-handler.ts |
| 7. Integration tests | Done | `test/integration/protobuf-getter.test.ts` — 19 tests covering all 4 phases + toggle + API |
| 8. Config wiring | Done | `KindScriptConfig.protobuf.enabled` → `check-program.ts` → `setProtobufCheckingEnabled()` |
| 9. Full test suite | Done | 409/409 pass (390 original + 19 new) |

### Detection coverage

| Pattern | Detected | Example |
|---------|----------|---------|
| PropertyAccessExpression | Yes | `p.name`, `p.age`, `addr.street` |
| ElementAccessExpression | Yes | `p['name']` |
| Chained access | Yes | `p.getAddress().street` |
| Namespace imports | Yes | `import * as proto from './person_pb'; proto.Person().name` |
| Property write | Yes | `p.name = 'test'` |
| Method calls (OK) | Yes | `p.getName()`, `p.setName()`, `p.toObject()` |
| toObject() escape hatch (OK) | Yes | `p.toObject().name` — not flagged |
| Non-protobuf types (OK) | Yes | `config.timeout` — not flagged |

### Files changed

| File | Change |
|------|--------|
| `src/adapters/analysis/spec/ts-kind-checking/equations/protobuf.ts` | **New**: toggle, patterns, ProtobufBinding, 7 equation fns |
| `src/adapters/analysis/spec/ts-kind-checking/equations/index.ts` | Re-export protobuf symbols |
| `src/adapters/analysis/spec/ts-kind-checking/spec.ts` | 4 new AttrDecl entries, pivot extended (ElementAccessExpression + PropertyAccessExpression) |
| `src/adapters/analysis/spec/ts-kind-checking/projections.ts` | Conditional merge of protobuf violations |
| `src/adapters/analysis/spec/ts-kind-checking/generated/dispatch.ts` | Regenerated (12 attrs, 2317 lines) |
| `src/adapters/analysis/spec/ts-kind-checking/generated/attr-types.ts` | Regenerated |
| `src/adapters/analysis/spec/ts-kind-checking/generated/dep-graph.ts` | Regenerated (9 edges) |
| `src/api.ts` | Added `protobuf?: { enabled?: boolean; modules?: readonly string[] }` to KindScriptConfig |
| `src/application/check-program.ts` | `applyConfig()` helper wires `config.protobuf.enabled` → toggle |
| `test/codegen/codegen-scripts.test.ts` | Updated counts: 8→12 attrs, 6→9 edges |
| `test/fixtures/protobuf-getter/src/person_pb.ts` | **New**: simulated protobuf generated classes (Person, Address, Wrapper<T>) |
| `test/fixtures/protobuf-getter/src/handler.ts` | **New**: violations (direct, element, chained, write) + OK cases (methods, toObject, non-protobuf) |
| `test/fixtures/protobuf-getter/src/namespace-handler.ts` | **New**: namespace import violations |
| `test/integration/protobuf-getter.test.ts` | **New**: 19 integration tests (collect, propagate, check, gather, toggle, config API) |

---

## The Problem (Recap)

google-protobuf / grpc-web store field data in internal arrays. Generated classes expose
`getField()` / `setField()` methods. Direct property access (`msg.name`) silently returns
`undefined`. This is a correctness bug with no runtime error and no TypeScript error in
many configurations.

## Design Constraint

- **No Kind<> annotations required** — detection is automatic across the whole codebase.
- **Global enable/disable** — a single source-level toggle controls whether protobuf
  getter enforcement is active. No per-file scoping. This matches how both JastAdd
  and Silver handle analysis rules: an analysis is either composed in or not.
- **Use AST node information** — the KS AST already has rich data stamped on nodes
  (`typeString`, `symIsMethod`, `symIsProperty`, `resolvedFileName`,
  `importModuleSpecifier`). The system should compute attributes from these signals.

---

## Key AST Signals Available

### On PropertyAccessExpression (`msg.name` or `msg.getName`)

```
PropertyAccessExpression
├── expression: LeftHandSideExpression    ← the object (msg)
│   └── typeString: string               ← TS type of the object (e.g., "Person")
├── name: MemberName (Identifier)        ← the property/method name
│   ├── escapedText: string              ← "name" or "getName"
│   ├── symIsMethod: boolean             ← true if TS resolves this as a method
│   └── symIsProperty: boolean           ← true if TS resolves this as a property
└── typeString: string                   ← type of the whole expression
```

### On Identifier (for import tracking)

```
Identifier (e.g., the 'Person' in 'import { Person } from ./person_pb')
├── escapedText: string                  ← "Person"
├── resolvesToImport: boolean            ← true if this binding comes from an import
├── resolvedFileName: string             ← "/path/to/person_pb.ts"
├── importModuleSpecifier: string        ← "./person_pb"
├── symIsClass: boolean                  ← true if it's a class (protobuf messages are classes)
└── isDefinitionSite: boolean            ← true at the import specifier definition
```

### On ImportDeclaration

```
ImportDeclaration
├── importClause: ImportClause
│   ├── isTypeOnly: boolean              ← true for 'import type {...}'
│   └── namedBindings: NamedImports | NamespaceImport
│       └── elements: ImportSpecifier[]
│           └── name: Identifier         ← the local binding name
├── moduleSpecifier: StringLiteral
│   └── value: string                    ← "./person_pb"
└── resolvedModulePath: string           ← "/abs/path/to/person_pb.ts" (at check depth)
```

### Critical distinction: `symIsMethod` vs `symIsProperty`

For a protobuf message with generated types:
```typescript
// person_pb.d.ts (generated)
export class Person extends jspb.Message {
  getName(): string;
  setName(value: string): void;
  getAge(): number;
  setAge(value: number): void;
  toObject(): Person.AsObject;
  serializeBinary(): Uint8Array;
}
```

When code does `msg.getName()`:
- The PropertyAccessExpression's `name` Identifier (`getName`) has **`symIsMethod: true`**
- The PropertyAccessExpression is the `expression` child of a CallExpression

When code does `msg.name`:
- The `name` Identifier has **`symIsMethod: false`**
- If `name` isn't declared on the class: symbol may not resolve → both flags `false`
- If types are loose (index signatures, `any`): `symIsProperty` may be `false` too
- The PropertyAccessExpression is NOT inside a CallExpression as callee

**`symIsMethod` is the strongest local signal.** If the name resolves to a method, it's
a legitimate accessor — regardless of whether it's called or passed as a reference.

---

## Attribute Design

Four new attributes, following the exact pattern of `kindDefs → defEnv → defLookup`.

This is the canonical **collect-propagate-check** pattern used by both JastAdd and
Silver for violation detection (see "Precedent from Other AG Systems" section below).

### Attribute 1: `protobufTypes` (synthesized, on CompilationUnit)

**What it computes**: The set of type/class names imported from protobuf modules in this
file.

**How it works**: Iterates child nodes of the CompilationUnit looking for
ImportDeclaration nodes. For each import whose `moduleSpecifier` matches the configured
protobuf module patterns (e.g., `*_pb`):

1. Skip type-only imports (`import type { ... }`) — these don't create runtime bindings
2. For named imports (`import { Person, Address } from './person_pb'`):
   collect each ImportSpecifier's `name.escapedText`
3. For namespace imports (`import * as proto from './person_pb'`):
   collect the namespace name AND note it as a namespace (access will be `proto.Person`)
4. For default imports (`import Person from './person_pb'`):
   collect the default name

**Returns**: `Map<string, ProtobufBinding>` where each entry records:
- The local binding name
- Whether it's a namespace import (affects how types are referenced downstream)

**Equation sketch**:
```typescript
const eq_protobufTypes_CompilationUnit = withDeps([],
  function(ctx: KindCtx<KSCompilationUnit>): Map<string, ProtobufBinding> {
    if (!PROTOBUF_CHECKING_ENABLED) return new Map();

    const bindings = new Map<string, ProtobufBinding>();
    for (const childCtx of ctx.children) {
      if (childCtx.node.kind !== 'ImportDeclaration') continue;
      const importDecl = childCtx.node as KSImportDeclaration;

      // Check module specifier against configured patterns
      const moduleSpec = importDecl.moduleSpecifier;
      if (moduleSpec.kind !== 'StringLiteral') continue;
      const modulePath = (moduleSpec as KSStringLiteral).value;
      if (!isProtobufModule(modulePath)) continue;

      // Also skip type-only imports
      const clause = importDecl.importClause;
      if (!clause || (clause as any).isTypeOnly) continue;

      // Extract binding names from the import clause children
      for (const clauseChild of childCtx.children) {
        // ... walk ImportClause → NamedImports → ImportSpecifier
        // ... or ImportClause → NamespaceImport
        // Collect binding names
      }
    }
    return bindings;
  }
);
```

**Why this works**: The module specifier string is available directly on the node. The
configured patterns (e.g., `['*_pb', '*_grpc_web_pb']`) are matched against this string.
No type checker needed for this step — it's pure AST analysis. But at `check` depth,
`resolvedModulePath` provides the absolute path for even stronger matching.

### Attribute 2: `protobufTypeEnv` (inherited)

**What it computes**: The global set of protobuf type names, available at every node in
the tree.

**How it works**: Root equation collects `protobufTypes` from all CompilationUnit children,
merges them into a single set. The inherited direction copies this down unchanged to
every descendant.

**Returns**: `Set<string>` of type names that are known protobuf messages.

**Equation sketch**:
```typescript
const eq_protobufTypeEnv_root = withDeps(['protobufTypes'],
  function(ctx: Ctx): Set<string> {
    const typeNames = new Set<string>();
    for (const cuCtx of ctx.children) {
      const bindings = cuCtx.attr('protobufTypes') as Map<string, ProtobufBinding>;
      for (const [name, binding] of bindings) {
        typeNames.add(name);
        // For namespace imports, we also need to track "proto.Person" patterns
        // The typeString of `new proto.Person()` would be "Person", not "proto.Person"
        // So the type name "Person" is what matters, extracted from the module's exports
      }
    }
    return typeNames;
  }
);
```

**Why inherited**: Every node in the tree needs to check "is the expression I'm looking
at a protobuf type?" The inherited attribute makes this O(1) — just check the set.
This mirrors `defEnv` exactly.

**Important nuance**: `typeString` on an expression like `msg` contains the TYPE name
(e.g., `"Person"`), not the variable name. For named imports, the local binding name
IS the type name. For namespace imports (`import * as proto from './pb'`), the type of
`proto.Person` is `"Person"` (not `"proto.Person"`), so the type name is the class name
inside the module, which we can get from the import specifier or from the `typeString`
of usages.

### Attribute 3: `protobufViolation` (synthesized, on PropertyAccessExpression)

**What it computes**: A diagnostic if this PropertyAccessExpression is a direct field
access on a protobuf message, or `null` if it's legitimate.

**Detection logic**:

```
Given PropertyAccessExpression with expression E and name N:

1. Is E's typeString in the protobufTypeEnv?
   NO  → return null (not a protobuf type, nothing to check)

2. Is N.symIsMethod === true?
   YES → return null (it's a real method like getName — always OK)

3. Is this node the 'expression' child of a CallExpression?
   (i.e., ctx.parentIs('CallExpression', 'expression'))
   YES → return null (it's being called as a method — OK even if symIsMethod
         isn't set, handles loose type scenarios)

4. All checks failed → VIOLATION
   Return diagnostic: "Direct field access '.{N.escapedText}' on protobuf
   message type '{E.typeString}' — use getter method (e.g., .get{Name}()) instead"
```

**Why this three-layer check works**:

| Scenario | Step 1 | Step 2 | Step 3 | Result |
|----------|--------|--------|--------|--------|
| `msg.name` (direct access) | in env ✓ | symIsMethod: false | not in CallExpr | **VIOLATION** |
| `msg.getName()` | in env ✓ | symIsMethod: true | — | OK |
| `msg.getName` (method ref) | in env ✓ | symIsMethod: true | — | OK |
| `msg.toObject()` | in env ✓ | symIsMethod: true | — | OK |
| `config.timeout` | NOT in env | — | — | OK |
| `msg.toObject().name` | toObject() returns non-pb type | — | — | OK |
| `getMsg().name` | return type in env ✓ | false | not in CallExpr | **VIOLATION** |
| `msg['name']` | (see ElementAccessExpression below) | | | |

**Equation sketch**:
```typescript
const eq_protobufViolation_PropertyAccessExpression = withDeps(['protobufTypeEnv'],
  function(ctx: KindCtx<KSPropertyAccessExpression>): Diagnostic | null {
    // Step 1: Is the object a protobuf type?
    const env = ctx.attr('protobufTypeEnv') as Set<string>;
    const exprType = ctx.node.expression.typeString;
    if (!exprType || !env.has(exprType)) return null;

    // Step 2: Is the accessed name a method?
    if (ctx.node.name.kind === 'Identifier') {
      const nameId = ctx.node.name as KSIdentifier;
      if (nameId.symIsMethod) return null;
    }

    // Step 3: Is this being called? (handles loose types where symIsMethod isn't set)
    if (ctx.parentIs('CallExpression', 'expression')) return null;

    // Violation
    const fieldName = ctx.node.name.kind === 'Identifier'
      ? (ctx.node.name as KSIdentifier).escapedText
      : '?';
    return {
      node: ctx.node,
      message: `Direct field access '.${fieldName}' on protobuf type '${exprType}' — use getter method instead`,
      kindName: '',  // No Kind annotation — config-driven
      property: 'protobuf-getter',
      pos: ctx.node.pos,
      end: ctx.node.end,
      fileName: ctx.findFileName(),
    };
  }
);
```

**Extension for ElementAccessExpression** (`msg['name']`):
Same logic but on ElementAccessExpression. Check `expression.typeString` against env,
check not inside CallExpression, flag as violation.

### Attribute 4: `allProtobufViolations` (synthesized, recursive gather)

**What it computes**: All protobuf violations in the subtree. Same pattern as existing
`allViolations`.

```typescript
const eq_allProtobufViolations = withDeps(['protobufViolation'],
  function(ctx: Ctx): Diagnostic[] {
    const result: Diagnostic[] = [];
    const v = ctx.attr('protobufViolation') as Diagnostic | null;
    if (v) result.push(v);
    for (const child of ctx.children) {
      const childViolations = child.attr('allProtobufViolations') as Diagnostic[];
      if (childViolations.length > 0) result.push(...childViolations);
    }
    return result;
  }
);
```

---

## Config Design

### Global enable/disable toggle

Protobuf getter enforcement is controlled by a single source-level boolean and a
list of module patterns. Both live in the equation module as module-level variables,
following the existing `resetCounter()` pattern:

```typescript
// In equations/protobuf.ts (actual implementation)

// ---- Global toggle ----
export let PROTOBUF_CHECKING_ENABLED = false;

/** Set the protobuf checking toggle (ES module exports are read-only). */
export function setProtobufCheckingEnabled(enabled: boolean): void {
  PROTOBUF_CHECKING_ENABLED = enabled;
}

// ---- Module pattern matching ----
const PROTOBUF_MODULE_PATTERNS: RegExp[] = [
  /^.*_pb$/,           // matches './person_pb', '@corp/user_pb'
  /^.*_grpc_web_pb$/,  // matches './service_grpc_web_pb'
];

export function isProtobufModule(moduleSpecifier: string): boolean {
  return PROTOBUF_MODULE_PATTERNS.some(re => re.test(moduleSpecifier));
}
```

To enable protobuf checking, call `setProtobufCheckingEnabled(true)` or edit the
default value of `PROTOBUF_CHECKING_ENABLED` in the source. To adjust which modules
are considered protobuf-generated, edit the `PROTOBUF_MODULE_PATTERNS` array. Most
google-protobuf codebases use the `_pb` suffix convention, so the defaults should
work for the common case.

This is the simplest possible approach — consistent with how both JastAdd and Silver
handle analysis rules. In JastAdd, you either include the aspect or you don't.
In Silver, you either import the extension grammar or you don't. There is no
framework-level per-file or per-directory scoping in either system, and we don't
need it here either.

### How it integrates with projections

The existing `projections.ts` gains a conditional merge:

```typescript
// In projections.ts
import { PROTOBUF_CHECKING_ENABLED } from './equations/protobuf';

export const analysisProjections: AnalysisProjections<KSCAttrMap, KSCProjections> = {
  projections: {
    definitions: (root) => root.children.flatMap(cu => cu.attr('kindDefs')),
    diagnostics: (root) => [
      ...root.attr('allViolations'),
      ...(PROTOBUF_CHECKING_ENABLED ? root.attr('allProtobufViolations') : []),
    ],
  },
  setup: () => {
    resetCounter();
  },
};
```

No factory function needed. No config parameter threading. The projections object
stays a simple singleton. The toggle variable controls everything.

---

## Data Flow: End-to-End Example

### Input

```typescript
// equations/protobuf.ts — toggle is set to true
export let PROTOBUF_CHECKING_ENABLED = true;

// person_pb.ts (generated)
export class Person extends jspb.Message {
  getName(): string { ... }
  setName(v: string): void { ... }
  getAge(): number { ... }
}

// handler.ts
import { Person } from './person_pb';

function process(p: Person) {
  console.log(p.name);        // VIOLATION — direct field access
  console.log(p.getName());   // OK — getter method call
  p.age = 30;                 // VIOLATION — direct field write
  p.setAge(30);               // OK — setter method call
}
```

### Attribute evaluation trace

**Step 1: `protobufTypes` on CompilationUnit (handler.ts)**
- Finds `ImportDeclaration` with moduleSpecifier `'./person_pb'`
- Matches default pattern `*_pb`
- Extracts named import `Person`
- Returns `Map { 'Person' → { name: 'Person', namespace: false } }`

**Step 2: `protobufTypeEnv` at root**
- Collects from all CUs: `Set { 'Person' }`
- Copies down to every node

**Step 3: `protobufViolation` on PropertyAccessExpressions**

For `p.name`:
- `p.typeString` = `"Person"` → in `protobufTypeEnv` ✓
- `name.symIsMethod` = `false` (name isn't a declared method)
- `parentIs('CallExpression', 'expression')` = `false` (parent is `console.log(...)` args)
- → **VIOLATION**: "Direct field access '.name' on protobuf type 'Person'"

For `p.getName()`:
- The inner PropertyAccessExpression `p.getName`:
  - `p.typeString` = `"Person"` → in env ✓
  - `getName.symIsMethod` = **`true`** → **OK, return null**

For `p.age = 30` (BinaryExpression with PropertyAccessExpression LHS):
- The LHS `p.age` is a PropertyAccessExpression:
  - `p.typeString` = `"Person"` → in env ✓
  - `age.symIsMethod` = `false`
  - `parentIs('CallExpression', 'expression')` = `false` (parent is BinaryExpression)
  - → **VIOLATION**: "Direct field access '.age' on protobuf type 'Person'"

For `p.setAge(30)`:
- The inner PropertyAccessExpression `p.setAge`:
  - `setAge.symIsMethod` = **`true`** → **OK, return null**

**Step 4: `allProtobufViolations` gathers**
- Two violations: `p.name` and `p.age`

**Step 5: Projection merges into diagnostics**
- `getDiagnostics()` returns the two protobuf violations

### Chained access example

```typescript
const msg = getResponse(); // returns a Person
msg.getAddress().street;   // should flag .street if Address is also protobuf
```

- `msg.getAddress()`: CallExpression → inner PropertyAccessExpression OK (symIsMethod)
- `msg.getAddress()` expression has `typeString` = `"Address"`
- `.street` PropertyAccessExpression:
  - expression is the CallExpression result, `typeString` = `"Address"`
  - If `"Address"` is in `protobufTypeEnv` → check applies
  - `street.symIsMethod` = false, not in CallExpression → **VIOLATION**

This works because `typeString` propagates through the expression type chain.

### toObject() escape hatch

```typescript
const plain = msg.toObject(); // returns Person.AsObject (plain interface)
plain.name;                   // OK — not a protobuf type
```

- `msg.toObject()`: OK (method call)
- `msg.toObject()` has `typeString` = `"Person.AsObject"` or `"{ name: string; age: number; }"`
- `"Person.AsObject"` is NOT in `protobufTypeEnv` (only `"Person"` is)
- `.name` on the result: not in env → no check → OK

The type system naturally handles this. `toObject()` returns a plain JS object type
that doesn't match any protobuf binding name.

---

## Handling `typeString` Matching

`typeString` is produced by TypeScript's `checker.typeToString()`. Its format depends on
how the type was declared:

| Declaration | typeString of instance | Matches? |
|---|---|---|
| `class Person` (named import) | `"Person"` | Direct match |
| `class Person` (namespace import) | `"Person"` | Direct match (TS resolves the type name, not the access path) |
| `class Person` (generic) | `"Person"` | Direct match |
| `class Person<T>` (instantiated) | `"Person<string>"` | Need prefix match |
| `Person \| null` (nullable) | `"Person \| null"` | Need contains-check |
| `Person[]` (array) | `"Person[]"` | Need extraction |

**Matching strategy**: Instead of exact equality, check if the typeString starts with or
contains a known protobuf type name, with appropriate boundaries:

```typescript
function isProtobufType(typeString: string, env: Set<string>): boolean {
  // Direct match (most common)
  if (env.has(typeString)) return true;
  // Check if any protobuf type name appears at a word boundary
  for (const typeName of env) {
    if (typeString.startsWith(typeName + '<') ||   // Generic: Person<T>
        typeString.startsWith(typeName + ' ')) {    // Union: Person | null
      return true;
    }
  }
  return false;
}
```

This covers the common cases. Edge cases (deeply nested generics, mapped types) are
unlikely with protobuf messages and can be handled later if needed.

---

## Integration: Where Do These Attributes Live?

Extend the existing ts-kind-checking analysis. Add the 4 new attributes to `spec.ts`
alongside the 8 kind-checking attributes. The generated dispatch handles all 12
attributes in one pass.

- Single evaluation, single tree build, single projection
- Violations appear in the same `getDiagnostics()` output
- Minimal new infrastructure — no new adapter, no config threading

**Files changed**:

| File | Change |
|------|--------|
| `src/adapters/analysis/spec/ts-kind-checking/types.ts` | Add `ProtobufBinding` type |
| `src/adapters/analysis/spec/ts-kind-checking/equations/protobuf.ts` | New file: toggle, patterns, 4 equation functions |
| `src/adapters/analysis/spec/ts-kind-checking/equations/index.ts` | Re-export protobuf equations |
| `src/adapters/analysis/spec/ts-kind-checking/spec.ts` | Add 4 AttrDecl entries to allAttrs |
| `src/adapters/analysis/spec/ts-kind-checking/projections.ts` | Merge `allProtobufViolations` into diagnostics |
| Run `ksc codegen` | Regenerate dispatch.ts, attr-types.ts, dep-graph.ts |

---

## Validation Strategies

### Oracle 1: Independent AST walk with TS type checker

Write a standalone script that:
1. Parses the same TS files with the TS compiler
2. For every `PropertyAccessExpression` in the TS AST:
   a. Get the expression's type via `checker.getTypeAtLocation(expr)`
   b. Walk the type's base types via `checker.getBaseTypes(type)` to check
      if it extends `jspb.Message`
   c. If yes and it's not inside a CallExpression: record as violation
3. Compare the violation set against the AG-computed diagnostics

This oracle uses `getBaseTypes()` (inheritance chain) rather than import-module matching,
so it's a completely independent detection method.

### Oracle 2: Check `symIsMethod` exhaustively

For each PropertyAccessExpression flagged as a violation, verify that:
- `name.symIsMethod === false` (confirming it's not a method)
- `name.symIsProperty === true` OR neither flag is set (confirming it's a field
  access or unresolved access, not a legitimate method reference)

This validates the sym flag signal is consistent with the violation.

### Oracle 3: Runtime validation

For test fixtures, actually instantiate protobuf messages and verify that:
- `msg.fieldName` returns `undefined` (confirming direct access doesn't work)
- `msg.getFieldName()` returns the expected value (confirming the getter works)

This proves the violation is real — the code would actually break at runtime.

### Oracle 4: Cross-check against module patterns

For every violation, verify that the expression's type came from a module matching the
configured patterns. Walk the TS compiler's module resolution to confirm the type
originates from a `_pb` module.

---

## Precedent from Other AG Systems

### The collect-propagate-check pattern

Both JastAdd and Silver use the same three-phase pattern for violation detection:

1. **Collect** (synthesized): gather definitions/declarations at their source
2. **Propagate** (inherited): broadcast the collected data to every node in the tree
3. **Check** (synthesized): detect violations at usage sites using the propagated data

Our 4-attribute chain (`protobufTypes → protobufTypeEnv → protobufViolation →
allProtobufViolations`) is a direct instance of this canonical pattern.

**JastAdd** (ExtendJ Java compiler): `syn CompilationUnit.protobufTypes()` →
`inh ASTNode.protobufTypeEnv()` → `syn PropertyAccessExpression.protobufProblems()`.
All violations contribute to a central `CompilationUnit.problems()` collection
attribute via `contributes each protobufProblems() to CompilationUnit.problems()`.

**Silver** (ableC C compiler): synthesized `defs` → inherited `env` → `top.errors <-`
contributions. Silver uses `monoid attribute errors :: [Message] with [], ++` and
`propagate errors;` auto-collects from children.

### Configuration: global, not scoped

Both systems treat analysis rules as globally enabled or disabled:

- **JastAdd**: No framework-level per-rule enable/disable. You either include the
  aspect file in your build or you don't. Projects that need runtime toggling guard
  contributions with `when program().options().isRuleEnabled("...")`, but this is
  application-level code, not a JastAdd feature.

- **Silver**: Configuration is primarily **build-time** — you import or don't import
  an extension grammar. `grammar myproject:composed; imports extensions:protobuf;`
  means protobuf checking is active. Omit the import → no protobuf checking.

Neither system has framework support for "these files are checked but those aren't."
If an analysis is enabled, it runs everywhere. Our global
`PROTOBUF_CHECKING_ENABLED` toggle follows this same convention.

### How config reaches equations

**JastAdd** uses the `program().options()` pattern: store an `Options` object on the
root AST node, broadcast a reference to the root via an inherited attribute, and
any equation calls `program().options()` to access settings. JastAdd also supports
`static` fields on `ASTNode` as a module-level singleton workaround — functionally
identical to our `let PROTOBUF_CHECKING_ENABLED` pattern.

**Silver** passes configuration as inherited attributes from the root, or relies on
grammar-module imports as the primary "what's enabled" mechanism.

Our approach — a source-level toggle variable that the equation reads directly —
is the simplest variant of the JastAdd `static` field pattern. It avoids the
complexity of an inherited config attribute while achieving the same result.

### Violation aggregation

**JastAdd**: Single `problems()` collection that ALL analyses contribute to. Each
concern defines `*Problems()` synthesized methods and contributes them:
`PropertyAccessExpression contributes each protobufProblems() to CompilationUnit.problems()`.

**Silver**: Single `errors` monoid attribute. Productions contribute via `top.errors <- [...]`.
`propagate errors;` auto-collects from children.

**KindScript**: We use explicit recursive gather (`allProtobufViolations`) and merge
in the projections layer. This is more verbose than JastAdd/Silver's contribution
syntax but more explicit — the data flow is visible in the attribute dependency graph.

### Aspect-per-concern organization

**JastAdd** organizes analyses into separate `.jrag` aspect files by concern:
`NameCheck.jrag`, `TypeCheck.jrag`, `AccessControl.jrag`, `ProtobufCheck.jrag`.
Each aspect can define attributes on any node type and contribute to shared collections.

**Silver** organizes into separate `.sv` grammar files and uses aspect productions
to add checks to existing node types from separate modules.

**KindScript**: Our `equations/protobuf.ts` is the direct equivalent of JastAdd's
`ProtobufCheck.jrag` — a single file containing all protobuf-related equation
functions, the toggle, and the module pattern matching.

### Closest real-world analogs

Neither JastAdd nor Silver has protobuf/gRPC enforcement examples. The closest
analogs in their ecosystems:

- **ExtendJ access control** (JastAdd): determines whether a type/member access is
  permitted. Same structure: collect visibility info → propagate scope → check at access.
- **ableC type qualifiers** (Silver, Carlson & Van Wyk GPCE 2017): enforces `nonnull`
  constraints. Same structure: annotate at declarations → propagate through types →
  check at usage sites.
- **JastAdd NonNull Checker** (BitBucket: `jastaddj-nonnullchecker`): ExtendJ extension
  detecting null-pointer risks using attributes.

### Key references

| Resource | URL |
|----------|-----|
| JastAdd Reference Manual | https://jastadd.cs.lth.se/web/documentation/reference-manual.php |
| ExtendJ (JastAdd Java compiler) | https://extendj.org/ |
| Silver tutorial | https://melt.cs.umn.edu/silver/tutorial/ |
| Silver collection attributes | https://melt.cs.umn.edu/silver/concepts/collections/ |
| Patterns of JastAdd-Style RAGs (Fors, 2020) | https://fileadmin.cs.lth.se/cs/Personal/Niklas_Fors/publications/fors20sle.pdf |
| Type Qualifiers as Composable Extensions (2017) | https://www-users.cse.umn.edu/~evw/pubs/carlson17gpce/carlson17gpce.pdf |
| ableC extensible C compiler | https://github.com/melt-umn/ableC |

---

## Summary

The detection mechanism layers three AST signals:

1. **`typeString`** on the expression identifies WHAT type the object is
2. **`protobufTypeEnv`** (computed from import analysis + config) identifies WHICH types
   are protobuf messages
3. **`symIsMethod`** on the property name identifies WHETHER the access is a legitimate
   method (getter/setter/utility)
4. **`parentIs('CallExpression', 'expression')`** catches method calls even when
   `symIsMethod` isn't available (loose types)

These four signals combine to catch direct field access on protobuf messages with high
precision and zero annotations. A source-level toggle (`PROTOBUF_CHECKING_ENABLED`)
controls whether the analysis runs, module patterns identify protobuf-generated files,
the attributes compute the type environment, and the violation equation uses local node
information for the final determination. This follows the canonical collect-propagate-check
pattern used by both JastAdd and Silver for the same class of analysis.
