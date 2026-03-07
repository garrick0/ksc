# Attribute Declaration: Prior Art and Options for KSC

How attribute grammar systems declare attributes — direction, production dispatch, root values — and what KSC can learn from them.

## The Problem

KSC's codegen script (`scripts/gen-ksc-evaluator.ts`) has a hand-maintained `ATTRS` array that declares every attribute's direction, production cases, root value shape, and extra arguments. When adding a new attribute, you must update three places:

1. `ksc-behavior/attr-types.ts` — the TypeScript type
2. `ksc-behavior/binder.ts` or `checker.ts` — the equation functions
3. `scripts/gen-ksc-evaluator.ts` — the ATTRS config entry

The codegen already infers **types** (from attr-types.ts) and **dependencies** (from `ctx.attr()` calls in equation source). The question is whether the remaining metadata — direction, cases, rootFn, hasParentEq, extraArgs — can also be derived automatically.

---

## How Other Systems Handle This

### 1. Silver (University of Minnesota)

**Approach: Explicit keyword declaration, separate from equations.**

Silver uses a three-layer structure:

```silver
-- Layer 1: Attribute declaration (direction + type)
synthesized attribute pp :: String;
inherited attribute env :: Env;
synthesized attribute errors :: [Message] with ++;   -- collection

-- Layer 2: Occurs-on (which nonterminals have this attribute)
attribute pp occurs on Expr, Stmt;

-- Layer 3: Equations inside productions
abstract production add
sum::Expr ::= l::Expr r::Expr
{
  sum.pp = l.pp ++ " + " ++ r.pp;
  l.env = sum.env;        -- parent provides inherited attr to child
}
```

Key properties:
- **Direction is always explicit** — `synthesized` or `inherited` keyword
- **Production cases are implicit** — the system discovers which productions have equations by scanning production bodies
- **Root values** — no special syntax; the root is decorated with `decorate expr with { env = emptyEnv() }`
- **Collection attributes** — declared with `with ++` (the combine operator), contributions use `<-` operator, base value uses `:=`
- **Boilerplate reduction** — `propagate env on Expr, Stmt` auto-generates copy equations for inherited attributes across all productions

**What KSC can learn:** Silver requires explicit direction but infers production cases from equation placement. This is the inverse of KSC's current situation (KSC could infer direction from naming but currently declares cases explicitly).

### 2. JastAdd (Lund University)

**Approach: Keyword-prefixed declarations in aspect files, equations separated by node class.**

```java
// Declaration: direction keyword + type + owner class
syn Type Exp.actualType();
inh Type Exp.expectedType();
coll LinkedList<Problem> CompilationUnit.problems() [new LinkedList<>()] with add;

// Equations — synthesized: on the owning class or subclass
eq LogicalExp.actualType() = Type.boolean();
eq IdUse.actualType() = decl().getType();

// Equations — inherited: on the PARENT class, specifying which child
eq WhileStmt.getExp().expectedType() = Type.boolean();
eq Program.getChild().isDest() = false;   // broadcast to all children

// Collection contributions — on ANY node class
PostfixExpr contributes
    error("cannot apply ++ to final variable")
    when getOperand().varDecl().isFinal()
    to CompilationUnit.problems();
```

Key properties:
- **Direction is always explicit** — `syn`, `inh`, `coll` keywords
- **Production cases** — JastAdd uses Java's class hierarchy; equations on subclasses override the parent's default
- **Root/default values** — inherited attributes use `getChild()` broadcasting from the root production; no dedicated syntax
- **Collection** — fully declarative with `contributes ... to ...` syntax
- **Code generation** — JastAdd generates Java source with lazy cache fields, `Define_` methods for inherited attrs, and survey/collect methods for collections

**What KSC can learn:** JastAdd's `eq ParentClass.getChild().attrName()` pattern is a clean way to express "this parent provides this inherited attribute to its children." The `contributes ... to ...` syntax for collections is more explicit than KSC's contribute/combine naming convention.

### 3. Kiama (Scala, UNSW)

**Approach: No declarations at all — everything inferred from equation bodies.**

```scala
// Synthesized: equation reads from children
val locmin: Tree => Int = attr {
    case Fork(l, r) => (locmin(l)) min (locmin(r))
    case Leaf(v)    => v
}

// Inherited: equation reads from parent
val globmin: Tree => Int = attr {
    case tree.parent(p) => globmin(p)
    case t              => locmin(t)    // root case (no parent)
}

// Circular: uses different factory method
val in: Stm => Set[Var] = circular(Set[Var]())(
    s => uses(s) ++ (out(s) -- defines(s))
)
```

Key properties:
- **Direction is never declared** — inferred from whether the equation calls `tree.parent()` (inherited) or destructures children (synthesized)
- **Production cases** — Scala pattern matching; each `case` clause is an equation for that production
- **Root value** — just the catch-all `case` in an inherited attribute's pattern match
- **Collection** — no dedicated mechanism; handled via `chain()` decorator or manual aggregation
- **No code generation** — pure runtime embedding with memoization

**What KSC can learn:** Kiama proves that direction can be fully inferred from the equation body. Its `attr {}` factory with pattern matching is the most minimal declaration possible. The tradeoff is less explicit metadata and no static validation of completeness.

### 4. Eli/LIDO (Classical AG)

**Approach: Explicit direction declarations on symbols, equations on grammar rules.**

```
-- Attribute declaration with explicit direction
ATTR code: PTGNode SYNT;
ATTR preType, postType: DefTableKey;

-- Equation on a specific grammar rule
RULE p: Stmt ::= 'while' Expr 'do' Stmt
COMPUTE
  Expr.postType = boolType;
END;

-- Symbol-level computation (applies to all productions of this symbol)
SYMBOL Expr
COMPUTE
  SYNT.coercion = coerce(THIS.preType, THIS.postType);
END;

-- Collection via CONSTITUENTS
SYMBOL Block
COMPUTE
  SYNT.count = CONSTITUENTS Usage.Count
    SHIELD Block
    WITH (int, ADD, IDENTICAL, ZERO);
END;
```

Key properties:
- **Direction is explicit** — `SYNT` / `INH` keywords
- **Two levels of equations** — RULE-level (specific production) and SYMBOL-level (all productions), with RULE overriding SYMBOL
- **Collection** — `CONSTITUENTS ... WITH (type, combine, single, zero)` — fully explicit combine/zero specification
- **Code generation** — generates C code with statically scheduled evaluation order

**What KSC can learn:** Eli's two-level system (symbol-level defaults overridden by rule-level specifics) maps well to KSC's `eq_X_default()` / `eq_X_SpecificKind()` pattern.

### 5. Modern TypeScript/Rust Codegen Patterns

**Rust derive macros:** Source structure IS the metadata. A struct's fields define serialization behavior. Overrides use `#[serde(rename = "...")]` attributes. Key principle: **infer the common case, annotate the exception.**

**Next.js file routing:** File names and directory structure encode routing metadata. `app/users/[id]/page.tsx` → route `/users/:id`. No config file. Convention-breaking requires explicit config.

**Prisma:** A small schema file is the single source of truth. Running `prisma generate` produces a fully typed client. The schema is simpler than code — it's a DSL designed for human authoring.

**tRPC:** TypeScript's type inference itself is the "convention." No codegen step at all — types flow through the type system. Only works within a single TypeScript project.

**Key principle across all these systems:** The best systems have **zero configuration for the common case** and a **lightweight override mechanism for edge cases**.

---

## How KSC Currently Works

### Equation naming conventions (already established)

| Pattern | Meaning | Example |
|---------|---------|---------|
| `eq_X_Kind` | syn equation for attribute X on node kind Kind | `eq_kindDefs_CompilationUnit` |
| `eq_X_default` | syn default (fallback for unlisted kinds) | `eq_kindDefs_default` |
| `eq_X_root` | inh root value computed by function | `eq_defEnv_root` |
| `eq_X_rootValue` | inh root value as exported constant | `eq_fileImports_rootValue` |
| `eq_X` (no suffix, for inh) | inh parent equation (may override propagation) | `eq_fileImports`, `eq_noImportsContext` |
| `eq_X_contribute` | collection contribution function | `eq_allViolations_contribute` |
| `eq_X_combine` | collection combine function | `eq_allViolations_combine` |
| `eq_X` (no suffix, for syn) | universal syn equation (all node kinds) | `eq_defLookup`, `eq_enclosingLocals` |

### What the codegen already infers

- **Types** — parsed from `KSCAttrMap` interface in attr-types.ts
- **Dependencies** — parsed from `ctx.attr('...')` calls in equation source
- **Parameter counts** — parsed from function signatures

### What the ATTRS array declares manually (6 fields per attribute)

| Field | Values | Inferable from naming? |
|-------|--------|----------------------|
| `name` | attribute name | Yes — the X in `eq_X_*` |
| `spec` | `'binder'` or `'checker'` | Yes — which file contains the functions |
| `direction` | `'syn'`, `'inh'`, `'collection'` | Yes — see rules below |
| `cases` | `['CompilationUnit']`, etc. | Yes — suffixes that aren't reserved |
| `rootFn` | boolean (inh only) | Yes — `_root` vs `_rootValue` |
| `hasParentEq` | boolean (inh only) | Yes — presence of bare `eq_X` |
| `extraArgs` | `{ Kind: ['this._counter'] }` | **No** — cannot be inferred |

---

## Options for KSC

### Option A: Full Convention Inference

Scan exported functions from binder.ts and checker.ts. Derive everything from naming:

**Direction inference rules:**
- Has `eq_X_contribute` + `eq_X_combine` → **collection**
- Has `eq_X_root` or `eq_X_rootValue` → **inh**
- Otherwise → **syn**

**Case inference rules:**
- Collect all suffixes of `eq_X_*` functions
- Remove reserved suffixes: `default`, `root`, `rootValue`, `contribute`, `combine`
- Remaining suffixes = production cases (e.g., `CompilationUnit`, `Identifier`)
- No remaining suffixes + no `_default` = universal equation

**Inh sub-properties:**
- `eq_X_root` exists → `rootFn: true`
- `eq_X_rootValue` exists → `rootFn: false`
- bare `eq_X` exists (not a reserved pattern, not a universal syn) → `hasParentEq: true`

**The one exception:** `extraArgs` for `kindDefs` (the `DefIdCounter` parameter). This requires an override mechanism.

**Override via JSDoc:**
```typescript
/** @extraArg this._counter */
export function eq_kindDefs_CompilationUnit(ctx: Ctx, counter: DefIdCounter): KindDefinition[] {
```

| Pros | Cons |
|------|------|
| Eliminates the ATTRS array entirely | Direction inference is implicit — a new developer must learn the naming rules |
| Adding an attribute = add type + write functions (2 places, not 3) | Reserved suffix list is a hidden convention |
| Matches what Silver/Kiama do (infer from equation structure) | Edge cases (extraArgs) need a different mechanism |
| Zero config for 11 of 12 attributes | Naming mistakes silently produce wrong metadata |

### Option B: JSDoc Tags on Equations

Keep equations as-is but add structured JSDoc tags for direction:

```typescript
/** @direction syn @cases CompilationUnit */
export function eq_kindDefs_CompilationUnit(ctx: Ctx, counter: DefIdCounter): KindDefinition[] {

/** @direction inh @rootFn */
export function eq_defEnv_root(rootCtx: Ctx): Map<string, KindDefinition> {

/** @direction collection */
export function eq_allViolations_contribute(ctx: Ctx): CheckerDiagnostic[] {
```

| Pros | Cons |
|------|------|
| Metadata is co-located with the code (like JastAdd's `syn`/`inh` keywords) | Verbose — every equation function needs a tag |
| Explicit — no inference rules to learn | Redundant with naming conventions that already encode the same info |
| Easy to validate (codegen can warn on missing/conflicting tags) | JSDoc tags are untyped strings — no IDE validation |
| Handles extraArgs naturally (`@extraArg this._counter`) | More annotation than Silver or JastAdd (which use language-level keywords) |

### Option C: Declarative Config File

A small `ksc-behavior/attrs.json` or `attrs.ts`:

```typescript
// ksc-behavior/attrs.ts
export const ATTR_DECLS = [
  { name: 'kindDefs',    direction: 'syn',        cases: ['CompilationUnit'], extraArgs: { CompilationUnit: ['this._counter'] } },
  { name: 'defEnv',      direction: 'inh',        rootFn: true },
  { name: 'defLookup',   direction: 'syn' },
  { name: 'allViolations', direction: 'collection' },
  // ...
] as const;
```

| Pros | Cons |
|------|------|
| Single source of truth for attribute metadata | Still a separate file to maintain (3 places → still 3, just relocated) |
| Type-safe if using TypeScript | Doesn't leverage the information already in the naming conventions |
| Easy to read — all attributes visible at a glance | Adds a file that's purely config, no behavior |
| Matches Prisma's "small schema" philosophy | Direction + cases are redundant with the function names |

### Option D: Hybrid — Infer from Naming, Override via JSDoc (Recommended)

Use Option A's inference as the baseline. Only require JSDoc for things that can't be inferred.

**What gets inferred (all 12 attributes):**
- Direction: from contribute/combine (collection), root/rootValue (inh), or neither (syn)
- Cases: from non-reserved suffixes
- rootFn/hasParentEq: from root vs rootValue, presence of bare `eq_X`
- Spec ownership: from which file the functions are in

**What needs a JSDoc override (1 attribute currently):**
```typescript
/** @extraArg this._counter */
export function eq_kindDefs_CompilationUnit(ctx: Ctx, counter: DefIdCounter): KindDefinition[] {
```

**Validation:** The codegen prints a summary of inferred metadata and warns on:
- Attributes in attr-types.ts with no matching equation functions
- Equation functions that don't match any attribute in attr-types.ts
- Ambiguous direction inference (e.g., has both `_root` and `_contribute`)

| Pros | Cons |
|------|------|
| Zero config for common cases (like Kiama, Next.js) | Naming conventions are load-bearing — a typo changes behavior |
| Override mechanism for edge cases (like Rust's `#[serde(...)]`) | Must document the naming rules |
| Adding an attribute = add type + write functions (2 places) | Inference rules add complexity to the codegen script |
| Codegen validates consistency | JSDoc parsing is a second extraction mechanism alongside naming |
| No new files | |

---

## Comparison Matrix

| System | Direction | Cases/Productions | Root Value | Collection | Override Mechanism |
|--------|-----------|-------------------|------------|------------|-------------------|
| **Silver** | Explicit keyword | Inferred from production bodies | Manual decoration | `with` operator + `<-` contributions | Aspect productions |
| **JastAdd** | Explicit keyword (`syn`/`inh`/`coll`) | Java class hierarchy | `getChild()` broadcasting | `contributes ... to ...` | Refine keyword |
| **Kiama** | Inferred from equation body | Scala pattern matching | Catch-all case clause | Manual / `chain()` | N/A (pure embedding) |
| **Eli/LIDO** | Explicit keyword (`SYNT`/`INH`) | RULE vs SYMBOL level | Symbol-level default | `CONSTITUENTS ... WITH ...` | RULE overrides SYMBOL |
| **KSC (current)** | Hand-written in ATTRS array | Hand-written in ATTRS array | Hand-written in ATTRS array | Hand-written in ATTRS array | N/A (edit the array) |
| **KSC Option A** | Inferred from naming | Inferred from naming | Inferred from naming | Inferred from naming | Not supported (except extraArgs) |
| **KSC Option B** | JSDoc tags | JSDoc tags | JSDoc tags | JSDoc tags | JSDoc tags |
| **KSC Option C** | Config file | Config file | Config file | Config file | Config file |
| **KSC Option D** | Inferred from naming | Inferred from naming | Inferred from naming | Inferred from naming | JSDoc for edge cases |

---

## How Each System Compares on "Places to Update When Adding an Attribute"

| System | Steps to add a new attribute |
|--------|------------------------------|
| **Silver** | 1. Declare attribute (direction + type). 2. Add `occurs on` declaration. 3. Write equations in productions. |
| **JastAdd** | 1. Declare attribute (direction + type + owner class) in aspect. 2. Write equations in same or other aspects. |
| **Kiama** | 1. Write equation function (that's it — direction is inferred). |
| **KSC (current)** | 1. Add type to attr-types.ts. 2. Write equation functions. 3. Add ATTRS entry in codegen script. 4. Regenerate. |
| **KSC Option D** | 1. Add type to attr-types.ts. 2. Write equation functions (following naming conventions). 3. Regenerate. |

Option D brings KSC to parity with Silver and JastAdd (2-3 steps) and close to Kiama (which has no codegen step at all).

---

## Sources

- [Silver — MELT Group, University of Minnesota](https://melt.cs.umn.edu/silver/)
- [Silver Attribute Declarations Reference](https://melt.cs.umn.edu/silver/ref/decl/attributes/)
- [Silver Automatic Attributes](https://melt.cs.umn.edu/silver/concepts/automatic-attributes/)
- [JastAdd Reference Manual](https://jastadd.cs.lth.se/web/documentation/reference-manual.php)
- [ExtendJ Technical Design](https://extendj.org/technical_design.html)
- [Kiama GitHub Repository](https://github.com/inkytonik/kiama)
- [Kiama Attribution Documentation](https://inkytonik.github.io/kiama/Attribution)
- [A Pure Object-Oriented Embedding of Attribute Grammars (Sloane, Kats, Visser)](https://eelcovisser.org/publications/2010/SloaneKV10.pdf)
- [Eli/LIDO Reference — Attributes](http://eli-project.sourceforge.net/elionline/lidoref_6.html)
- [Spoofax Statix Reference](https://spoofax.dev/references/statix/)
- [Serde Attributes](https://serde.rs/attributes.html)
- [Next.js File-system Conventions](https://nextjs.org/docs/app/api-reference/file-conventions)
- [ts-json-schema-generator (JSDoc-based codegen)](https://github.com/vega/ts-json-schema-generator)
- [Prisma Schema](https://www.prisma.io/typescript)
