# Plan: TypeScript Checker Fields in KSC AST

> Stamp TS binder and checker information onto KSC AST nodes during conversion,
> add corresponding AG attributes, and make the depth of analysis configurable.

---

## 1. Current State

**One checker field exists:** `Identifier.resolvesToImport: boolean`, stamped during conversion via `isImportReference()` which calls `checker.getSymbolAtLocation()` and checks `SymbolFlags.Alias`.

**One kind property checked:** `noImports` — uses `resolvesToImport` to detect imported bindings in annotated scopes.

**The TS checker is already initialized** in `buildKSTree()` via `tsProgram.getTypeChecker()`. The infrastructure for checker-aware conversion is in place.

**The design doc (04-checker.md)** describes 9+ properties that KSC should check: `noImports`, `noConsole`, `immutable`, `static`, `noSideEffects`, `noMutation`, `noIO`, `pure`, `maxFanOut`, plus relational properties (`noDependency`, `noCycles`, etc.).

---

## 2. Goals

1. **Stamp additional TS checker/binder fields** onto KSC AST nodes during conversion
2. **Add AG attributes** that use these fields to check kind properties
3. **Make analysis depth configurable**: parse-only, parse+bind, parse+bind+check
4. **Preserve the existing pattern**: schema declares fields, codegen generates converters, `convertFieldOverrides` wires checker calls

---

## 3. Three Analysis Levels

The TS compiler has three distinct phases. KSC should let users choose how much information to extract:

| Level | What TS Does | What KSC Stamps | Use Case |
|---|---|---|---|
| **parse** | Syntax tree only | AST structure, operators, literals, declaration kinds | Fast AST tooling, linting |
| **parse+bind** | + symbol tables, scope chains | + symbol flags, definition sites, export status, scope info | Name resolution, import analysis |
| **parse+bind+check** | + full type inference | + resolved types, type strings, call signatures, module paths | Type-aware property checking |

### Decision: How to Configure

**Chosen: Option B — Parameter on `buildKSTree`**

```ts
function buildKSTree(tsProgram: ts.Program, depth?: 'parse' | 'bind' | 'check'): KSTree
```

Single function, optional parameter, defaults to `'check'` (current behavior). The `analysisDepth` controls both which fields get populated and whether `getTypeChecker()` is called at all for `'parse'` mode. Also exposed via `KindScriptConfig.analysisDepth` and threaded through `program.ts`.

---

## 4. Fields to Add — Binder Level

These fields require `getTypeChecker()` (which triggers TS binding) but do NOT require type inference. They use symbol tables and flags only.

### 4.1 On `Identifier` nodes

#### Decision: Individual boolean fields for ALL symbol flags

Every TS `SymbolFlags` flag gets its own boolean field on Identifier. Schema-native, zero parsing, each field independently useful in equations.

| Field | Type | Source | Description |
|---|---|---|---|
| `escapedText` | `string` | **exists** | The identifier text |
| `resolvesToImport` | `boolean` | **exists** | Whether this identifier resolves to an imported binding |
| `isDefinitionSite` | `boolean` | Parent node analysis | `true` if this identifier IS the name of a declaration vs. a reference |
| `resolvedFileName` | `string` | `getAliasedSymbol(sym).declarations[0].getSourceFile().fileName` | For import aliases: which file the symbol was originally declared in. Empty for non-imports. |
| `symIsVariable` | `boolean` | `sym.flags & SymbolFlags.Variable` | Symbol is a variable |
| `symIsFunctionScopedVariable` | `boolean` | `sym.flags & SymbolFlags.FunctionScopedVariable` | Symbol is a `var` declaration |
| `symIsBlockScopedVariable` | `boolean` | `sym.flags & SymbolFlags.BlockScopedVariable` | Symbol is a `let`/`const` declaration |
| `symIsFunction` | `boolean` | `sym.flags & SymbolFlags.Function` | Symbol is a function |
| `symIsClass` | `boolean` | `sym.flags & SymbolFlags.Class` | Symbol is a class |
| `symIsInterface` | `boolean` | `sym.flags & SymbolFlags.Interface` | Symbol is an interface |
| `symIsTypeAlias` | `boolean` | `sym.flags & SymbolFlags.TypeAlias` | Symbol is a type alias |
| `symIsAlias` | `boolean` | `sym.flags & SymbolFlags.Alias` | Symbol is an import alias |
| `symIsProperty` | `boolean` | `sym.flags & SymbolFlags.Property` | Symbol is an object/class property |
| `symIsMethod` | `boolean` | `sym.flags & SymbolFlags.Method` | Symbol is a class/object method |
| `symIsEnum` | `boolean` | `sym.flags & SymbolFlags.Enum` | Symbol is an enum |
| `symIsEnumMember` | `boolean` | `sym.flags & SymbolFlags.EnumMember` | Symbol is an enum member |
| `symIsNamespace` | `boolean` | `sym.flags & SymbolFlags.Namespace` | Symbol is a namespace/module |
| `symIsExportValue` | `boolean` | `sym.flags & SymbolFlags.ExportValue` | Symbol is an exported value |
| `symIsType` | `boolean` | `sym.flags & SymbolFlags.Type` | Symbol is a type |
| `symIsValue` | `boolean` | `sym.flags & SymbolFlags.Value` | Symbol is a value |
| `importModuleSpecifier` | `string` | Walk symbol → ImportDeclaration → moduleSpecifier.text | For identifiers that resolve to imports: the module specifier string (e.g. `'./helper'`, `'fs'`). Empty for non-import identifiers. |

All `sym*` fields default to `false` when the checker is unavailable (parse-only mode) or when the identifier has no resolved symbol. `importModuleSpecifier` defaults to `''`.

### 4.2 On declaration nodes

#### Decision: `isExported` on each declaration node individually

Add `isExported: prop('boolean')` to each declaration kind. Strongly typed, clear which nodes carry the field.

**Declaration nodes that get `isExported`:**

- `VariableDeclaration` (technically checked via parent VariableStatement, but kept here for convenience)
- `VariableStatement`
- `FunctionDeclaration`
- `ClassDeclaration`
- `InterfaceDeclaration`
- `TypeAliasDeclaration`
- `EnumDeclaration`
- `ModuleDeclaration`
- `MethodDeclaration`
- `PropertyDeclaration`

### 4.3 On `ImportDeclaration` nodes

| Field | Type | Source | Depth | Description |
|---|---|---|---|---|
| `isTypeOnly` | `boolean` | `node.importClause?.isTypeOnly` | **parse** | Whether this is `import type { ... }` |
| `resolvedModulePath` | `string` | Module resolution via checker | **check** | Absolute file path this import resolves to. Empty for unresolvable/external. |

### 4.4 On scope containers

#### Decision: Include `localCount`

Cheap to compute (just `(node as any).locals?.size ?? 0`), useful for complexity analysis and `maxFanOut`.

| Field | Type | Source | Description |
|---|---|---|---|
| `localCount` | `number` | `(node as any).locals?.size ?? 0` | Number of locally declared symbols in this scope |

**Scope container nodes that get `localCount`:**

- `Block`
- `FunctionDeclaration`
- `FunctionExpression`
- `ArrowFunction`
- `ModuleBlock`
- `CaseClause`
- `DefaultClause`
- `ForStatement`
- `ForInStatement`
- `ForOfStatement`
- `Constructor`

`CompilationUnit` already has its own conversion logic; `localCount` should be added there as well (from the source file's `.locals`).

---

## 5. Fields to Add — Checker Level (Full Type Info)

These fields require full type checking and are more expensive. Only populated when `analysisDepth === 'check'`.

### 5.1 `typeString` — on ALL expression and declaration nodes

#### Decision: All nodes get `typeString`

Every expression node and every declaration node gets `typeString: prop('string')`. Complete type information across the entire AST.

**Expression nodes (~40 kinds):**
- All `Expression` subtypes: `Identifier`, `NumericLiteral`, `StringLiteral`, `BinaryExpression`, `CallExpression`, `PropertyAccessExpression`, `ElementAccessExpression`, `NewExpression`, `ArrowFunction`, `FunctionExpression`, `ArrayLiteralExpression`, `ObjectLiteralExpression`, `ConditionalExpression`, `TemplateExpression`, `TaggedTemplateExpression`, `TypeAssertionExpression`, `AsExpression`, `AwaitExpression`, `YieldExpression`, `SpreadElement`, `PrefixUnaryExpression`, `PostfixUnaryExpression`, `ParenthesizedExpression`, `DeleteExpression`, `TypeOfExpression`, `VoidExpression`, `NonNullExpression`, `SatisfiesExpression`, `ClassExpression`, etc.

**Declaration nodes (~10 kinds):**
- `VariableDeclaration`, `FunctionDeclaration`, `ClassDeclaration`, `MethodDeclaration`, `PropertyDeclaration`, `Parameter`, `GetAccessor`, `SetAccessor`, `PropertySignature`, `MethodSignature`

**Implementation note:** The codegen will add `typeString: prop('string')` to every node kind that is a member of the `Expression` sum type or a declaration kind, and wire the `convertFieldOverrides` to `'getTypeString(node)'`. The helper returns `''` when `_depth !== 'check'`.

### 5.2 Call/property resolution — via symbol flags + file path

#### Decision: Use `symbolFlags` + `resolvedFileName` on Identifier (Option C)

No special `resolvedCallTarget` or `resolvedPropertySymbol` fields. Instead, equations reconstruct call target information composably from:
- `Identifier.symIsFunction`, `symIsMethod`, etc. — what kind of thing is being called
- `Identifier.resolvedFileName` — where it was declared
- `Identifier.escapedText` — the name

For `PropertyAccessExpression` analysis (e.g. `console.log`), the equation walks to the `.name` child Identifier and checks its symbol flags + the expression's `escapedText`.

This keeps the schema lean and avoids formatting logic in conversion. Equations do slightly more work but gain full composability.

---

## 6. Implementation in Schema + Codegen

### 6.1 Schema changes (`ast-schema/schema.ts`)

```ts
// Identifier — individual boolean flags for every SymbolFlags value
node('Identifier', [...], {
  escapedText: prop('string'),
  resolvesToImport: prop('boolean'),       // exists
  isDefinitionSite: prop('boolean'),       // NEW (bind)
  resolvedFileName: prop('string'),        // NEW (bind)
  symIsVariable: prop('boolean'),          // NEW (bind)
  symIsFunctionScopedVariable: prop('boolean'), // NEW (bind)
  symIsBlockScopedVariable: prop('boolean'),    // NEW (bind)
  symIsFunction: prop('boolean'),          // NEW (bind)
  symIsClass: prop('boolean'),             // NEW (bind)
  symIsInterface: prop('boolean'),         // NEW (bind)
  symIsTypeAlias: prop('boolean'),         // NEW (bind)
  symIsAlias: prop('boolean'),             // NEW (bind)
  symIsProperty: prop('boolean'),          // NEW (bind)
  symIsMethod: prop('boolean'),            // NEW (bind)
  symIsEnum: prop('boolean'),              // NEW (bind)
  symIsEnumMember: prop('boolean'),        // NEW (bind)
  symIsNamespace: prop('boolean'),         // NEW (bind)
  symIsExportValue: prop('boolean'),       // NEW (bind)
  symIsType: prop('boolean'),              // NEW (bind)
  symIsValue: prop('boolean'),             // NEW (bind)
  importModuleSpecifier: prop('string'),   // NEW (bind) — module specifier for import aliases
  typeString: prop('string'),              // NEW (check)
});

// ImportDeclaration
node('ImportDeclaration', [...], {
  importClause: optChild('ImportClause'),
  moduleSpecifier: child(Expression),
  attributes: optChild('ImportAttributes'),
  isTypeOnly: prop('boolean'),             // NEW (parse)
  resolvedModulePath: prop('string'),      // NEW (check)
});

// VariableDeclaration
node('VariableDeclaration', [Declaration], {
  name: child(BindingName),
  type: optChild(TypeNode),
  initializer: optChild(Expression),
  isExported: prop('boolean'),             // NEW (bind)
  typeString: prop('string'),              // NEW (check)
});

// FunctionDeclaration
node('FunctionDeclaration', [...], {
  name: optChild('Identifier'),
  typeParameters: list('TypeParameter'),
  parameters: list('Parameter'),
  type: optChild(TypeNode),
  body: optChild('Block'),
  isExported: prop('boolean'),             // NEW (bind)
  typeString: prop('string'),              // NEW (check)
});

// ClassDeclaration — similar (isExported + typeString)
// InterfaceDeclaration — isExported
// TypeAliasDeclaration — isExported
// EnumDeclaration — isExported
// etc.

// Scope containers — add localCount
// Block, FunctionDeclaration, ArrowFunction, etc.
// localCount: prop('number'),             // NEW (bind)

// All Expression-type nodes — add typeString
// CallExpression, PropertyAccessExpression, BinaryExpression, etc.
// typeString: prop('string'),             // NEW (check)
```

### 6.2 Codegen changes (`ast-schema/codegen.ts`)

#### a) Accept `analysisDepth` in `buildKSTree`

```ts
export type AnalysisDepth = 'parse' | 'bind' | 'check';

let _depth: AnalysisDepth = 'check';

export function buildKSTree(
  tsProgram: ts.Program,
  depth: AnalysisDepth = 'check',
): KSTree {
  _depth = depth;
  if (depth !== 'parse') {
    _checker = tsProgram.getTypeChecker();
  } else {
    _checker = undefined;
  }
  // ... rest unchanged
}
```

#### b) Add converter helper functions

New helpers emitted into the generated `convert.ts` preamble:

```ts
// ── Symbol flag helpers (bind-level) ──

function getSymbol(node: ts.Node): ts.Symbol | undefined {
  if (!_checker) return undefined;
  return _checker.getSymbolAtLocation(node);
}

function hasSymbolFlag(node: ts.Node, flag: ts.SymbolFlags): boolean {
  const sym = getSymbol(node);
  return sym ? !!(sym.flags & flag) : false;
}

function isDefinitionSite(node: ts.Node): boolean {
  if (!ts.isIdentifier(node)) return false;
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isClassDeclaration(parent) && parent.name === node) return true;
  if (ts.isInterfaceDeclaration(parent) && parent.name === node) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;
  if (ts.isEnumDeclaration(parent) && parent.name === node) return true;
  if (ts.isEnumMember(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodSignature(parent) && parent.name === node) return true;
  if (ts.isGetAccessorDeclaration(parent) && parent.name === node) return true;
  if (ts.isSetAccessorDeclaration(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) && (parent.name === node || parent.propertyName === node)) return true;
  if (ts.isImportClause(parent)) return true;
  if (ts.isNamespaceImport(parent)) return true;
  if (ts.isExportSpecifier(parent)) return true;
  if (ts.isBindingElement(parent) && parent.name === node) return true;
  return false;
}

function getResolvedFileName(node: ts.Node): string {
  if (!_checker || !ts.isIdentifier(node)) return '';
  const sym = _checker.getSymbolAtLocation(node);
  if (!sym || !(sym.flags & ts.SymbolFlags.Alias)) return '';
  try {
    const resolved = _checker.getAliasedSymbol(sym);
    const decl = resolved.declarations?.[0];
    return decl ? decl.getSourceFile().fileName : '';
  } catch { return ''; }
}

function isNodeExported(node: ts.Node): boolean {
  if (!_checker) return false;
  const mods = (node as any).modifiers;
  if (mods?.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword)) return true;
  if (node.parent && ts.isExportAssignment(node.parent)) return true;
  return false;
}

function getLocalCount(node: ts.Node): number {
  if (!_checker) return 0;
  return (node as any).locals?.size ?? 0;
}

// ── Checker-level helpers ──

function getTypeString(node: ts.Node): string {
  if (!_checker || _depth !== 'check') return '';
  try {
    const type = _checker.getTypeAtLocation(node);
    return _checker.typeToString(type);
  } catch { return ''; }
}

function getResolvedModulePath(node: ts.ImportDeclaration): string {
  if (!_checker || _depth !== 'check') return '';
  const spec = node.moduleSpecifier;
  if (!ts.isStringLiteral(spec)) return '';
  const sym = _checker.getSymbolAtLocation(spec);
  if (!sym) return '';
  const decls = sym.declarations;
  if (!decls || decls.length === 0) return '';
  return decls[0].getSourceFile().fileName;
}
```

#### c) Extend `convertFieldOverrides`

```ts
const convertFieldOverrides: Record<string, Record<string, string>> = {
  // ── Existing ──
  PrefixUnaryExpression: { operator: 'prefixUnaryOperatorMap[n.operator]' },
  PostfixUnaryExpression: { operator: 'postfixUnaryOperatorMap[n.operator]' },
  TypeOperator: { operator: 'typeOperatorMap[n.operator]' },
  HeritageClause: { token: 'heritageTokenMap[n.token]' },
  MetaProperty: { keywordToken: 'metaPropertyKeywordMap[n.keywordToken]' },
  VariableDeclarationList: { declarationKind: 'getDeclarationKind(n.flags)' },

  // ── Identifier: all symbol flags as individual booleans ──
  Identifier: {
    resolvesToImport: 'isImportReference(node)',
    isDefinitionSite: 'isDefinitionSite(node)',
    resolvedFileName: 'getResolvedFileName(node)',
    symIsVariable: 'hasSymbolFlag(node, ts.SymbolFlags.Variable)',
    symIsFunctionScopedVariable: 'hasSymbolFlag(node, ts.SymbolFlags.FunctionScopedVariable)',
    symIsBlockScopedVariable: 'hasSymbolFlag(node, ts.SymbolFlags.BlockScopedVariable)',
    symIsFunction: 'hasSymbolFlag(node, ts.SymbolFlags.Function)',
    symIsClass: 'hasSymbolFlag(node, ts.SymbolFlags.Class)',
    symIsInterface: 'hasSymbolFlag(node, ts.SymbolFlags.Interface)',
    symIsTypeAlias: 'hasSymbolFlag(node, ts.SymbolFlags.TypeAlias)',
    symIsAlias: 'hasSymbolFlag(node, ts.SymbolFlags.Alias)',
    symIsProperty: 'hasSymbolFlag(node, ts.SymbolFlags.Property)',
    symIsMethod: 'hasSymbolFlag(node, ts.SymbolFlags.Method)',
    symIsEnum: 'hasSymbolFlag(node, ts.SymbolFlags.Enum)',
    symIsEnumMember: 'hasSymbolFlag(node, ts.SymbolFlags.EnumMember)',
    symIsNamespace: 'hasSymbolFlag(node, ts.SymbolFlags.Namespace)',
    symIsExportValue: 'hasSymbolFlag(node, ts.SymbolFlags.ExportValue)',
    symIsType: 'hasSymbolFlag(node, ts.SymbolFlags.Type)',
    symIsValue: 'hasSymbolFlag(node, ts.SymbolFlags.Value)',
    typeString: 'getTypeString(node)',
  },

  // ── ImportDeclaration ──
  ImportDeclaration: {
    isTypeOnly: '!!(n.importClause?.isTypeOnly)',
    resolvedModulePath: 'getResolvedModulePath(node as any)',
  },

  // ── Declaration nodes: isExported ──
  VariableStatement:     { isExported: 'isNodeExported(node)' },
  VariableDeclaration:   { isExported: 'isNodeExported(node)', typeString: 'getTypeString(node)' },
  FunctionDeclaration:   { isExported: 'isNodeExported(node)', typeString: 'getTypeString(node)' },
  ClassDeclaration:      { isExported: 'isNodeExported(node)', typeString: 'getTypeString(node)' },
  InterfaceDeclaration:  { isExported: 'isNodeExported(node)' },
  TypeAliasDeclaration:  { isExported: 'isNodeExported(node)' },
  EnumDeclaration:       { isExported: 'isNodeExported(node)' },
  ModuleDeclaration:     { isExported: 'isNodeExported(node)' },
  MethodDeclaration:     { isExported: 'isNodeExported(node)', typeString: 'getTypeString(node)' },
  PropertyDeclaration:   { isExported: 'isNodeExported(node)', typeString: 'getTypeString(node)' },

  // ── Scope containers: localCount ──
  Block:                 { localCount: 'getLocalCount(node)' },
  // FunctionDeclaration already listed above, add localCount:
  // (codegen merges overrides per kind, so these must be in the same object —
  //  implementation: merge FunctionDeclaration entry above with localCount)
  ArrowFunction:         { localCount: 'getLocalCount(node)', typeString: 'getTypeString(node)' },
  FunctionExpression:    { localCount: 'getLocalCount(node)', typeString: 'getTypeString(node)' },
  ModuleBlock:           { localCount: 'getLocalCount(node)' },
  CaseClause:            { localCount: 'getLocalCount(node)' },
  DefaultClause:         { localCount: 'getLocalCount(node)' },
  ForStatement:          { localCount: 'getLocalCount(node)' },
  ForInStatement:        { localCount: 'getLocalCount(node)' },
  ForOfStatement:        { localCount: 'getLocalCount(node)' },
  Constructor:           { localCount: 'getLocalCount(node)' },

  // ── Expression nodes: typeString ──
  // (All Expression sum type members not already listed above)
  CallExpression:                 { typeString: 'getTypeString(node)' },
  PropertyAccessExpression:       { typeString: 'getTypeString(node)' },
  ElementAccessExpression:        { typeString: 'getTypeString(node)' },
  NewExpression:                  { typeString: 'getTypeString(node)' },
  BinaryExpression:               { typeString: 'getTypeString(node)' },
  ConditionalExpression:          { typeString: 'getTypeString(node)' },
  ArrayLiteralExpression:         { typeString: 'getTypeString(node)' },
  ObjectLiteralExpression:        { typeString: 'getTypeString(node)' },
  TemplateExpression:             { typeString: 'getTypeString(node)' },
  TaggedTemplateExpression:       { typeString: 'getTypeString(node)' },
  ParenthesizedExpression:        { typeString: 'getTypeString(node)' },
  SpreadElement:                  { typeString: 'getTypeString(node)' },
  AsExpression:                   { typeString: 'getTypeString(node)' },
  SatisfiesExpression:            { typeString: 'getTypeString(node)' },
  NonNullExpression:              { typeString: 'getTypeString(node)' },
  AwaitExpression:                { typeString: 'getTypeString(node)' },
  YieldExpression:                { typeString: 'getTypeString(node)' },
  DeleteExpression:               { typeString: 'getTypeString(node)' },
  TypeOfExpression:               { typeString: 'getTypeString(node)' },
  VoidExpression:                 { typeString: 'getTypeString(node)' },
  TypeAssertionExpression:        { typeString: 'getTypeString(node)' },
  ClassExpression:                { typeString: 'getTypeString(node)' },
  NumericLiteral:                 { typeString: 'getTypeString(node)' },
  StringLiteral:                  { typeString: 'getTypeString(node)' },
  RegularExpressionLiteral:       { typeString: 'getTypeString(node)' },
  NoSubstitutionTemplateLiteral:  { typeString: 'getTypeString(node)' },
  // etc. — codegen should auto-detect Expression members and add typeString
};
```

**Implementation note:** Rather than listing every Expression member in `convertFieldOverrides`, the codegen should detect any node kind that is a member of the `Expression` sum type and auto-add `typeString: 'getTypeString(node)'` if the schema declares a `typeString` field. This keeps the override map manageable.

#### d) Merging overrides for nodes with multiple concerns

Some nodes appear in multiple categories (e.g. `FunctionDeclaration` is a declaration + scope container + has typeString). The codegen override map should merge entries:

```ts
FunctionDeclaration: {
  isExported: 'isNodeExported(node)',
  localCount: 'getLocalCount(node)',
  typeString: 'getTypeString(node)',
},
```

#### e) Depth-aware field emission

**Chosen: Option A — Runtime guards in each helper.**

Each helper checks `_checker` / `_depth` and returns a default (`false`, `''`, `0`). Single converter per node kind, negligible runtime cost. No separate codegen paths.

---

## 7. AG Attributes to Add

Using the stamped fields, implement the kind properties from `04-checker.md` as AG attributes.

### 7.1 Property -> Attribute Mapping

| Kind Property | Required Stamped Fields | Violation Attribute | Context Attribute | Node Scope | Depth |
|---|---|---|---|---|---|
| `noImports` | `resolvesToImport` | `importViolation` | `noImportsContext` | Identifier | **bind** |
| `noConsole` | `escapedText`, `symIsFunction`/`symIsVariable` | `consoleViolation` | `noConsoleContext` | PropertyAccessExpression | **bind** |
| `immutable` | `declarationKind` (exists) | `mutableBindingViolation` | `immutableContext` | VariableDeclarationList | **parse** |
| `static` | (syntax-only: ImportKeyword in CallExpression) | `dynamicImportViolation` | `staticContext` | CallExpression | **parse** |
| `noSideEffects` | (syntax-only: top-level expression statements) | `sideEffectViolation` | `noSideEffectsContext` | ExpressionStatement | **parse** |
| `noMutation` | (syntax-only: assignment, ++/--, delete) | `mutationViolation` | `noMutationContext` | BinaryExpression, PrefixUnary, PostfixUnary, DeleteExpression | **parse** |
| `noIO` | `importModuleSpecifier`, `resolvesToImport`, IO module list | `ioViolation` | `noIOContext` | Identifier | **check** |
| `pure` | `resolvedFileName`, `symIsFunction`, cross-file | `purityViolation` | `pureContext` | CallExpression | **check** |

### 7.2 New PropertySet Keys

```ts
interface PropertySet {
  readonly noImports?: true;
  readonly noConsole?: true;       // NEW
  readonly immutable?: true;       // NEW
  readonly static?: true;          // NEW
  readonly noSideEffects?: true;   // NEW
  readonly noMutation?: true;      // NEW
  readonly noIO?: true;            // NEW
  readonly pure?: true;            // NEW (Phase 4)
}
```

### 7.3 Attribute Architecture

#### Decision: One inherited context per property

Each property gets its own independent context attribute. Clean, modular flow — each property has an independent inheritance chain. The pattern for every property:

```
                         ┌─────────────────────────┐
                         │  kindAnnotations (syn)   │ ← extract from type annotation
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
        ┌───────────▼──────┐  ┌──────▼───────┐  ┌──────▼───────┐
        │ noImportsContext │  │noConsoleCtx  │  │immutableCtx  │  ... (one per property)
        │     (inh)        │  │   (inh)      │  │   (inh)      │
        └───────┬──────────┘  └──────┬───────┘  └──────┬───────┘
                │                    │                  │
        ┌───────▼──────────┐  ┌──────▼───────┐  ┌──────▼───────┐
        │importViolation   │  │consoleViol.  │  │mutableBind.  │  ... (one per property)
        │     (syn)        │  │   (syn)      │  │   (syn)      │
        └───────┬──────────┘  └──────┬───────┘  └──────┬───────┘
                │                    │                  │
                └────────────────────┼──────────────────┘
                                     │
                         ┌───────────▼─────────┐
                         │  allViolations       │ ← collection, combines all
                         │     (coll)           │
                         └─────────────────────┘
```

### 7.4 Full Attribute Set

| Attribute | Direction | Type | Description |
|---|---|---|---|
| **Binder** | | | |
| `kindDefs` | syn | `KindDefinition[]` | Kind definitions found in CompilationUnit (unchanged) |
| `defEnv` | inh | `Map<string, KindDefinition>` | All kind definitions propagated from root (unchanged) |
| `defLookup` | syn | `(name: string) => KindDefinition \| undefined` | Lookup function from defEnv (unchanged) |
| **Checker — shared** | | | |
| `kindAnnotations` | syn | `KindDefinition[]` | Kind annotations on VariableDeclaration (unchanged) |
| **Checker — per-property contexts (inh)** | | | |
| `noImportsContext` | inh | `KindDefinition \| null` | Kind requiring noImports, propagated down (unchanged) |
| `noConsoleContext` | inh | `KindDefinition \| null` | Kind requiring noConsole |
| `immutableContext` | inh | `KindDefinition \| null` | Kind requiring immutable |
| `staticContext` | inh | `KindDefinition \| null` | Kind requiring static |
| `noSideEffectsContext` | inh | `KindDefinition \| null` | Kind requiring noSideEffects |
| `noMutationContext` | inh | `KindDefinition \| null` | Kind requiring noMutation |
| `noIOContext` | inh | `KindDefinition \| null` | Kind requiring noIO |
| `pureContext` | inh | `KindDefinition \| null` | Kind requiring pure |
| **Checker — per-property violations (syn)** | | | |
| `importViolation` | syn | `CheckerDiagnostic \| null` | Import violation on Identifier (unchanged) |
| `consoleViolation` | syn | `CheckerDiagnostic \| null` | Console usage violation |
| `mutableBindingViolation` | syn | `CheckerDiagnostic \| null` | let/var binding violation |
| `dynamicImportViolation` | syn | `CheckerDiagnostic \| null` | import() expression violation |
| `sideEffectViolation` | syn | `CheckerDiagnostic \| null` | Top-level side effect violation |
| `mutationViolation` | syn | `CheckerDiagnostic \| null` | Assignment/increment/delete violation |
| `ioViolation` | syn | `CheckerDiagnostic \| null` | IO module usage violation |
| `purityViolation` | syn | `CheckerDiagnostic \| null` | Purity violation (Phase 5) |
| **Checker — aggregation** | | | |
| `allViolations` | collection | `CheckerDiagnostic[]` | All violations collected (unchanged combiner) |

**Total:** 23 attributes (was 7).

### 7.5 Context Equation Pattern

Each `{prop}Context` inherited attribute follows the same pattern. The equation checks `kindAnnotations` on `VariableDeclaration` parents for the relevant property:

```ts
export function eq_noConsoleContext(parentCtx: Ctx): KindDefinition | null | undefined {
  if ((parentCtx.node as any).kind === 'VariableDeclaration') {
    const kinds = parentCtx.attr('kindAnnotations');
    const match = kinds.find((k: KindDefinition) => k.properties.noConsole);
    if (match) return match;
  }
  return undefined; // inherit from parent
}

export const eq_noConsoleContext_rootValue: KindDefinition | null = null;
```

This is identical to the existing `eq_noImportsContext` pattern, just checking a different property key. Consider a factory function to reduce boilerplate:

```ts
function makeContextEquation(propKey: keyof PropertySet) {
  return function(parentCtx: Ctx): KindDefinition | null | undefined {
    if ((parentCtx.node as any).kind === 'VariableDeclaration') {
      const kinds = parentCtx.attr('kindAnnotations');
      const match = kinds.find((k: KindDefinition) => k.properties[propKey]);
      if (match) return match;
    }
    return undefined;
  };
}

export const eq_noConsoleContext = makeContextEquation('noConsole');
export const eq_immutableContext = makeContextEquation('immutable');
export const eq_staticContext = makeContextEquation('static');
// etc.
```

### 7.6 Example Violation Equations

#### `noConsole` — detect `console.*` access

```ts
export function eq_consoleViolation_PropertyAccessExpression(
  ctx: Ctx, raw: KSNode
): CheckerDiagnostic | null {
  const kindCtx = ctx.attr('noConsoleContext');
  if (!kindCtx) return null;

  const pae = raw as KSPropertyAccessExpression;
  if (pae.expression.kind !== 'Identifier') return null;
  if ((pae.expression as KSIdentifier).escapedText !== 'console') return null;

  return {
    node: raw,
    message: `'console.${(pae.name as KSIdentifier).escapedText}' violates ${kindCtx.name} (noConsole)`,
    kindName: kindCtx.name,
    property: 'noConsole',
    pos: raw.pos, end: raw.end,
    fileName: findFileName(ctx),
  };
}
```

#### `immutable` — detect `let`/`var` bindings

```ts
export function eq_mutableBindingViolation_VariableDeclarationList(
  ctx: Ctx, raw: KSNode
): CheckerDiagnostic | null {
  const kindCtx = ctx.attr('immutableContext');
  if (!kindCtx) return null;

  const vdl = raw as KSVariableDeclarationList;
  if (vdl.declarationKind === 'const') return null;

  return {
    node: raw,
    message: `'${vdl.declarationKind}' binding violates ${kindCtx.name} (immutable)`,
    kindName: kindCtx.name,
    property: 'immutable',
    pos: raw.pos, end: raw.end,
    fileName: findFileName(ctx),
  };
}
```

#### `static` — detect dynamic `import()` calls

```ts
export function eq_dynamicImportViolation_CallExpression(
  ctx: Ctx, raw: KSNode
): CheckerDiagnostic | null {
  const kindCtx = ctx.attr('staticContext');
  if (!kindCtx) return null;

  const call = raw as KSCallExpression;
  // Dynamic import: the expression is an ImportKeyword token
  if (call.expression.kind !== 'ImportKeyword') return null;

  return {
    node: raw,
    message: `dynamic import() violates ${kindCtx.name} (static)`,
    kindName: kindCtx.name,
    property: 'static',
    pos: raw.pos, end: raw.end,
    fileName: findFileName(ctx),
  };
}
```

#### `noMutation` — detect assignments, ++/--, delete

```ts
export function eq_mutationViolation_BinaryExpression(
  ctx: Ctx, raw: KSNode
): CheckerDiagnostic | null {
  const kindCtx = ctx.attr('noMutationContext');
  if (!kindCtx) return null;

  const bin = raw as KSBinaryExpression;
  const assignOps = new Set([
    'EqualsToken', 'PlusEqualsToken', 'MinusEqualsToken',
    'AsteriskEqualsToken', 'SlashEqualsToken', 'PercentEqualsToken',
    'AmpersandEqualsToken', 'BarEqualsToken', 'CaretEqualsToken',
    'LessThanLessThanEqualsToken', 'GreaterThanGreaterThanEqualsToken',
    'GreaterThanGreaterThanGreaterThanEqualsToken',
    'AsteriskAsteriskEqualsToken',
    'BarBarEqualsToken', 'AmpersandAmpersandEqualsToken',
    'QuestionQuestionEqualsToken',
  ]);
  if (!assignOps.has(bin.operator)) return null;

  return {
    node: raw,
    message: `assignment operator '${bin.operator}' violates ${kindCtx.name} (noMutation)`,
    kindName: kindCtx.name,
    property: 'noMutation',
    pos: raw.pos, end: raw.end,
    fileName: findFileName(ctx),
  };
}

export function eq_mutationViolation_PrefixUnaryExpression(
  ctx: Ctx, raw: KSNode
): CheckerDiagnostic | null {
  const kindCtx = ctx.attr('noMutationContext');
  if (!kindCtx) return null;

  const pre = raw as KSPrefixUnaryExpression;
  if (pre.operator !== 'PlusPlusToken' && pre.operator !== 'MinusMinusToken') return null;

  return {
    node: raw,
    message: `'${pre.operator}' violates ${kindCtx.name} (noMutation)`,
    kindName: kindCtx.name,
    property: 'noMutation',
    pos: raw.pos, end: raw.end,
    fileName: findFileName(ctx),
  };
}

// PostfixUnaryExpression — same pattern
// DeleteExpression — similar
```

#### `noIO` — detect IO module usage via Identifier (check-level)

```ts
const IO_MODULES = new Set([
  'fs', 'fs/promises', 'path', 'net', 'http', 'https',
  'child_process', 'cluster', 'dgram', 'dns', 'tls',
  'crypto', 'zlib', 'stream', 'readline', 'worker_threads',
]);

export function eq_ioViolation_Identifier(
  ctx: Ctx, raw: KSNode
): CheckerDiagnostic | null {
  const kindCtx = ctx.attr('noIOContext');
  if (!kindCtx) return null;

  const ident = raw as KSIdentifier;
  if (!ident.resolvesToImport) return null;
  if (!ident.importModuleSpecifier) return null;
  if (!IO_MODULES.has(ident.importModuleSpecifier)) return null;

  return {
    node: raw,
    message: `'${ident.escapedText}' from IO module '${ident.importModuleSpecifier}' violates ${kindCtx.name} (noIO)`,
    kindName: kindCtx.name,
    property: 'noIO',
    pos: raw.pos, end: raw.end,
    fileName: findFileName(ctx),
  };
}
```

> **Note:** The original design used `ImportDeclaration` nodes, but imports are at file top level (outside annotated scopes). The `importModuleSpecifier` field on `Identifier` solves this by checking at the use site.

### 7.7 `allViolations` Collection — Updated

The `contribute` function now collects from ALL violation attributes:

```ts
export function eq_allViolations_contribute(ctx: Ctx): CheckerDiagnostic[] {
  const violations: CheckerDiagnostic[] = [];
  const v1 = ctx.attr('importViolation');
  if (v1) violations.push(v1);
  const v2 = ctx.attr('consoleViolation');
  if (v2) violations.push(v2);
  const v3 = ctx.attr('mutableBindingViolation');
  if (v3) violations.push(v3);
  const v4 = ctx.attr('dynamicImportViolation');
  if (v4) violations.push(v4);
  const v5 = ctx.attr('sideEffectViolation');
  if (v5) violations.push(v5);
  const v6 = ctx.attr('mutationViolation');
  if (v6) violations.push(v6);
  const v7 = ctx.attr('ioViolation');
  if (v7) violations.push(v7);
  const v8 = ctx.attr('purityViolation');
  if (v8) violations.push(v8);
  return violations;
}
```

---

## 8. Configuration Integration

### 8.1 Threading `analysisDepth` through the pipeline

```ts
// src/api/config.ts
export interface KindScriptConfig {
  readonly include?: string[];
  readonly exclude?: string[];
  readonly strict?: boolean;
  readonly analysisDepth?: 'parse' | 'bind' | 'check';  // NEW
}

// src/program.ts
export function createProgramFromTSProgram(
  tsProgram: ts.Program,
  config?: KindScriptConfig,
): KSProgramInterface {
  const depth = config?.analysisDepth ?? 'check';
  const ksTree = buildKSTree(tsProgram, depth);
  const { definitions, diagnostics, getDepGraph } = evaluate(ksTree.root);
  // ...
}
```

### 8.2 Attribute evaluation respects depth

Equations degrade gracefully: stamped fields default to `false`/`''`/`0` when the checker isn't called. At `'parse'` depth, `resolvesToImport` will be `false`, all `sym*` flags will be `false`, `typeString` will be `''`, etc. Violation attributes that depend on these fields will return `null`. No special evaluator logic needed.

For properties that work at parse level (`immutable`, `static`, `noSideEffects`, `noMutation`), the violations will be correctly detected even at `'parse'` depth since they only use syntactic fields (`declarationKind`, node kinds).

---

## 9. Implementation Phases

### Phase 1: Foundation — bind-level fields + analysis depth config

1. Add all `sym*` boolean fields + `isDefinitionSite` + `resolvedFileName` to `Identifier` in schema
2. Add `isExported` to all declaration nodes in schema
3. Add `isTypeOnly` to `ImportDeclaration` in schema
4. Add `localCount` to scope container nodes in schema
5. Add `AnalysisDepth` type + parameter to generated `buildKSTree`
6. Add `getSymbol`, `hasSymbolFlag`, `isDefinitionSite`, `getResolvedFileName`, `isNodeExported`, `getLocalCount` helpers to codegen preamble
7. Add `convertFieldOverrides` entries for all new fields
8. Thread `analysisDepth` through `KindScriptConfig` → `program.ts` → `buildKSTree`
9. Regenerate all generated files
10. Verify all 117 tests pass
11. Add tests for new stamped fields (symbol flags, definition sites, exports, localCount)

### Phase 2: typeString on all expression/declaration nodes

1. Add `typeString: prop('string')` to all Expression sum type members + declaration nodes in schema
2. Add `getTypeString` helper to codegen preamble
3. Auto-detect Expression members in codegen and add `typeString` override
4. Regenerate, verify tests pass
5. Add tests verifying typeString values at `'check'` depth and empty at `'parse'`/`'bind'`

### Phase 3: Parse-level properties (`immutable`, `static`, `noSideEffects`, `noMutation`)

1. Expand `PropertySet` with 4 new keys, update `PROPERTY_KEYS` in binder
2. Add 4 new context attributes (inh) + 4 violation attributes (syn)
3. Add violation equations for each property
4. Update `allViolations` contribute to collect from new violations
5. Update evaluator generation (new attributes, dep graph edges)
6. Add test fixtures and tests for each property

### Phase 4: Bind-level properties (`noConsole`)

1. Add `noConsole` to `PropertySet`
2. Add `noConsoleContext` (inh) + `consoleViolation` (syn) attributes
3. Add violation equation (pattern-match on `escapedText === 'console'` via PropertyAccessExpression)
4. Test: direct console use, nested in functions, clean code with no console

### Phase 5: Check-level fields + properties (`resolvedModulePath`, `noIO`)

1. Add `resolvedModulePath` to `ImportDeclaration` in schema
2. Add `getResolvedModulePath` helper to codegen
3. Add `noIO` to `PropertySet`
4. Add `noIOContext` (inh) + `ioViolation` (syn) attributes
5. Add violation equation using `resolvedModulePath` + IO module list
6. Test: IO imports, clean imports, aliased IO

### Phase 6: Deep analysis (`pure`, relational properties)

1. `pure` requires transitive call graph analysis — may need a pre-pass that builds a call graph from symbol flags + resolved file names on Identifiers
2. Relational properties (`noDependency`, `noCycles`) operate on the import graph between composite members — different architecture than per-node violations
3. These warrant separate design documents

---

## 10. Summary of Decisions

| # | Decision | Chosen |
|---|---|---|
| 1 | How to configure analysis depth | **B: `buildKSTree` param** + config field |
| 2 | Symbol flags representation | **D: Individual boolean fields** for all flags |
| 3 | Where to put `isExported` | **A: On each declaration node individually** |
| 4 | Which nodes get `typeString` | **A: All expression and declaration nodes** |
| 5 | Call/property resolution format | **C: Symbol flags + file path** (composable, equations reconstruct) |
| 6 | Depth handling in generated code | **A: Runtime guards** in each helper |
| 7 | Shared vs per-property context | **A: One inherited context per property** |
| 8 | Include `localCount`? | **Yes** |

---

## 11. Files to Modify

| File | Changes |
|---|---|
| `ast-schema/schema.ts` | Add 18 `sym*` booleans + `isDefinitionSite` + `resolvedFileName` + `typeString` to Identifier; `isExported` to ~10 declaration kinds; `isTypeOnly` + `resolvedModulePath` to ImportDeclaration; `localCount` to ~11 scope containers; `typeString` to ~50 expression/declaration kinds |
| `ast-schema/codegen.ts` | Add `AnalysisDepth` type, `_depth` variable, helper functions (`getSymbol`, `hasSymbolFlag`, `isDefinitionSite`, `getResolvedFileName`, `isNodeExported`, `getLocalCount`, `getTypeString`, `getResolvedModulePath`), extend `convertFieldOverrides`, auto-detect Expression members for `typeString` |
| `src/api/config.ts` | Add `analysisDepth?: 'parse' \| 'bind' \| 'check'` to `KindScriptConfig` |
| `src/program.ts` | Thread `analysisDepth` to `buildKSTree()` |
| `ksc-behavior/types.ts` | Expand `PropertySet` with `noConsole`, `immutable`, `static`, `noSideEffects`, `noMutation`, `noIO`, `pure` |
| `ksc-behavior/binder.ts` | Update `PROPERTY_KEYS` set with new keys |
| `ksc-behavior/checker.ts` | Add 7 context equations + 7 violation equations, update `allViolations` contribute, add `findFileName` helper |
| `ksc-behavior/attr-types.ts` | Add 14 new attribute types to `KSCAttrMap` (7 contexts + 7 violations) |
| `ksc-behavior/ctx.ts` | No changes (Ctx interface is generic) |
| `ksc-generated/evaluator.ts` | Regenerated (23 attributes, expanded dep graph) |
| `ast-schema/generated/*` | Regenerated (node-types, schema, convert, builders, serialize, index) |
| `scripts/gen-ksc-evaluator.ts` | May need updates if `makeContextEquation` factory pattern is used |
| `test/` | New test fixtures for each property; tests for stamped fields at each depth level |

---

## 12. Implementation Progress

### Phase 1: Foundation — bind-level fields + analysis depth config

| # | Task | Status |
|---|---|---|
| 1 | Add all `sym*` boolean fields + `isDefinitionSite` + `resolvedFileName` to `Identifier` in schema | DONE |
| 2 | Add `isExported` to all declaration nodes in schema | DONE |
| 3 | Add `isTypeOnly` to `ImportDeclaration` in schema | DONE (already existed as parse-level field) |
| 4 | Add `localCount` to scope container nodes in schema | DONE |
| 5 | Add `AnalysisDepth` type + parameter to generated `buildKSTree` | DONE |
| 6 | Add helper functions to codegen preamble | DONE (`hasSymFlag`, `checkIsDefinitionSite`, `getResolvedFileName`, `isNodeExported`, `getLocalCount`) |
| 7 | Add `convertFieldOverrides` entries for all new fields | DONE (auto-detection loops for isExported, localCount, typeString) |
| 8 | Thread `analysisDepth` through config -> program -> buildKSTree | DONE |
| 9 | Regenerate all generated files | DONE |
| 10 | Verify all tests pass | DONE (136 tests passing) |
| 11 | Add tests for new stamped fields | DONE (analysisDepth tests in config.test.ts) |

### Phase 2: typeString on all expression/declaration nodes

| # | Task | Status |
|---|---|---|
| 1 | Add `typeString: prop('string')` via `addFieldToSumTypeMembers` + `addFieldToKinds` | DONE |
| 2 | Add `getTypeString` helper to codegen preamble | DONE |
| 3 | Auto-detect Expression members in codegen for typeString override | DONE |
| 4 | Regenerate, verify tests pass | DONE (136 tests passing) |
| 5 | Add tests verifying typeString values at different depths | DONE (analysisDepth tests in config.test.ts) |

### Phase 3: Parse-level properties (`immutable`, `static`, `noSideEffects`, `noMutation`)

| # | Task | Status |
|---|---|---|
| 1 | Expand `PropertySet` with 4 new keys, update `PROPERTY_KEYS` in binder | DONE |
| 2 | Add 4 context attributes (inh) + 4 violation attributes (syn) to attr-types | DONE |
| 3 | Add violation equations in checker.ts | DONE |
| 4 | Update `allViolations` contribute | DONE |
| 5 | Regenerate evaluator | DONE (22 attributes, 26 dep edges) |
| 6 | All tests pass | DONE (136 tests passing) |
| 7 | Add test fixtures and tests for each property | DONE (checker-properties.test.ts — 13 tests) |

### Phase 4: Bind-level properties (`noConsole`)

| # | Task | Status |
|---|---|---|
| 1 | Add `noConsole` to `PropertySet` + `PROPERTY_KEYS` | DONE |
| 2 | Add `noConsoleContext` (inh) + `consoleViolation` (syn) attributes | DONE |
| 3 | Add violation equation (PropertyAccessExpression pattern) | DONE |
| 4 | Regenerate evaluator, tests pass | DONE |
| 5 | Add test fixtures | DONE (in checker-properties fixture) |

### Phase 5: Check-level fields + properties (`resolvedModulePath`, `noIO`)

| # | Task | Status |
|---|---|---|
| 1 | Add `resolvedModulePath` to `ImportDeclaration` in schema | DONE |
| 2 | Add `getResolvedModulePath` helper to codegen | DONE |
| 3 | Add `noIO` to `PropertySet` + `PROPERTY_KEYS` | DONE |
| 4 | Add `noIOContext` (inh) + `ioViolation` (syn) attributes | DONE |
| 5 | Add violation equation — Identifier-based with `importModuleSpecifier` | DONE (see note 5 below) |
| 6 | Regenerate evaluator, tests pass | DONE |
| 7 | Add test fixtures | DONE (violation + clean tests in checker-properties) |
| 8 | Add `importModuleSpecifier` field to Identifier in schema | DONE |
| 9 | Add `getImportModuleSpecifier` helper to codegen | DONE |
| 10 | Add `static` property test fixtures (dynamic import detection) | DONE |
| 11 | Refine `noSideEffects` to only flag call/await/yield statements | DONE (see note 6 below) |
| 12 | Add stamped field value tests (sym*, isDefinitionSite, etc.) | DONE (17 tests in stamped-fields.test.ts) |

### Phase 6: Deep analysis (`pure`, relational properties)

| # | Task | Status |
|---|---|---|
| 1 | `pureContext` attribute + placeholder `purityViolation` equation | DONE (returns null, deferred) |
| 2 | Transitive call graph analysis | DEFERRED |
| 3 | Relational properties (`noDependency`, `noCycles`) | DEFERRED |

### Key Implementation Notes

1. **Factory pattern breaks evaluator codegen**: The evaluator generator (`gen-ksc-evaluator.ts`) detects attribute dependencies by scanning equation function bodies for `.attr('xxx')` calls. Using `makeContextEquation()` factory functions hides these calls inside the factory body, causing the generator to miss dependency edges. All 8 context equations must be written as explicit function declarations with inline `parentCtx.attr('kindAnnotations')` calls.

2. **`addFieldToSumTypeMembers` / `addFieldToKinds`**: New builder.ts helpers that batch-add a field to all members of a sum type or a list of kinds. Used to add `typeString` to ~50+ Expression member kinds without individual schema edits. Must be called after `resolveIncludes()`.

3. **Auto-detection in codegen**: Rather than listing every node kind in `convertFieldOverrides`, the codegen loops over schema entries to auto-detect `isExported`, `localCount`, and `typeString` fields and add appropriate override expressions.

4. **Depth degradation**: All checker/binder helpers check `_checker` / `_depth` and return safe defaults (`false`, `''`, `0`). No separate codegen paths needed — same converter works at all depths.

5. **noIO fix — Identifier-based detection**: The original `ioViolation` fired on `ImportDeclaration` nodes, but imports are always at file top level (outside annotated `VariableDeclaration` scope), so `noIOContext` never reached them. Fix: added `importModuleSpecifier: prop('string')` to `Identifier` in the schema, with a `getImportModuleSpecifier` codegen helper that traces `symbol → ImportDeclaration → moduleSpecifier.text`. The violation equation now fires on `Identifier` nodes, checking if `resolvesToImport` is true and `importModuleSpecifier` matches the IO module list. This correctly detects IO module usage inside annotated functions.

6. **noSideEffects refinement**: The original `sideEffectViolation` flagged ALL `ExpressionStatement` nodes, including legitimate code like assignments and increments. Refined to only flag when the expression is `CallExpression`, `AwaitExpression`, or `YieldExpression` — the actual side-effecting expression kinds.

7. **BinaryExpression operator field**: The `operatorToken` on `BinaryExpression` is a child `Token` node (not a string property). Mutation detection uses `bin.operatorToken.kind` to get the operator name (e.g. `'EqualsToken'`).
