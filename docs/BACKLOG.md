# KindScript — Feature & Analysis Backlog

This is the living backlog of analyses, attributes, and capabilities under consideration.
It consolidates ESLint rule assessments, new attribute proposals, and verification work.

---

## ESLint Rule Assessment

KindScript can implement many ESLint rules as AG analyses. The difference: ESLint rules
are imperative visitor callbacks; KSC rules are declarative attribute equations with
explicit dependency graphs, enabling incremental and parallel evaluation.

### Assessment Dimensions

- **Priority**: High / Medium / Low / Skip
- **Feasibility**: Pure AST sufficient, or TypeScript type checker needed
- **AG pattern**: Which attribute direction is the natural formulation

### Implemented (Phase 9)

These rules are already implemented in the eslint-equiv analysis:

- `no-shadow` — scope environment threading (inherited)
- `complexity` — cyclomatic complexity (synthesized)
- `max-depth` — control flow nesting depth (inherited)
- `max-params` — function parameter count (synthesized)
- `default-case` — switch default case checking (synthesized)
- `no-fallthrough` — switch case fallthrough detection (synthesized + inherited)
- `no-unreachable` — unreachable code detection (inherited)

### Priority Tiers

**Tier 1 — High priority, pure AST** (natural AG formulations):

| Rule | Description | AG Pattern |
|------|-------------|------------|
| `no-var` | Require `let`/`const` over `var` | Trivial syn |
| `prefer-const` | Flag `let` that is never reassigned | Syn + scope tracking |
| `no-eval` | Ban `eval()` calls | Trivial syn |
| `no-implied-eval` | Ban `setTimeout(string)` etc. | Syn with child inspection |
| `no-new-wrappers` | Ban `new String()` etc. | Trivial syn |
| `no-throw-literal` | Require `throw` of Error objects | Syn with child inspection |
| `no-useless-catch` | Flag `catch(e) { throw e }` | Syn with child inspection |
| `no-empty` | Flag empty block statements | Trivial syn |
| `no-lonely-if` | Flag `else { if }` → `else if` | Syn with child inspection |
| `eqeqeq` | Require `===` over `==` | Trivial syn |
| `no-nested-ternary` | Ban nested ternary expressions | Inherited depth counter |
| `no-else-return` | Flag unnecessary `else` after `return` | Syn with control flow |
| `no-empty-function` | Flag empty function bodies | Trivial syn |
| `guard-for-in` | Require `hasOwnProperty` check in `for...in` | Syn with child inspection |
| `@typescript-eslint/no-inferrable-types` | Remove unnecessary type annotations | Syn with type checking |
| `@typescript-eslint/prefer-as-const` | Prefer `as const` over literal type assertion | Syn |
| `@typescript-eslint/no-non-null-assertion` | Ban `!` postfix operator | Trivial syn |

**Tier 2 — Medium priority, need path/scope tracking**:

| Rule | Description | AG Pattern |
|------|-------------|------------|
| `no-use-before-define` | Variables used before declaration | Inherited scope env |
| `no-unused-vars` | Declared but unused variables | Collection + scope |
| `consistent-return` | All code paths return same type | Syn with control flow |
| `no-param-reassign` | Ban parameter reassignment | Inherited + syn |
| `no-loop-func` | Ban functions created inside loops | Inherited context |
| `@typescript-eslint/no-unnecessary-type-assertion` | Remove unnecessary `as` casts | Syn + type checker |

**Tier 3 — Lower priority or require type checker**:

Rules that need TypeScript's type checker (not just AST) are lower priority because
they require `AnalysisDepth: 'check'` and add evaluation cost.

### Reusable AG Patterns

Six patterns enable multiple rules each:

1. **Scope environment** (inherited): Thread variable bindings down the tree. Enables
   `no-shadow`, `no-use-before-define`, `no-unused-vars`, `no-redeclare`.
2. **Naming violation** (synthesized): Check identifier against naming convention.
   Enables `camelcase`, `new-cap`, `id-length`.
3. **Complexity metrics** (synthesized): Count control flow branches per function.
   Enables `complexity`, `max-depth`, `max-lines-per-function`.
4. **Type annotation** (synthesized): Inspect type annotation syntax.
   Enables `no-inferrable-types`, `prefer-as-const`, `consistent-type-assertions`.
5. **Collection attrs** (collection): Gather items across tree.
   Enables `no-duplicate-imports`, `no-duplicate-case`.
6. **Functional bans** (trivial syn): Check node kind against banned set.
   Enables `no-var`, `no-eval`, `no-delete-var`, `no-void`.

### Oracle Validation Strategy

ESLint itself serves as the ground truth oracle. For each implemented rule, run both
ESLint and KSC on the same fixtures and compare results. This is implemented in
`test/oracle/` using parameterized tests.

---

## New Attribute Proposals

Attributes that extend the existing analyses with new capabilities.

### Wave 1 — High value, straightforward

| Attribute | Direction | Description | Oracle |
|-----------|-----------|-------------|--------|
| `accessesThis` | syn | Function uses `this` keyword | Boundary tracking |
| `throwsException` | syn | Function contains `throw` | Trivial AST walk |

### Wave 2 — Module-level analysis

| Attribute | Direction | Description | Oracle |
|-----------|-----------|-------------|--------|
| `importSources` | syn | Set of module specifiers per file | TS compiler AST |
| `exportedNames` | syn | Public API surface per file | `ts.TypeChecker.getExportsOfModule()` |

### Wave 3 — Scope and binding

| Attribute | Direction | Description | Oracle |
|-----------|-----------|-------------|--------|
| `closureCaptures` | syn | Variables captured from outer scope | `ts.TypeChecker` symbol resolution |
| `localBindingCount` | syn | Local vars declared in function | Already stamped on nodes |
| `isAsyncScope` | inh | Inside async function | Check async modifier |
| `parameterCount` | syn | Function parameter count | TS signatures |

### Wave 4 — Type-aware (requires depth: check)

| Attribute | Direction | Description | Oracle |
|-----------|-----------|-------------|--------|
| `hasAnyType` | syn | Expression types containing `any` | TypeFlags.Any |
| `maxNestingDepth` | inh | Control flow nesting depth | Simple DFS oracle |
| `typeNarrowingDepth` | inh | How many type guards apply | Complex oracle |

---

## Evaluator Verification

Attributes designed to test the AG evaluator engine itself, not domain logic.

### Tier 1 — Core machinery verification

| Attribute | Direction | What it tests | Oracle |
|-----------|-----------|---------------|--------|
| `depth` | inh | Inherited propagation (root=0, child=parent+1) | DFS counter |
| `height` | syn | Synthesized aggregation (leaf=0, internal=1+max) | Post-order DFS |
| `kindCount(kind)` | parameterized | Parameterized dispatch + Map caching | Filter + count |

### Tier 2 — Cross-validation

| Test | What it tests |
|------|---------------|
| `allViolations` exhaustive check | Collection attribute completeness |
| `defEnv` identity check | Inherited environment threading |
| `leafCount` (collection) | Collection attribute fold |

Combination of tiers provides high confidence in evaluator correctness.
