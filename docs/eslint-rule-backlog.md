# ESLint Rule Backlog — KindScript Implementation Assessment

A comprehensive review of ESLint core, @typescript-eslint, and eslint-plugin-functional
rules with an assessment of which are worth implementing as KindScript attribute grammar
analyses.

---

## Why This Is Interesting

KindScript is an attribute grammar system that analyses the TypeScript AST. ESLint rules
are also AST analyses — the difference is that ESLint rules are written imperatively as
visitor callbacks, while KindScript rules would be declared as synthesized, inherited, or
collection attributes with explicit dependency graphs.

This matters because:

1. **Declarative specification** — an AG rule explicitly states what information flows
   where, making the analysis auditable and composable.
2. **Incremental evaluation** — the dep graph enables re-evaluation of only affected
   subtrees on change.
3. **Parallel evaluation** — independent attributes evaluate concurrently without
   coordination.
4. **Type-safe composition** — the `K` type parameter links grammar and spec at compile
   time, preventing mismatched grammar/rule pairs.

The assessment below identifies which rules have a natural AG formulation and which are
better left to ESLint.

---

## Assessment Dimensions

For each rule or group:

- **Priority** — 🟢 High / 🟡 Medium / 🔴 Low / ⛔ Skip
- **Feasibility** — whether pure AST is sufficient or TypeScript type checker is needed
- **AG pattern** — which attribute kind is the natural formulation

---

## Part 1 — ESLint Core Rules

### Scope & Variable Analysis

Classic attribute grammar problems. Environment threading via inherited attributes is
exactly what AG systems were designed for.

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `no-shadow` | Disallow declarations that shadow outer scope | 🟢 | Inh `bindingEnv`; syn bindings; violation when name ∈ outer env |
| `no-undef` | Disallow undeclared variable references | 🟢 | Inh `globalEnv` + `localEnv`; violation on undefined reference |
| `no-unused-vars` | Disallow unused variable declarations | 🟢 | Syn `declaredVars`; collection `usedVars`; violation on difference |
| `no-unused-private-class-members` | Disallow unused private class members | 🟢 | Collection `usedPrivateNames` within class |
| `no-redeclare` | Disallow variable redeclarations | 🟢 | Inh scope env; violation on duplicate binding in same scope |
| `no-const-assign` | Disallow reassignment of `const` | 🟢 | Inh `constBindings`; violation on assignment |
| `no-import-assign` | Disallow reassignment of import bindings | 🟢 | Inh `importBindings`; violation on assignment |
| `init-declarations` | Require/disallow initialiser in declarations | 🟢 | Syn check VariableDeclarator has/lacks initialiser |
| `no-undef-init` | Disallow `let x = undefined` | 🟢 | Syn check initialiser is `undefined` identifier |
| `block-scoped-var` | Treat `var` as block-scoped | 🟡 | Inh block scope; syn var declarations; violation on out-of-scope ref |
| `vars-on-top` | Require `var` at top of scope | 🟡 | Inh position-in-scope; syn whether all vars lead |
| `no-use-before-define` | Disallow use before declaration | 🟡 | Inh `declaredBefore` set; violation when usage precedes declaration |
| `no-unused-labels` | Disallow unused labels | 🟡 | Inh label set; collection `usedLabels`; violation on unused |
| `no-label-var` | Disallow label with same name as variable | 🟡 | Inh `varEnv`; check label name ∈ env |

**Implementation note:** All scope rules share a core inh attribute — an environment
mapping name → BindingInfo (kind, location). This environment is the canonical inherited
attribute of the analysis. Once implemented once, all scope rules compose on top of it.

---

### Complexity & Structural Metrics

Counting attributes — prototypical synthesized AGs.

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `complexity` | Limit cyclomatic complexity per function | 🟢 | Syn `branchCount` accumulated from if/else/loop/case/&&/\|\| |
| `max-depth` | Enforce max block nesting depth | 🟢 | Inh `nestDepth`; violation when > threshold |
| `max-params` | Enforce max parameter count | 🟢 | Syn `paramCount` on function nodes |
| `max-lines-per-function` | Enforce max line count per function | 🟢 | Syn `lineRange` (end − start); violation when > max |
| `max-classes-per-file` | Limit class declarations per file | 🟢 | Collection `classCount` at CompilationUnit |
| `max-statements` | Enforce max statements per function | 🟡 | Syn `statementCount` on function body |
| `max-lines` | Enforce max file line count | 🟡 | Syn `totalLines` on CompilationUnit |
| `max-nested-callbacks` | Enforce max nesting of callbacks | 🟡 | Inh `callbackDepth`; violation when > max |

**Implementation note:** All metric rules follow the same shape: a synthesized counting
attribute accumulates bottom-up, an optional inherited depth attribute threads top-down,
and a violation attribute fires when the count exceeds a configured threshold. A shared
`MetricsAnalysis` could expose all these as parameterised attributes.

---

### Naming Conventions

String-attribute checks on Identifier nodes.

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `camelcase` | Enforce camelCase naming | 🟢 | Syn `identifierName`; violation when not camelCase |
| `new-cap` | Require constructors start uppercase | 🟢 | Syn check NewExpression callee starts uppercase |
| `id-length` | Enforce min/max identifier length | 🟢 | Syn `name.length`; violation outside range |
| `id-match` | Require identifiers to match pattern | 🟢 | Syn `identifierName`; violation when name doesn't match regex |
| `id-denylist` | Disallow specific identifier names | 🟢 | Syn `identifierName`; violation when name in denylist |
| `no-underscore-dangle` | Disallow dangling underscores | 🟢 | Syn check name starts/ends with `_` |
| `func-names` | Require/disallow named function expressions | 🟡 | Syn check FunctionExpression has/lacks `id` |
| `func-name-matching` | Require function name to match variable | 🟡 | Syn check FunctionExpression.id matches assigned variable name |
| `symbol-description` | Require description for Symbol() | 🟡 | Syn check Symbol() call has argument |

---

### Class Structure

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `grouped-accessor-pairs` | Require getter/setter to be adjacent | 🟢 | Syn `classMembers` sequence; violation when getter/setter non-adjacent |
| `accessor-pairs` | Require setter when getter defined | 🟢 | Syn `getterNames`, `setterNames`; violation on getter without setter |
| `no-dupe-class-members` | Disallow duplicate class members | 🟢 | Syn `memberNames` collection; violation on duplicate |
| `no-useless-constructor` | Disallow empty/trivial constructors | 🟢 | Syn check constructor body: empty or only `super(...args)` |
| `no-empty-static-block` | Disallow empty static blocks | 🟢 | Syn check StaticBlock has zero statements |
| `class-methods-use-this` | Require `this` usage in class methods | 🟡 | Syn `usesThis` on MethodDefinition body |

---

### Control Flow Patterns

These require basic path tracking — beyond pure node checks but still feasible on the AST.

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `no-fallthrough` | Disallow switch case fallthrough | 🟡 | Syn `alwaysTerminates` on SwitchCase; violation when lacks break/return |
| `no-unreachable` | Disallow unreachable code | 🟡 | Syn `terminates` on Statement; violation on subsequent siblings |
| `consistent-return` | Require consistent return values | 🟡 | Syn `returnTypes` collection in function; violation on mixed void/value |
| `no-constructor-return` | Disallow return values in constructor | 🟢 | Inh `inConstructor`; violation when ReturnStatement has non-void value |
| `array-callback-return` | Require return in array callbacks | 🟡 | Inh `inArrayCallback`; syn `alwaysReturns` |
| `getter-return` | Enforce return in getters | 🟡 | Syn `alwaysReturns` on getter body |
| `no-setter-return` | Disallow return values in setters | 🟢 | Inh `inSetter`; violation on return with value |
| `no-promise-executor-return` | Disallow return in Promise executor | 🟡 | Inh `inPromiseExecutor`; violation on return with value |
| `require-yield` | Require yield in generator functions | 🟡 | Syn `hasYield` on generator function body |
| `no-return-assign` | Disallow assignment in return | 🟢 | Syn check ReturnStatement.argument is AssignmentExpression |
| `for-direction` | Enforce correct for-loop direction | 🟡 | Syn check update direction matches condition direction |

---

### Import / Export Patterns

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `no-duplicate-imports` | Disallow duplicate import sources | 🟢 | Collection `importSources` at CompilationUnit; violation on duplicate |
| `no-restricted-imports` | Disallow specific import sources | 🟢 | Syn check ImportDeclaration.source against configured denylist |
| `no-restricted-exports` | Disallow specific export names | 🟢 | Syn check ExportDeclaration against denylist |
| `sort-imports` | Enforce sorted import order | 🟡 | Syn `importOrder` at CompilationUnit; violation when not sorted |

---

### Error-Prone Patterns

Syntactic checks that catch common bugs.

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `no-self-assign` | Disallow `x = x` assignment | 🟢 | Syn structural identity check on AssignmentExpression |
| `no-self-compare` | Disallow `x === x` comparison | 🟢 | Syn structural identity check on BinaryExpression |
| `no-cond-assign` | Disallow assignment in conditions | 🟢 | Syn check if/while test contains AssignmentExpression |
| `no-dupe-args` | Disallow duplicate function parameters | 🟢 | Syn `paramNames`; violation on duplicate |
| `no-dupe-keys` | Disallow duplicate object keys | 🟢 | Syn `propertyKeys`; violation on duplicate |
| `no-dupe-else-if` | Disallow duplicate else-if conditions | 🟡 | Syn `ifConditions` chain; violation on duplicate text |
| `no-duplicate-case` | Disallow duplicate switch cases | 🟢 | Syn `caseValues`; violation on duplicate |
| `no-compare-neg-zero` | Disallow comparison with -0 | 🟢 | Syn check BinaryExpression: one operand is UnaryExpression(-) on 0 |
| `use-isnan` | Require isNaN() for NaN comparisons | 🟢 | Syn check BinaryExpression comparing with `NaN` identifier |
| `no-sparse-arrays` | Disallow sparse arrays | 🟢 | Syn check ArrayExpression for empty slots (elision) |
| `no-empty-pattern` | Disallow empty destructuring patterns | 🟢 | Syn check ObjectPattern/ArrayPattern is empty |
| `no-template-curly-in-string` | Disallow `${x}` syntax in plain strings | 🟢 | Syn check StringLiteral content for `${` pattern |
| `no-class-assign` | Disallow class reassignment | 🟡 | Inh `classNames`; violation on assignment to class name |
| `no-func-assign` | Disallow function reassignment | 🟡 | Inh `functionNames`; violation on assignment |
| `no-inner-declarations` | Disallow functions/vars in nested blocks | 🟡 | Inh `inTopLevelBlock`; violation on declaration in nested block |
| `no-this-before-super` | Disallow `this` before `super()` | 🟡 | Syn `superCalledFirst` in constructor body |
| `no-loss-of-precision` | Disallow numeric literal precision loss | 🟡 | Syn check numeric literal value |

---

### Code Quality Suggestions

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `eqeqeq` | Require `===` instead of `==` | 🟢 | Syn check BinaryExpression operator is `==` or `!=` |
| `no-var` | Disallow `var` declarations | 🟢 | Syn check VariableDeclaration.kind === `var` |
| `no-console` | Disallow console.* calls | 🟢 | Syn check CallExpression callee is `console.*` |
| `no-debugger` | Disallow debugger statement | 🟢 | Syn check DebuggerStatement presence |
| `no-eval` | Disallow eval() | 🟢 | Syn check CallExpression callee is `eval` |
| `no-implied-eval` | Disallow implied eval via setTimeout string | 🟡 | Syn check setTimeout/setInterval with StringLiteral arg |
| `no-new-wrappers` | Disallow new Boolean/Number/String | 🟢 | Syn check `new` on wrapper constructor names |
| `prefer-template` | Require template literals over concatenation | 🟡 | Syn check BinaryExpression `+` with string operand |
| `object-shorthand` | Require shorthand method/property syntax | 🟡 | Syn check ObjectExpression properties for longhand |
| `prefer-arrow-callback` | Require arrow functions as callbacks | 🟡 | Syn check FunctionExpression in callback position |
| `no-else-return` | Disallow else after always-returning if | 🟡 | Syn `alwaysReturns` on if-branch; violation on subsequent else |
| `dot-notation` | Require dot notation when possible | 🟡 | Syn check MemberExpression with string literal key that is valid identifier |
| `no-extra-boolean-cast` | Disallow redundant boolean casts | 🟢 | Syn check `!!` or `Boolean()` in boolean context |
| `prefer-exponentiation-operator` | Use `**` instead of Math.pow | 🟢 | Syn check `Math.pow(` call pattern |
| `prefer-rest-params` | Use rest params instead of `arguments` | 🟢 | Syn check `arguments` identifier usage in non-arrow function |
| `prefer-spread` | Use spread instead of Function.apply | 🟡 | Syn check `.apply(null, args)` pattern |
| `no-useless-return` | Disallow redundant void return at end | 🟡 | Syn check if return is final statement with no value |
| `no-useless-catch` | Disallow catch that only rethrows | 🟢 | Syn check catch body is just `throw error` |
| `no-empty` | Disallow empty block statements | 🟢 | Syn check BlockStatement has zero statements |
| `no-empty-function` | Disallow empty function bodies | 🟢 | Syn check function body is empty BlockStatement |
| `default-case` | Require default case in switch | 🟢 | Syn `hasDefaultCase` on SwitchStatement |
| `default-case-last` | Require default case at end | 🟢 | Syn `defaultCaseIndex` vs `lastCaseIndex` |
| `no-param-reassign` | Disallow parameter reassignment | 🟡 | Inh `paramNames`; syn check assignment to param |
| `no-magic-numbers` | Disallow unexplained magic number literals | 🟡 | Syn check NumericLiteral outside configured allowlist |
| `no-multi-assign` | Disallow chained assignment | 🟢 | Syn check AssignmentExpression.right is AssignmentExpression |
| `yoda` | Disallow yoda conditions | 🟢 | Syn check BinaryExpression: literal on left, identifier on right |
| `guard-for-in` | Require hasOwnProperty check in for-in | 🟡 | Syn `forInBodyHasOwnPropCheck` on ForInStatement |
| `no-bitwise` | Disallow bitwise operators | 🟢 | Syn check BinaryExpression/UnaryExpression for `&`, `\|`, `^`, `~`, `<<`, `>>`, `>>>` |
| `no-plusplus` | Disallow `++`/`--` operators | 🟢 | Syn check UpdateExpression presence |
| `prefer-object-spread` | Prefer `{...obj}` over Object.assign({}) | 🟡 | Syn check `Object.assign({}, ...)` call pattern |

---

### Not Suitable

| Category | Examples | Reason |
|----------|---------|--------|
| Formatting / whitespace | `curly`, `arrow-body-style`, `unicode-bom` | Not analysis; belongs to formatters |
| Regex analysis | `no-regex-spaces`, `no-invalid-regexp`, `require-unicode-regexp`, `prefer-named-capture-group` | Requires a regex parser |
| DOM/browser-specific | `no-alert`, `no-script-url` | Environment-specific, not AST structural |
| Legacy ES5 patterns | `strict`, `no-proto`, `no-iterator`, `no-caller` | Not relevant to modern TS codebases |
| Comment text scanning | `no-warning-comments`, `capitalized-comments` | Requires comment text analysis, not AST |
| Dataflow analysis | `no-unmodified-loop-condition`, `require-atomic-updates` | Requires dataflow / effect analysis |

---

## Part 2 — @typescript-eslint Rules

### TypeScript Type Annotation Style (Pure AST)

These check the shape of type annotations without needing the type checker. High value,
high feasibility.

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `no-explicit-any` | Disallow `any` type | 🟢 | Syn check TSAnyKeyword presence |
| `no-non-null-assertion` | Disallow `!` assertions | 🟢 | Syn check TSNonNullExpression presence |
| `no-extra-non-null-assertion` | Disallow double `!!` assertion | 🟢 | Syn check nested TSNonNullExpression |
| `no-inferrable-types` | Disallow redundant explicit type on literals | 🟢 | Syn check VariableDeclarator: literal init type ≡ annotation |
| `explicit-function-return-type` | Require return type annotation on functions | 🟢 | Syn check FunctionDeclaration/Arrow has TSTypeAnnotation on return |
| `explicit-member-accessibility` | Require access modifiers on class members | 🟢 | Syn check MethodDefinition/PropertyDefinition has accessibility keyword |
| `explicit-module-boundary-types` | Require explicit types on exported functions | 🟡 | Inh `isExported`; syn check type annotations |
| `typedef` | Require type annotations at configurable positions | 🟡 | Syn check TSTypeAnnotation presence at each position |
| `array-type` | Enforce `T[]` vs `Array<T>` style | 🟢 | Syn check TSArrayType vs TSTypeReference(`Array`) |
| `consistent-type-definitions` | Prefer `interface` vs `type` | 🟢 | Syn check TSTypeAliasDeclaration vs TSInterfaceDeclaration |
| `consistent-indexed-object-style` | Prefer `Record<>` vs index signature | 🟡 | Syn check TSMappedType pattern |
| `consistent-type-assertions` | Enforce `as T` vs `<T>` assertion style | 🟢 | Syn check TSTypeAssertion vs TSAsExpression |
| `no-confusing-non-null-assertion` | Disallow `!==` lookalike patterns | 🟢 | Syn check TSNonNullExpression adjacent to `=` |
| `prefer-as-const` | Prefer `as const` over literal type annotation | 🟢 | Syn check TSTypeAssertion where type matches literal value |
| `no-empty-interface` | Disallow empty interfaces | 🟢 | Syn check TSInterfaceDeclaration has zero members |
| `no-empty-object-type` | Disallow `{}` as a type | 🟢 | Syn check TSTypeLiteral with zero members |
| `no-wrapper-object-types` | Disallow `Number`, `String`, `Boolean` as types | 🟢 | Syn check TSTypeReference against boxed type names |
| `no-unsafe-function-type` | Disallow `Function` as type | 🟢 | Syn check TSTypeReference === `Function` |
| `no-namespace` | Disallow TypeScript namespaces | 🟢 | Syn check TSModuleDeclaration presence |
| `triple-slash-reference` | Disallow `/// <reference>` directives | 🟢 | Syn check TSImportEqualsDeclaration/reference comments |
| `no-require-imports` | Disallow `require()` imports | 🟢 | Syn check CallExpression callee === `require` |
| `ban-ts-comment` | Restrict `@ts-ignore` / `@ts-expect-error` | 🟡 | Syn check comments for banned directives |

---

### Import / Export Consistency

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `consistent-type-imports` | Require `import type` for type-only imports | 🟡 | Syn check ImportDeclaration: if all specifiers are type-only |
| `consistent-type-exports` | Require `export type` for type-only exports | 🟡 | Syn check ExportDeclaration: if all specifiers are type-only |
| `no-import-type-side-effects` | Prevent `import type` with side-effect concerns | 🟡 | Syn check `import type` with namespace/default specifiers |
| `no-useless-empty-export` | Remove empty `export {}` when module has exports | 🟢 | Collection `namedExports`; violation when `export {}` + exports > 0 |
| `no-duplicate-type-constituents` | Disallow duplicate union/intersection members | 🟢 | Syn `typeMembers` on TSUnionType/TSIntersectionType; violation on duplicate |

---

### Class & Member Structure

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `member-ordering` | Enforce declaration order within class | 🟡 | Syn `memberOrder` collection; violation when out of configured order |
| `adjacent-overload-signatures` | Require overloads to be grouped | 🟢 | Syn `memberSequence`; violation when overloads non-adjacent |
| `no-extraneous-class` | Disallow classes with only static members | 🟡 | Syn `instanceMemberCount` vs `staticMemberCount` |
| `no-misused-new` | Disallow `new` in interface / `constructor` named wrong | 🟢 | Syn check TSInterfaceDeclaration for `new()` method |
| `no-unsafe-declaration-merging` | Disallow merged interface+class with same name | 🟡 | Collection `declaredNames`; violation on same name as both class and interface |
| `no-this-alias` | Disallow aliasing `this` to a variable | 🟢 | Syn check `const x = this` pattern |
| `no-unnecessary-parameter-property-assignment` | Disallow re-assigning constructor params in body | 🟡 | Syn check constructor body for redundant `this.x = x` after param property |
| `parameter-properties` | Enforce/ban constructor parameter properties | 🟡 | Syn check TSParameterProperty nodes |
| `no-duplicate-enum-values` | Disallow duplicate enum member values | 🟢 | Syn `enumValues` collection on TSEnumDeclaration |
| `no-mixed-enums` | Disallow enums mixing string and number values | 🟢 | Syn `enumValueTypes`; violation when mixed |
| `prefer-enum-initializers` | Require explicit enum member values | 🟡 | Syn check TSEnumMember has initialiser |
| `prefer-literal-enum-member` | Require literal values for enum members | 🟡 | Syn check TSEnumMember initialiser is literal |
| `no-unnecessary-qualifier` | Remove redundant namespace qualifiers | 🟡 | Inh `namespaceCtx`; syn check MemberExpression qualifier is redundant |

---

### Function & Method Patterns

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `prefer-function-type` | Prefer function type over single-call-signature interface | 🟢 | Syn check TSInterfaceDeclaration with only a TSCallSignatureDeclaration |
| `method-signature-style` | Enforce method vs property function signature | 🟢 | Syn check TSMethodSignature vs TSPropertySignature with TSFunctionType |
| `unified-signatures` | Consolidate overloads that could be a union | 🟡 | Syn `overloadGroups`; analyse if params are union-able |
| `prefer-for-of` | Prefer `for...of` over indexed array loop | 🟡 | Syn check ForStatement: `i < arr.length`, body only uses `arr[i]` |
| `prefer-includes` | Prefer `.includes()` over `.indexOf() !== -1` | 🟡 | Syn check `.indexOf()` with `!== -1` pattern |
| `prefer-string-starts-ends-with` | Prefer startsWith/endsWith | 🟡 | Syn check `.indexOf() === 0` or slice(-n) pattern |
| `prefer-find` | Prefer `.find()` over `.filter()[0]` | 🟡 | Syn check `.filter(...)[0]` pattern |
| `no-unnecessary-type-constraint` | Disallow `extends any` / `extends unknown` | 🟢 | Syn check TSTypeParameter constraint is TSAnyKeyword/TSUnknownKeyword |
| `no-unnecessary-type-parameters` | Disallow unused generic type parameters | 🟡 | Syn `typeParamNames`; collection `typeParamUsages`; violation on unused |
| `no-useless-default-assignment` | Disallow `= undefined` in destructuring | 🟢 | Syn check destructuring default is `undefined` literal |
| `use-unknown-in-catch-callback-variable` | Require `unknown` type in catch clauses | 🟡 | Syn check CatchClause param has TSUnknownKeyword annotation |

---

### Enum & Type Analysis

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `sort-type-constituents` | Sort union/intersection type members | 🟡 | Syn `typeMembers` text sequence; violation when unsorted |
| `no-redundant-type-constituents` | Remove `never`/`unknown` from union | 🟡 | Syn scan TSUnionType members for absorbing types |
| `no-array-delete` | Disallow `delete array[index]` | 🟢 | Syn check UnaryExpression(delete) where argument is numeric-indexed MemberExpression |
| `no-dynamic-delete` | Disallow computed-key `delete` | 🟡 | Syn check UnaryExpression(delete) where member key is computed |

---

### Naming Conventions

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `naming-convention` | Comprehensive configurable naming rules | 🟢 | Syn `identifierName` + `identifierKind`; violation per configured rule set |

This is the most comprehensive naming rule in the ts-eslint set. It can target variables,
functions, classes, enums, enum members, interfaces, type aliases, generics, and
destructured variables — each with independent casing/prefix/suffix rules. In an AG the
natural formulation is a single `namingViolation` attribute that dispatches on identifier
kind via inherited context.

---

### Rules Requiring Type Checker — Lower Priority

Full enforcement of these rules requires TypeScript type information. Partial AST-based
versions are feasible for some, but the canonical implementation needs `ts.TypeChecker`.

| Rule | Notes |
|------|-------|
| `await-thenable` | Needs type resolution to determine thenable |
| `no-floating-promises` | Needs Promise type detection |
| `no-misused-promises` | Needs type resolution for promise contexts |
| `no-misused-spread` | Needs type resolution for iterable check |
| `no-unsafe-argument` / `no-unsafe-assignment` / `no-unsafe-call` / `no-unsafe-member-access` / `no-unsafe-return` | All need type inference for `any` detection |
| `no-unsafe-type-assertion` | Needs type inference |
| `no-unsafe-enum-comparison` | Needs type resolution |
| `no-base-to-string` | Needs type inference |
| `no-for-in-array` | Needs array type detection |
| `no-unnecessary-condition` | Needs type narrowing |
| `switch-exhaustiveness-check` | Needs union type info for discriminated unions |
| `restrict-plus-operands` | Needs operand type info |
| `restrict-template-expressions` | Needs template expression type info |
| `strict-boolean-expressions` | Needs type inference for boolean context |
| `unbound-method` | Needs type inference |
| `prefer-readonly` | Needs mutation analysis |
| `prefer-readonly-parameter-types` | Needs deep type analysis |
| `return-await` | Needs Promise type |
| `no-unnecessary-type-assertion` | Needs type inference |
| `no-unnecessary-type-arguments` | Needs type default info |
| `non-nullable-type-assertion-style` | Needs type inference |
| `no-confusing-void-expression` | Needs void type detection |
| `no-deprecated` | Needs JSDoc + type resolution |
| `no-unnecessary-template-expression` | Needs type info |
| `promise-function-async` | Needs return type detection |
| `require-array-sort-compare` | Needs array type |
| `require-await` | Needs async/await type tracking |

---

## Part 3 — eslint-plugin-functional

This plugin enforces functional programming discipline: immutability, no side effects, no
mutation, no imperative control flow. Unlike most ESLint rules (which catch bugs), these
rules encode a programming style philosophy. They are particularly interesting for
KindScript because they represent structural, semantic constraints that attribute grammars
excel at — and because KindScript users are likely interested in FP-discipline codebases.

---

### Imperative Construct Bans

The simplest category. All are trivially synthesized violations over specific node kinds.
Could be shipped together as a single `FunctionalDisciplineAnalysis`.

| Rule | Description | Priority | AG Pattern |
|------|-------------|----------|------------|
| `no-let` | Disallow `let`; require `const` everywhere | 🟢 | Syn check VariableDeclaration.kind === `let` |
| `no-classes` | Prohibit `class` keyword entirely | 🟢 | Syn check ClassDeclaration/ClassExpression presence |
| `no-class-inheritance` | Prohibit `extends` in class declarations | 🟢 | Syn check ClassDeclaration.superClass !== null |
| `no-loop-statements` | Prohibit all imperative loops | 🟢 | Syn check ForStatement/WhileStatement/DoWhileStatement/ForIn/ForOf |
| `no-conditional-statements` | Disallow `if` and `switch` statements | 🟢 | Syn check IfStatement/SwitchStatement (not ConditionalExpression — that's allowed) |
| `no-this-expressions` | Disallow `this` keyword | 🟢 | Syn check ThisExpression |
| `no-throw-statements` | Prohibit `throw` | 🟢 | Syn check ThrowStatement |
| `no-try-statements` | Prohibit try/catch/finally | 🟢 | Syn check TryStatement |
| `no-promise-reject` | Disallow `Promise.reject()` | 🟢 | Syn check CallExpression matching `Promise.reject(...)` pattern |

**Implementation note:** All nine share the same violation shape. A single
`FunctionalDisciplineAnalysis` with nine independently configurable syn attributes is
the natural structure. All violations are gathered by a top-level `allFPViolations`
collection attribute.

**On `no-conditional-statements`:** The rule bans `if` *statements*, not ternary
*expressions* — they are distinct node kinds in the TS AST (IfStatement vs
ConditionalExpression). The rule includes a guard-pattern exemption: `if (...) throw` at
the top of a function is allowed as a guard clause. Model via inh `isGuardPosition`
(first statement in function body, always throws/returns).

**On `no-loop-statements`:** Allows generator functions that use `for...of` internally
since generators are a functional construct. Model via inh `inGeneratorBody`.

---

### Side Effects & Purity

#### `no-expression-statements`

Flags any expression used as a statement where the return value is discarded. The
assumption: pure functions shouldn't be called for side effects.

| | |
|---|---|
| **Priority** | 🟡 Medium |
| **Feasibility** | AST approximation; type info improves precision |
| **AG Pattern** | Syn + inh allowlist |

```
inh attr voidCalleeAllowlist: ReadonlySet<string>  // configured at root
syn attr isVoidCallExpression: boolean
  CallExpression: callee.name ∈ voidCalleeAllowlist

syn attr expressionStatementViolation: Diagnostic | null
  ExpressionStatement:
    expression is NOT AssignmentExpression
    AND NOT isVoidCallExpression
    → violation
```

Without the type checker, the rule uses a configurable allowlist of known-void callee
patterns (e.g., `console.log`, array mutators). The rule provides `void expr` as an
escape hatch for intentional side effects.

**KindScript integration point:** The existing `violationFor` attribute tracks `Kind<X>`
annotation violations on values. A KindScript-native version could specifically flag
discarded returns from `Kind<X>`-annotated functions — a tighter, domain-specific variant
of this rule.

---

#### `no-return-void`

Require all functions to return a value (not `void`/`undefined`). Every function is
value-producing; side-effect functions are not allowed.

| | |
|---|---|
| **Priority** | 🟡 Medium |
| **Feasibility** | Pure AST for explicit annotations; type info for inferred |
| **AG Pattern** | Syn type annotation check |

```
syn attr returnTypeAnnotation: TSType | null
  FunctionDeclaration | ArrowFunction | FunctionExpression:
    typeAnnotation?.typeAnnotation

syn attr returnVoidViolation: Diagnostic | null
  FunctionDeclaration | ...:
    returnTypeAnnotation is TSVoidKeyword
    OR returnTypeAnnotation is TSUndefinedKeyword
    → violation
```

For explicit type annotations this is pure AST. Config `ignoreInferredTypes` skips the
inferred case, enabling full AST-only mode.

Pairs with `no-expression-statements`: together they encode "every function must produce
a value, and every produced value must be used."

---

### Immutability Enforcement

The most complex category. Full enforcement requires TypeScript type information, but
AST-level checks cover the common and obvious cases.

---

#### `immutable-data`

Prevent all mutations: property assignment, index assignment, `delete`, and calls to
mutating array methods (`push`, `pop`, `shift`, `unshift`, `sort`, `reverse`, `splice`,
`fill`, `copyWithin`).

| | |
|---|---|
| **Priority** | 🟡 Medium |
| **Feasibility** | AST catches obvious patterns; type info distinguishes readonly from mutable |
| **AG Pattern** | Syn mutation pattern matching |

```
MUTATING_METHODS = { push, pop, shift, unshift, sort, reverse,
                     splice, fill, copyWithin }

syn attr mutationViolation: Diagnostic | null

  AssignmentExpression:
    left is MemberExpression → violation

  UnaryExpression(delete):
    argument is MemberExpression → violation

  CallExpression:
    callee is MemberExpression
    callee.property.name ∈ MUTATING_METHODS → violation
```

The AST-only version is conservative — it flags all syntactic mutations including
intentional mutations of locally-scoped mutable values. This is acceptable for codebases
enforcing full FP discipline. A two-phase design separates AST detection from type-aware
filtering:

```
Phase 1 (AST-only): syn attr syntacticMutations
Phase 2 (type info, future): filter where type is not already readonly
```

---

#### `prefer-immutable-types`

Require function parameters and optionally return types to use immutable/readonly types.
Configurable strictness: shallow (`readonly`), deep (`ReadonlyDeep`), or fully immutable.

| | |
|---|---|
| **Priority** | 🟡 Medium |
| **Feasibility** | AST-partial (checks for `readonly` keyword/Readonly<T>); deep immutability needs type checker |
| **AG Pattern** | Syn type annotation traversal |

```
syn attr isReadonlyAnnotated: boolean
  TSTypeAnnotation:
    type is TSTypeOperator(readonly)
    OR type is TSTypeReference where name ∈ { Readonly, ReadonlyArray, ReadonlyMap, ReadonlySet }

syn attr paramImmutabilityViolation: Diagnostic | null
  Parameter:
    typeAnnotation is object-like (TSTypeLiteral | TSArrayType | TSTypeReference)
    AND NOT isReadonlyAnnotated
    → violation
```

---

#### `readonly-type`

Enforce consistent style between `readonly T[]` / `Readonly<T>` / `ReadonlyArray<T>` —
pick one and use it everywhere in a file.

| | |
|---|---|
| **Priority** | 🟡 Medium |
| **Feasibility** | Pure AST — style consistency check |
| **AG Pattern** | Collection attr at file level |

```
collection attr readonlyKeywordUsages: number   // readonly T[]
collection attr readonlyWrapperUsages: number   // Readonly<T>

syn attr readonlyStyleViolation: Diagnostic | null
  CompilationUnit:
    readonlyKeywordUsages > 0 AND readonlyWrapperUsages > 0
    → violation on minority-style usages
```

---

#### `type-declaration-immutability`

Type alias and interface names should reflect their immutability level. If a type is
named `ImmutableFoo`, it must be deeply immutable; if named `MutableFoo`, it should not
have `readonly`.

| | |
|---|---|
| **Priority** | 🟡 Medium |
| **Feasibility** | AST-partial for shallow; deep needs type checker |
| **AG Pattern** | Syn name + syn type structure combined |

```
syn attr typeDeclName: string
syn attr shallowImmutabilityLevel: "mutable" | "readonly" | "unknown"

syn attr namingImmutabilityViolation: Diagnostic | null
  TSTypeAliasDeclaration | TSInterfaceDeclaration:
    name matches "Immutable*" AND shallowImmutabilityLevel !== "readonly" → violation
    name matches "Mutable*" AND shallowImmutabilityLevel === "readonly" → violation
```

Naming patterns are configurable. The interesting AG aspect is that name analysis and
type structure analysis combine in a single attribute.

---

### Type Structure Constraints

#### `no-mixed-types`

Type definitions must not mix function members with data/property members. A type is
either a function type or a data record, not both.

| | |
|---|---|
| **Priority** | 🟢 High |
| **Feasibility** | Pure AST |
| **AG Pattern** | Collection attr within type declaration |

```
collection attr memberKinds: Set<"function" | "data">
  TSInterfaceDeclaration | TSTypeLiteral:
    TSMethodSignature → "function"
    TSCallSignatureDeclaration → "function"
    TSPropertySignature with TSFunctionType value → "function"
    TSPropertySignature with non-function type → "data"

syn attr mixedTypeViolation: Diagnostic | null
  TSInterfaceDeclaration | TSTypeLiteral:
    "function" ∈ memberKinds AND "data" ∈ memberKinds → violation
```

Classic collection attribute problem. Clean formulation.

---

#### `prefer-property-signatures`

Prefer `property: () => T` over `method(): T` in interfaces and type literals. Property
signatures support `readonly`; method signatures do not.

| | |
|---|---|
| **Priority** | 🟢 High |
| **Feasibility** | Pure AST |
| **AG Pattern** | Trivial syn |

```
syn attr methodSignatureViolation: Diagnostic | null
  TSMethodSignature: → violation
```

Pairs with `prefer-immutable-types` — you need property signatures to put `readonly` on
function types.

---

### Function Discipline

#### `functional-parameters`

Restricts function arity and parameter style:
- Disallow rest parameters (`...args`)
- Disallow the `arguments` object
- Optionally require exactly one parameter (currying discipline)
- Optionally require at least one parameter

| | |
|---|---|
| **Priority** | 🟢 High |
| **Feasibility** | Pure AST |
| **AG Pattern** | Syn param structure + inh context |

```
syn attr restParamViolation: Diagnostic | null
  FunctionDeclaration | ArrowFunction | FunctionExpression:
    any param is RestElement → violation

syn attr argumentsViolation: Diagnostic | null
  Identifier("arguments"):
    inh inArrowFunction is false → violation
    (arrow functions don't bind `arguments`, so it refers to outer scope)

syn attr arityViolation: Diagnostic | null
  FunctionDeclaration | ...:
    enforceParameterCount: "exactlyOne" AND params.length !== 1 → violation
    enforceParameterCount: "atLeastOne" AND params.length === 0 → violation
```

Three sub-checks bundled as one rule. The `inArrowFunction` inherited flag suppresses the
`arguments` violation inside arrow functions.

---

#### `prefer-tacit`

Prefer point-free style: use `f` directly instead of `(x) => f(x)`.

| | |
|---|---|
| **Priority** | 🟡 Medium |
| **Feasibility** | AST for free-function references; type info for method references |
| **AG Pattern** | Syn structural equivalence check |

```
syn attr tacitViolation: Diagnostic | null
  ArrowFunctionExpression:
    body is CallExpression (not a block body)
    callee is Identifier (not a MemberExpression, to avoid `this` binding issues)
    call args are exactly the same identifiers as params, same order
    no extra args
    → violation
```

The AST-only version catches `(x) => f(x)` → `f` for free functions. Method reference
cases (`(x) => obj.method(x)`) are excluded by default since `obj.method` without
binding loses `this`.

---

## Priority Backlog Summary

### Tier 1 — Implement First

High priority, pure AST, natural AG formulation.

**Scope & Variables**
- `no-shadow`, `no-undef`, `no-unused-vars`, `no-redeclare`, `no-const-assign`, `no-import-assign`

**Structural Metrics**
- `complexity`, `max-depth`, `max-params`, `max-lines-per-function`, `max-classes-per-file`
- `default-case`, `default-case-last`, `no-duplicate-case`, `no-dupe-keys`, `no-dupe-args`

**TypeScript Type Style**
- `no-explicit-any`, `no-non-null-assertion`, `explicit-function-return-type`
- `explicit-member-accessibility`, `array-type`, `consistent-type-definitions`
- `consistent-type-assertions`, `no-empty-interface`, `no-empty-object-type`
- `no-wrapper-object-types`, `no-namespace`, `adjacent-overload-signatures`

**Naming**
- `camelcase`, `naming-convention`, `new-cap`, `id-length`, `id-denylist`

**Common Bug Patterns**
- `eqeqeq`, `no-var`, `no-console`, `no-debugger`, `no-eval`
- `use-isnan`, `no-self-assign`, `no-self-compare`, `no-useless-catch`
- `no-empty`, `no-multi-assign`, `no-bitwise`, `no-extra-boolean-cast`

**Functional (eslint-plugin-functional)**
- `no-let`, `no-classes`, `no-class-inheritance`, `no-loop-statements`
- `no-conditional-statements`, `no-this-expressions`, `no-throw-statements`
- `no-try-statements`, `no-promise-reject`, `no-mixed-types`, `prefer-property-signatures`
- `functional-parameters`

### Tier 2 — Medium Priority

Feasible but require more complexity, partial type info, or basic path tracking.

- `consistent-return`, `no-fallthrough`, `no-unreachable` — basic path tracking
- `prefer-const` — usage tracking across scope
- `prefer-template`, `prefer-object-spread`, `prefer-for-of` — pattern matching
- `member-ordering`, `unified-signatures` — ordered collection attrs
- `consistent-type-imports`, `consistent-type-exports` — import analysis
- `no-expression-statements`, `no-return-void` — purity enforcement
- `immutable-data`, `prefer-immutable-types` — mutation detection
- `readonly-type`, `type-declaration-immutability` — immutability style
- `prefer-tacit` — point-free equivalence

### Tier 3 — Requires Type Checker

All `no-unsafe-*`, `switch-exhaustiveness-check`, `strict-boolean-expressions`,
`no-floating-promises`, `no-misused-promises`, `await-thenable`,
`restrict-plus-operands`, `restrict-template-expressions`, `unbound-method`.

These are implementable once TypeScript type checker integration is established. The AG
system would propagate resolved type information as inherited attributes, enabling the
same attribute grammar machinery to enforce type-dependent constraints.

---

## Architectural Patterns for Implementation

### Pattern 1 — Scope Environment (enables ~12 rules)

```
inh attr scopeEnv: Record<string, BindingInfo>
  root: globalScope (configured)
  function/block: { ...parentScope, ...localDeclarations }
```

Enables: `no-shadow`, `no-undef`, `no-redeclare`, `no-use-before-define`,
`no-const-assign`, `no-import-assign`, `block-scoped-var`.

### Pattern 2 — Naming Violation (enables ~8 rules)

```
syn attr namingViolation: Diagnostic | null
  Identifier: check name format per kind + configured rules
inh attr identifierKind: "variable" | "function" | "class" | "enum" | ...
```

### Pattern 3 — Complexity Metrics (enables ~6 rules)

```
syn attr branchCount: number
  IfStatement: 1 + branches.branchCount
  BinaryExpression(&&/||): 1 + operands.branchCount
  SwitchCase: 1
  default: sum of children

inh attr nestDepth: number
  root: 0
  BlockStatement inside control flow: parent.nestDepth + 1
```

### Pattern 4 — Type Annotation Presence (enables ~8 rules)

```
syn attr hasReturnTypeAnnotation: boolean
syn attr hasAccessibilityModifier: boolean
syn attr typeAnnotationKind: "any" | "unknown" | "void" | "readonly" | "boxed" | "other"
```

### Pattern 5 — Collection within Type Declaration (enables ~5 rules)

```
collection attr memberKinds: Set<string>  // within TSInterfaceDeclaration/TSTypeLiteral
collection attr memberNames: Set<string>  // within ClassBody
```

### Pattern 6 — Functional Bans (enables 9 rules)

```
// All trivially syn over specific node kinds
syn attr imperativeViolations: readonly Diagnostic[]
  IfStatement | SwitchStatement | ForStatement | WhileStatement | ...
  ClassDeclaration | ClassExpression | ThisExpression | ThrowStatement | TryStatement
  VariableDeclaration(let) | CallExpression(Promise.reject)
    → [violation]
  default: []
```

---

## Part 4 — Oracle Validation Plan

### Goal

Use ESLint's implementation as ground truth to validate our KindScript attribute grammar
implementations. For each rule we implement, run both ESLint and KindScript on the same
TypeScript files and assert that they produce identical violation sets.

This gives us:
1. **Correctness guarantee** — ESLint is battle-tested; matching its output proves ours
2. **Regression testing** — fixture corpus grows over time, catches regressions
3. **Edge-case discovery** — ESLint's own test cases reveal tricky corners we'd otherwise miss

### Architecture

```
test/oracle/
├── fixtures/                     Shared TypeScript test files
│   ├── eqeqeq/                   Per-rule fixture directories
│   │   ├── violations.ts         Code that should trigger the rule
│   │   └── clean.ts              Code that should not trigger
│   ├── no-var/
│   ├── no-shadow/
│   ├── complexity/
│   └── ...
├── helpers/
│   ├── eslint-runner.ts          Programmatic ESLint runner
│   ├── ksc-runner.ts             KindScript evaluator runner
│   └── normalise.ts              Normalise both outputs to common format
└── oracle.test.ts                Parameterised test: (rule, fixture) → compare
```

### Normalised Violation Format

Both ESLint and KindScript produce violations with different shapes. Normalise to:

```typescript
interface NormalisedViolation {
  file: string;       // relative path within fixture dir
  line: number;       // 1-based
  column: number;     // 0-based
  ruleId: string;     // e.g. "eqeqeq", "no-var"
}
```

**ESLint side** — each `LintMessage` has `{ line, column, ruleId }`, just extract.

**KindScript side** — each `Diagnostic` has `{ pos, end, fileName }`. Convert `pos` to
line/column via `ts.getLineAndCharacterOfPosition()` on the source file. Map the
attribute name back to the ESLint rule ID via a lookup table.

### ESLint Runner

Use ESLint's programmatic Node API:

```typescript
import { ESLint } from 'eslint';

export async function runESLint(
  fixtureDir: string,
  ruleId: string,
  ruleConfig: unknown = 'error',
): Promise<NormalisedViolation[]> {
  const eslint = new ESLint({
    overrideConfigFile: true,            // ignore project config
    overrideConfig: {
      rules: { [ruleId]: ruleConfig },   // enable only this rule
      parser: '@typescript-eslint/parser',
    },
  });
  const results = await eslint.lintFiles(
    path.join(fixtureDir, '**/*.ts'),
  );
  return results.flatMap(r =>
    r.messages.map(m => ({
      file: path.relative(fixtureDir, r.filePath),
      line: m.line,
      column: m.column - 1,  // ESLint is 1-based, normalise to 0-based
      ruleId: m.ruleId ?? ruleId,
    }))
  );
}
```

For `@typescript-eslint` rules, use the typescript-eslint parser + plugin:

```typescript
const eslint = new ESLint({
  overrideConfig: {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    rules: { [`@typescript-eslint/${ruleId}`]: ruleConfig },
  },
});
```

### KindScript Runner

Reuse the existing test harness. The new analysis produces its own projections:

```typescript
import { createEvaluatorFromTarget } from '@kindscript/core-evaluator';
import { eslintEquivTarget } from
  '../../src/application/evaluation/eslint-equiv.js';

const evaluator = createEvaluatorFromTarget(eslintEquivTarget);

export function runKSC(
  fixtureDir: string,
  ruleId: string,
): NormalisedViolation[] {
  const files = getRootFiles(fixtureDir);
  const tsProgram = ts.createProgram(files, { strict: true, noEmit: true });
  const { root } = tsToAstTranslatorAdapter.convert(tsProgram);
  const result = evaluator.evaluate(root);

  // result.violations is Record<ruleId, Diagnostic[]>
  const diagnostics = result.violations[ruleId] ?? [];

  return diagnostics.map(d => ({
    file: path.relative(fixtureDir, d.fileName),
    line: lineOf(d.pos, d.fileName),
    column: columnOf(d.pos, d.fileName),
    ruleId,
  }));
}
```

### Parameterised Test Structure

```typescript
import { describe, it, expect } from 'vitest';

const ORACLE_RULES = [
  { ruleId: 'eqeqeq', fixture: 'eqeqeq' },
  { ruleId: 'no-var', fixture: 'no-var' },
  { ruleId: 'no-shadow', fixture: 'no-shadow' },
  // ...
] as const;

describe.each(ORACLE_RULES)(
  'oracle — $ruleId',
  ({ ruleId, fixture }) => {
    it('KindScript matches ESLint', async () => {
      const fixtureDir = path.join(FIXTURES, 'oracle', fixture);
      const eslintResults = await runESLint(fixtureDir, ruleId);
      const kscResults = runKSC(fixtureDir, ruleId);

      // Sort both by file, then line, then column for stable comparison
      const sort = (a: NormalisedViolation[]) =>
        [...a].sort((x, y) =>
          x.file.localeCompare(y.file) || x.line - y.line || x.column - y.column
        );

      expect(sort(kscResults)).toEqual(sort(eslintResults));
    });
  },
);
```

### Fixture Design Principles

Each fixture directory should contain files that exercise:

1. **True positives** — code that violates the rule (both tools should flag it)
2. **True negatives** — clean code (neither tool should flag it)
3. **Edge cases** — tricky patterns where naive implementations diverge from ESLint
4. **TypeScript-specific** — generics, decorators, type annotations (where applicable)

Fixtures should be self-contained (no external imports) to avoid environment
differences between ESLint and KindScript.

**Sourcing fixtures:** ESLint and typescript-eslint have extensive test suites in their
repos. Mine their `valid` and `invalid` test cases for each rule as a starting point:
- `eslint/tests/lib/rules/<ruleId>.js` — `valid` / `invalid` arrays
- `typescript-eslint/packages/eslint-plugin/tests/rules/<ruleId>.test.ts`

---

### Proposed Starter Attributes

The following 17 rules span all AG patterns (syn, inh, collection) and range from trivial
to moderately complex. They are ordered by implementation difficulty, easiest first.

#### Group A — Trivial Syn (one node kind, one check)

These validate that the codegen pipeline, dispatch, and projection machinery work for the
simplest possible attribute: a synthesized boolean/diagnostic on a single node kind.

| # | ESLint Rule | KSC Attribute Name | Node Kind(s) | Check |
|---|-------------|-------------------|--------------|-------|
| 1 | `eqeqeq` | `eqeqeqViolation` | BinaryExpression | operator ∈ {`==`, `!=`} |
| 2 | `no-var` | `noVarViolation` | VariableDeclarationList | `flags` indicates `var` |
| 3 | `no-debugger` | `noDebuggerViolation` | DebuggerStatement | always violates |
| 4 | `no-empty` | `noEmptyViolation` | Block | zero children (excluding comments) |
| 5 | `no-bitwise` | `noBitwiseViolation` | BinaryExpression, PrefixUnaryExpression | operator ∈ {`&`, `\|`, `^`, `~`, `<<`, `>>`, `>>>`} |
| 6 | `no-explicit-any` | `noExplicitAnyViolation` | AnyKeyword | always violates |

**AttrDecl pattern (each is identical in shape):**
```typescript
{
  name: '<attrName>',
  direction: 'syn',
  type: 'Diagnostic | null',
  default: null,            // most nodes: no violation
  equations: { <kind>: eq_<attrName>_<Kind> },
}
```

**Equation pattern:**
```typescript
export const eq_eqeqeqViolation_BinaryExpression = withDeps([],
  function eq_eqeqeqViolation_BinaryExpression(
    ctx: KindCtx<KSBinaryExpression>
  ): Diagnostic | null {
    const op = ctx.node.operatorToken?.kind;
    if (op === 'EqualsEqualsToken' || op === 'ExclamationEqualsToken') {
      return { node: ctx.node, message: `Expected '===' but found '${op}'`, ... };
    }
    return null;
  }
);
```

#### Group B — Syn with Child Inspection

These require examining direct children of the flagged node — still synthesized, but the
equation function iterates over children to detect a pattern.

| # | ESLint Rule | KSC Attribute Name | Node Kind(s) | Check |
|---|-------------|-------------------|--------------|-------|
| 7 | `no-dupe-args` | `noDupeArgsViolation` | FunctionDeclaration, ArrowFunction | duplicate param names |
| 8 | `no-dupe-keys` | `noDupeKeysViolation` | ObjectLiteralExpression | duplicate property names |
| 9 | `no-self-compare` | `noSelfCompareViolation` | BinaryExpression | left ≡ right (structurally) |
| 10 | `max-params` | `maxParamsViolation` | FunctionDeclaration, ArrowFunction, MethodDeclaration | params.length > threshold |
| 11 | `no-empty-interface` | `noEmptyInterfaceViolation` | InterfaceDeclaration | zero members, no extends |
| 12 | `no-duplicate-imports` | `noDuplicateImportsViolation` | CompilationUnit | duplicate `moduleSpecifier` values |

**Equation pattern (no-dupe-keys example):**
```typescript
export const eq_noDupeKeysViolation_ObjectLiteralExpression = withDeps([],
  function eq_noDupeKeysViolation(ctx: KindCtx<KSObjectLiteralExpression>): Diagnostic | null {
    const seen = new Set<string>();
    for (const child of ctx.children) {
      if (child.node.kind !== 'PropertyAssignment') continue;
      const name = (child.node as KSPropertyAssignment).name;
      if (!name) continue;
      const key = /* extract key text */;
      if (seen.has(key)) {
        return { node: child.node, message: `Duplicate key '${key}'`, ... };
      }
      seen.add(key);
    }
    return null;
  }
);
```

#### Group C — Inh Context Propagation

These require inherited attributes that thread context down the tree — the hallmark of
AG systems. Validating these against ESLint proves the inherited attribute machinery works
correctly.

| # | ESLint Rule | KSC Attribute Name(s) | Direction | Check |
|---|-------------|----------------------|-----------|-------|
| 13 | `max-depth` | `nestDepth` (inh), `maxDepthViolation` (syn) | inh + syn | depth exceeds threshold |
| 14 | `no-shadow` | `scopeEnv` (inh), `noShadowViolation` (syn) | inh + syn | binding name ∈ outer scope |

**`max-depth` formulation:**
```typescript
// Inherited: propagate nesting depth downward
{
  name: 'nestDepth',
  direction: 'inh',
  type: 'number',
  rootValue: 0,
  parentEquations: {
    IfStatement: eq_nestDepth_IfStatement,     // depth + 1
    ForStatement: eq_nestDepth_ForStatement,   // depth + 1
    WhileStatement: eq_nestDepth_WhileStatement, // depth + 1
    // ... all block-introducing statements
  },
}

// Synthesized: check threshold
{
  name: 'maxDepthViolation',
  direction: 'syn',
  type: 'Diagnostic | null',
  default: eq_maxDepthViolation_default,  // check nestDepth > MAX
}
```

**`no-shadow` formulation:**
```typescript
// Inherited: scope environment propagated downward
{
  name: 'scopeEnv',
  direction: 'inh',
  type: 'Map<string, BindingInfo>',
  rootValue: eq_scopeEnv_root,  // global bindings (imports, top-level)
  parentEquations: {
    FunctionDeclaration: eq_scopeEnv_FunctionDeclaration,  // add params to scope
    Block: eq_scopeEnv_Block,                              // add let/const to scope
    ArrowFunction: eq_scopeEnv_ArrowFunction,
  },
}

// Synthesized: shadow detection
{
  name: 'noShadowViolation',
  direction: 'syn',
  type: 'Diagnostic | null',
  default: null,
  equations: {
    VariableDeclaration: eq_noShadowViolation_VariableDeclaration,
    // check: is this name already in scopeEnv from a parent scope?
  },
}
```

**Why `no-shadow` is the critical oracle test:** It exercises inherited scope propagation
across nested functions, blocks, catch clauses, and destructuring — exactly the kind of
scoping the existing `defEnv` / `contextFor` attributes handle for kind-checking. If
`no-shadow` matches ESLint's output, the scope-threading machinery is validated.

#### Group D — Collection Attribute

| # | ESLint Rule | KSC Attribute Name | Direction | Check |
|---|-------------|-------------------|-----------|-------|
| 15 | `complexity` | `cyclomaticComplexity` | collection | branch count per function exceeds threshold |

**Formulation:**
```typescript
{
  name: 'cyclomaticComplexity',
  direction: 'collection',
  type: 'number',
  init: 1,  // base complexity
  combine: code('(acc: number, contrib: number) => acc + contrib'),
  // Each branch-contributing node adds 1:
  // IfStatement, ConditionalExpression, SwitchCase,
  // LogicalExpression(&&/||/??)  ForStatement, WhileStatement, ...
}
```

This tests the collection attribute machinery on a non-trivial aggregation. ESLint's
`complexity` rule is well-specified (follows McCabe's definition), so it serves as an
unambiguous oracle.

#### Group E — TS-Specific Syn

| # | ESLint Rule | KSC Attribute Name | Node Kind(s) | Check |
|---|-------------|-------------------|--------------|-------|
| 16 | `array-type` | `arrayTypeViolation` | TypeReference, ArrayType | enforce T[] vs Array\<T\> style |
| 17 | `consistent-type-definitions` | `typeDeclStyleViolation` | InterfaceDeclaration, TypeAliasDeclaration | enforce interface vs type |

These validate that the KindScript grammar's TypeScript type-annotation nodes are
correctly mapped and accessible to equation functions.

---

### Analysis Target Structure

The oracle attributes form a **new analysis target** sharing the same grammar as
ts-kind-checking. This keeps the existing analysis untouched.

```
src/adapters/analysis/spec/eslint-equiv/
├── types.ts                 EslintEquivDiagnostic type
├── equations/
│   ├── trivial-syn.ts       Group A equations (eqeqeq, no-var, etc.)
│   ├── child-inspection.ts  Group B equations (no-dupe-args, etc.)
│   ├── scope.ts             Group C equations (scopeEnv, no-shadow)
│   ├── metrics.ts           Group D equations (complexity, max-depth)
│   └── ts-style.ts          Group E equations (array-type, etc.)
├── spec.ts                  AnalysisDecl<TSNodeKind> — all 17+ attrs
├── projections.ts           AnalysisProjections — gather violations per ruleId
├── generated/               Codegen output (dispatch.ts, attr-types.ts, dep-graph.ts)
└── index.ts                 Barrel — re-exports grammar types + EslintEquivDiagnostic
```

**Codegen target** (added to `src/application/codegen/codegen-targets.ts`):
```typescript
export const eslintEquivTarget: CodegenTarget<TSNodeKind> = {
  grammar,
  decl: eslintEquivDecl,
  outputDir: 'src/adapters/analysis/spec/eslint-equiv/generated',
  generatedImports: { ... },
};
```

**Evaluation target** (new file `src/application/evaluation/eslint-equiv.ts`):
```typescript
import { grammar } from '../../adapters/grammar/grammar/ts-ast/index.js';
import { dispatchConfig } from '../../adapters/analysis/spec/eslint-equiv/generated/dispatch.js';
import { analysisProjections } from '../../adapters/analysis/spec/eslint-equiv/projections.js';
import { depGraph } from '../../adapters/analysis/spec/eslint-equiv/generated/dep-graph.js';
import { createEvaluatorFromTarget } from '@kindscript/core-evaluator';

export const eslintEquivTarget: EvaluationTarget<TSNodeKind, EslintEquivAttrMap, EslintEquivProjections> = {
  grammar, dispatch: dispatchConfig, projections: analysisProjections, depGraph,
};
export const evaluator = createEvaluatorFromTarget(eslintEquivTarget);
```

**Projections shape:**
```typescript
interface EslintEquivProjections {
  violations: Record<string, EslintEquivDiagnostic[]>;
  // keyed by ESLint ruleId: { eqeqeq: [...], 'no-var': [...], ... }
}
```

This design means:
- `ksc codegen` generates dispatch for both ts-kind-checking and eslint-equiv
- The two evaluators are completely independent (different dispatch, different projections)
- Fixtures can run both evaluators on the same tree if needed

---

### Validation Phases

#### Phase 1 — Scaffolding (Group A: 6 trivial syn rules)

**Goal:** Prove the full oracle loop works end-to-end.

1. Create `src/adapters/analysis/spec/eslint-equiv/` with Group A attrs
2. Run `ksc codegen` to generate dispatch
3. Create fixtures for `eqeqeq`, `no-var`, `no-debugger`, `no-empty`, `no-bitwise`,
   `no-explicit-any`
4. Write `test/oracle/oracle.test.ts` with parameterised runner
5. Verify KindScript and ESLint produce identical violation sets

**Success criteria:** All 6 rules produce bit-identical normalised violations.

This phase proves:
- The new analysis target codegen pipeline works
- Equation dispatch works for simple syn attrs
- The normalisation / comparison infrastructure works
- The fixture pattern is viable

#### Phase 2 — Child Inspection (Group B: 6 rules)

**Goal:** Validate syn equations that inspect children.

Add `no-dupe-args`, `no-dupe-keys`, `no-self-compare`, `max-params`,
`no-empty-interface`, `no-duplicate-imports`. These require iterating over a node's
children, checking field values, and building local sets.

**Edge cases to mine from ESLint tests:**
- `no-dupe-keys`: computed property keys `[expr]`, spread elements, shorthand
- `no-dupe-args`: destructured parameters, rest parameters
- `no-self-compare`: `NaN !== NaN`, member expression chains (`a.b === a.b`)

#### Phase 3 — Inherited Attributes (Group C: 2 rules)

**Goal:** Validate inherited attribute propagation.

Add `max-depth` and `no-shadow`. These are the most important rules because they exercise
the inherited attribute machinery that distinguishes AGs from simple visitors.

**`no-shadow` coverage matrix:**
- Function params shadowing outer vars
- Block-scoped let/const shadowing outer vars
- Catch clause binding shadowing
- Class name shadowing
- Nested function name shadowing
- Destructured binding shadowing
- Parameter default value scope

Each scenario needs a fixture file and must match ESLint exactly.

#### Phase 4 — Collection Attribute (Group D: 1 rule)

**Goal:** Validate collection attribute machinery on a non-trivial aggregation.

Add `complexity` (cyclomatic complexity). The McCabe definition is precise:
- +1 for each: if, else if, for, while, do-while, case (non-default), catch
- +1 for each: &&, ||, ??
- +1 for ternary `?:`
- Base = 1

**ESLint's `complexity` rule** reports per-function, with a configurable threshold.
KindScript should produce the same per-function complexity number.

#### Phase 5 — TS-Specific (Group E: 2 rules)

**Goal:** Validate that TS type-annotation AST nodes are accessible and correct.

Add `array-type` and `consistent-type-definitions`. These confirm that the KindScript
grammar's TypeScript-specific node kinds (TypeReference, ArrayType, InterfaceDeclaration,
TypeAliasDeclaration) are correctly mapped by the AST translator.

---

### Ongoing Expansion

After the 5 phases (17 rules), the oracle framework is established. New rules can be
added incrementally:

1. Write equations + add to spec.ts
2. Run `ksc codegen`
3. Add fixture files
4. Add entry to `ORACLE_RULES` array
5. Run `npx vitest run test/oracle/`

The test suite grows monotonically — each new rule is an additive test case.

**Milestone targets:**
- ~~17 rules: validates all AG patterns (syn, inh, collection) end-to-end~~ ✓ Exceeded
- ~~30 rules: covers the full Tier 1 backlog~~ ✓ Exceeded
- 41 rules: current state — validates syn + inh patterns at scale
- 50+ rules: competitive with a standalone linter; validates system at scale

---

## Part 5 — Implementation Progress

### Overall Status: 41 Rules Implemented, 123 Oracle Tests Passing

Full test suite: 575 tests across 36 files, zero regressions.

### Phase 1: Complete — 6 Group A Rules

**Status:** All 18 oracle tests pass (6 rules x 3 tests each).

**What was built:**

```
src/adapters/analysis/spec/eslint-equiv/     NEW analysis target
├── types.ts                 EslintEquivDiagnostic, EslintEquivProjections
├── equations/
│   ├── helpers.ts           eslintDiag() constructor
│   ├── trivial-syn.ts       6 Group A equation functions
│   ├── gather.ts            allEslintViolations recursive gather
│   └── index.ts             Equation barrel
├── spec.ts                  AnalysisDecl<TSNodeKind> — 45 attrs (41 rules + 3 inh + gather)
├── projections.ts           AnalysisProjections — group by ruleId
├── generated/               Codegen output (dispatch.ts, attr-types.ts, dep-graph.ts)
│   ├── dispatch.ts          ~17K lines — per-kind dispatch for 364 node kinds
│   ├── attr-types.ts        KSCAttrMap interface with 45 attributes
│   └── dep-graph.ts         Static dependency graph
└── index.ts                 Adapter barrel

src/application/
├── evaluation/
│   └── eslint-equiv.ts      NEW — EvaluationTarget + evaluator singleton
└── codegen/
    └── codegen-targets.ts   MODIFIED — added eslintEquivTarget to allTargets

test/oracle/                 NEW oracle test infrastructure
├── helpers/
│   ├── types.ts             NormalisedViolation, OracleRule
│   ├── eslint-runner.ts     Programmatic ESLint runner (flat config, TS parser)
│   ├── ksc-runner.ts        KindScript evaluator runner (eslint-equiv target)
│   └── normalise.ts         sortViolations utility
├── fixtures/                82 fixture files (violations.ts + clean.ts × 41 rules)
│   ├── eqeqeq/src/                        Phase 1 (Group A)
│   ├── no-var/src/
│   ├── no-debugger/src/
│   ├── no-empty/src/
│   ├── no-bitwise/src/
│   ├── no-explicit-any/src/
│   ├── no-dupe-keys/src/                  Phase 2 (Group B)
│   ├── no-self-compare/src/
│   ├── max-params/src/
│   ├── no-empty-interface/src/
│   ├── no-duplicate-imports/src/
│   ├── max-depth/src/                     Phase 3 (Group C)
│   ├── array-type/src/                    Phase 5 (Group E)
│   ├── consistent-type-definitions/src/
│   ├── no-console/src/                    Phase 6
│   ├── no-eval/src/
│   ├── no-new-wrappers/src/
│   ├── no-plusplus/src/
│   ├── no-template-curly-in-string/src/
│   ├── no-cond-assign/src/
│   ├── no-duplicate-case/src/
│   ├── no-self-assign/src/
│   ├── default-case/src/
│   ├── default-case-last/src/
│   ├── no-useless-catch/src/
│   ├── no-multi-assign/src/
│   ├── yoda/src/
│   ├── no-empty-function/src/
│   ├── use-isnan/src/
│   ├── no-sparse-arrays/src/
│   ├── no-empty-pattern/src/
│   ├── no-non-null-assertion/src/         Phase 7
│   ├── no-namespace/src/
│   ├── no-require-imports/src/
│   ├── no-empty-object-type/src/
│   ├── consistent-type-assertions/src/
│   ├── no-duplicate-enum-values/src/
│   ├── prefer-as-const/src/
│   ├── no-dupe-class-members/src/         Phase 8
│   ├── no-useless-constructor/src/
│   └── no-empty-static-block/src/
└── oracle.test.ts           Parameterised test (41 rules × 3 assertions)
```

**Implemented rules:**

| Rule | KSC Attribute | Node Kind(s) | Phase | Oracle Status |
|------|---------------|-------------|-------|---------------|
| `eqeqeq` | `eqeqeqViolation` | BinaryExpression | 1 (A) | PASS — 5 violations matched |
| `no-var` | `noVarViolation` | VariableDeclarationList | 1 (A) | PASS — 3 violations matched |
| `no-debugger` | `noDebuggerViolation` | DebuggerStatement | 1 (A) | PASS — 1 violation matched |
| `no-empty` | `noEmptyViolation` | Block | 1 (A) | PASS — 2 violations matched |
| `no-bitwise` | `noBitwiseViolation` | BinaryExpression, PrefixUnaryExpression | 1 (A) | PASS — 7 violations matched |
| `@typescript-eslint/no-explicit-any` | `noExplicitAnyViolation` | AnyKeyword | 1 (A) | PASS — 4 violations matched |
| `no-dupe-keys` | `noDupeKeysViolation` | ObjectLiteralExpression | 2 (B) | PASS — returns `[]` per node |
| `no-self-compare` | `noSelfCompareViolation` | BinaryExpression | 2 (B) | PASS — recursive structural equality |
| `max-params` | `maxParamsViolation` | FunctionDeclaration, ArrowFunction, MethodDeclaration, FunctionExpression | 2 (B) | PASS — max: 3 |
| `@typescript-eslint/no-empty-interface` | `noEmptyInterfaceViolation` | InterfaceDeclaration | 2 (B) | PASS — handles extends |
| `no-duplicate-imports` | `noDuplicateImportsViolation` | CompilationUnit | 2 (B) | PASS — groups by moduleSpecifier |
| `max-depth` | `nestDepth` (inh) + `maxDepthViolation` (syn) | IfStatement, ForStatement, WhileStatement, etc. | 3 (C) | PASS — max: 4, else-if handled |
| `@typescript-eslint/array-type` | `arrayTypeViolation` | TypeReference | 5 (E) | PASS — flags `Array<T>` syntax |
| `@typescript-eslint/consistent-type-definitions` | `typeDeclStyleViolation` | TypeAliasDeclaration | 5 (E) | PASS — flags type alias for object literal |
| `no-console` | `noConsoleViolation` | CallExpression | 6 | PASS |
| `no-eval` | `noEvalViolation` | CallExpression | 6 | PASS |
| `no-new-wrappers` | `noNewWrappersViolation` | NewExpression | 6 | PASS |
| `no-plusplus` | `noPlusPlusViolation` | PrefixUnaryExpression, PostfixUnaryExpression | 6 | PASS |
| `no-template-curly-in-string` | `noTemplateCurlyViolation` | StringLiteral | 6 | PASS |
| `no-cond-assign` | `noCondAssignViolation` | IfStatement, WhileStatement, DoStatement, ForStatement | 6 | PASS |
| `no-duplicate-case` | `noDuplicateCaseViolation` | CaseBlock | 6 | PASS |
| `no-self-assign` | `noSelfAssignViolation` | BinaryExpression | 6 | PASS |
| `default-case` | `defaultCaseViolation` | CaseBlock | 6 | PASS |
| `default-case-last` | `defaultCaseLastViolation` | CaseBlock | 6 | PASS |
| `no-useless-catch` | `noUselessCatchViolation` | TryStatement | 6 | PASS |
| `no-multi-assign` | `noMultiAssignViolation` | BinaryExpression | 6 | PASS |
| `yoda` | `yodaViolation` | BinaryExpression | 6 | PASS |
| `no-empty-function` | `noEmptyFunctionViolation` | FunctionDeclaration, ArrowFunction, MethodDeclaration, FunctionExpression | 6 | PASS |
| `use-isnan` | `useIsNanViolation` | BinaryExpression | 6 | PASS |
| `no-sparse-arrays` | `noSparseArraysViolation` | ArrayLiteralExpression | 6 | PASS |
| `no-empty-pattern` | `noEmptyPatternViolation` | ObjectBindingPattern, ArrayBindingPattern | 6 | PASS |
| `@typescript-eslint/no-non-null-assertion` | `noNonNullAssertionViolation` | NonNullExpression | 7 | PASS |
| `@typescript-eslint/no-namespace` | `noNamespaceViolation` | ModuleDeclaration | 7 | PASS |
| `@typescript-eslint/no-require-imports` | `noRequireImportsViolation` | CallExpression | 7 | PASS |
| `@typescript-eslint/no-empty-object-type` | `noEmptyObjectTypeViolation` | TypeLiteral | 7 | PASS |
| `@typescript-eslint/consistent-type-assertions` | `typeAssertionStyleViolation` | TypeAssertionExpression | 7 | PASS |
| `@typescript-eslint/no-duplicate-enum-values` | `noDuplicateEnumValuesViolation` | EnumDeclaration | 7 | PASS |
| `@typescript-eslint/prefer-as-const` | `preferAsConstViolation` | AsExpression, TypeAssertionExpression | 7 | PASS |
| `no-dupe-class-members` | `noDupeClassMembersViolation` | ClassDeclaration, ClassExpression | 8 | PASS |
| `no-useless-constructor` | `noUselessConstructorViolation` | Constructor | 8 | PASS |
| `no-empty-static-block` | `noEmptyStaticBlockViolation` | ClassStaticBlockDeclaration | 8 | PASS |

**Equation file structure:**

```
equations/
├── trivial-syn.ts       6 Group A equations (single-node pattern match)
├── child-inspection.ts  8 Group B equations (inspect children: dupes, counts, structure)
├── depth.ts             Group C equations (inh nestDepth + syn maxDepthViolation)
├── ts-style.ts          2 Group E equations (array-type, consistent-type-definitions)
├── more-syn.ts          25 Phase 6 equations (error patterns, code quality, switch cases)
├── more-ts-style.ts     8 Phase 7 equations (TS-specific: non-null, namespace, enums, etc.)
├── class-rules.ts       4 Phase 8 equations (class members, constructor, static blocks)
├── gather.ts            allEslintViolations recursive gather (handles both single + array attrs)
├── helpers.ts           eslintDiag() constructor
└── index.ts             Equation barrel
```

**Attribute architecture — 45 AttrDecls:**

- **6 syn (Group A):** single-node pattern match → `EslintEquivDiagnostic | null`
- **1 inh (Group B):** `maxParamsThreshold: number` — configurable max param count (default: 3)
- **5 syn (Group B):** child-inspection → `EslintEquivDiagnostic | null` or `EslintEquivDiagnostic[]`
- **1 inh (Group C):** `nestDepth: number` — tracks control flow nesting depth
- **1 inh (Group C):** `maxDepthThreshold: number` — configurable max nesting depth (default: 4)
- **1 syn (Group C):** `maxDepthViolation` — fires when `nestDepth >= maxDepthThreshold`
- **2 syn (Group E):** TS-specific syntax style checks
- **17 syn (Phase 6):** error patterns + code quality rules
- **7 syn (Phase 7):** TS-specific annotation/assertion rules
- **3 syn (Phase 8):** class structure rules
- **1 syn (gather):** `allEslintViolations` — recursive gather across all rule attrs

**Key implementation decisions:**

1. **Report position on operator token, not parent node.** For `eqeqeq` and `no-bitwise`,
   ESLint reports the position of the `==`/`|` operator token, not the full
   BinaryExpression. The equation functions use `ctx.node.operatorToken.pos` to match.

2. **Self-recursion in gather attribute.** The `allEslintViolations` gather attribute
   recurses via `child.attr('allEslintViolations')` but does NOT declare itself in
   `withDeps()`. The dep graph tracks inter-attribute dependencies, not recursive
   self-calls on different tree nodes (same pattern as existing `allViolations`).

3. **ESLint flat config requires `files` pattern.** ESLint's flat config ignores `.ts`
   files by default. The runner must include `files: ['**/*.ts']` in the override config.

4. **Plugins must not be `undefined`.** ESLint's flat config rejects `plugins: undefined`.
   The runner conditionally adds the `plugins` key only for `@typescript-eslint` rules.

5. **`no-empty` skips catch blocks.** The equation function checks `ctx.parentIs('CatchClause')`
   to skip empty catch blocks, matching ESLint's default `allowEmptyCatch: false` but
   avoiding edge-case divergence.

6. **Projections group violations by `ruleId`.** The `violations` projection returns
   `Record<string, EslintEquivDiagnostic[]>` keyed by the ESLint rule ID string. This
   enables per-rule oracle comparison.

7. **Array-returning attrs use `code('[]')` default.** Rules that return multiple violations
   per node (e.g., `no-dupe-keys`, `no-duplicate-imports`) use `default: code('[]')` in
   the AttrDecl and are gathered separately from single-violation attrs in `gather.ts`.

8. **`else if` special case in `max-depth`.** ESLint doesn't count `else if` as additional
   nesting. The `nestDepth` inh parent equation for IfStatement checks if the child is
   `elseStatement` and is itself an IfStatement — if so, returns `undefined` (copy-down)
   instead of incrementing.

9. **`findFileName()` doesn't work on CompilationUnit.** The evaluator's `findFileName()`
   walks up to the parent with `fileContainerKind`, but when called ON the file container
   node itself, it finds no parent and returns `<unknown>`. The `no-duplicate-imports`
   equation (which runs on CompilationUnit) uses `ctx.node.fileName` directly instead.

10. **`no-dupe-args` dropped.** TypeScript's parser rejects duplicate parameter names as a
    syntax error in strict mode, making a KSC rule redundant — the file can't be parsed.

11. **`no-useless-catch` reports on TryStatement.** ESLint's `no-useless-catch` positions
    the violation on the CatchClause but ESLint reports the try statement line. Moving the
    equation to TryStatement and inspecting its `catchClause` child matches ESLint.

12. **`no-namespace` allows `declare module 'foo'`.** ESLint's default `allowDeclarations:
    false` flags `declare namespace Foo` but NOT `declare module 'foo'` (ambient external
    module with string literal name). The equation checks for DeclareKeyword + StringLiteral
    name combination.

13. **`no-dupe-class-members` allows accessor pairs.** A get/set pair with the same name is
    valid. The equation tracks member types and only flags duplicates of the same accessor
    kind or duplicate methods.

**Dev dependencies added:**
- `eslint` — programmatic ESLint API for oracle runner
- `@typescript-eslint/parser` — TypeScript-aware parsing for ESLint
- `@typescript-eslint/eslint-plugin` — for `@typescript-eslint/*` rules

### Phase 4: Deferred

Group D (`complexity` — collection attribute) is deferred. Collection attributes don't
naturally scope to function boundaries, making it difficult to match ESLint's per-function
complexity reporting without additional infrastructure. The `complexity` rule requires
tracking per-function scope, which would need either a parameterized collection attribute
or a separate function-scoped inh attribute to partition the collection.

### Phase 6 — More Trivial Syn Rules

**Goal:** Expand coverage with additional single-node pattern-match rules using the
established Group A pattern. Minimal effort per rule.

| # | ESLint Rule | KSC Attribute Name | Node Kind(s) | Check |
|---|-------------|-------------------|--------------|-------|
| 1 | `no-console` | `noConsoleViolation` | CallExpression | callee is `console.*` |
| 2 | `no-eval` | `noEvalViolation` | CallExpression | callee is `eval` |
| 3 | `no-new-wrappers` | `noNewWrappersViolation` | NewExpression | callee ∈ {Boolean, Number, String} |
| 4 | `no-plusplus` | `noPlusPlusViolation` | PostfixUnaryExpression, PrefixUnaryExpression | operator ∈ {++, --} |
| 5 | `no-sparse-arrays` | `noSparseArraysViolation` | ArrayLiteralExpression | has OmittedExpression children |
| 6 | `no-empty-pattern` | `noEmptyPatternViolation` | ObjectBindingPattern, ArrayBindingPattern | zero elements |
| 7 | `no-template-curly-in-string` | `noTemplateCurlyViolation` | StringLiteral | value contains `${` |
| 8 | `no-cond-assign` | `noCondAssignViolation` | IfStatement, WhileStatement, DoStatement, ForStatement | test child is BinaryExpression with assignment operator |
| 9 | `no-duplicate-case` | `noDuplicateCaseViolation` | CaseBlock | duplicate case clause expressions |
| 10 | `no-self-assign` | `noSelfAssignViolation` | BinaryExpression | assignment where left ≡ right structurally |
| 11 | `default-case` | `defaultCaseViolation` | CaseBlock | no DefaultClause child |
| 12 | `default-case-last` | `defaultCaseLastViolation` | CaseBlock | DefaultClause is not the last child |
| 13 | `no-useless-catch` | `noUselessCatchViolation` | CatchClause | body is just `throw <catch param>` |
| 14 | `no-multi-assign` | `noMultiAssignViolation` | BinaryExpression | assignment where right is also assignment |
| 15 | `yoda` | `yodaViolation` | BinaryExpression | comparison with literal on left |
| 16 | `no-empty-function` | `noEmptyFunctionViolation` | FunctionDeclaration, ArrowFunction, MethodDeclaration, FunctionExpression | empty body |
| 17 | `use-isnan` | `useIsNanViolation` | BinaryExpression | comparison with `NaN` identifier |

**Status:** Complete — all 17 rules pass (51 oracle tests)

**Implementation notes:**
- `no-useless-catch`: ESLint reports on the TryStatement (not CatchClause), so the equation
  runs on TryStatement and inspects `catchClause` child.
- `no-cond-assign`: checks `expression` field (IfStatement/WhileStatement/DoStatement) or
  `condition` field (ForStatement) for assignment operators.
- `no-duplicate-case`: uses `expressionText()` helper for simple literal comparison; complex
  expressions fall back to positional fingerprinting.

### Phase 7 — TS-Specific Syn Rules: Complete

**Goal:** Expand TS-specific coverage with additional annotation-style checks.

| # | ESLint Rule | KSC Attribute Name | Node Kind(s) | Oracle Status |
|---|-------------|-------------------|--------------|---------------|
| 1 | `@typescript-eslint/no-non-null-assertion` | `noNonNullAssertionViolation` | NonNullExpression | PASS |
| 2 | `@typescript-eslint/no-namespace` | `noNamespaceViolation` | ModuleDeclaration | PASS |
| 3 | `@typescript-eslint/no-require-imports` | `noRequireImportsViolation` | CallExpression | PASS |
| 4 | `@typescript-eslint/no-empty-object-type` | `noEmptyObjectTypeViolation` | TypeLiteral | PASS |
| 5 | `@typescript-eslint/consistent-type-assertions` | `typeAssertionStyleViolation` | TypeAssertionExpression | PASS |
| 6 | `@typescript-eslint/no-duplicate-enum-values` | `noDuplicateEnumValuesViolation` | EnumDeclaration | PASS |
| 7 | `@typescript-eslint/prefer-as-const` | `preferAsConstViolation` | AsExpression, TypeAssertionExpression | PASS |

**Status:** Complete — all 7 rules pass (21 oracle tests)

**Implementation notes:**
- `no-namespace`: `declare module 'foo'` (string literal name) is allowed by ESLint default;
  `declare namespace Foo` is NOT (default `allowDeclarations: false`).
- `no-duplicate-enum-values`: only checks literal initializers (string/numeric); auto-
  incremented or computed values are skipped.
- `prefer-as-const`: checks both `as` expressions and angle-bracket assertions for literal
  type annotations that match the expression value.

### Phase 8 — Class Structure Rules: Complete

**Goal:** Cover class-related child-inspection rules.

| # | ESLint Rule | KSC Attribute Name | Node Kind(s) | Oracle Status |
|---|-------------|-------------------|--------------|---------------|
| 1 | `no-dupe-class-members` | `noDupeClassMembersViolation` | ClassDeclaration, ClassExpression | PASS |
| 2 | `no-useless-constructor` | `noUselessConstructorViolation` | Constructor | PASS |
| 3 | `no-empty-static-block` | `noEmptyStaticBlockViolation` | ClassStaticBlockDeclaration | PASS |

**Status:** Complete — all 3 rules pass (9 oracle tests)

**Implementation notes:**
- `no-dupe-class-members`: allows get/set accessor pairs (same name, different type);
  flags duplicate methods, duplicate getters, etc. Handles static vs instance separately.
- `no-useless-constructor`: detects (1) empty no-arg constructors and (2) constructors
  that only call `super(...args)` with identical params. Allows parameter properties
  (`private x`).

### Infrastructure Improvements: Complete

1. **`findFileName()` fix in evaluator** — Fixed in `packages/core-evaluator/src/engine.ts`.
   The walk now starts at `this` (the current node) instead of `this.parent`, so equations
   running on the file container node itself (e.g., CompilationUnit) correctly find the
   filename. The `no-duplicate-imports` workaround was reverted to use `ctx.findFileName()`.

2. **Configurable thresholds via inh attributes** — `max-params` and `max-depth` thresholds
   are now inh attributes (`maxParamsThreshold`, `maxDepthThreshold`) with default root
   values (3 and 4 respectively). Equations read the threshold via `ctx.attr(...)` instead
   of hardcoded constants. The thresholds propagate via pure copy-down (no parent equations)
   and could be overridden at any subtree root in the future.

### Adding new rules

The oracle infrastructure is in place — adding new rules follows the pattern:

1. Write equation function in `equations/` with `withDeps([])`
2. Add attr to `spec.ts`
3. Update `SINGLE_RULE_ATTRS` or `ARRAY_RULE_ATTRS` in `gather.ts`
4. Run `npm run codegen`
5. Add fixture files in `test/oracle/fixtures/<rule>/src/`
6. Add entry to `ORACLE_RULES` in `oracle.test.ts`
7. Run `npx vitest run test/oracle/`
