# Protobuf Getter Enforcement — Options & Plan

## The Problem

In codebases using **google-protobuf** (JSPB) or **grpc-web**, protobuf message objects
store field data in an internal array (`array_[fieldIndex]`), NOT as named properties.
The generated classes expose `getFieldName()` / `setFieldName(value)` methods, but the
actual property `message.fieldName` does not exist.

```typescript
const person = new proto.Person();
person.setName("Alice");

person.getName();  // "Alice" ← correct
person.name;       // undefined ← silent bug!
person.name = "Bob"; // sets a shadow property — invisible to serialization
```

This is a **silent correctness bug**: no TypeScript error, no runtime error, just
`undefined` where you expected a value, or data that vanishes on serialization.

**Note**: This problem is specific to **google-protobuf / grpc-web**. Other libraries
(protobufjs, ts-proto, protobuf-es, protobuf-ts) generate plain properties where direct
access works correctly. There are no existing ESLint plugins for this — it's an unserved
gap.

### What should be flagged

| Pattern | AST Shape | Verdict |
|---------|-----------|---------|
| `msg.name` (read) | `PropertyAccessExpression` not inside `CallExpression` | VIOLATION |
| `msg.name = "x"` (write) | `BinaryExpression` with `PropertyAccessExpression` LHS | VIOLATION |
| `msg['name']` | `ElementAccessExpression` not inside `CallExpression` | VIOLATION |
| `msg.getName()` | `CallExpression` wrapping `PropertyAccessExpression` | OK |
| `msg.setName("x")` | `CallExpression` wrapping `PropertyAccessExpression` | OK |
| `msg.hasName()` | `CallExpression` wrapping `PropertyAccessExpression` | OK |
| `msg.toObject()` | `CallExpression` wrapping `PropertyAccessExpression` | OK |
| `msg.serializeBinary()` | `CallExpression` wrapping `PropertyAccessExpression` | OK |
| `msg.toObject().name` | `PropertyAccessExpression` on non-protobuf type | OK (toObject returns plain object) |

### How the AST distinguishes these

`msg.name` (violation):
```
PropertyAccessExpression          ← parent is NOT CallExpression
  expression: Identifier("msg")  ← typeString: "proto.Person"
  name: Identifier("name")
```

`msg.getName()` (allowed):
```
CallExpression
  expression: PropertyAccessExpression  ← parent IS CallExpression
    expression: Identifier("msg")
    name: Identifier("getName")
  arguments: []
```

The existing `ctx.parentIs('CallExpression', 'expression')` method on the AG context
detects this precisely — it returns true when the PropertyAccessExpression is the
callee of a call.

### How to identify protobuf message types

The equation needs to know "is this object a protobuf message?" Several signals exist:

1. **`typeString`** on the expression (at check depth) — e.g., `"Person"`, `"proto.mypackage.Person"`.
   The TS type checker resolves the concrete type, so even through generics and aliases,
   the actual protobuf class name appears.

2. **`resolvedFileName`** on Identifier expressions — if the binding was imported from a
   `*_pb.ts` or `*_pb.js` file, it's a protobuf type. Already stamped on Identifier nodes.

3. **`importModuleSpecifier`** on Identifier expressions — the import path (e.g.,
   `'./generated/person_pb'`). Already stamped on Identifier nodes.

4. **Type inheritance** — all google-protobuf messages extend `jspb.Message`. Not
   directly available in the AST schema today, but `typeString` at the expression level
   contains the concrete type name, which could be matched against a configured set.

---

## Options

### Option A: New Kind Property (`useGetters`)

Add `useGetters` to `PropertySet`. Users annotate functions that handle protobuf objects:

```typescript
type ProtoSafe = Kind<{ useGetters: true }>;

const handler: ProtoSafe & ((msg: proto.Person) => string) = (msg) => {
  return msg.getName();  // OK
  return msg.name;       // VIOLATION: direct field access violates ProtoSafe (useGetters)
};
```

**How it works**: Same as `noConsole`. The `contextFor('useGetters')` inherited attribute
propagates the active kind into the function body. The `violationFor('useGetters')`
equation on `PropertyAccessExpression` fires when:
1. `contextFor('useGetters')` is non-null (we're inside an annotated function)
2. The PropertyAccessExpression is NOT the callee of a CallExpression
3. The expression's `typeString` matches a protobuf type pattern

**Changes required**:

| File | Change |
|------|--------|
| `src/api.ts` | Add `useGetters?: true` to `PropertySet` |
| `src/adapters/analysis/spec/ts-kind-checking/types.ts` | Add `'useGetters'` to `PROPERTY_KEYS` |
| `src/adapters/analysis/spec/ts-kind-checking/equations/attributes.ts` | Extend `eq_violationFor_PropertyAccessExpression` with `useGetters` check |
| `src/adapters/analysis/spec/ts-kind-checking/equations/predicates.ts` | Add `isProtobufMessageType()` predicate |
| Run `ksc codegen` | Regenerate dispatch (automatic — no new node kinds needed) |

**Pros**:
- Fits perfectly into existing architecture — minimal code changes
- Leverages all existing machinery (contextFor, violationFor, diagnostics, projections)
- Same user experience as other Kind properties
- No config changes needed
- Composable: `Kind<{ useGetters: true, noMutation: true }>`

**Cons**:
- Requires annotating every function that touches protobuf messages
- Doesn't scale if the whole codebase handles protobuf objects pervasively
- The type detection heuristic needs to be right (see "Type Detection" section below)
- ALL property access (not just protobuf fields) gets flagged inside annotated functions
  unless the equation also checks that the receiver type is a protobuf message

**Difficulty**: Low. ~50 lines of production code.

---

### Option B: Kind Property + Type-Aware Filtering

Same as Option A but the equation is smarter: it only fires when the receiver expression's
type is detected as a protobuf message. Non-protobuf property access is unaffected.

```typescript
type ProtoSafe = Kind<{ useGetters: true }>;

const handler: ProtoSafe & ((msg: proto.Person, config: AppConfig) => void) = (msg, config) => {
  msg.name;         // VIOLATION — msg is protobuf type
  config.timeout;   // OK — config is not protobuf type
  msg.getName();    // OK — method call
};
```

**Type detection strategy**: Use `typeString` on the expression node. The equation checks
whether the type matches a protobuf pattern. Two sub-options for pattern source:

**B1: Convention-based detection** (no config needed)
The equation checks if `typeString` matches patterns indicating a protobuf message:
- Type is imported from a `*_pb` module (via `resolvedFileName` on the expression identifier)
- Type name matches common protobuf patterns

```typescript
function isProtobufExpression(exprNode: KSNode): boolean {
  if (exprNode.kind === 'Identifier') {
    const id = exprNode as KSIdentifier;
    // Check if imported from a *_pb file
    if (id.resolvedFileName && /[_.]pb\b/.test(id.resolvedFileName)) return true;
  }
  return false;
}
```

**B2: Config-driven detection** (explicit type patterns)
Users configure which types require getter access in `ksc.config.ts`:

```typescript
// ksc.config.ts
export default defineConfig({
  useGetters: {
    typePatterns: ['*_pb.*', 'proto.*'],
    modulePatterns: ['*_pb', '*_pb.js', '*_pb.ts'],
  },
});
```

The equation reads this config (passed through the composition root) and uses it to
match `typeString` and `resolvedFileName`.

**Changes required** (beyond Option A):

| File | Change |
|------|--------|
| `src/api.ts` | Add `useGetters` config section to `KindScriptConfig` (for B2) |
| `src/adapters/analysis/spec/ts-kind-checking/equations/predicates.ts` | Add `isProtobufExpression()` using resolvedFileName/typeString |

**Pros**:
- No false positives on non-protobuf property access
- The `resolvedFileName` signal is very strong — if a binding was imported from `person_pb.ts`, it's protobuf
- Config-driven version (B2) handles any getter-based library, not just protobuf

**Cons**:
- Still requires per-function annotation via Kind<>
- `resolvedFileName` only works for direct imports, not for variables passed through function parameters
  (the parameter's resolvedFileName isn't available — only typeString is)
- Type detection adds complexity to the equation

**Difficulty**: Low-Medium. ~80 lines of production code.

---

### Option C: Global Rule via Config (No Annotations Needed)

Instead of per-function Kind annotations, add a project-level config rule that applies
everywhere:

```typescript
// ksc.config.ts
export default defineConfig({
  rules: {
    useGetters: {
      modulePatterns: ['**/*_pb', '**/*_pb.js'],
    },
  },
});
```

This would flag direct field access on protobuf types **anywhere in the codebase** —
no `Kind<{ useGetters: true }>` annotation needed.

**Implementation approach**: The rule would NOT use the `contextFor` / `violationFor`
parameterized attribute pair (which requires a Kind annotation to activate). Instead,
it would be a new synthesized attribute `protobufViolations` that checks every
`PropertyAccessExpression` in the tree against the configured patterns.

**Changes required**:

| File | Change |
|------|--------|
| `src/api.ts` | Add `rules` section to `KindScriptConfig` |
| `src/adapters/analysis/spec/ts-kind-checking/types.ts` | No PROPERTY_KEYS change |
| `src/adapters/analysis/spec/ts-kind-checking/spec.ts` | Add new `protobufViolations` attribute |
| `src/adapters/analysis/spec/ts-kind-checking/equations/` | New equation file for protobuf checks |
| `src/adapters/analysis/spec/ts-kind-checking/projections.ts` | Add protobuf violations to diagnostics projection |
| `src/application/check-program.ts` | Pass config through to evaluator |
| Run `ksc codegen` | Regenerate all |

**Pros**:
- No annotations needed — whole-codebase enforcement out of the box
- Better UX for "my whole company uses protobuf" use case
- Config is the right level for project-wide rules

**Cons**:
- Significant architecture change: config must flow into equations (currently equations
  don't receive config — they only access the tree and other attributes)
- Either pass config as an inherited attribute (adds a new mechanism) or via closure
  (breaks the pure equation model)
- New attribute type (not parameterized by property) — adds complexity to the spec
- Harder to compose with existing Kind properties

**Difficulty**: Medium-High. ~200 lines of production code + architecture change.

---

### Option D: Separate Analysis Adapter

Create a new analysis adapter `src/adapters/analysis/spec/protobuf-safety/` with its
own attributes, codegen target, and evaluation target. Completely independent from
kind-checking.

**Attributes**:
- `protobufTypes` (syn, on CompilationUnit): Set of type names imported from *_pb modules
- `protobufTypeEnv` (inh): Inherited environment of protobuf type names
- `protobufViolation` (syn): Diagnostic for direct field access on protobuf types
- `allProtobufViolations` (syn): Recursive gather

**Changes required**:

| File | Change |
|------|--------|
| `src/adapters/analysis/spec/protobuf-safety/` | New adapter (types, equations, spec, projections) |
| `src/application/codegen/codegen-targets.ts` | New codegen target |
| `src/application/evaluation/protobuf-safety.ts` | New evaluation target + evaluator |
| `src/application/check-program.ts` | Compose both evaluators, merge diagnostics |
| Run `ksc codegen` | Generate protobuf-safety dispatch |

**Pros**:
- Clean separation — protobuf analysis doesn't complicate kind-checking
- Demonstrates the multi-analysis capability of the AG system
- Each analysis has its own attribute set, dependency graph, and projections
- Proves the architecture: "plug in a new analysis without touching existing ones"

**Cons**:
- Heavy implementation — full new adapter with 4+ attributes, equations, codegen target,
  evaluation target, composition root changes
- Running two evaluators means building the AG tree twice (or sharing it)
- Overkill if we just need one violation check
- More maintenance surface

**Difficulty**: High. ~500 lines of production code across many files.

---

### Option E: Hybrid — Kind Property + Smart Default

Combine Option A with a heuristic that auto-activates in protobuf-heavy contexts:

1. Add `useGetters` to PropertySet (same as Option A)
2. Add a `defaultKinds` config option:
   ```typescript
   defineConfig({
     defaultKinds: {
       '**/*_pb_handler.*': { useGetters: true },
       'src/api/**': { useGetters: true, noMutation: true },
     },
   });
   ```
3. Files matching patterns automatically get their functions treated as if annotated

This bridges the gap between "annotate every function" and "global rule" — users can
apply Kind properties to entire directories via config, without annotating each function.

**Pros**:
- Reuses all existing Kind machinery
- Scales to whole-codebase via config patterns
- Composable with other Kind properties
- Natural upgrade path: start with annotations, graduate to config patterns

**Cons**:
- The `defaultKinds` config mechanism is new infrastructure
- Pattern matching against file paths in the evaluator is a new capability
- Moderate architecture change (less than Option C, more than Option A)

**Difficulty**: Medium. ~150 lines.

---

## Type Detection Deep Dive

All options need to answer: "is this expression a protobuf message type?"

### Signal 1: `resolvedFileName` (strongest, only on Identifiers)

When a variable is imported, its Identifier node has `resolvedFileName` pointing to the
source file. If it ends in `_pb.ts`, `_pb.js`, or `_pb.d.ts`, it's a protobuf type.

```typescript
function hasProtobufOrigin(node: KSNode): boolean {
  if (node.kind !== 'Identifier') return false;
  const id = node as KSIdentifier;
  return id.resolvedFileName !== '' && /[_.]pb(\.(js|ts|d\.ts))?$/.test(id.resolvedFileName);
}
```

**Limitation**: Only works for direct import bindings. A function parameter `(msg: Person)`
doesn't carry `resolvedFileName` — the parameter name `msg` resolves to the parameter
declaration, not the import.

### Signal 2: `typeString` (works everywhere, but requires pattern matching)

Every expression has `typeString` at check depth. For protobuf messages, this contains
the TypeScript type name: `"Person"`, `"proto.mypackage.Person"`, etc.

**Challenge**: How to distinguish `proto.Person` (protobuf) from `models.Person` (plain
class)? Options:
- User configures type patterns in config (explicit, no false positives)
- Convention: types from `*_pb` modules get a distinctive type name format
- Check if type has getters: if `typeString` shows a class with `getName` method, likely
  protobuf (but this requires deeper type introspection not currently available)

### Signal 3: `importModuleSpecifier` (on imported Identifiers)

The import path string: `'./generated/person_pb'`. Checking for `_pb` suffix in the
module specifier is a strong signal.

### Recommendation: Layer signals

```typescript
function isLikelyProtobufMessage(exprNode: KSNode, config?: ProtobufConfig): boolean {
  // Signal 1: direct import from _pb module (strongest)
  if (exprNode.kind === 'Identifier') {
    const id = exprNode as KSIdentifier;
    if (id.resolvedFileName && /[_.]pb\b/.test(id.resolvedFileName)) return true;
    if (id.importModuleSpecifier && /[_.]pb\b/.test(id.importModuleSpecifier)) return true;
  }

  // Signal 2: typeString matches configured patterns
  if (config?.typePatterns) {
    const typeStr = (exprNode as any).typeString ?? '';
    return config.typePatterns.some(pat => matchPattern(typeStr, pat));
  }

  return false;
}
```

For the initial implementation, **Signal 1 alone** (`resolvedFileName` / `importModuleSpecifier`)
covers the most common case (code directly using an imported protobuf variable) and has
zero false positives. Signal 2 can be added later for the parameter-passing case.

---

## Recommendation

**Start with Option B1 (Kind property + convention-based type detection), then evolve
toward Option E (config-driven file patterns) if needed.**

### Rationale

1. **Option A/B1 is the lowest-risk path**: ~50-80 lines of code, entirely within the
   existing architecture, uses proven patterns (identical to how `noConsole` works).

2. **Convention-based detection covers 80% of cases**: If a variable was imported from a
   `_pb` file, we know it's protobuf. No config needed for this common case.

3. **The Kind annotation model is the right framing**: Users already think in terms of
   "this function handles protobuf messages, so it should follow protobuf rules." The
   annotation makes this explicit and composable.

4. **Option E (file-pattern config) is a natural follow-up** that doesn't invalidate
   the Option B1 work — it just adds a config mechanism to auto-apply Kind properties
   to files, which benefits ALL properties, not just `useGetters`.

5. **Option C (global rule) requires threading config through the evaluator**, which is
   an architecture change that should be designed carefully, not rushed for one feature.

6. **Option D (separate adapter) is overkill**: The violation is one check on one node
   kind. A full separate analysis adapter with its own codegen target is too much
   machinery for this.

---

## Implementation Plan (Option B1)

### Step 1: Add the property to the vocabulary

**`src/api.ts`** — Add to PropertySet:
```typescript
export interface PropertySet {
  // ... existing properties ...
  readonly useGetters?: true;
}
```

**`src/adapters/analysis/spec/ts-kind-checking/types.ts`** — Add to PROPERTY_KEYS:
```typescript
export const PROPERTY_KEYS: ReadonlySet<string> = new Set<keyof PropertySet>([
  'noImports', 'noConsole', 'immutable', 'static',
  'noSideEffects', 'noMutation', 'noIO', 'pure',
  'useGetters',  // ← new
]);
```

### Step 2: Add the protobuf detection predicate

**`src/adapters/analysis/spec/ts-kind-checking/equations/predicates.ts`** — New helper:

```typescript
/**
 * Check whether an expression node is likely a protobuf message instance.
 * Uses import origin as the primary signal: if the binding was imported from
 * a *_pb module, it's a protobuf type.
 */
export function isProtobufMessageExpression(exprNode: KSNode): boolean {
  if (exprNode.kind !== 'Identifier') return false;
  const id = exprNode as KSIdentifier;
  // Check resolved source file
  if (id.resolvedFileName && /[_.]pb(\.(js|ts|d\.ts))?$/i.test(id.resolvedFileName)) {
    return true;
  }
  // Check import module specifier
  if (id.importModuleSpecifier && /[_.]pb('|")?$/i.test(id.importModuleSpecifier)) {
    return true;
  }
  return false;
}
```

### Step 3: Add the violation equation

**`src/adapters/analysis/spec/ts-kind-checking/equations/attributes.ts`** — Extend the
existing `eq_violationFor_PropertyAccessExpression`:

```typescript
export const eq_violationFor_PropertyAccessExpression = withDeps(['contextFor'],
  function eq_violationFor_PropertyAccessExpression(
    ctx: KindCtx<KSPropertyAccessExpression>,
    property: string,
  ): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;

    // Existing: noConsole
    if (property === 'noConsole') {
      if (ctx.node.expression.kind === 'Identifier'
          && (ctx.node.expression as KSIdentifier).escapedText === 'console') {
        return diag(ctx, kindCtx, property,
          `'console.${(ctx.node.name as KSIdentifier).escapedText}' violates ${kindCtx.name} (noConsole)`);
      }
    }

    // New: useGetters
    if (property === 'useGetters') {
      // Only flag if this property access is NOT the callee of a method call
      // i.e., msg.name is flagged, but msg.getName() is not (because PropertyAccessExpression
      // is the 'expression' child of a CallExpression)
      if (!ctx.parentIs('CallExpression', 'expression')) {
        // Only flag if the receiver looks like a protobuf message
        if (isProtobufMessageExpression(ctx.node.expression)) {
          const fieldName = ctx.node.name.kind === 'Identifier'
            ? (ctx.node.name as KSIdentifier).escapedText
            : '?';
          return diag(ctx, kindCtx, property,
            `direct access '.${fieldName}' on protobuf message — use getter method instead, violates ${kindCtx.name} (useGetters)`);
        }
      }
    }

    return null;
  }
);
```

### Step 4: (Optional) Add ElementAccessExpression violation

For `message['name']` patterns, add a new per-kind equation:

```typescript
export const eq_violationFor_ElementAccessExpression = withDeps(['contextFor'],
  function eq_violationFor_ElementAccessExpression(
    ctx: KindCtx<KSElementAccessExpression>,
    property: string,
  ): Diagnostic | null {
    const kindCtx = getKindCtx(ctx, property);
    if (!kindCtx) return null;

    if (property === 'useGetters') {
      if (!ctx.parentIs('CallExpression', 'expression')) {
        if (isProtobufMessageExpression(ctx.node.expression)) {
          return diag(ctx, kindCtx, property,
            `bracket access on protobuf message — use getter method instead, violates ${kindCtx.name} (useGetters)`);
        }
      }
    }

    return null;
  }
);
```

Then add this equation to the `violationFor` attribute declaration in `spec.ts`.

### Step 5: Run codegen

```bash
ksc codegen
```

This regenerates `dispatch.ts` to include the new equation for `ElementAccessExpression`
(if added) and to dispatch `useGetters` through the existing `PropertyAccessExpression`
equation. No manual dispatch changes needed.

### Step 6: Add tests

**New fixture**: `test/fixtures/protobuf-access/src/`

```typescript
// kinds.ts
import { Kind } from 'kindscript';
export type ProtoSafe = Kind<{ useGetters: true }>;

// person_pb.ts (mock protobuf generated file)
export class Person {
  getName(): string { return ''; }
  setName(v: string): void {}
  getAge(): number { return 0; }
  setAge(v: number): void {}
  toObject(): { name: string; age: number } { return { name: '', age: 0 }; }
}

// handler.ts
import { Person } from './person_pb';
import type { ProtoSafe } from './kinds';

export const handlePerson: ProtoSafe & ((p: Person) => string) = (p) => {
  p.getName();      // OK — method call
  p.setName("x");   // OK — method call
  p.toObject();     // OK — method call

  p.name;           // VIOLATION — direct field access
  p.age;            // VIOLATION — direct field access
  p['name'];        // VIOLATION — bracket access

  const plain = p.toObject();
  plain.name;       // OK — toObject() returns plain object, not protobuf
  return p.getName();
};
```

**Test assertions**:
```typescript
it('detects direct field access on protobuf messages', () => {
  const { diagnostics } = buildAndEvaluate('protobuf-access');
  const violations = diagnostics.filter(d => d.property === 'useGetters');
  expect(violations.length).toBe(3); // p.name, p.age, p['name']
  expect(violations.every(v => v.message.includes('protobuf'))).toBe(true);
});

it('allows getter method calls on protobuf messages', () => {
  const { diagnostics } = buildAndEvaluate('protobuf-access');
  const violations = diagnostics.filter(d => d.property === 'useGetters');
  // getName(), setName(), toObject() should NOT appear
  expect(violations.every(v => !v.message.includes('getName'))).toBe(true);
});
```

### Step 7: Update documentation

Update `src/api.ts` JSDoc for `PropertySet` and `CLAUDE.md` to document the new property.

---

## Validation Strategy

### Oracle 1: AST pattern matching

Write an independent checker that walks the raw TS AST (not the AG tree):
1. For each `PropertyAccessExpression` not inside a `CallExpression`
2. Check if the expression's type extends `jspb.Message` (via TS type checker:
   `checker.getBaseTypes()` recursively)
3. Compare results against AG diagnostics

This oracle uses the TS type checker directly, which is the most authoritative source
for "is this a protobuf type." The AG equation uses `resolvedFileName` as a heuristic,
so any disagreement between the two reveals a detection gap.

### Oracle 2: grep for direct access patterns

For a known protobuf codebase, grep for patterns like:
```
\.\b(field names from .proto files)\b(?!\s*\()
```
This catches `msg.fieldName` but not `msg.fieldName()`. Compare grep hits against
AG violations.

### Oracle 3: Runtime assertion

Instrument the test fixture to actually run the code:
```typescript
const person = new Person();
person.setName("Alice");
assert(person.getName() === "Alice");   // passes
assert((person as any).name === undefined); // proves direct access fails
```

This proves the violation is real — `person.name` genuinely doesn't work.

---

## Future Evolution Path

1. **Start**: Option B1 — Kind property + `resolvedFileName`-based detection
2. **Next**: Add `typeString`-based detection for the parameter-passing case
   (function receives protobuf as parameter, not directly imported)
3. **Later**: Option E — `defaultKinds` config to auto-apply `useGetters` to directories
4. **Eventually**: Generalize `useGetters` to work with any getter-based API
   (not just protobuf), driven by config patterns

Each step is incremental and backward-compatible. Users who start with annotations can
gradually move to config-driven enforcement without changing their Kind definitions.
