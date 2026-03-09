# Specialization Architecture: Redesigning KSC Around Its Inputs

**Status**: Proposal — architectural analysis and options

## The Problem

KSC has three inputs that determine its behavior:

1. **Grammar** — the AST node kinds, their fields, and sum type hierarchy (schema.ts)
2. **Attributes** — the AG equations that compute analysis results (binder.ts, checker.ts)
3. **Program** — the TypeScript source files being analyzed (runtime input)

Today these are combined through two code generation scripts run as shell commands:

```
npx tsx ast-schema/codegen.ts          # grammar → generated types + converter
npx tsx scripts/gen-ksc-evaluator.ts   # attributes → generated evaluator
```

This works, but the stages are implicit — they're scripts, not typed functions. The interfaces between stages are file-system artifacts (generated `.ts` files), not programmatic values. And the grammar-attribute coupling is handled through naming conventions rather than enforced contracts.

This document proposes ways to restructure the codebase so that each specialization stage is an explicit, typed function with clear inputs and outputs — mirroring the Futamura projection structure where `mix(interpreter, static_input) → residual`.

---

## Current Architecture — What We Have

### The Three Inputs (Concrete Files)

| Input | File(s) | Format | Consumed By |
|-------|---------|--------|-------------|
| Grammar | `ast-schema/schema.ts` | Builder DSL calls (`node()`, `leaf()`, `sumType()`) | `codegen.ts` |
| Field extractors | `ast-schema/codegen.ts` (convertFieldOverrides) | Hand-written TS expressions as strings | `codegen.ts` (self) |
| Attribute equations | `ksc-behavior/binder.ts`, `checker.ts` | Named TS functions (`eq_X_Kind`) | `gen-ksc-evaluator.ts` |
| Attribute types | `ksc-behavior/attr-types.ts` | TypeScript interface (`KSCAttrMap`) | `gen-ksc-evaluator.ts` |
| Program | User's `.ts` files | TypeScript source | `ts.createProgram()` at runtime |

### The Two Specialization Steps

**Step 1: Grammar specialization** (`codegen.ts`)
- Reads: `schema.ts` (via builder registries), `convertFieldOverrides` (hard-coded)
- Produces: `generated/node-types.ts`, `generated/schema.ts`, `generated/convert.ts`, `generated/builders.ts`, `generated/serialize.ts`
- Pattern: `for (const [kind, entry] of nodes) emit(template(kind, entry))`

**Step 2: Attribute specialization** (`gen-ksc-evaluator.ts`)
- Reads: `attr-types.ts` (type map), `binder.ts` + `checker.ts` (function names + bodies via regex)
- Produces: `ksc-generated/evaluator.ts`
- Pattern: `for (const attr of ATTRS) emit(method(attr))`

### The Runtime Step

```
program.ts: buildKSTree(tsProgram, depth) → evaluate(root) → { definitions, diagnostics }
```

### Where the Coupling Lives

The attribute equations in `binder.ts`/`checker.ts` are coupled to the grammar in two ways:

1. **By name**: Function names encode grammar kinds (`eq_kindDefs_CompilationUnit`, `eq_consoleViolation_PropertyAccessExpression`)
2. **By type**: Function bodies cast to grammar-specific types (`raw as KSIdentifier`, `raw as KSBinaryExpression`) and access grammar-specific fields (`.escapedText`, `.operatorToken`, `.declarationKind`)

This coupling is inherent — you cannot describe "detect console.log usage" without knowing that the grammar has `PropertyAccessExpression` with an `expression` child and a `name` child. But the coupling is currently informal (naming conventions, manual imports) rather than enforced by an interface.

---

## Design Axes

Before presenting options, here are the independent dimensions of the design space:

### Axis 1: Separation Mechanism
How do grammar and attributes relate?

- **(a) Shared codebase, naming conventions** — status quo. Equations name grammar kinds in their function names, the generator finds them by regex.
- **(b) Attributes as data referencing grammar by string** — equations declared as records keyed by kind name, bodies are functions.
- **(c) Attributes as code against typed interfaces** — the grammar compilation produces an interface that the attribute module is written against.

### Axis 2: Specialization Mechanism
How do you go from generic to specialized?

- **(a) Code generation scripts** — status quo. Run a script, produce a file.
- **(b) Typed functions producing source strings** — same code generation, but called as functions with typed signatures rather than as scripts.
- **(c) Typed functions producing runtime values** — no code generation. Build the specialized evaluator in memory.
- **(d) Curried higher-order functions** — each specialization is a function application that returns a more-specialized function.

### Axis 3: What Gets Generated vs. What Stays as Code
Where is the human-written code vs. machine-generated code boundary?

- **(a) Only wiring is generated** — status quo. Equation bodies are hand-written; only the dispatch/caching/tree-building is generated.
- **(b) Boilerplate from spec, predicates by hand** — the repeated patterns (8 context equations, 8 root values) are generated from a property vocabulary; violation predicates remain hand-written.
- **(c) Everything from data** — all equations are expressed as data (rule tables), and all code is generated.

---

## Option 1: Typed Pipeline Functions (Minimal Structural Change)

**Axes**: Separation (a), Specialization (b), Generation (a+b)

Keep the current file structure but wrap each specialization step in a typed function. The scripts become thin wrappers around these functions.

### Interface

```typescript
// === Stage 1: Grammar Compilation ===

interface GrammarSpec {
  nodes: ReadonlyMap<string, NodeEntry>;
  sumTypes: ReadonlyMap<string, SumTypeEntry>;
  fieldExtractors: Record<string, Record<string, string>>;  // convertFieldOverrides
}

interface GrammarResidual {
  nodeTypesSource: string;     // generated/node-types.ts content
  schemaSource: string;        // generated/schema.ts content
  convertSource: string;       // generated/convert.ts content
  buildersSource: string;      // generated/builders.ts content
  serializeSource: string;     // generated/serialize.ts content
}

function compileGrammar(spec: GrammarSpec): GrammarResidual;

// === Stage 2: Evaluator Compilation ===

interface AttrSpec {
  typeMap: Map<string, string>;           // attr name → TS type
  equations: Map<string, RawExport[]>;    // attr name → exported functions
  equationSource: Map<string, string>;    // 'binder'|'checker' → full source text
}

interface EvaluatorResidual {
  evaluatorSource: string;    // ksc-generated/evaluator.ts content
  depGraph: AttributeDepGraph;
  attrs: AttrDef[];
}

function compileEvaluator(spec: AttrSpec): EvaluatorResidual;

// === Stage 3: Runtime Analysis ===

interface AnalysisResult {
  definitions: KindDefinition[];
  diagnostics: CheckerDiagnostic[];
  depGraph: AttributeDepGraph;
}

function analyze(
  program: ts.Program,
  depth: AnalysisDepth,
): AnalysisResult;
```

### File Structure Changes

```
ast-schema/
  builder.ts              (unchanged)
  schema.ts               (unchanged)
  compile-grammar.ts      (NEW — exports compileGrammar, extracted from codegen.ts)
  codegen.ts              (becomes thin script: import { compileGrammar } → write files)
  generated/              (unchanged)

ksc-behavior/
  binder.ts               (unchanged)
  checker.ts              (unchanged)
  attr-types.ts           (unchanged)

scripts/
  gen-ksc-evaluator.ts    (becomes thin script: import { compileEvaluator } → write file)

ksc-compiler/             (NEW)
  compile-evaluator.ts    (exports compileEvaluator, extracted from gen-ksc-evaluator.ts)
  compile-grammar.ts      (re-export or move from ast-schema)
  pipeline.ts             (orchestrates: compileGrammar → compileEvaluator → write all)
```

### What This Buys

- Each specialization step is a **testable pure function**: `GrammarSpec → GrammarResidual`
- You can call `compileGrammar(spec)` in a test and inspect the output without writing files
- The pipeline is explicit: `pipeline.ts` calls stage 1 then stage 2
- Type signatures document what each stage needs and produces

### What This Doesn't Change

- Attributes still reference grammar kinds by naming convention
- No runtime specialization — still generates source strings
- Grammar-attribute coupling unchanged

### Effort: Small. Extract existing code into functions, add type signatures.

---

## Option 2: Property Vocabulary Layer (Eliminate Boilerplate Equations)

**Axes**: Separation (b), Specialization (b), Generation (b)

Add a middle layer between grammar and equations: a **property vocabulary** that generates the repetitive context/rootValue/collection patterns automatically.

### The Observation

Today, 8 context equations, 8 rootValue constants, and the allViolations collection are all derived from the same list: `['noImports', 'noConsole', 'immutable', 'static', 'noSideEffects', 'noMutation', 'noIO', 'pure']`. Adding a new property requires touching 4+ files and writing ~20 lines of boilerplate.

### Interface

```typescript
// === Property Vocabulary (NEW — replaces hand-written boilerplate) ===

interface PropertyDecl {
  name: string;                    // 'noImports'
  contextAttrName: string;         // 'noImportsContext' (auto-derived)
  violationAttrName: string;       // 'importViolation' (must specify — names vary)
  annotationTrigger: string;       // 'VariableDeclaration' — where annotations are found
  annotationKey: string;           // key in PropertySet to check
}

interface PropertyVocabulary {
  properties: PropertyDecl[];
  annotationExtractor: string;     // 'kindAnnotations' — the shared syn attr
}

// Generates: context equations, rootValue constants, allViolations wiring
function generatePropertyBoilerplate(
  vocab: PropertyVocabulary,
): {
  equationSource: string;        // generated eq_*Context functions with inline .attr() calls
  attrTypeEntries: string;       // entries for KSCAttrMap
};
```

### Concrete Property Spec

```typescript
// property-spec.ts (NEW)
export const PROPERTY_VOCABULARY: PropertyVocabulary = {
  annotationExtractor: 'kindAnnotations',
  properties: [
    { name: 'noImports',     contextAttrName: 'noImportsContext',     violationAttrName: 'importViolation',         annotationTrigger: 'VariableDeclaration', annotationKey: 'noImports' },
    { name: 'noConsole',     contextAttrName: 'noConsoleContext',     violationAttrName: 'consoleViolation',        annotationTrigger: 'VariableDeclaration', annotationKey: 'noConsole' },
    { name: 'immutable',     contextAttrName: 'immutableContext',     violationAttrName: 'mutableBindingViolation', annotationTrigger: 'VariableDeclaration', annotationKey: 'immutable' },
    { name: 'static',        contextAttrName: 'staticContext',        violationAttrName: 'dynamicImportViolation',  annotationTrigger: 'VariableDeclaration', annotationKey: 'static' },
    { name: 'noSideEffects', contextAttrName: 'noSideEffectsContext', violationAttrName: 'sideEffectViolation',     annotationTrigger: 'VariableDeclaration', annotationKey: 'noSideEffects' },
    { name: 'noMutation',    contextAttrName: 'noMutationContext',    violationAttrName: 'mutationViolation',       annotationTrigger: 'VariableDeclaration', annotationKey: 'noMutation' },
    { name: 'noIO',          contextAttrName: 'noIOContext',          violationAttrName: 'ioViolation',             annotationTrigger: 'VariableDeclaration', annotationKey: 'noIO' },
    { name: 'pure',          contextAttrName: 'pureContext',          violationAttrName: 'purityViolation',         annotationTrigger: 'VariableDeclaration', annotationKey: 'pure' },
  ],
};
```

### What Gets Generated vs. Hand-Written

| Component | Source | Count |
|-----------|--------|-------|
| Context equations (`eq_{prop}Context`) | **Generated** from property spec | 8 |
| Root value constants (`eq_{prop}Context_rootValue`) | **Generated** | 8 |
| `allViolations` contribute/combine | **Generated** — iterates violation attrs | 1 |
| `KSCAttrMap` context+violation entries | **Generated** | 16 |
| Violation equations (`eq_{prop}Violation_*`) | **Hand-written** — unique predicates | 12 |
| Binder equations | **Hand-written** — domain-specific | 4 |
| `kindAnnotations` | **Hand-written** | 2 |

### The Dependency Scanner Problem — Solved

The generated context equations contain **literal `.attr()` calls** in their bodies because the generator writes them out explicitly:

```typescript
// Generated by gen-property-boilerplate.ts:
export function eq_noImportsContext(parentCtx: Ctx): KindDefinition | null | undefined {
  if ((parentCtx.node as any).kind === 'VariableDeclaration') {
    const kinds = parentCtx.attr('kindAnnotations');  // ← visible to dep scanner
    const match = kinds.find((k: KindDefinition) => (k.properties as any)['noImports']);
    if (match) return match;
  }
  return undefined;
}
```

This preserves `gen-ksc-evaluator.ts`'s regex-based dependency detection while eliminating 8 copies of identical code from the hand-written source.

### Pipeline

```
property-spec.ts ──→ gen-property-boilerplate.ts ──→ ksc-behavior/generated-equations.ts
                                                          │
schema.ts ──→ codegen.ts ──→ generated/*                  │
                                                          ▼
                              ksc-behavior/binder.ts + checker.ts (hand-written violations)
                                                          │
                              attr-types.ts ◄─────────────┘ (partially generated)
                                                          │
                                                          ▼
                              gen-ksc-evaluator.ts ──→ evaluator.ts
```

### Effort: Medium. New generator script, refactor checker.ts to remove boilerplate, update attr-types.ts.

---

## Option 3: Curried Specialization with Explicit Residuals

**Axes**: Separation (c), Specialization (d), Generation (a)

Model the entire system as a curried function that progressively specializes on each input. Each call returns a typed **residual** — the partially-applied result.

### Core Abstraction

```typescript
// The fully generic system, expressed as a curried type:
//
//   KSC = Grammar → Attributes → Program → Results
//
// Each arrow is a specialization step.
// Each intermediate value is a residual that captures
// the work done so far.

// ─── Stage 0: The Compiler Factory ───

interface CompilerFactory {
  /** Specialize on a grammar. Returns a grammar-aware compiler. */
  withGrammar(grammar: GrammarSpec): GrammarBoundCompiler;
}

// ─── Stage 1 Residual: Grammar is fixed ───

interface GrammarBoundCompiler {
  /** The compiled grammar — types, converter, child fields. */
  readonly grammar: CompiledGrammar;

  /** Specialize on an attribute set. Returns a ready-to-run analyzer. */
  withAttributes(attrs: AttributeSpec): BoundAnalyzer;

  /** Generate grammar source files to disk. */
  emitGrammar(outDir: string): void;
}

interface CompiledGrammar {
  readonly nodes: ReadonlyMap<string, NodeEntry>;
  readonly sumTypes: ReadonlyMap<string, SumTypeEntry>;
  readonly childFields: (kind: string) => readonly string[];
  readonly convert: (tsProgram: ts.Program, depth: AnalysisDepth) => KSTree;
}

// ─── Stage 2 Residual: Grammar + Attributes are fixed ───

interface BoundAnalyzer {
  /** The compiled evaluator. */
  readonly evaluator: CompiledEvaluator;

  /** Run analysis on a program. */
  analyze(program: ts.Program, depth?: AnalysisDepth): AnalysisResult;

  /** Generate evaluator source to disk. */
  emitEvaluator(outDir: string): void;
}

interface CompiledEvaluator {
  readonly attrs: AttrDef[];
  readonly depGraph: AttributeDepGraph;
  readonly evaluate: (root: KSNode) => EvaluationResult;
}

// ─── Stage 3 Result: Everything is fixed ───

interface AnalysisResult {
  readonly definitions: KindDefinition[];
  readonly diagnostics: CheckerDiagnostic[];
  readonly depGraph: AttributeDepGraph;
  readonly tree: KSTree;
}
```

### Usage

```typescript
import { createCompilerFactory } from './ksc-compiler/factory.js';
import { TS_GRAMMAR } from './ast-schema/schema.js';
import { KIND_ATTRIBUTES } from './ksc-behavior/spec.js';

// Build time — specialize on grammar
const factory = createCompilerFactory();
const tsCompiler = factory.withGrammar(TS_GRAMMAR);
tsCompiler.emitGrammar('./ast-schema/generated');

// Build time — specialize on attributes
const kindAnalyzer = tsCompiler.withAttributes(KIND_ATTRIBUTES);
kindAnalyzer.emitEvaluator('./ksc-generated');

// Runtime — analyze a program
const results = kindAnalyzer.analyze(myProgram, 'check');
```

### Attribute Spec Format

The `AttributeSpec` is where the grammar-attribute coupling becomes explicit:

```typescript
interface AttributeSpec {
  /** Attribute declarations — what exists. */
  attrs: AttrDeclaration[];

  /** Equation functions — organized by attribute. */
  equations: Map<string, EquationSet>;

  /** Projections — how to extract final results from the root. */
  projections: ProjectionDecl[];
}

interface AttrDeclaration {
  name: string;
  type: string;          // TypeScript type as string
  direction: 'syn' | 'inh' | 'collection';
}

interface EquationSet {
  /** Per-kind production equations. Keys are grammar kind names. */
  cases?: Record<string, EquationFn>;
  /** Default equation (when no case matches). */
  default?: EquationFn;
  /** Root equation (for inh attrs). */
  root?: EquationFn | { value: unknown };
  /** Parent equation (for inh attrs — runs in parent's context). */
  parent?: EquationFn;
  /** Collection functions. */
  contribute?: EquationFn;
  combine?: (acc: any, contrib: any) => any;
}

type EquationFn = (ctx: Ctx, raw?: KSNode) => unknown;
```

### Concrete Attribute Spec (What It Would Look Like)

```typescript
// ksc-behavior/spec.ts
export const KIND_ATTRIBUTES: AttributeSpec = {
  attrs: [
    { name: 'kindDefs', type: 'KindDefinition[]', direction: 'syn' },
    { name: 'defEnv', type: 'Map<string, KindDefinition>', direction: 'inh' },
    { name: 'noImportsContext', type: 'KindDefinition | null', direction: 'inh' },
    { name: 'importViolation', type: 'CheckerDiagnostic | null', direction: 'syn' },
    // ... all 22 attrs
  ],

  equations: new Map([
    ['kindDefs', {
      cases: { CompilationUnit: eq_kindDefs_CompilationUnit },
      default: eq_kindDefs_default,
    }],
    ['defEnv', {
      root: eq_defEnv_root,
    }],
    ['noImportsContext', {
      root: { value: null },
      parent: eq_noImportsContext,
    }],
    ['importViolation', {
      cases: { Identifier: eq_importViolation_Identifier },
      default: eq_importViolation_default,
    }],
    // ...
  ]),

  projections: [
    { name: 'definitions', fn: project_binder },
    { name: 'diagnostics', fn: project_checker },
  ],
};
```

### What This Buys

- **Typed interfaces at every boundary**: `GrammarSpec → GrammarBoundCompiler → BoundAnalyzer → AnalysisResult`
- **Testable at each level**: Can test grammar compilation independently from attribute compilation
- **Grammar-attribute coupling is visible**: The `AttributeSpec` references grammar kinds in `cases` keys — this is explicit, not discovered by regex
- **Supports multiple attribute sets against the same grammar**: `tsCompiler.withAttributes(kindAttrs)` vs `tsCompiler.withAttributes(otherAttrs)`
- **Mirrors Futamura projections**: Each `.with*()` call is a partial application / specialization step
- **Both build-time and runtime paths**: `.emit*()` for code generation, `.analyze()` for in-memory execution

### What This Changes

- `gen-ksc-evaluator.ts` would read the `AttributeSpec` object instead of scanning source files
- Dependency graph derived from the `equations` Map structure (which attrs reference which) rather than regex on function bodies
- The evaluator generator needs a new way to discover deps — either the spec explicitly declares them, or the generator calls each equation with a recording proxy

### The Dependency Detection Problem

Currently `gen-ksc-evaluator.ts` finds deps by regex: `/\.attr\(['"](\w+)['"]\)/g`. With equations as function values in a spec object, the generator can't read their source.

**Three solutions:**

1. **Explicit deps in spec**: Each equation declares its dependencies.
   ```typescript
   ['importViolation', {
     deps: ['noImportsContext'],  // ← explicit
     cases: { Identifier: eq_importViolation_Identifier },
   }]
   ```

2. **Recording proxy**: At compile time, call each equation with a `Ctx` proxy that records `.attr()` calls.
   ```typescript
   function detectDeps(fn: EquationFn): string[] {
     const recorded: string[] = [];
     const proxy = new Proxy({}, {
       get(_, prop) {
         if (prop === 'attr') return (name: string) => { recorded.push(name); return null; };
         // ...
       }
     });
     try { fn(proxy as Ctx); } catch {}
     return recorded;
   }
   ```

3. **Source reading (hybrid)**: Keep the source-reading approach but point it at the spec file instead of individual equation files.

### Effort: Large. New compiler factory, attribute spec format, evaluator generator rewrite.

---

## Option 4: Three-Input Functor (Maximum Formal Purity)

**Axes**: Separation (c), Specialization (d), Generation (b+c)

Express the system as a composition of three functors, where each functor transforms a spec into a component, and the components compose.

### Core Types

```typescript
// ─── The three input specs ───

/** Grammar: what nodes exist, what fields they have. */
interface GrammarSpec {
  nodes: NodeDecl[];
  sumTypes: SumTypeDecl[];
  fieldExtractors: FieldExtractorDecl[];
}

/** Properties: what behavioral properties exist, how they're annotated. */
interface PropertySpec {
  vocabulary: string[];           // ['noImports', 'noConsole', ...]
  annotationKind: string;         // 'VariableDeclaration'
  annotationAttr: string;         // 'kindAnnotations'
}

/** Rules: how violations are detected (the genuinely unique logic). */
interface RuleSpec {
  binder: BinderRule[];
  violations: ViolationRule[];
}

interface ViolationRule {
  property: string;               // which property this rule enforces
  triggerKinds: string[];         // grammar kinds where this rule fires
  predicate: (ctx: Ctx, node: KSNode) => boolean;
  messageTemplate: (ctx: Ctx, node: KSNode, kindDef: KindDefinition) => string;
}

// ─── The three functors ───

type GrammarFunctor   = (g: GrammarSpec) => CompiledGrammar;
type PropertyFunctor  = (g: CompiledGrammar, p: PropertySpec) => CompiledProperties;
type RuleFunctor      = (props: CompiledProperties, r: RuleSpec) => CompiledAnalyzer;

// ─── The residuals ───

interface CompiledGrammar {
  nodeTypes: GeneratedSource;
  childFields: GeneratedSource;
  converter: GeneratedSource;
  runtime: {
    getChildFields: (kind: string) => string[];
    convert: (prog: ts.Program, depth: AnalysisDepth) => KSTree;
  };
}

interface CompiledProperties {
  grammar: CompiledGrammar;
  /** Generated: context equations, rootValues, allViolations collection. */
  generatedEquations: GeneratedSource;
  /** Generated: attr-types entries for context + violation attrs. */
  generatedAttrTypes: GeneratedSource;
  /** The property vocabulary for downstream use. */
  properties: PropertyDecl[];
}

interface CompiledAnalyzer {
  properties: CompiledProperties;
  /** Generated: full evaluator.ts with all equations wired. */
  evaluator: GeneratedSource;
  /** Runtime: analyze a program. */
  analyze: (program: ts.Program, depth?: AnalysisDepth) => AnalysisResult;
}

interface GeneratedSource {
  content: string;
  emit(path: string): void;
}
```

### The Composition

```typescript
// compile.ts — the full pipeline as function composition
export function compile(
  grammar: GrammarSpec,
  properties: PropertySpec,
  rules: RuleSpec,
): CompiledAnalyzer {
  const g = compileGrammar(grammar);
  const p = compileProperties(g, properties);
  const a = compileRules(p, rules);
  return a;
}

// Or, curried for partial application:
export const ksc =
  (grammar: GrammarSpec) =>
  (properties: PropertySpec) =>
  (rules: RuleSpec) =>
  compile(grammar, properties, rules);

// Specialization:
const tsGrammar  = ksc(TS_GRAMMAR);                    // fix grammar
const tsKind     = tsGrammar(KIND_PROPERTIES);          // fix property vocabulary
const tsAnalyzer = tsKind(KIND_RULES);                  // fix violation rules
const results    = tsAnalyzer.analyze(myProgram);       // run
```

### What the Three Specs Look Like for KSC

```typescript
// ── 1. Grammar (already exists as schema.ts, just repackaged) ──

const TS_GRAMMAR: GrammarSpec = {
  nodes: [
    { kind: 'Identifier', fields: { escapedText: prop('string'), /* ... 18 sym flags ... */ }},
    { kind: 'VariableDeclaration', fields: { name: child('Identifier'), type: optChild('TypeNode'), initializer: optChild('Expression') }},
    // ... 360 nodes
  ],
  sumTypes: [
    { name: 'Expression', members: ['Identifier', 'CallExpression', /* ... */] },
    // ...
  ],
  fieldExtractors: [
    { kind: 'Identifier', field: 'resolvesToImport', expr: 'isImportReference(node)' },
    { kind: 'Identifier', field: 'symIsVariable', expr: 'hasSymFlag(node, ts.SymbolFlags.Variable)' },
    // ...
  ],
};

// ── 2. Properties (NEW — replaces the repeated pattern in checker.ts) ──

const KIND_PROPERTIES: PropertySpec = {
  vocabulary: ['noImports', 'noConsole', 'immutable', 'static', 'noSideEffects', 'noMutation', 'noIO', 'pure'],
  annotationKind: 'VariableDeclaration',
  annotationAttr: 'kindAnnotations',
};

// ── 3. Rules (the genuinely unique logic, extracted from checker.ts) ──

const KIND_RULES: RuleSpec = {
  binder: [
    {
      attr: 'kindDefs',
      direction: 'syn',
      cases: { CompilationUnit: eq_kindDefs_CompilationUnit },
      default: () => [],
    },
    { attr: 'defEnv', direction: 'inh', root: eq_defEnv_root },
    { attr: 'defLookup', direction: 'syn', universal: eq_defLookup },
    { attr: 'kindAnnotations', direction: 'syn',
      cases: { VariableDeclaration: eq_kindAnnotations_VariableDeclaration },
      default: () => [] },
  ],
  violations: [
    {
      property: 'noImports',
      triggerKinds: ['Identifier'],
      predicate: (ctx, node) => (node as KSIdentifier).resolvesToImport,
      messageTemplate: (ctx, node, def) =>
        `'${(node as KSIdentifier).escapedText}' is an imported binding, violating ${def.name} (noImports)`,
    },
    {
      property: 'noConsole',
      triggerKinds: ['PropertyAccessExpression'],
      predicate: (ctx, node) => {
        const pae = node as KSPropertyAccessExpression;
        return pae.expression.kind === 'Identifier'
            && (pae.expression as KSIdentifier).escapedText === 'console';
      },
      messageTemplate: (ctx, node, def) =>
        `'console.${((node as KSPropertyAccessExpression).name as KSIdentifier).escapedText}' violates ${def.name} (noConsole)`,
    },
    // ... remaining violation rules
  ],
};
```

### What This Buys Over Option 3

- **Three separate specs instead of one mixed bag**: Grammar, Properties, and Rules are distinct concerns with distinct change frequencies
- **Properties are pure data**: Adding a new property is adding one string to `vocabulary` — context equations, rootValues, allViolations wiring all generated automatically
- **Violation rules are declarative**: `{ property, triggerKinds, predicate, messageTemplate }` rather than naming-convention-encoded functions
- **Each functor is independently testable**: `compileGrammar` doesn't know about properties; `compileProperties` doesn't know about specific violation logic
- **Formal currying**: Each specialization step is a function application that closes over one more input

### What This Costs

- **Major refactor**: Every equation in binder.ts/checker.ts gets restructured into spec objects
- **Loss of TypeScript type checking in predicates**: The predicates are `(ctx, node) => boolean` functions stored in a data structure — TypeScript can't verify that `node as KSIdentifier` is valid for `triggerKinds: ['Identifier']`
- **Dependency detection**: Still needs either explicit deps, recording proxy, or source analysis — the predicates are opaque function values
- **Complexity**: Three layers of abstraction for a system that currently works with two scripts

### Effort: Large. Full restructuring of equation organization.

---

## Option 5: Hybrid — Typed Pipeline + Property Generation (Recommended)

**Axes**: Separation (a→b partial), Specialization (b), Generation (b)

Combines Options 1 and 2: wrap specialization steps in typed functions AND generate boilerplate from property vocabulary. Keep hand-written equations for unique logic.

### Design Principle

> **Generate what's mechanical. Hand-write what's semantic. Type-check the boundary.**

### Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  INPUTS (human-written)                                              │
│                                                                      │
│  schema.ts          property-spec.ts        checker-rules.ts         │
│  (grammar DSL)      (property vocab)        (violation predicates)   │
│                                                                      │
│  binder.ts                                                           │
│  (kind definition extraction)                                        │
└──────────┬──────────────┬──────────────────────┬─────────────────────┘
           │              │                      │
           ▼              ▼                      │
┌─────────────────┐ ┌───────────────────────┐    │
│ compileGrammar() │ │ compileProperties()   │    │
│                  │ │                       │    │
│ GrammarSpec      │ │ PropertyVocabulary    │    │
│ → GrammarResidual│ │ → context eqs        │    │
│   (5 files)      │ │   rootValues          │    │
│                  │ │   attrType entries    │    │
│                  │ │   allViolations       │    │
└────────┬─────────┘ └──────────┬────────────┘    │
         │                      │                 │
         │    ┌─────────────────┘                 │
         │    │                                   │
         ▼    ▼                                   ▼
      ┌──────────────────────────────────────────────┐
      │ compileEvaluator()                            │
      │                                               │
      │ AttrSpec (merged: generated + hand-written)   │
      │ → EvaluatorResidual (evaluator.ts)            │
      └──────────────────────┬────────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ analyze()         │
                    │                   │
                    │ ts.Program        │
                    │ → AnalysisResult  │
                    └──────────────────┘
```

### Concrete Interfaces

```typescript
// === ksc-compiler/types.ts ===

/** Output of a code generation step. */
interface GeneratedFile {
  path: string;
  content: string;
}

/** Stage 1: Grammar → types + converter */
interface GrammarCompilation {
  files: GeneratedFile[];
  summary: { nodeCount: number; sumTypeCount: number; fieldCount: number };
}
function compileGrammar(spec: GrammarSpec): GrammarCompilation;

/** Stage 1.5: Properties → boilerplate equations */
interface PropertyCompilation {
  /** Generated equation functions (with inline .attr() calls). */
  equationSource: string;
  /** Generated attr-types entries. */
  attrTypeEntries: { name: string; type: string }[];
  /** Generated allViolations wiring. */
  collectionSource: string;
}
function compileProperties(vocab: PropertyVocabulary): PropertyCompilation;

/** Stage 2: Equations → evaluator */
interface EvaluatorCompilation {
  file: GeneratedFile;
  attrs: AttrDef[];
  depGraph: AttributeDepGraph;
}
function compileEvaluator(spec: AttrSpec): EvaluatorCompilation;

/** Full pipeline */
interface PipelineResult {
  grammar: GrammarCompilation;
  properties: PropertyCompilation;
  evaluator: EvaluatorCompilation;
}
function compilePipeline(opts: {
  grammar: GrammarSpec;
  properties: PropertyVocabulary;
  equations: AttrSpec;
}): PipelineResult;
```

### What Changes from Status Quo

1. **New file: `ksc-behavior/property-spec.ts`** — declares the 8 properties as data
2. **New file: `ksc-compiler/compile-properties.ts`** — generates context equations, rootValues, allViolations
3. **New file: `ksc-compiler/compile-grammar.ts`** — extracted from `codegen.ts`, returns `GrammarCompilation`
4. **New file: `ksc-compiler/compile-evaluator.ts`** — extracted from `gen-ksc-evaluator.ts`, returns `EvaluatorCompilation`
5. **New file: `ksc-compiler/pipeline.ts`** — orchestrates all stages
6. **Modified: `checker.ts`** — remove 8 context equations + 8 rootValue constants + allViolations. Keep only violation predicates + kindAnnotations.
7. **Modified: `attr-types.ts`** — context + violation type entries generated, not hand-written
8. **Build scripts become thin**: `codegen.ts` and `gen-ksc-evaluator.ts` become 5-line wrappers that call pipeline functions and write files

### Adding a New Property (Developer Experience)

Before (status quo — 5 files, ~25 lines):
1. Add to `PropertySet` in types.ts
2. Add to `PROPERTY_KEYS` in binder.ts
3. Write `eq_{prop}Context` + `eq_{prop}Context_rootValue` in checker.ts (10 lines of boilerplate)
4. Write `eq_{prop}Violation_*` in checker.ts (unique logic)
5. Add to `allViolations_contribute` in checker.ts
6. Add 2 entries to `KSCAttrMap` in attr-types.ts

After (Option 5 — 2 files, ~10 lines):
1. Add property name to `PROPERTY_VOCABULARY` in property-spec.ts
2. Write `eq_{prop}Violation_*` in checker.ts (unique logic only)

Everything else is generated.

### Effort: Medium. New compiler module with 3 extraction functions + property generator. Checker.ts shrinks significantly.

---

## Comparison Matrix

| Criterion | Option 1 | Option 2 | Option 3 | Option 4 | Option 5 |
|-----------|----------|----------|----------|----------|----------|
| **Effort** | Small | Medium | Large | Large | Medium |
| **Boilerplate eliminated** | None | Context eqs | All | All | Context eqs |
| **Typed stage interfaces** | Yes | Partial | Yes | Yes | Yes |
| **Testable stages** | Yes | Partial | Yes | Yes | Yes |
| **Formal currying** | No | No | Yes | Yes | No |
| **Multi-grammar support** | No | No | Yes | Yes | No |
| **Multi-property-set support** | No | Yes | Yes | Yes | Yes |
| **Preserves TS type safety** | Yes | Yes | Partial | Partial | Yes |
| **Preserves dep scanner** | Yes | Yes | Needs rework | Needs rework | Yes |
| **Futamura clarity** | Moderate | Moderate | High | Highest | Moderate |
| **Practical value** | Low | High | Moderate | Low | High |

---

## Recommendation

**Option 5 (Hybrid)** gives the best ratio of practical improvement to effort:

- **Typed pipeline functions** make each specialization step explicit and testable — without changing the code generation approach that already works
- **Property generation** eliminates the most painful repetition (context boilerplate) — while keeping the unique violation predicates as hand-written TypeScript with full type safety
- **No dependency scanner changes** — generated equations contain literal `.attr()` calls, so `gen-ksc-evaluator.ts` continues to work as-is
- **Clear path to Option 3/4 later** — if multi-grammar support becomes needed, the typed interfaces from Option 5 provide the foundation

Option 3 or 4 would be the right choice if KSC needed to support multiple source languages (not just TypeScript) or multiple property vocabularies with different annotation mechanisms. But for a single-grammar, single-vocabulary system, the formal purity adds complexity without corresponding practical benefit.

---

## Appendix: Mapping to Futamura Projections

For reference, here is how each option maps to the projection framework:

| Projection | Meaning | Option 1 | Option 5 |
|------------|---------|----------|----------|
| 1st | `mix(interp, spec) → program` | `compileEvaluator(attrSpec) → evaluator.ts` | Same, plus `compileProperties(vocab) → equations` |
| 2nd | `mix(mix, interp) → compiler` | Not addressed | `compilePipeline()` — the pipeline function itself |
| 3rd | `mix(mix, mix) → cogen` | Not addressed | The pipeline is already the cogen (it takes any grammar + vocab + rules → analyzer) |
| Fixpoint | `mix(mix, mix)` reproduces itself | The pipeline applied to its own spec would reproduce the pipeline | Same |

The curried form in Option 3/4 makes each projection explicit as a function call. Options 1/5 keep the projections implicit but practically equivalent — each `compile*()` function IS a mix application, just not spelled as currying.
