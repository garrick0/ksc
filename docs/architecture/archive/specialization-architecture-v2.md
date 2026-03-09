# Specialization Architecture v2: Two-Functor Design

**Status**: IMPLEMENTING Option B
**Supersedes**: specialization-architecture.md (v1)

### Implementation Progress

- [x] Phase 1: Foundation — interfaces, KindToNode, violation builder
- [x] Phase 2: Extract Functor 1 — `ksc-compiler/compile-grammar.ts`, codegen.ts is thin wrapper
- [x] Phase 3: Build Analysis Spec — `ksc-analysis/spec.ts` with 5 structural + 8 properties
- [x] Phase 4: Extract Functor 2 — `ksc-compiler/compile-analysis.ts`, gen-ksc-evaluator.ts is thin wrapper
- [x] Phase 5: Wire up — full pipeline verified, 179/179 tests pass, checker.ts no longer imported

## Motivation

KSC has three inputs that determine its behavior:

1. **Grammar** — AST node kinds, fields, sum type hierarchy (`schema.ts`)
2. **Analysis** — AG equations: structural attrs (binder) + property enforcement (checker)
3. **Program** — TypeScript source files (runtime input)

Today these combine through two shell scripts (`npx tsx ast-schema/codegen.ts`, `npx tsx scripts/gen-ksc-evaluator.ts`) with file-system artifacts as interfaces. The grammar-to-analysis dependency is informal (import paths, naming conventions). There are no typed interfaces between stages.

This document proposes restructuring so each specialization stage is a typed function with explicit inputs, explicit outputs, and a clear dependency chain — mirroring the Futamura projection structure where `mix(program, static_input) → residual`.

---

## Current Architecture

### Files and Data Flow

```
schema.ts ──────→ codegen.ts ──────→ generated/node-types.ts
(grammar DSL)     (script)           generated/schema.ts
                                     generated/convert.ts
                                     generated/builders.ts
                                     generated/serialize.ts
                                           │
                                           │ (imports)
                                           ▼
                              binder.ts + checker.ts ──→ gen-ksc-evaluator.ts ──→ evaluator.ts
                              (hand-written equations)   (script, regex scan)     (generated)
                              attr-types.ts ─────────────────────┘
```

### Where Coupling Lives

The equations in `binder.ts`/`checker.ts` are coupled to the grammar in two ways:

- **By name**: Function names encode grammar kinds — `eq_consoleViolation_PropertyAccessExpression`
- **By type**: Function bodies cast to grammar-specific types — `raw as KSIdentifier`, `pae.expression.kind === 'Identifier'`

This coupling is inherent. You cannot describe "detect console.log" without knowing the grammar has `PropertyAccessExpression` with `expression` and `name` children. The question is whether to make this coupling **explicit and typed** rather than **implicit and discovered by regex**.

### Structural Repetition

All 8 checker properties follow an identical pattern:

```typescript
// This appears 8 times with only the property name changed:
export function eq_{prop}Context(parentCtx: Ctx): KindDefinition | null | undefined {
  if ((parentCtx.node as any).kind === 'VariableDeclaration') {
    const kinds = parentCtx.attr('kindAnnotations');
    const match = kinds.find((k: KindDefinition) => (k.properties as any)['{prop}']);
    if (match) return match;
  }
  return undefined;
}
export const eq_{prop}Context_rootValue: KindDefinition | null = null;
```

Plus `allViolations_contribute` manually lists all 8 violation attrs. Adding a new property touches 4+ files and ~25 lines of boilerplate.

### Dependency Detection

`gen-ksc-evaluator.ts` builds the attribute dependency graph by regex-scanning equation function bodies for `.attr('xxx')` calls. This works but has a hard constraint: **equations must be explicit function declarations with inline `.attr()` calls.** Factory functions, helpers, or any indirection hides dependencies from the scanner.

---

## Design Principles

Three principles guide the redesign:

1. **Equations are code, not data.** Violation predicates are TypeScript functions with full type checking, IDE support, and refactoring. A functor doesn't require its inputs to be data — it requires them to have a known interface. Functions are values; a module of functions is a value a functor can process.

2. **Model dependencies explicitly.** The grammar-analysis coupling should be a typed function parameter (`compileAnalysis(grammar, spec)`), not an implicit import path. The dep graph should be derived from spec structure where possible, explicit where necessary — never regex-scanned.

3. **Generate what's mechanical, hand-write what's semantic.** Context equations, root values, collection wiring, and dep edges are derivable from a property list. Violation predicates require domain knowledge and should remain hand-written TypeScript.

---

## Option A: Typed Pipeline (Minimal Refactor)

Wrap each existing script in a typed function. No structural changes to equations.

### Interface

```typescript
function compileGrammar(spec: GrammarSpec): GrammarCompilation;
function compileEvaluator(spec: AttrSpec): EvaluatorCompilation;

interface GrammarCompilation {
  files: { path: string; content: string }[];
  summary: { nodeCount: number; sumTypeCount: number };
}

interface EvaluatorCompilation {
  file: { path: string; content: string };
  attrs: AttrDef[];
  depGraph: AttributeDepGraph;
}
```

### What Changes

- `codegen.ts` extracted into `compile-grammar.ts` (pure function) + thin script wrapper
- `gen-ksc-evaluator.ts` extracted into `compile-evaluator.ts` (pure function) + thin script wrapper
- New `pipeline.ts` orchestrates both stages

### What Doesn't Change

- Equations remain as named `eq_*` functions discovered by regex
- Grammar-analysis coupling remains implicit (import paths)
- 8 copies of context equation boilerplate remain
- Dep graph still built by regex scanning

### Tradeoffs

| Benefit | Cost |
|---------|------|
| Stages are testable pure functions | No boilerplate elimination |
| Pipeline is explicit | Grammar-analysis coupling unchanged |
| Small effort | Dep detection unchanged (regex) |

---

## Option B: Two-Functor Architecture (Recommended)

Two typed functors. Grammar is Input 1. Analysis (structural equations + property declarations with bundled violation rules) is Input 2. The grammar residual is an explicit parameter to the analysis functor.

### Core Insight: Properties and Rules Are One Concern

A property IS its rules. `noConsole` has no meaning without "detect `console.x` on `PropertyAccessExpression`." The context equation, violation detection, and collection wiring are all aspects of enforcing one behavioral constraint. They should be declared together:

```typescript
interface PropertyDecl {
  name: string;               // 'noConsole'
  annotationKey: string;      // key in PropertySet to check
  violations: ViolationRule[]; // the detection rules
}
```

The functor generates all AG plumbing (context equations, root values, allViolations wiring) from this declaration. The developer only writes the violation predicates.

### Core Insight: Deps Are Derivable

Current approach: regex-scan all equation bodies for `.attr()` calls.

Better approach: **the spec structure implies the dep graph.**

For property-based attributes (22 of 26 current dep edges):
- Each context attr depends on `kindAnnotations` — known from the property pattern
- Each violation attr depends on its context attr — known from the property declaration
- `allViolations` depends on all violation attrs — known from the property list

For structural attributes (4 of 26 edges):
- `defEnv → kindDefs`, `defLookup → defEnv`, `kindAnnotations → defLookup`, `kindDefs → (leaf)`
- There are only 4 of these. Explicit `deps` declarations are manageable and reliable.

**Zero regex scanning.** The dep graph is fully determined by spec structure + 4 explicit declarations.

### Type Safety via Generated Kind Map

Functor 1 generates a type-level mapping from kind strings to node types:

```typescript
// generated/kind-map.ts (new output of compileGrammar)
export type KindToNode = {
  'Identifier': KSIdentifier;
  'PropertyAccessExpression': KSPropertyAccessExpression;
  'BinaryExpression': KSBinaryExpression;
  // ... all 364 kinds
};
```

A builder function uses this map for type inference:

```typescript
function violation<K extends string & keyof KindToNode>(config: {
  triggerKind: K;
  predicate: (ctx: Ctx, node: KindToNode[K]) => boolean;
  message: (ctx: Ctx, node: KindToNode[K], def: KindDefinition) => string;
}): ViolationRule {
  return config as ViolationRule;
}
```

TypeScript infers `K` from the `triggerKind` string literal and narrows the `node` parameter in `predicate` and `message`. No unsafe casts on the trigger node. Full IDE autocomplete on node fields.

### Functor 1: Grammar Compilation

```typescript
interface GrammarSpec {
  nodes: ReadonlyMap<string, NodeEntry>;
  sumTypes: ReadonlyMap<string, SumTypeEntry>;
  fieldExtractors: Record<string, Record<string, string>>;
}

interface CompiledGrammar {
  // Generated source files
  files: GeneratedFile[];

  // Runtime capabilities
  readonly kinds: ReadonlySet<string>;
  readonly childFields: (kind: string) => readonly string[];
  readonly convert: (program: ts.Program, depth: AnalysisDepth) => KSTree;

  // Type-level output: KindToNode map (generated as source)
  hasKind(kind: string): boolean;
}

function compileGrammar(spec: GrammarSpec): CompiledGrammar;
```

Produces: `node-types.ts`, `schema.ts`, `convert.ts`, `builders.ts`, `serialize.ts`, `kind-map.ts`.

Unchanged from current codegen except wrapped in a typed function and producing the new `KindToNode` map.

### Functor 2: Analysis Compilation

```typescript
interface AnalysisSpec {
  // Structural equations — binder + kindAnnotations
  structural: StructuralAttr[];

  // Property declarations — each bundles name + violations
  properties: PropertyDecl[];
}

interface StructuralAttr {
  name: string;
  direction: 'syn' | 'inh' | 'collection';
  type: string;
  deps: string[];              // explicit (only ~4 of these)
  equations: EquationSet;      // functions, not data
}

interface EquationSet {
  cases?: Record<string, EquationFn>;
  default?: EquationFn;
  root?: EquationFn | { value: unknown };
  universal?: EquationFn;
  contribute?: EquationFn;
  combine?: (acc: unknown, contrib: unknown) => unknown;
}

type EquationFn = (ctx: Ctx, node?: KSNode) => unknown;

interface PropertyDecl {
  name: string;
  annotationKey: string;
  violations: ViolationRule[];
}

interface ViolationRule {
  triggerKind: string;
  predicate: (ctx: Ctx, node: KSNode) => boolean;
  message: (ctx: Ctx, node: KSNode, def: KindDefinition) => string;
}

interface CompiledAnalyzer {
  // Generated source
  evaluatorFile: GeneratedFile;

  // Metadata
  attrs: AttrDef[];
  depGraph: AttributeDepGraph;

  // Runtime
  analyze: (program: ts.Program, depth?: AnalysisDepth) => AnalysisResult;
}

function compileAnalysis(
  grammar: CompiledGrammar,   // ← grammar dependency is explicit
  spec: AnalysisSpec,
): CompiledAnalyzer;
```

### What the Functor Generates From Each PropertyDecl

Given a property declaration like:

```typescript
{
  name: 'noConsole',
  annotationKey: 'noConsole',
  violations: [
    violation({
      triggerKind: 'PropertyAccessExpression',
      predicate: (ctx, pae) => { /* ... */ },
      message: (ctx, pae, def) => `...`,
    }),
  ],
}
```

The analysis functor generates:

| Generated artifact | Source |
|-------------------|--------|
| `eq_noConsoleContext` inherited equation | Pattern: check `kindAnnotations` for `annotationKey` match |
| `eq_noConsoleContext_rootValue = null` | Always null for root |
| `consoleViolation` synthesized equation | Wraps the hand-written predicate: check context → run predicate → build diagnostic |
| `allViolations` collection entry | Adds `consoleViolation` to the collection |
| `KSCAttrMap` entries | `noConsoleContext: KindDefinition \| null`, `consoleViolation: CheckerDiagnostic \| null` |
| Dep edges | `noConsoleContext → kindAnnotations`, `consoleViolation → noConsoleContext`, `allViolations → consoleViolation` |

All of these are mechanical derivations from the property name and the property enforcement pattern. The only human-written part is the violation predicate.

### Validation at Compile Time

The functor validates kind references against the grammar:

```typescript
function compileAnalysis(grammar: CompiledGrammar, spec: AnalysisSpec): CompiledAnalyzer {
  // Validate all kind references exist in grammar
  for (const prop of spec.properties) {
    for (const rule of prop.violations) {
      if (!grammar.hasKind(rule.triggerKind)) {
        throw new Error(
          `Property '${prop.name}': violation references unknown kind '${rule.triggerKind}'`
        );
      }
    }
  }
  for (const attr of spec.structural) {
    if (attr.equations.cases) {
      for (const kind of Object.keys(attr.equations.cases)) {
        if (!grammar.hasKind(kind)) {
          throw new Error(
            `Structural attr '${attr.name}': case references unknown kind '${kind}'`
          );
        }
      }
    }
  }
  // ... generate evaluator
}
```

Grammar-analysis coupling is validated at build time, not discovered at runtime.

### Concrete Spec for KSC

```typescript
// ksc-analysis/spec.ts

import { violation } from '../ksc-compiler/violation.js';
import type { Ctx } from '../ksc-behavior/ctx.js';
import type { KSIdentifier, KSPropertyAccessExpression, /* ... */ } from '../ast-schema/generated/index.js';
import type { KindDefinition } from '../ksc-behavior/types.js';
import type { AnalysisSpec } from '../ksc-compiler/types.js';

// ── Structural equations (hand-written, explicit deps) ──

function eq_kindDefs_CompilationUnit(ctx: Ctx, counter: DefIdCounter): KindDefinition[] {
  // ... unchanged from current binder.ts
}

function eq_defEnv_root(rootCtx: Ctx): Map<string, KindDefinition> {
  // ... unchanged
}

function eq_defLookup(ctx: Ctx): (name: string) => KindDefinition | undefined {
  const env = ctx.attr('defEnv');
  return (name: string) => env.get(name);
}

function eq_kindAnnotations_VariableDeclaration(ctx: Ctx, raw: KSNode): KindDefinition[] {
  // ... unchanged
}

// ── Violation predicates (hand-written, type-safe) ──

const ASSIGNMENT_OPS = new Set([
  'EqualsToken', 'PlusEqualsToken', 'MinusEqualsToken', /* ... */
]);

const IO_MODULES = new Set([
  'fs', 'fs/promises', 'path', 'net', 'http', 'https', /* ... */
]);

const SIDE_EFFECT_KINDS = new Set([
  'CallExpression', 'AwaitExpression', 'YieldExpression',
]);

// ── The spec ──

export const KSC_ANALYSIS: AnalysisSpec = {
  structural: [
    {
      name: 'kindDefs', direction: 'syn', type: 'KindDefinition[]',
      deps: [],
      equations: {
        cases: { CompilationUnit: eq_kindDefs_CompilationUnit },
        default: () => [],
      },
    },
    {
      name: 'defEnv', direction: 'inh', type: 'Map<string, KindDefinition>',
      deps: ['kindDefs'],
      equations: { root: eq_defEnv_root },
    },
    {
      name: 'defLookup', direction: 'syn',
      type: '(name: string) => KindDefinition | undefined',
      deps: ['defEnv'],
      equations: { universal: eq_defLookup },
    },
    {
      name: 'kindAnnotations', direction: 'syn', type: 'KindDefinition[]',
      deps: ['defLookup'],
      equations: {
        cases: { VariableDeclaration: eq_kindAnnotations_VariableDeclaration },
        default: () => [],
      },
    },
  ],

  properties: [
    {
      name: 'noImports', annotationKey: 'noImports',
      violations: [
        violation({
          triggerKind: 'Identifier',
          predicate: (ctx, ident) => ident.resolvesToImport,
          message: (ctx, ident, def) =>
            `'${ident.escapedText}' is an imported binding, violating ${def.name} (noImports)`,
        }),
      ],
    },
    {
      name: 'noConsole', annotationKey: 'noConsole',
      violations: [
        violation({
          triggerKind: 'PropertyAccessExpression',
          predicate: (ctx, pae) => {
            if (pae.expression.kind !== 'Identifier') return false;
            return (pae.expression as KSIdentifier).escapedText === 'console';
          },
          message: (ctx, pae, def) =>
            `console.${(pae.name as KSIdentifier).escapedText} violates ${def.name} (noConsole)`,
        }),
      ],
    },
    {
      name: 'immutable', annotationKey: 'immutable',
      violations: [
        violation({
          triggerKind: 'VariableDeclarationList',
          predicate: (ctx, vdl) => vdl.declarationKind !== 'const',
          message: (ctx, vdl, def) =>
            `'${vdl.declarationKind}' binding violates ${def.name} (immutable)`,
        }),
      ],
    },
    {
      name: 'static', annotationKey: 'static',
      violations: [
        violation({
          triggerKind: 'CallExpression',
          predicate: (ctx, call) => (call as any).expression?.kind === 'ImportKeyword',
          message: (ctx, call, def) =>
            `dynamic import() violates ${def.name} (static)`,
        }),
      ],
    },
    {
      name: 'noSideEffects', annotationKey: 'noSideEffects',
      violations: [
        violation({
          triggerKind: 'ExpressionStatement',
          predicate: (ctx, stmt) => SIDE_EFFECT_KINDS.has(stmt.expression.kind),
          message: (ctx, stmt, def) =>
            `${stmt.expression.kind} as statement is a side effect, violating ${def.name} (noSideEffects)`,
        }),
      ],
    },
    {
      name: 'noMutation', annotationKey: 'noMutation',
      violations: [
        violation({
          triggerKind: 'BinaryExpression',
          predicate: (ctx, bin) => ASSIGNMENT_OPS.has(bin.operatorToken.kind),
          message: (ctx, bin, def) =>
            `assignment operator violates ${def.name} (noMutation)`,
        }),
        violation({
          triggerKind: 'PrefixUnaryExpression',
          predicate: (ctx, pre) => pre.operator === '++' || pre.operator === '--',
          message: (ctx, pre, def) =>
            `prefix '${pre.operator}' violates ${def.name} (noMutation)`,
        }),
        violation({
          triggerKind: 'PostfixUnaryExpression',
          predicate: (ctx, post) => post.operator === '++' || post.operator === '--',
          message: (ctx, post, def) =>
            `postfix '${post.operator}' violates ${def.name} (noMutation)`,
        }),
        violation({
          triggerKind: 'DeleteExpression',
          predicate: () => true,
          message: (ctx, node, def) =>
            `'delete' violates ${def.name} (noMutation)`,
        }),
      ],
    },
    {
      name: 'noIO', annotationKey: 'noIO',
      violations: [
        violation({
          triggerKind: 'Identifier',
          predicate: (ctx, ident) =>
            ident.resolvesToImport
            && !!ident.importModuleSpecifier
            && IO_MODULES.has(ident.importModuleSpecifier),
          message: (ctx, ident, def) =>
            `'${ident.escapedText}' from IO module '${ident.importModuleSpecifier}' violates ${def.name} (noIO)`,
        }),
      ],
    },
    {
      name: 'pure', annotationKey: 'pure',
      violations: [],  // placeholder — Phase 6 transitive analysis
    },
  ],
};
```

### Dep Graph: Fully Derived, Zero Scanning

The analysis functor builds the dep graph from spec structure:

```typescript
function buildDepGraph(spec: AnalysisSpec): DepEdge[] {
  const edges: DepEdge[] = [];

  // 1. Structural deps — explicit in spec
  for (const attr of spec.structural) {
    for (const dep of attr.deps) {
      edges.push([attr.name, dep]);
    }
  }

  // 2. Property-derived deps — mechanical
  for (const prop of spec.properties) {
    const contextAttr = `${prop.name}Context`;

    // Context depends on kindAnnotations (always)
    edges.push([contextAttr, 'kindAnnotations']);

    // Each violation depends on its context
    for (const rule of prop.violations) {
      const violationAttr = violationAttrName(prop, rule);
      edges.push([violationAttr, contextAttr]);

      // allViolations collects each violation
      edges.push(['allViolations', violationAttr]);
    }
  }

  return edges;
}
```

22 edges derived mechanically. 4 edges declared explicitly. 0 regex scanning.

### Pipeline

```typescript
// ksc-compiler/pipeline.ts

import { compileGrammar } from './compile-grammar.js';
import { compileAnalysis } from './compile-analysis.js';
import { TS_GRAMMAR } from '../ast-schema/schema.js';
import { KSC_ANALYSIS } from '../ksc-analysis/spec.js';

// Functor 1: specialize on grammar
const grammar = compileGrammar(TS_GRAMMAR);

// Functor 2: specialize on analysis (grammar is explicit input)
const analyzer = compileAnalysis(grammar, KSC_ANALYSIS);

// Build time: emit generated files
grammar.emit('./ast-schema/generated');
analyzer.emit('./ksc-generated');

// Runtime: analyze a program
export function analyze(program: ts.Program, depth?: AnalysisDepth): AnalysisResult {
  return analyzer.analyze(program, depth);
}
```

### File Structure

```
ast-schema/
  builder.ts                  (unchanged — schema DSL)
  schema.ts                   (unchanged — grammar definition)
  generated/                  (unchanged — generated output)
    kind-map.ts               (NEW — KindToNode type mapping)

ksc-analysis/                 (NEW — replaces ksc-behavior/ equation files)
  spec.ts                     (the AnalysisSpec: structural + properties)
  helpers.ts                  (shared constants: ASSIGNMENT_OPS, IO_MODULES, etc.)

ksc-behavior/
  ctx.ts                      (unchanged — Ctx interface)
  types.ts                    (unchanged — KindDefinition, CheckerDiagnostic, etc.)
  attr-types.ts               (GENERATED by analysis functor, not hand-written)

ksc-compiler/                 (NEW — the two functors)
  types.ts                    (GrammarSpec, AnalysisSpec, CompiledGrammar, etc.)
  compile-grammar.ts          (Functor 1: extracted from codegen.ts)
  compile-analysis.ts         (Functor 2: extracted from gen-ksc-evaluator.ts)
  violation.ts                (violation<K>() builder function)
  pipeline.ts                 (orchestrates both functors)

ksc-generated/
  evaluator.ts                (unchanged output — generated by Functor 2)

scripts/
  codegen.ts                  (thin wrapper: calls pipeline.compileGrammar + emit)
  gen-ksc-evaluator.ts        (thin wrapper: calls pipeline.compileAnalysis + emit)
```

### Adding a New Property (Developer Experience)

**Before (status quo) — 5 files, ~25 lines:**
1. Add to `PropertySet` in types.ts
2. Add to `PROPERTY_KEYS` in binder.ts
3. Write `eq_{prop}Context` + `eq_{prop}Context_rootValue` in checker.ts (10 lines boilerplate)
4. Write `eq_{prop}Violation_*` in checker.ts (unique predicate)
5. Add to `eq_allViolations_contribute` in checker.ts
6. Add 2 entries to `KSCAttrMap` in attr-types.ts

**After — 1 file, ~8 lines:**
1. Add a `PropertyDecl` to `KSC_ANALYSIS.properties` in spec.ts:
```typescript
{
  name: 'noEval', annotationKey: 'noEval',
  violations: [
    violation({
      triggerKind: 'CallExpression',
      predicate: (ctx, call) =>
        call.expression.kind === 'Identifier'
        && (call.expression as KSIdentifier).escapedText === 'eval',
      message: (ctx, call, def) => `eval() violates ${def.name} (noEval)`,
    }),
  ],
}
```

Everything else — context equation, root value, attr-types entry, allViolations wiring, dep edges — is generated by the functor.

### Tradeoffs

| Benefit | Cost |
|---------|------|
| Two explicit typed functors | Significant refactor of equation organization |
| Grammar dependency is a function parameter | New `ksc-compiler/` module to build |
| Full TypeScript type safety on violation nodes | Generated `KindToNode` map (~364 entries) |
| Zero regex scanning for deps | Structural equations need explicit `deps` arrays (4 total) |
| Adding a property = 1 file, ~8 lines | Spec file is a different shape than current equations |
| Properties + violations bundled as one concept | Must learn the spec format |
| Build-time validation of kind references | — |
| Pipeline testable at each stage | — |

---

## Option C: Pragmatic Hybrid

Same boilerplate elimination as Option B, but without the formal functor interface. Equations stay as named `eq_*` functions. A new generator produces the boilerplate from a property list. The dep scanner continues to work via regex on the generated equations.

### Interface

```typescript
// property-spec.ts (data — the property vocabulary)
export const PROPERTIES = [
  { name: 'noImports',     violationAttr: 'importViolation',         annotationKey: 'noImports' },
  { name: 'noConsole',     violationAttr: 'consoleViolation',        annotationKey: 'noConsole' },
  { name: 'immutable',     violationAttr: 'mutableBindingViolation', annotationKey: 'immutable' },
  // ... 8 total
] as const;

// gen-property-boilerplate.ts (new generator)
// Produces: context equations, rootValues, allViolations, attr-types entries
// Output has inline .attr() calls → dep scanner works unchanged
```

### What Changes

- New `property-spec.ts` declares the 8 properties as data
- New `gen-property-boilerplate.ts` generates context equations + collection wiring
- `checker.ts` shrinks: only violation predicates remain (hand-written)
- `attr-types.ts` partially generated
- `codegen.ts` and `gen-ksc-evaluator.ts` wrapped in typed functions (from Option A)

### What Doesn't Change

- Equations are still named `eq_*` functions discovered by regex
- Grammar-analysis coupling still via import paths
- Dep graph still built by regex scanning (but the generated equations have literal `.attr()` calls)
- No formal functor interface

### Tradeoffs

| Benefit | Cost |
|---------|------|
| Boilerplate eliminated (context eqs, rootValues, collection) | New generator to maintain |
| Dep scanner works unchanged | Grammar-analysis coupling still implicit |
| Adding a property ≈ 2 files, ~12 lines | No build-time validation of kind references |
| Smaller refactor than Option B | Properties + violations in separate files |
| Full TS type safety (same as today) | No formal functor interface |

---

## Comparison

| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| **Effort** | Small | Large | Medium |
| **Boilerplate eliminated** | None | All property boilerplate | All property boilerplate |
| **Typed functor interfaces** | Partial | Full | Partial |
| **Grammar dep explicit** | No | Yes (function parameter) | No |
| **Kind validation at build time** | No | Yes | No |
| **Type-safe violation nodes** | No | Yes (KindToNode map) | No |
| **Dep detection** | Regex (unchanged) | Derived from spec (no scanning) | Regex (unchanged) |
| **Adding a property** | 5 files, ~25 lines | 1 file, ~8 lines | 2 files, ~12 lines |
| **Equations as** | Named functions | Functions in spec object | Named functions |
| **Non-property analysis** | Add eq_* functions | Add to `structural` array | Add eq_* functions |
| **Futamura clarity** | Low | High | Moderate |

---

## Recommendation

**Option B** for a system designed around its specialization stages. The two-functor architecture makes the data flow explicit (`grammar → analysis functor → evaluator`), eliminates all property boilerplate, provides type safety on violation nodes, and derives the dep graph from spec structure without regex scanning. The cost is a significant refactor, but the result is a system where adding a new property is one declaration in one file.

**Option C** if the priority is eliminating boilerplate with minimum disruption. It solves the most painful practical problem (repetitive context equations) without changing the equation organization model. The dep scanner, import structure, and naming conventions all continue to work. The cost is that grammar-analysis coupling remains informal and kind references aren't validated.

**Option A** only if the goal is to make stages testable without any other changes. It's a stepping stone, not a destination.

---

## Appendix: Futamura Mapping

| Projection | KSC equivalent |
|------------|---------------|
| **1st**: `mix(interp, spec) → program` | `compileAnalysis(grammar, analysisSpec) → evaluator` — specializes the generic AG evaluation strategy on a specific set of equations |
| **2nd**: `mix(mix, interp) → compiler` | `compileGrammar(grammarSpec) → compiledGrammar` then `compileAnalysis(compiledGrammar, ·)` — the analysis functor itself is a compiler that takes any analysis spec and produces an evaluator |
| **3rd**: `mix(mix, mix) → cogen` | The pipeline function that takes any grammar spec + any analysis spec and produces an analyzer. Applied to KSC's own grammar + analysis spec, it produces KSC. |
| **Fixpoint** | The pipeline applied to its own structure (grammar of grammar specs + analysis of analysis specs) would reproduce the pipeline. The `for (item of spec) emit(template(item))` loop is the irreducible unit. |

## Appendix: Dep Graph Derivation

Current dep graph (26 edges) broken down by source:

| Source | Edges | Detection method in Option B |
|--------|-------|------------------------------|
| Structural: `defEnv → kindDefs` | 1 | Explicit in spec |
| Structural: `defLookup → defEnv` | 1 | Explicit in spec |
| Structural: `kindAnnotations → defLookup` | 1 | Explicit in spec |
| Structural: `kindDefs → (leaf)` | 0 | No edge needed |
| Context → kindAnnotations (x8) | 8 | Derived from property pattern |
| Violation → context (x8) | 8 | Derived from property declaration |
| allViolations → violations (x8) | 8 | Derived from property list |
| **Total** | **26** | **3 explicit + 24 derived** |
