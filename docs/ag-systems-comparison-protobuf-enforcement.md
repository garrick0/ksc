# How JastAdd and Silver Would Handle Protobuf Getter Enforcement

A comparison of how the two major attribute grammar systems would implement the
"detect direct field access on protobuf messages" analysis, along with their
general patterns for coding convention enforcement and configuration.

---

## 1. JastAdd Approach

### 1.1 The Canonical Pattern: Collection Attributes + Contributions

JastAdd's standard violation detection pattern uses **collection attributes**
with a `contributes ... when ... to ...` mechanism. The root of the compilation
unit declares a collection attribute:

```java
coll LinkedList<Problem> CompilationUnit.problems() root CompilationUnit;
```

Individual node types conditionally contribute violations:

```java
// Direct contribution with guard clause
PropertyAccessExpression contributes
    errorf("Direct field access '.%s' on protobuf type '%s'",
           getName().getID(), getExpression().typeString())
    when isProtobufDirectAccess()
    to CompilationUnit.problems();
```

Where `isProtobufDirectAccess()` is a synthesized attribute:

```java
syn boolean PropertyAccessExpression.isProtobufDirectAccess() {
    // Step 1: Is expression a protobuf type?
    if (!protobufTypeEnv().contains(getExpression().typeString()))
        return false;
    // Step 2: Is the accessed name a method?
    if (getName().isMethod()) return false;
    // Step 3: Is this inside a call expression?
    if (parentIsCallExpression()) return false;
    // All checks failed -> violation
    return true;
}
```

### 1.2 Collect-Propagate-Check: The JastAdd Idiom

JastAdd's bread-and-butter analysis pattern maps directly to the protobuf design:

**Phase 1 — Collect (synthesized)**: Gather protobuf type names from imports

```java
// Synthesized attribute on CompilationUnit
syn lazy Set<String> CompilationUnit.protobufTypes() {
    Set<String> types = new HashSet<>();
    for (ImportDeclaration imp : getImportDeclList()) {
        if (isProtobufModule(imp.getModuleSpecifier())) {
            for (ImportSpecifier spec : imp.getNamedImports()) {
                types.add(spec.getLocalName());
            }
        }
    }
    return types;
}
```

**Phase 2 — Propagate (inherited)**: Broadcast protobuf type set to all nodes

```java
// Inherited attribute available at every node
inh Set<String> ASTNode.protobufTypeEnv();

// Root equation collects from all compilation units
eq Program.getChild().protobufTypeEnv() {
    Set<String> env = new HashSet<>();
    for (CompilationUnit cu : getCompilationUnitList()) {
        env.addAll(cu.protobufTypes());
    }
    return Collections.unmodifiableSet(env);
}
```

The inherited attribute copies down automatically to every descendant. JastAdd calls
this "broadcasting" — when a parent defines `eq Parent.getChild().attr() = value`,
the value propagates to the **entire subtree**, not just the immediate child.

**Phase 3 — Check (synthesized + contribute)**: Detect violations at usage sites

```java
syn Collection<Problem> PropertyAccessExpression.protobufProblems() {
    Collection<Problem> problems = new LinkedList<>();
    String exprType = getExpression().typeString();
    if (!protobufTypeEnv().contains(exprType)) return problems;
    if (getName().isMethod()) return problems;
    if (parentIsCallExpression()) return problems;

    problems.add(errorf(
        "Direct field access '.%s' on protobuf type '%s' — use getter method",
        getName().getID(), exprType));
    return problems;
}

// Contribute to the problems collection
PropertyAccessExpression contributes each protobufProblems()
    to CompilationUnit.problems();
```

### 1.3 Configuration in JastAdd

JastAdd has **no built-in configuration framework**. The standard approach is:

#### The `program().options()` pattern (canonical)

Store configuration on the root AST node and expose it via an inherited attribute:

```java
// Store options on the root Program node
public Options Program.options = new Options();

// Broadcast the Program reference to every node
inh Program ASTNode.program();
eq Program.getChild().program() = this;

// Any equation can access configuration:
if (program().options().hasOption("--check-protobuf")) { ... }
```

This is exactly what ExtendJ (the JastAdd-based Java compiler) does. The pattern:
1. Root node holds an `Options` object (set imperatively before analysis begins)
2. An inherited attribute `program()` broadcasts the root reference to every descendant
3. Any equation calls `program().options()` to access settings

#### Module-level static fields (workaround)

JastAdd also supports static fields on ASTNode as a workaround:

```java
static Set<String> ASTNode.protobufModulePatterns = Collections.emptySet();
```

This is the JastAdd equivalent of KindScript's module-level singleton pattern
(`let _protobufModulePatterns`). The JastAdd reference manual documents this
as an explicit idiom, though the `program()` inherited attribute approach is preferred.

#### No per-rule enable/disable mechanism

JastAdd provides **no framework-level mechanism for enabling/disabling rules**.
Projects implement it by checking configuration inside `when` guards:

```java
PropertyAccessExpression contributes each protobufProblems()
    when program().options().isRuleEnabled("protobuf-getter")
    to CompilationUnit.problems();
```

This is purely application-level code — the JastAdd framework is not involved.

**Configuration is always global or "on/off".** There is no JastAdd mechanism for
"this directory allows protobuf direct access but this one doesn't" — you would need
to implement scoped configuration yourself via inherited attributes that change at
scope boundaries:

```java
// Hypothetical scoped config
inh AnalysisConfig CompilationUnit.analysisConfig();
eq Program.getCompilationUnit(int i).analysisConfig() {
    return configForFile(getCompilationUnit(i).getFileName());
}
```

### 1.4 Multi-Concern Organization: Aspects

JastAdd uses **`.jrag` aspect files** to organize analyses by concern:

```
aspects/
  NameCheck.jrag          ← name resolution violations
  TypeCheck.jrag          ← type mismatch violations
  AccessControl.jrag      ← visibility violations
  ProtobufCheck.jrag      ← protobuf getter violations (new)
```

Each aspect defines its own `*Problems()` synthesized methods and contributes them
to the shared `CompilationUnit.problems()` collection. Aspects can span multiple
node types:

```java
// ProtobufCheck.jrag
aspect ProtobufCheck {
    // Attribute declarations
    syn lazy Set<String> CompilationUnit.protobufTypes();
    inh Set<String> ASTNode.protobufTypeEnv();

    // Equations for collect phase
    eq CompilationUnit.protobufTypes() { ... }
    eq Program.getChild().protobufTypeEnv() { ... }

    // Check equations
    syn Collection<Problem> PropertyAccessExpression.protobufProblems() { ... }

    // Contribution to problems collection
    PropertyAccessExpression contributes each protobufProblems()
        to CompilationUnit.problems();
}
```

The aspects are **automatically composed** by JastAdd's build system. Dependencies
between aspects (e.g., `ProtobufCheck` needing `TypeAnalysis` results) are resolved
by demand-driven evaluation — no explicit ordering needed.

ExtendJ demonstrates this at scale with ~50 aspect files for the Java 4 frontend:

| Category | Aspect Files |
|----------|-------------|
| Name resolution | `LookupType.jrag`, `LookupVariable.jrag`, `LookupMethod.jrag` |
| Type analysis | `TypeAnalysis.jrag`, `PrimitiveTypes.jrag`, `Arrays.jrag` |
| Checking | `NameCheck.jrag`, `TypeCheck.jrag`, `AccessControl.jrag`, `Modifiers.jrag` |
| Error infrastructure | `ErrorCheck.jrag` |
| Configuration | `Options.jadd` |

### 1.5 ExtendJ: Real-World Example of the Pattern

ExtendJ's access control checking is the closest real-world analog to protobuf
getter enforcement — both check whether a specific access pattern is allowed:

```java
// Synthesized: is this type accessible from that context?
syn boolean TypeDecl.accessibleFrom(TypeDecl type) {
    if (isPublic()) return true;
    if (isPrivate()) return topLevelType() == type.topLevelType();
    return hostPackage().equals(type.hostPackage());
}

// Use site contributes violations
TypeAccess contributes each accessControlProblems()
    to CompilationUnit.problems();
```

The pattern is identical: determine what the entity is, check what access is
allowed, report violation if access is forbidden.

### 1.6 Key References (JastAdd)

| Resource | URL |
|----------|-----|
| JastAdd Reference Manual | https://jastadd.cs.lth.se/web/documentation/reference-manual.php |
| JastAdd Concept Overview | https://jastadd.cs.lth.se/web/documentation/concept-overview.php |
| ExtendJ (Java compiler) | https://extendj.org/ and https://github.com/ExtendJ/ExtendJ |
| PicoJava Example | https://jastadd.cs.lth.se/web/examples.php?example=PicoJava |
| Tutorial paper (Hedin, 2011) | https://link.springer.com/chapter/10.1007/978-3-642-18023-1_4 |
| Patterns paper (Fors, 2020) | https://fileadmin.cs.lth.se/cs/Personal/Niklas_Fors/publications/fors20sle.pdf |
| Collection attributes paper | https://link.springer.com/article/10.1007/s10515-009-0046-z |
| JastAdd System paper (2007) | https://www.sciencedirect.com/science/article/pii/S0167642307001591 |
| ExtendJ Extensions | https://jastadd.cs.lth.se/web/extendj/extensions.php |
| JastAdd Examples | https://jastadd.cs.lth.se/web/examples.php |
| NonNull Checker Extension | https://bitbucket.org/jastadd/jastaddj-nonnullchecker |
| EDAN70 Student Projects (ErrorProne in JastAdd) | https://cs.lth.se/edan70/projects-in-compilers-and-program-analysis/compiler-projects-fall-2015/ |

---

## 2. Silver Approach

### 2.1 The Canonical Pattern: Monoid Attributes + Contributions

Silver uses **monoid (collection) attributes** with a `<-` contribution operator:

```silver
monoid attribute errors :: [Message] with [], ++;
```

This declares `errors` as a collection attribute with base value `[]` (empty list)
and combining operator `++` (concatenation). Productions contribute errors:

```silver
abstract production propertyAccessExpr
top::Expr ::= obj::Expr name::Name
{
  propagate errors;  -- auto-collect from children

  top.errors <-
    if isProtobufDirectAccess(obj.typerep, name, top.env)
    then [errFromOrigin(name, "Direct field access '." ++ name.name
                              ++ "' on protobuf type — use getter method")]
    else [];
}
```

The `propagate errors;` statement auto-generates the equation that collects
errors from all children. The `<-` operator contributes additional errors
specific to this production.

### 2.2 Collect-Propagate-Check in Silver

**Phase 1 — Collect (synthesized `defs`)**: Declarations produce definitions

```silver
monoid attribute defs :: [Def] with [], ++;

abstract production importDecl
top::Decl ::= specifier::StringLiteral bindings::ImportBindingList
{
  -- If this import is from a protobuf module, contribute protobuf defs
  top.defs <-
    if isProtobufModule(specifier.value)
    then map(protobufTypeDef, bindings.names)
    else [];
}
```

**Phase 2 — Propagate (inherited `env`)**: Environment threads through statements

```silver
inherited attribute env :: Env;

abstract production seqStmt
top::Stmt ::= s1::Stmt s2::Stmt
{
  s1.env = top.env;
  s2.env = addEnv(s1.defs, top.env);
}
```

Silver uses an explicit `Env` data structure (typically a list of scopes with
lookup functions). The `env` flows down through inherited attributes, with
`defs` (synthesized) adding to the environment at declaration sites.

**Phase 3 — Check (contribute errors)**: Violations at usage sites

```silver
abstract production memberAccessExpr
top::Expr ::= obj::Expr deref::Boolean name::Name
{
  propagate errors;

  -- Look up type info from the environment
  local objType :: Type = obj.typerep;

  top.errors <-
    if isProtobufType(objType, top.env)
    then if name.isMethod then []
         else if isCallee(top) then []
         else [errFromOrigin(name,
                "Direct field access '." ++ name.name
                ++ "' on protobuf type '" ++ show(80, objType)
                ++ "' — use getter method")]
    else [];
}
```

### 2.3 Configuration in Silver

Silver also has **no built-in configuration/options framework**.

#### Inherited attributes from the root

The standard AG pattern — inherited attributes of the root represent external config:

```silver
abstract production root
top::Root ::= d::GlobalDecls
{
  d.env = addEnv(builtinDefs, top.env);
  d.analysisConfig = top.analysisConfig;
}
```

Configuration is injected at the root by whoever decorates the tree:

```silver
local decorated :: Root = decorate parseResult with {
  env = emptyEnv();
  analysisConfig = loadConfig("ksc.config.ts");
};
```

#### Grammar module selection (build-time configuration)

Silver's primary "configuration" mechanism is **which grammar modules you import**:

```silver
grammar myproject:composed:with_protobuf;
imports myproject:host;
imports myproject:extensions:protobuf_checking;
imports myproject:extensions:kind_checking;
```

You turn analyses on/off by including or excluding extension grammars at build time.
There is no runtime "enable/disable rule" — each extension's checks are always active
when the extension is included.

This is a fundamentally different model from lint tools like ESLint where you have a
`.eslintrc` with `"rules": { "no-console": "warn" }`. In Silver, you would have a
separate grammar `extensions:no_console` that you either import or don't.

#### No scoped configuration

Like JastAdd, Silver has no framework support for "these files allow X but those don't."
You would need to implement it via inherited attributes:

```silver
inherited attribute protobufCheckEnabled :: Boolean;

aspect production compilationUnit
top::CompilationUnit ::= imports::Imports decls::Decls
{
  decls.protobufCheckEnabled =
    not (contains(top.fileName, configuredExclusions));
}
```

### 2.4 Extension Composition: Forwarding

Silver's key innovation is **forwarding**, which solves the expression problem.
New syntax forwards to existing host language constructs for default attribute values:

```silver
abstract production repeatStmt
s::Stmt ::= body::Stmt cond::Expr
{
  s.pp = "repeat " ++ body.pp ++ " until " ++ cond.pp;
  forwards to seqStmt(@body, whileStmt(notExpr(@cond), blockStmt(^body)));
}
```

For protobuf enforcement, forwarding is less relevant since we're adding new
**checks** (attributes), not new **syntax** (productions). But the forwarding
mechanism means that if a protobuf extension adds a `protobufErrors` attribute,
any other independently-developed extension's new productions automatically
get the right default behavior via forwarding.

### 2.5 Aspect Productions for Adding Checks

Silver allows adding equations to existing productions from separate modules:

```silver
-- In extensions/protobuf_checking/Checks.sv
aspect production memberAccessExpr
top::Expr ::= obj::Expr deref::Boolean name::Name
{
  top.errors <-
    if isProtobufDirectAccess(obj.typerep, name.name, top.env)
    then [errFromOrigin(name, "Use getter method instead of direct field access")]
    else [];
}
```

This is powerful: you can add protobuf checking to the existing `memberAccessExpr`
production without modifying the host grammar. The aspect just contributes
additional errors to the existing collection attribute.

### 2.6 The Type Qualifier Paper (Closest Analog)

The closest Silver work to protobuf getter enforcement is **Carlson & Van Wyk's
"Type Qualifiers as Composable Language Extensions" (GPCE 2017)**. The `nonnull`
qualifier works similarly:

1. **Annotate at declaration sites**: `nonnull int* ptr = malloc(...);`
2. **Propagate through the type system**: qualifier info flows via `typerep`
3. **Check at usage sites**: assigning a possibly-null value to a `nonnull` variable is an error
4. **Optionally generate runtime checks**: where static checking is infeasible

The architecture is:

```
Declare qualifier → Attach to types → Flow through expression types → Check at assignments/calls
```

For protobuf, the analogous flow is:

```
Detect protobuf import → Mark types as protobuf → Flow type info through expressions → Check at property accesses
```

### 2.7 Key References (Silver)

| Resource | URL |
|----------|-----|
| Silver home page | https://melt.cs.umn.edu/silver/ |
| Silver tutorial (6 chapters) | https://melt.cs.umn.edu/silver/tutorial/ |
| Silver collection attributes | https://melt.cs.umn.edu/silver/concepts/collections/ |
| Silver attribute declarations | https://melt.cs.umn.edu/silver/ref/decl/attributes/ |
| Silver aspect productions | https://melt.cs.umn.edu/silver/concepts/aspects/ |
| Silver forwarding | https://melt.cs.umn.edu/silver/ref/stmt/forwarding/ |
| Silver modular well-definedness | https://melt.cs.umn.edu/silver/concepts/modular-well-definedness/ |
| Silver style guide | https://melt.cs.umn.edu/silver/style-guide/ |
| ableC (extensible C compiler) | https://github.com/melt-umn/ableC |
| Silver tutorial at Google | https://github.com/melt-umn/Silver-tutorial |
| Silver AG System paper (2010) | https://www-users.cse.umn.edu/~evw/pubs/vanwyk10scp/vanwyk10scp.pdf |
| MWDA paper (2012) | https://www-users.cse.umn.edu/~evw/pubs/kaminski12sle/kaminski12sle.pdf |
| Type Qualifiers paper (2017) | https://www-users.cse.umn.edu/~evw/pubs/carlson17gpce/carlson17gpce.pdf |
| ableC OOPSLA 2017 paper | https://dl.acm.org/doi/10.1145/3138224 |
| Oberon0 modular spec (2015) | https://www.sciencedirect.com/science/article/pii/S0167642315003020 |
| Eric Van Wyk publications | https://www-users.cse.umn.edu/~evw/pubs.html |

---

## 3. Side-by-Side Comparison

### 3.1 Violation Collection Mechanism

| Concern | JastAdd | Silver | KindScript (current) |
|---------|---------|--------|---------------------|
| Violation attribute | `coll LinkedList<Problem> CompilationUnit.problems()` | `monoid attribute errors :: [Message] with [], ++;` | `allViolations: syn`, recursive gather |
| Contribution syntax | `Node contributes expr when cond to Root.problems()` | `top.errors <- [...]` in production | Equation function returns `Diagnostic \| null` |
| Auto-collection | `contributes each methodName()` | `propagate errors;` | Manual: equation iterates children |
| Conditional | `when` guard on contribution | `if ... then [...] else []` | Equation logic returns null for non-violations |
| Multi-concern merge | All aspects contribute to same `problems()` | All aspects contribute to same `errors` | Would merge in projections |

### 3.2 Configuration

| Concern | JastAdd | Silver | KindScript (proposed) |
|---------|---------|--------|----------------------|
| Config mechanism | `program().options()` inherited attr | Inherited attr from root, or grammar imports | Module-level singleton via `setup()` |
| Where config lives | `Options` object on root AST node | Root inherited attribute values | `ksc.config.ts` |
| How equations access | `program().options().hasOption("...")` | `top.analysisConfig` (inherited) | `isProtobufModule(modulePath)` (module function) |
| Scoped config | Application-level inherited attr | Application-level inherited attr | Not planned (global enable/disable) |
| Rule enable/disable | `when program().options().isRuleEnabled(...)` | Grammar module import/exclude | Config field present = enabled |
| Build-time vs runtime | Both (but typically runtime options) | Primarily build-time (grammar imports) | Runtime (config file) |

### 3.3 Analysis Organization

| Concern | JastAdd | Silver | KindScript |
|---------|---------|--------|------------|
| Unit of organization | `.jrag` / `.jadd` aspect files | `.sv` grammar files | Equation modules in `equations/` |
| New analysis | New aspect file, contributes to `problems()` | New grammar, aspect productions contribute to `errors` | New attrs in spec, new equation file |
| Cross-cutting | Aspects can add equations to any node type | Aspect productions can extend any production | Equations keyed by node kind |
| Composition | Automatic (JastAdd build system) | Automatic (Silver composition) | Manual (add to spec, run codegen) |
| Independence | Demand-driven evaluation resolves order | Demand-driven evaluation resolves order | Dependency graph resolves order |

### 3.4 The Protobuf Pattern Specifically

| Step | JastAdd | Silver | KindScript (proposed) |
|------|---------|--------|----------------------|
| 1. Identify protobuf modules | Config via `program().options()` | Config via root inherited attr or grammar imports | Config via `ksc.config.ts` + module singleton |
| 2. Collect protobuf types | `syn Set<String> CU.protobufTypes()` | `top.defs <- protobufTypeDefs` (contribute to env) | `syn protobufTypes` on CompilationUnit |
| 3. Propagate type set | `inh Set<String> ASTNode.protobufTypeEnv()` | Flows through existing `env` attribute | `inh protobufTypeEnv` (new inherited attr) |
| 4. Detect violations | `syn Collection<Problem> PAE.protobufProblems()` | `top.errors <- [...]` in aspect on member access | `syn protobufViolation` on PropertyAccessExpression |
| 5. Aggregate | `contributes each protobufProblems() to CU.problems()` | `propagate errors;` + `<-` contributions | `syn allProtobufViolations` recursive gather |

---

## 4. What KindScript's Design Gets Right (and Where It Differs)

### 4.1 Alignment with AG traditions

The protobuf-getter-enforcement-v2 design aligns closely with established AG patterns:

1. **Collect-Propagate-Check** is the canonical pattern in both JastAdd and Silver.
   KindScript's `protobufTypes → protobufTypeEnv → protobufViolation` directly mirrors
   JastAdd's `protobufTypes() → protobufTypeEnv() → protobufProblems()` and Silver's
   `defs → env → errors`.

2. **Inherited attribute for broadcasting** (`protobufTypeEnv`) is exactly what both
   JastAdd and Silver do. JastAdd calls it "broadcasting" — when a parent defines
   `eq Parent.getChild().attr() = value`, it propagates to the entire subtree.

3. **Synthesized violation detection** at the specific node type (PropertyAccessExpression)
   mirrors JastAdd's `syn Collection<Problem> PropertyAccessExpression.protobufProblems()`.

4. **Module-level singleton for config** (`configureProtobufModules()`) is functionally
   equivalent to JastAdd's `static Set<String> ASTNode.protobufModulePatterns` pattern.
   Both are documented workarounds for "I need the equation to access config but there's
   no clean way to pass it through the AG framework."

### 4.2 Where KindScript differs

**No `contributes` syntax**: JastAdd and Silver both have first-class syntax for
contributing to collection attributes from any node. KindScript uses explicit recursive
gather (`allProtobufViolations`). This is more verbose but more explicit.

**Separate violation attributes**: KindScript uses a separate `allProtobufViolations`
attribute rather than contributing to the existing `allViolations`. JastAdd and Silver
would typically have a single `problems()` / `errors` collection that ALL analyses
contribute to. The KindScript approach merges in the projections layer instead.

**Config as module singleton vs. inherited attribute**: Both JastAdd and Silver prefer
an inherited attribute (the `program()` pattern or root inherited attr). KindScript's
module singleton is functionally equivalent but less "AG-pure" — it's a side channel
outside the AG dependency graph. Neither JastAdd nor Silver would consider this wrong,
but they'd consider it a pragmatic workaround rather than an idiomatic solution.

The inherited-attribute approach would look like:

```typescript
// Instead of module singleton:
{
  name: 'protobufConfig',
  direction: 'inh',
  type: 'ProtobufConfig',
  rootValue: () => getProtobufConfig(),  // from external config
  // No parent equations — pure copy-down
} as InhAttr
```

Then `protobufTypes` would read `ctx.attr('protobufConfig')` instead of calling
`isProtobufModule()`. This keeps all data flow within the AG graph. The tradeoff:
one more attribute, but full traceability.

### 4.3 Build-time vs runtime configuration

A notable philosophical difference: Silver strongly favors **build-time** configuration
(you import or don't import an extension grammar). JastAdd supports both but tends
toward **runtime** configuration (`program().options()`). KindScript's approach
(`ksc.config.ts`) is closer to JastAdd's runtime model.

Neither JastAdd nor Silver has a concept of "these files are checked but those aren't"
at the framework level. If an analysis is enabled, it runs everywhere. Scoped
configuration is always application-level code.

---

## 5. Protobuf/gRPC in the AG World

**Neither JastAdd nor Silver has any examples of protobuf/gRPC enforcement.** Both
systems are primarily used for programming language implementation:

- JastAdd: ExtendJ (Java), JModelica (Modelica), various DSLs
- Silver: ableC (C), Oberon0, various DSLs

The API enforcement / protobuf / gRPC space uses entirely different tooling:
- `buf lint` (protobuf linting)
- `api-linter` (Google API design guidelines)
- `protovalidate` (runtime validation)
- ESLint rules (JS/TS-level enforcement)

The closest analogs in AG research are:

1. **ExtendJ's access control checking** — determines whether a type access is
   permitted based on visibility modifiers and lexical scope. Same structure:
   collect visibility info → propagate scope context → check at access sites.

2. **Silver's type qualifier extensions** (Carlson & Van Wyk, GPCE 2017) — enforces
   that `nonnull` values aren't assigned to nullable targets. Same structure:
   annotate at declarations → propagate through types → check at usage sites.

3. **JastAdd NonNull Checker** (BitBucket: `jastaddj-nonnullchecker`) — an ExtendJ
   extension that detects null-pointer risks using JastAdd attributes.

---

## 6. Summary: What Each System Teaches Us

### From JastAdd

- **The `program().options()` pattern** is the battle-tested way to get configuration
  into equations. It's an inherited attribute that broadcasts the root node (which holds
  config) to every descendant. Every node can call `program().options()`.
- **`contributes ... when ...`** cleanly separates "what is a violation?" from
  "how are violations aggregated?" KindScript's manual recursive gather is more
  explicit but more boilerplate.
- **Aspects per concern** keep analyses modular. KindScript's `equations/protobuf.ts`
  is the direct equivalent of JastAdd's `ProtobufCheck.jrag`.
- **Configuration is always global** — enabled/disabled project-wide, never scoped to
  specific files or directories at the framework level.

### From Silver

- **Grammar-module imports as configuration** is a powerful idea: you compose your
  analysis by selecting which extensions to include. KindScript could model this as
  "which analysis adapter is composed" — if protobuf checking is a separate adapter,
  you include or exclude it.
- **Aspect productions** for adding checks to existing nodes without modifying them
  is elegant. KindScript's equation-per-kind-in-spec is less dynamic but has the same
  effect.
- **`propagate errors;`** auto-collects from children, reducing boilerplate. KindScript's
  collection attributes have the same `init + combine` pattern but require explicit
  declaration.
- **Type qualifiers** (nonnull extension) show the exact pattern: mark types with
  metadata at declaration sites, propagate through expressions, check at usage sites.
  This is architecturally identical to protobuf-type-env propagation.

### For KindScript's protobuf design

The design in `protobuf-getter-enforcement-v2.md` is well-aligned with AG traditions:

1. The 4-attribute chain (collect → propagate → check → gather) is the canonical AG
   pattern used by both JastAdd and Silver for exactly this kind of analysis.

2. The module-level singleton for config is a pragmatic choice. JastAdd uses the same
   pattern (`static` fields on ASTNode). An inherited `protobufConfig` attribute would
   be more AG-pure but adds complexity for the same result.

3. Configuration is global (project-wide) — consistent with both JastAdd and Silver,
   where there is no framework support for file-scoped rule enable/disable.

4. The design to merge protobuf violations into the existing `diagnostics` projection
   is analogous to JastAdd's single `problems()` collection and Silver's single `errors`
   monoid — all analyses contribute to one aggregation point.
