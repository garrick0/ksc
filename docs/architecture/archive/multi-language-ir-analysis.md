# Generic IR vs Language-Specific ASTs: Trade-offs for Multi-Language Analysis

A research analysis of how multi-language analysis tools handle the tension between
generic intermediate representations and language-specific fidelity, with implications
for KindScript's multi-language strategy.

---

## Table of Contents

1. [The Core Tension](#1-the-core-tension)
2. [How Major Tools Handle It](#2-how-major-tools-handle-it)
3. [Can Both Work Together?](#3-can-both-work-together)
4. [The Richness Loss Problem](#4-the-richness-loss-problem)
5. [The Property Evaluation Problem](#5-the-property-evaluation-problem)
6. [Patterns and Best Practices](#6-patterns-and-best-practices)
7. [What This Means for KindScript](#7-what-this-means-for-kindscript)
8. [Sources and Further Reading](#8-sources-and-further-reading)

---

## 1. The Core Tension

Every multi-language analysis tool faces the same fundamental question: do you force all
languages into a single shared representation, or do you keep language-specific representations
and share the analysis logic some other way?

The trade-off is well-quantified. YASA (Ant Group, 2025) classified AST nodes across four
languages and found that **65% of constructs can be expressed universally** while **35% must
remain language-specific** to avoid semantic loss. They achieved 77.3% code reuse across
languages, but each new language still required 16-27% additional language-specific effort.

A 2024 survey paper (Zhang et al., "Unveiling the Power of Intermediate Representations for
Static Analysis") identifies three strategies:

1. **Low-abstraction IR** (LLVM IR, Jimple): Limited vocabulary, loses high-level semantics.
   Works for low-level properties (null deref, resource leaks) but not structural enforcement.

2. **Expanded vocabulary IR** (HHIR, SIL): Incorporates language-specific features into the IR
   vocabulary. Avoids semantic loss but causes "IR vocabulary inflation, rendering the IR
   itself incomprehensible."

3. **Dual-level IR** (SAIL): Maintains both a high-level language-specific representation and
   a low-level generic one with bidirectional mappings. Analyzes on the generic level, reports
   errors using the language-specific level.

**Key paper**: Zhang et al., [Unveiling the Power of IRs for Static Analysis](https://arxiv.org/abs/2405.12841), 2024.

---

## 2. How Major Tools Handle It

### Semgrep: Generic AST (`AST_generic`)

Semgrep converts all languages into a single `AST_generic` representation. Tree-sitter
parses source into a language-specific CST, then a per-language mapper translates it to the
generic AST. The matching engine and analysis operate entirely on the generic form.

**What works**: Pattern matching across 30+ languages from a single engine. As Yoann
Padioleau described, improvements to matching on the generic AST automatically benefit all
languages.

**Where it breaks down**: The Pro Engine team discovered that real vulnerability detection
required language-specific understanding. Benchmarking on Java revealed that practical
accuracy improvements came from understanding inheritance and framework-specific patterns
(Spring, Servlets), not from deeper generic computation. Their accuracy went from 10% to
56% through targeted language-specific enhancements. Interfile analysis supports only 8
languages vs 30+ for basic matching.

The generic AST uses catch-all categories (`OtherExpr`, `OtherStmt`) for constructs that
don't map cleanly. The team tries to extend the generic AST "sparingly" since it's "already
very rich."

**Sources**:
- [Semgrep: a static analysis journey](https://semgrep.dev/blog/2021/semgrep-a-static-analysis-journey/)
- [The birth of Semgrep Pro Engine](https://semgrep.dev/blog/2023/the-birth-of-semgrep-pro-engine/)
- [Tips for converting CST to AST](https://semgrep.dev/docs/contributing/cst-to-ast-tips)
- [semgrep-core contributing](https://semgrep.dev/docs/contributing/semgrep-core-contributing)

### CodeQL: Language-Specific Frontends, Shared Query Language

CodeQL takes the opposite approach. Each language has a dedicated extractor producing TRAP
files (Tuples Representing Abstract Properties) imported into a relational database with a
**language-specific schema**. The unification happens at the query language level (QL), not
the AST level.

The shared dataflow algorithm lives in `DataFlowImplCommon.qll`. Each language implements
a `DataFlowPrivate` module satisfying a required interface:

```
// The "contract" each language must fulfill
class Node { ... }
predicate simpleLocalFlowStep(Node n1, Node n2)
predicate viableCallable(DataFlowCall c)
predicate storeStep(Node n1, Content c, Node n2)
predicate readStep(Node n1, Content c, Node n2)
```

A `DataFlowImplConsistency.qll` file contains consistency checks verifying that
language-specific parts satisfy invariants expected by the shared implementation.

**Result**: Deeper analysis with fewer false positives, at the cost of higher per-language
engineering effort. Each language needs its own database schema, extractor, and dataflow
adapter.

**Sources**:
- [About CodeQL](https://codeql.github.com/docs/codeql-overview/about-codeql/)
- [CodeQL dataflow documentation](https://github.com/github/codeql/blob/main/docs/ql-libraries/dataflow/dataflow.md)
- [CodeQL Academic Publications](https://codeql.github.com/publications/)

### Facebook Infer: Common IR (SIL) + Language-Specific Frontends

Infer translates all languages to SIL (Smallfoot Intermediate Language), a common IR based
on control flow graphs. Checkers operate on SIL, so a single checker works across all
supported languages.

**Multi-language checkers** (on SIL): Pulse (memory/value analysis), Cost (complexity),
Liveness, Loop Hoisting, Purity, Topl (temporal properties).

**Language-specific checkers**: Annotation Reachability (Java), Fragment Retains View
(Java/Android), Self in Block (Objective-C), SIOF (C++).

InferSharp extended this to .NET by translating CIL to SIL via a language-agnostic JSON
serialization, supporting all .NET languages (C#, F#, VB) through a single frontend.

**Sources**:
- [All Infer checkers](https://fbinfer.com/docs/all-checkers/)
- [Building checkers with Infer.AI](https://fbinfer.com/docs/absint-framework/)
- [Scaling Static Analyses at Facebook (CACM)](https://cacm.acm.org/research/scaling-static-analyses-at-facebook/)

### JetBrains IntelliJ: Dual PSI + UAST (A Cautionary Tale)

IntelliJ maintains both language-specific PSI trees and a universal UAST for JVM languages.
UAST enables cross-language inspections, but the documentation reveals significant problems:

- **Performance**: "UAST is not a zero-cost abstraction: some methods could be unexpectedly
  expensive for some languages."
- **Incomplete coverage**: Groovy supports declarations only; method bodies not supported.
  Kotlin-specific features like expression annotations produce `UnknownKotlinExpression`.
- **Tree structure mismatch**: "No ancestor-descendant relation preserving is guaranteed."
- **Read-only**: Modification classes "currently not recommended for external usage."
- **Official recommendation**: "We encourage using `PsiMethod`, `PsiClass` as common
  interfaces... and discourage exposing the UAST interfaces in the API."

Even within a **single language family** (JVM languages that are structurally very similar),
the universal AST has significant costs. JetBrains recommends treating it as an internal
implementation detail, not a primary interface.

**Source**: [UAST -- IntelliJ Platform Plugin SDK](https://plugins.jetbrains.com/docs/intellij/uast.html)

### GraalVM/Truffle: No Shared AST At All

Truffle uses language-specific self-modifying AST nodes with shared compilation
infrastructure. Cross-language interop uses a standardized **message protocol** (not a
shared AST): `hasArrayElements()`, `readArrayElement()`, `fitsInInt()`, etc.

The foundational paper "One VM to Rule Them All" (Wurthinger et al., 2013): developers
"just focus on creating a parser and AST interpreter" while shared infrastructure handles
compilation. "At no point was the dynamic compiler modified to understand the semantics of
the guest language."

This demonstrates that **shared infrastructure does not require a shared AST**. The right
abstraction can be a protocol that languages implement according to their own semantics.

**Sources**:
- [GraalVM Polyglot Programming](https://www.graalvm.org/latest/reference-manual/polyglot-programming/)
- [Truffle Language Implementation Framework](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/)
- [One VM to Rule Them All (Morning Paper)](https://blog.acolyer.org/2014/11/18/one-vm-to-rule-them-all/)

### GitHub Semantic: The Failed Universal AST (Archived 2025)

GitHub's Semantic project (Haskell) attempted multi-language analysis using "data types a
la carte" -- composable, shared syntax types across languages. It failed for several
reasons:

1. Writing two separate hand-coded grammars per language was error-prone and tedious
2. Assignment code was tightly coupled to tree-sitter grammars and broke silently at runtime
3. The a la carte datatypes were "essentially untyped" and couldn't express
   context-specific constraints
4. Each new language required substantial manual effort

They pivoted to auto-generating strongly-typed, **per-language** AST types from tree-sitter's
`node-types.json` schema, prioritizing "compile-time safety over runtime flexibility." The
project was ultimately archived in April 2025, superseded by tree-sitter (for parsing) and
stack-graphs (for code navigation).

**Lesson**: The universal AST abstraction was too ambitious. Per-language types generated
from a schema turned out to be more practical than hand-crafted shared abstractions.

**Sources**:
- [GitHub Semantic repository (archived)](https://github.com/github/semantic)
- [CodeGen: Semantic's improved language support system](https://github.blog/engineering/architecture-optimization/codegen-semantics-improved-language-support-system/)

### Joern/CPG: Language-Independent Graph + Escape Hatches

The Code Property Graph merges ASTs, CFGs, and PDGs into a single graph with a
language-independent base schema. Language-specific constructs that don't fit are handled
through:

- An `UNKNOWN` node type with `PARSER_TYPE_NAME` preserving original terminology
- `CANONICAL_NAME` fields for language-specific canonicalization (e.g., C union aliasing)
- Schema extensions via plugins for adding new node types and properties
- `OVERLAYS` property tracking which semantic enrichments have been applied

Each language frontend extends `X2CPG`, a base framework with common structures. The same
query language works across all supported languages, trading language-specific richness for
cross-language queryability.

**Sources**:
- [Joern CPG Documentation](https://docs.joern.io/code-property-graph/)
- [CPG Specification](https://cpg.joern.io/)
- [Joern GitHub](https://github.com/joernio/joern)

### ast-grep vs Semgrep: Two Philosophies

ast-grep works directly on tree-sitter CSTs without converting to a generic AST. This
preserves full language fidelity but means patterns are inherently language-specific.
Semgrep converts to a generic AST, enabling cross-language rules but losing some precision.
Comby goes further, using fully language-agnostic patterns, gaining maximum generality but
being "not aware of the syntax and semantics" at all.

**Source**: [ast-grep: Comparison With Other Frameworks](https://ast-grep.github.io/advanced/tool-comparison.html)

---

## 3. Can Both Work Together?

Yes, and the most successful tools do exactly this. There are several proven composition
patterns:

### Pattern A: MLIR Dialect Coexistence (Gold Standard)

MLIR's core innovation is **dialects** -- domain-specific operations, types, and attributes
in isolated namespaces, all on shared infrastructure. Operations from different dialects can
coexist in the same IR at any time. A single function can contain high-level structured ops
alongside low-level LLVM ops during partial lowering. This is not an accident -- MLIR
explicitly supports mixing abstraction levels.

The key insight: "Op semantics declare and transport information that is traditionally
obtained by compiler analyses. This information is not lost by lowering prematurely."

**Sources**:
- [MLIR Rationale](https://mlir.llvm.org/docs/Rationale/Rationale/)
- Lattner et al., [MLIR: A Compiler Infrastructure for the End of Moore's Law](https://arxiv.org/abs/2002.11054), 2020

### Pattern B: Generic Algorithm + Language Adapter Interface (CodeQL)

Define a shared analysis algorithm parameterized over a language-specific interface. The
algorithm says "I need you to tell me about local flow steps, call resolution, and field
access" and each language provides those answers in its own way. The shared code never needs
to know *how* the language resolves a call -- just *that* it can.

This is the most compositionally sound approach and directly applicable to KindScript.

### Pattern C: Generic IR + Metadata Annotations (LLVM)

LLVM IR is generic, but frontends attach language-specific metadata (TBAA type hierarchies,
debug info, custom annotations). Language-specific optimization passes query this metadata;
generic passes ignore metadata they don't understand. This is safe by design -- the rule
is that programs must remain correct even if all metadata is silently dropped.

The Quala project (Cornell) extends this further, preserving frontend type qualifiers as
persistent metadata through the entire compilation pipeline.

**Sources**:
- [Extensible Metadata in LLVM IR](https://blog.llvm.org/2010/04/extensible-metadata-in-llvm-ir.html)
- [Quala: Custom Type Systems on LLVM IR](https://www.cs.cornell.edu/~asampson/blog/quala-codegen.html)

### Pattern D: Layered Pipeline (Generic parsing + Language-specific resolution)

GitHub's current approach: tree-sitter handles parsing generically (uniform API, all
languages), while stack-graphs handle name resolution in a language-aware declarative DSL
operating on the tree-sitter parse trees. The two compose: generic structure, language-aware
semantics.

### Pattern E: SonarQube's Pragmatic Split

SonarQube uses SLANG (a common AST) for languages where simple syntax-based rules suffice
(Ruby, Kotlin, Scala), but builds dedicated full-featured analyzers for languages needing
deep analysis (Java, Python, JavaScript). This openly acknowledges that not all languages
need the same depth of analysis.

**Source**: [SonarSource/slang](https://github.com/SonarSource/slang)

### The Recurring Lesson

Across all these systems: **the most successful approaches do not try to make one
representation serve all purposes.** Instead, they provide generic infrastructure with
well-defined extension points (MLIR dialects, LLVM metadata, CPG overlays, CodeQL adapter
interfaces) that allow language-specific information to be layered on without corrupting the
shared core.

---

## 4. The Richness Loss Problem

### How Significant Is It?

It depends entirely on what you're analyzing.

**For structural/syntactic analysis** (pattern matching, code metrics, simple linting):
richness loss is minimal. The 80/20 principle applies -- a generic AST handles the 80% of
constructs that matter. Semgrep demonstrates this convincingly across 30+ languages.

**For semantic analysis** (type-aware checks, dataflow, taint analysis): richness loss is
significant. Semgrep's Pro Engine supports deep analysis for only 8 of 30+ languages, and
even then had to add language-specific understanding of frameworks and inheritance to
achieve acceptable accuracy.

**For language-specific property enforcement** (the KindScript use case): richness loss is
the core problem. Properties like "immutable" or "pure" depend on language-specific type
system features that a generic AST typically cannot represent.

### What Gets Lost in Practice

The JetBrains UAST experience provides concrete examples of richness loss even among
closely-related JVM languages:

- Kotlin expression annotations → `UnknownKotlinExpression`
- Groovy method bodies → not supported at all
- Array access types in Kotlin → cannot be determined
- Ancestor-descendant tree relationships → not preserved

Semgrep's `OtherExpr` / `OtherStmt` catch-alls represent constructs where the tool
explicitly says "I know this exists but I can't reason about it generically."

### The 80/20 Principle

A blog post titled "The Semantic Impedance Mismatch" argues that languages share
"irreducible semantic concepts that all general-purpose languages must have: Data,
Computation, Control flow, Scope, Effects." For the remaining language-specific constructs
(Rust ownership, Haskell lazy evaluation, C++ multiple inheritance), the recommendation is
marking them with explicit failure markers rather than silent corruption. The conclusion:
"The impedance mismatch isn't eliminated. But it's made explicit, queryable, and
manageable."

YASA's empirical data supports this: 65% universal, 35% language-specific. That 35% cannot
be wished away.

**Source**: [The Semantic Impedance Mismatch](https://datom.world/blog/semantic-impedance-mismatch.blog)

---

## 5. The Property Evaluation Problem

This is the question: if "immutable" means completely different things in Rust vs Python vs
TypeScript, can you evaluate properties generically on an IR at all?

### The Problem Is Real

Consider what "immutable" means across languages:

| Language   | Immutability mechanism             | Enforcement level          |
|------------|-------------------------------------|---------------------------|
| Rust       | Ownership + borrow checker         | Compile-time, guaranteed  |
| TypeScript | `readonly` keyword                 | Structural, erased at runtime |
| Python     | `frozen=True` on dataclasses       | Convention, bypassable    |
| Go         | No immutability keywords           | None                      |
| Haskell    | Everything immutable by default    | Type system, guaranteed   |

A property checker that treats all of these as equivalent "immutable = true" would be
meaningless. Rust's guarantee is fundamentally different from Python's convention.

The same applies to purity (Haskell enforces via IO monad; most languages have no
enforcement), memory safety (Rust guarantees it; C doesn't), and side effect tracking.

### But the IR Is Still Useful

Here's the critical insight: **you don't need to analyze properties the same way across
languages for a shared IR to be valuable.** The IR gives you a shared structure to walk.
The property evaluation logic can be parameterized per language.

This is exactly what the most successful tools do:

**Infer's model**: Checkers operate on the SIL IR, but some checkers are language-specific.
The Purity checker works generically (it checks for writes and calls to impure functions),
but the Annotation Reachability checker is Java-only. Both operate on SIL. The IR is shared;
the analysis logic is selectively shared.

**CodeQL's model**: The dataflow algorithm is shared, but each language implements its own
`DataFlowPrivate` adapter. The algorithm doesn't know or care how Python resolves method
calls vs how Java does -- it just asks "what are the flow steps?" and gets
language-appropriate answers.

**LiSA's model**: The LiSA framework (Library for Static Analysis) allows language-specific
CFG node instances with customized semantics. The analysis engine operates generically on
the CFG structure, but individual nodes can have different behaviors depending on the source
language. "Semantics, execution model, and memory model are not directly encoded within the
components themselves" -- they are parameterized.

**Source**: [LiSA: A Generic Framework for Multilanguage Static Analysis](https://link.springer.com/chapter/10.1007/978-981-19-9601-6_2)

### For KindScript Specifically

KindScript's properties (noImports, noConsole, noMutation, noIO, noSideEffects, immutable,
pure) fall into two categories:

**Structurally detectable properties** (most of them): `noImports` is "does this file
contain import statements?" -- that's a tree-walking question that works identically on any
IR that represents imports. `noConsole` is "does this code call console.log (or print() in
Python, or fmt.Println in Go)?" -- you need a language-specific list of what counts as
"console output" but the detection pattern (find calls to specific targets) is generic.

**Semantically deep properties** (fewer): `immutable` and `pure` depend on what the
language guarantees. A "pure" function in Haskell is guaranteed by the type system. A "pure"
function in JavaScript means "we checked that it doesn't call any known-impure functions and
doesn't write to any non-local variables" -- a best-effort analysis. The detection
*mechanism* (walk the tree, check for writes and impure calls) is generic; the *confidence
level* of the result and the *definition* of what constitutes a violation are
language-specific.

### The Right Architecture

The answer is not "give up on generic IR" -- it's **generic IR + language-specific property
evaluators connected via a well-defined interface**:

```
interface PropertyEvaluator<Lang> {
  // Which AST patterns count as "console output" in this language?
  consoleOutputPatterns(): CallPattern[]

  // Which constructs indicate mutation in this language?
  mutationPatterns(): MutationPattern[]

  // What level of immutability guarantee does this language provide?
  immutabilityModel(): 'guaranteed' | 'structural' | 'convention' | 'none'

  // Language-specific import resolution
  resolveImport(node: ImportNode): ResolvedImport
}
```

The checker walks the generic IR. When it encounters a node that requires language-specific
interpretation, it delegates to the evaluator. The tree structure is shared; the semantic
interpretation is pluggable.

This is exactly what CodeQL does with `DataFlowPrivate`, what Infer does with
language-specific frontends + shared checkers, and what MLIR does with dialects. It's the
established pattern.

---

## 6. Patterns and Best Practices

Based on the research, here are the proven architectural patterns ranked by applicability
to KindScript's use case:

### 1. Shared Algorithm + Language Adapter Interface (Recommended)

**Used by**: CodeQL, LiSA

Define the analysis algorithm once, parameterized over a language-specific interface.
Each language provides an implementation of that interface. The algorithm never knows which
language it's analyzing -- it just asks questions through the interface.

**Pros**: Maximum analysis depth, clean separation, type-safe contracts, consistency checks
possible. **Cons**: Higher per-language effort than a generic AST approach.

### 2. Generic IR + Language-Specific Metadata/Annotations

**Used by**: LLVM (metadata), Joern/CPG (UNKNOWN nodes + schema extensions), Quala (type
qualifier metadata)

Use a slim generic IR for the tree structure, but attach language-specific metadata that
specialized analysis passes can query. Generic passes ignore metadata they don't understand.

**Pros**: Single tree representation, graceful degradation, extensible. **Cons**: Metadata
can become a dumping ground; no type safety on metadata access.

### 3. Generic AST with Catch-All Escape Hatches

**Used by**: Semgrep (`OtherExpr`/`OtherStmt`), YASA (language-specific node category)

Define a union AST covering common constructs, with explicit "Other" variants for anything
that doesn't fit. Accept that some nodes are opaque to generic analysis.

**Pros**: Fastest path to multi-language support, rules benefit all languages. **Cons**:
35% of constructs end up in catch-alls; deep analysis requires layering language-specific
logic on top anyway.

### 4. Multi-Level IR (Progressive Lowering)

**Used by**: MLIR (dialects), GCC (GENERIC → GIMPLE), SAIL (dual-level)

Maintain multiple representation levels. Analyze at the appropriate level for each property.
Report errors using the highest-level representation for user comprehension.

**Pros**: No information loss, each analysis uses the right abstraction. **Cons**: Complex
infrastructure, multiple representations to maintain.

### 5. Pragmatic Split: Generic for Simple, Dedicated for Complex

**Used by**: SonarQube (SLANG + dedicated analyzers)

Use a generic AST for languages where simple structural rules suffice. Build dedicated
analyzers for languages needing deep analysis. Openly acknowledge that different languages
need different levels of support.

**Pros**: Honest about what's possible, avoids over-engineering. **Cons**: Inconsistent
depth across languages, code duplication.

---

## 7. What This Means for KindScript

### The Core Question Restated

KindScript defines behavioral properties (kinds) and checks them. To go multi-language,
we need to answer: what's the right split between generic and language-specific?

### Recommendation: Pattern 1 + Pattern 3

Combine a **generic IR with escape hatches** (for tree walking) with a **language adapter
interface** (for property evaluation). Specifically:

**Layer 1 -- Generic IR (tree structure)**:
A slim generic AST (~15-20 node types) as described in the interactive document. This is
what the checker walks. Import nodes, function definitions, call expressions, assignments --
these exist in every language and can be represented generically. Language-specific
constructs that don't fit go in an `Other` node with language and type tags.

**Layer 2 -- Language Adapter (property semantics)**:
Each language provides an adapter implementing a `LanguageSemantics` interface. This tells
the checker how to interpret what it finds in the IR:

- What counts as "console output" in this language?
- What constitutes "mutation"?
- What are the import patterns and how do they resolve?
- What guarantees does this language provide about immutability?

**Layer 3 -- Kind definitions and checking (shared)**:
The kind system, kind definitions, property algebra, and checking logic are entirely generic.
They operate on the IR using the language adapter. `Kind<{ noImports: true }>` means the
same thing conceptually in every language; the adapter tells the checker how to detect
violations.

### Why Not Just Language-Specific Everything?

Because KindScript's value proposition is the **kind abstraction** itself -- defining
behavioral contracts declaratively and checking them. That abstraction is inherently
language-agnostic. "This module must not have side effects" is meaningful in any language.
The generic IR captures enough structure for the checker to walk, and the language adapter
provides the semantic context needed to evaluate properties correctly.

The 65/35 split from YASA's research aligns well with this: most of what KindScript needs
to check (imports, calls, assignments, function structure) falls in the 65% that's universal.
The 35% that's language-specific (what constitutes mutation in Rust vs Python, what
"readonly" means in TypeScript vs Go) is handled by the adapter.

### What Would Be Wasted Effort

Building a full language-specific AST per language (the CodeQL path) would be overkill for
KindScript. CodeQL needs deep dataflow and taint analysis -- KindScript needs to walk a tree
and check structural properties. The slim generic IR + adapter approach matches the actual
analysis depth KindScript requires.

Similarly, trying to represent every language construct in the generic IR (the vocabulary
inflation problem) would create complexity without value. If a Rust lifetime annotation
appears in an `Other` node, that's fine -- KindScript doesn't need to understand lifetimes
to check `noImports`.

---

## 8. Sources and Further Reading

### Primary Research Papers

- Zhang et al., [Unveiling the Power of IRs for Static Analysis: A Survey](https://arxiv.org/abs/2405.12841), 2024 -- Comprehensive survey of IR approaches
- YASA Team, [Scalable Multi-Language Taint Analysis on the Unified AST at Ant Group](https://arxiv.org/html/2601.17390), 2025 -- The 65/35 split quantification
- Lattner et al., [MLIR: A Compiler Infrastructure for the End of Moore's Law](https://arxiv.org/abs/2002.11054), 2020 -- Dialect-based multi-level IR
- Dillig et al., [SAIL: Static Analysis Intermediate Language](https://www.cs.utexas.edu/~isil/sail.pdf) -- Dual-level IR with bidirectional mappings
- Negrini et al., [LiSA: A Generic Framework for Multilanguage Static Analysis](https://link.springer.com/chapter/10.1007/978-981-19-9601-6_2), 2023 -- Parameterized CFG nodes
- Distefano et al., [Scaling Static Analyses at Facebook](https://cacm.acm.org/research/scaling-static-analyses-at-facebook/), CACM 2019 -- Infer at scale
- Wurthinger et al., [One VM to Rule Them All](https://dl.acm.org/doi/10.1145/2509578.2509581), Onward! 2013 -- Truffle/GraalVM design
- Teixeira & Bispo, [Multi-language static code analysis on the LARA framework](https://dl.acm.org/doi/10.1145/3460946.3464317), SOAP 2021
- Grichi et al., [Static Code Analysis of Multilanguage Software Systems](https://arxiv.org/abs/1906.00815), 2019
- GAST paper, [A Generic AST Representation for Language-Independent Source Code Analysis](https://www.researchgate.net/publication/374247652), 2023

### Tool Documentation and Architecture

- [Semgrep: a static analysis journey](https://semgrep.dev/blog/2021/semgrep-a-static-analysis-journey/)
- [The birth of Semgrep Pro Engine](https://semgrep.dev/blog/2023/the-birth-of-semgrep-pro-engine/)
- [Semgrep: Adding a language](https://semgrep.dev/docs/contributing/adding-a-language)
- [Semgrep: CST to AST tips](https://semgrep.dev/docs/contributing/cst-to-ast-tips)
- [CodeQL: About CodeQL](https://codeql.github.com/docs/codeql-overview/about-codeql/)
- [CodeQL shared dataflow docs](https://github.com/github/codeql/blob/main/docs/ql-libraries/dataflow/dataflow.md)
- [Infer: All checkers](https://fbinfer.com/docs/all-checkers/)
- [Infer: Building checkers with Infer.AI](https://fbinfer.com/docs/absint-framework/)
- [UAST -- IntelliJ Platform Plugin SDK](https://plugins.jetbrains.com/docs/intellij/uast.html)
- [GraalVM Polyglot Programming](https://www.graalvm.org/latest/reference-manual/polyglot-programming/)
- [Truffle Language Implementation Framework](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/)
- [Joern CPG Documentation](https://docs.joern.io/code-property-graph/)
- [ast-grep: Comparison With Other Frameworks](https://ast-grep.github.io/advanced/tool-comparison.html)
- [SonarSource/slang](https://github.com/SonarSource/slang)
- [LiSA GitHub](https://github.com/lisa-analyzer/lisa)
- [YASA Engine GitHub](https://github.com/antgroup/YASA-Engine)

### Architecture Deep Dives

- [MLIR Rationale](https://mlir.llvm.org/docs/Rationale/Rationale/)
- [GCC Internals: GIMPLE](https://gcc.gnu.org/onlinedocs/gccint/GIMPLE.html)
- [Extensible Metadata in LLVM IR](https://blog.llvm.org/2010/04/extensible-metadata-in-llvm-ir.html)
- [Quala: Custom Type Systems on LLVM IR](https://www.cs.cornell.edu/~asampson/blog/quala-codegen.html)
- [Roslyn Syntax Analysis](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/get-started/syntax-analysis)
- [GitHub Semantic (archived)](https://github.com/github/semantic)
- [CodeGen: Semantic's improved language support](https://github.blog/engineering/architecture-optimization/codegen-semantics-improved-language-support-system/)
- [Stack Graphs (GitHub)](https://github.blog/open-source/introducing-stack-graphs/)

### Community Discussions and Comparisons

- [The Semantic Impedance Mismatch](https://datom.world/blog/semantic-impedance-mismatch.blog) -- 80/20 principle for universal ASTs
- [Comparing Semgrep and CodeQL (Doyensec)](https://blog.doyensec.com/2022/10/06/semgrep-codeql.html)
- [Comparing Rule Syntax: CodeQL and Semgrep (Spaceraccoon)](https://spaceraccoon.dev/comparing-rule-syntax-codeql-semgrep/)
- [Tree-Sitter, LLVM, and the future of language tooling](https://www.tzvipm.dev/posts/tree-sitter-llvm-and-the-future-of-language-tooling)
- [A Deeper Look at Modern SAST Tools](https://goingbeyondgrep.com/posts/a-deeper-look-at-modern-sast-tools/)
- [AL: A new declarative language for detecting bugs with Infer](https://engineering.fb.com/2017/05/24/developer-tools/al-a-new-declarative-language-for-detecting-bugs-with-infer/)
- [LLVM meets Code Property Graphs](https://blog.llvm.org/posts/2021-02-23-llvm-meets-code-property-graphs/)
