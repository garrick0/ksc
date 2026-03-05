# KSC AG Integration: Own AST, Unified Tree, AG Features

## Overview

This document describes the next phase of KSC development:

1. **AG library additions** — `match`, `lookup` helpers
2. **KSC AST node types** — full mirror of the TypeScript AST, every node type
3. **Unified program tree** — JastAdd-style `Program → CompilationUnit* → [full AST]`
4. **Pipeline rewrite** — binder (and future stages) operate on the KSC tree using AG attributes

---

## Part 1: AG Library Additions (`libs/ag`)

### 1a. `match` — Typed Per-Production Dispatch

**Problem:** Every `syn` callback receives the full union type. Users must manually narrow with `if`/`switch`, losing type safety inside branches.

**JastAdd equivalent:** `syn int Leaf.value() = ...` — equations are defined per production, the system dispatches.

**API:**

```typescript
// Node union must have a string discriminant field
type MatchEquations<N extends object, D extends string, V> = {
  [K in (N extends Record<D, infer T> ? T extends string ? T : never : never)]?:
    (node: Extract<N, Record<D, K>>) => V;
} & { _?: (node: N) => V };

function match<N extends object, V>(
  discriminant: string,
  equations: MatchEquations<N, typeof discriminant, V>,
): Attribute<N, V>;
```

The discriminant key is explicit (e.g., `'kind'` for KSC nodes, `'type'` for other ASTs). This keeps match generic.

**Usage:**

```typescript
const kindDefs = match<KSNode, KindDef[]>('kind', {
  CompilationUnit: (cu) => extractKindDefs(cu),  // cu: KSCompilationUnit
  Program: (p) => p.compilationUnits.flatMap(cu => kindDefs(cu)),
  _: () => [],
});
```

- Cached via `syn` internally
- Type narrows each branch automatically via `Extract<N, Record<D, K>>`
- `_` is the default/fallback equation
- Discriminant is a parameter, not hardcoded to `'type'` or `'kind'`

**File:** `libs/ag/src/match.ts`
**Tests:** `libs/ag/test/match.test.ts`

### 1b. `lookup` — Reference Attribute Helper

**Problem:** The pattern of "collect entries from the whole tree into a map, then let any node query it" is JastAdd's most common `coll` + `inh` combination. It requires manually wiring `coll` at the root with `down` to push the map to descendants.

**JastAdd equivalent:**

```
coll Map<String, KindDef> Program.allDefs() [new HashMap<>()];
CompilationUnit contributes each kindDefs() to Program.allDefs();

inh Map<String, KindDef> Declaration.env();
eq Program.getCompilationUnit().env() = allDefs();
```

**API:**

```typescript
function lookup<N extends object, K, V>(
  collect: (node: N) => Iterable<[K, V]>,
): AttributeDef<N, (key: K) => V | undefined>;
```

**Usage:**

```typescript
const defLookup = lookup<KSNode, string, KindDef>((node) => {
  if (node.kind === 'CompilationUnit') {
    const defs: KindDefinition[] = (node as any).kindDefs;
    return defs.map(d => [d.name, d] as [string, KindDef]);
  }
  return [];
});

// Apply to tree, then any node can resolve references via property access:
applyAttributes(root, { defLookup });
const resolved = (someDecl as any).defLookup('Pure');  // KindDef | undefined
```

**Implementation:**
1. On first access of any node, walks the **entire tree from root** (using `coll` internally), building a `Map<K, V>`
2. Caches the map (it's the same for every node — one walk, shared result)
3. Returns a lookup function bound to that map

This is effectively `coll` at the root + global `inh` to distribute, composed into one call.

**File:** `libs/ag/src/lookup.ts`
**Tests:** `libs/ag/test/lookup.test.ts`

---

## Part 2: KSC AST Node Types — Full TS AST Mirror

### Design principle: mirror the complete TypeScript AST

The previous plan defined ~10 statement types and collapsed everything else into `OtherStatement`/`OtherType`. That's wrong — KSC should work on the same structure as the TypeScript AST. Every node type in the TS AST gets a corresponding KS node. The tree goes all the way down through expressions, type nodes, identifiers, literals, everything.

**Why every node type matters:**
- Future stages (checker, property verification) will need to inspect expressions, assignments, function bodies, call sites — not just top-level declarations
- AG attributes work best on a complete tree. Stopping at statements means `coll` can't find contributions inside function bodies, `down` can't push context into expressions, etc.
- JastAdd/Silver/ExtendJ work on the complete AST — every production is a nonterminal

### Architecture: Full SyntaxKind coverage

TypeScript has ~360 SyntaxKind values. We define:

1. **`KSNodeBase`** — common fields every node shares
2. **361 specific typed interfaces** — every SyntaxKind has its own interface with a literal `kind` type
   - ~77 hand-written interfaces with named child accessors (declarations, statements, expressions, type nodes, etc.)
   - ~284 generated interfaces for remaining SyntaxKinds (tokens, keywords, JSDoc, JSX, trivia, etc.)

There is **no generic fallback** — every `ts.SyntaxKind` is covered. Unrecognized kinds cause a throw at conversion time.

The discriminant field is **`kind`** (a string matching the `ts.SyntaxKind` name). This mirrors TypeScript's own `node.kind` but as a string for discriminated union matching.

### Node Definitions

**File:** `src/pipeline/ast.ts`

```typescript
import type ts from 'typescript';

// ═══════════════════════════════════════════════════════════════════════
// Base and generic nodes
// ═══════════════════════════════════════════════════════════════════════

/** Fields shared by every KS node. */
interface KSNodeBase {
  /** SyntaxKind name string — discriminant for pattern matching */
  kind: string;
  /** Start position (0-based offset in source text) */
  pos: number;
  /** End position */
  end: number;
  /** Source text of this node */
  text: string;
  /** Syntactic children (same as ts.forEachChild order) */
  children: KSNode[];
  /** Back-reference to original TS node */
  tsNode: ts.Node;
}

// No generic fallback — every SyntaxKind has a specific typed interface.
// See ast.ts for the full list of 361 interfaces.

// ═══════════════════════════════════════════════════════════════════════
// Program + CompilationUnit (KSC additions, not in TS AST)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Program root node. JastAdd: Program ::= CompilationUnit*;
 * Not a TS AST node — this is KSC's addition.
 */
export interface KSProgram {
  kind: 'Program';
  compilationUnits: KSCompilationUnit[];
  pos: 0;
  end: 0;
  text: '';
  children: KSCompilationUnit[];
  /** ts.Program (not a ts.Node, but kept for access to type checker etc.) */
  tsProgram: ts.Program;
}

/**
 * CompilationUnit — one per source file.
 * JastAdd: CompilationUnit ::= Statement*;
 * Wraps ts.SourceFile.
 */
export interface KSCompilationUnit extends KSNodeBase {
  kind: 'CompilationUnit';
  fileName: string;
  isDeclarationFile: boolean;
  /** Full source text of the file */
  sourceText: string;
  /** Line start offsets */
  lineStarts: readonly number[];
  tsNode: ts.SourceFile;
}

// ═══════════════════════════════════════════════════════════════════════
// Declarations
// ═══════════════════════════════════════════════════════════════════════

export interface KSTypeAliasDeclaration extends KSNodeBase {
  kind: 'TypeAliasDeclaration';
  /** Name identifier node */
  name: KSIdentifier;
  /** Type parameter nodes, if any */
  typeParameters: KSNode[];
  /** The aliased type (RHS) */
  type: KSNode;
  modifiers: KSNode[];
  tsNode: ts.TypeAliasDeclaration;
}

export interface KSInterfaceDeclaration extends KSNodeBase {
  kind: 'InterfaceDeclaration';
  name: KSIdentifier;
  typeParameters: KSNode[];
  members: KSNode[];
  heritageClauses: KSNode[];
  modifiers: KSNode[];
  tsNode: ts.InterfaceDeclaration;
}

export interface KSFunctionDeclaration extends KSNodeBase {
  kind: 'FunctionDeclaration';
  name: KSIdentifier | undefined;
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;  // return type annotation
  body: KSNode | undefined;
  modifiers: KSNode[];
  asteriskToken: KSNode | undefined;
  tsNode: ts.FunctionDeclaration;
}

export interface KSClassDeclaration extends KSNodeBase {
  kind: 'ClassDeclaration';
  name: KSIdentifier | undefined;
  typeParameters: KSNode[];
  members: KSNode[];
  heritageClauses: KSNode[];
  modifiers: KSNode[];
  tsNode: ts.ClassDeclaration;
}

export interface KSEnumDeclaration extends KSNodeBase {
  kind: 'EnumDeclaration';
  name: KSIdentifier;
  members: KSNode[];
  modifiers: KSNode[];
  tsNode: ts.EnumDeclaration;
}

export interface KSVariableStatement extends KSNodeBase {
  kind: 'VariableStatement';
  declarationList: KSVariableDeclarationList;
  modifiers: KSNode[];
  tsNode: ts.VariableStatement;
}

export interface KSVariableDeclarationList extends KSNodeBase {
  kind: 'VariableDeclarationList';
  declarations: KSVariableDeclaration[];
  flags: { const: boolean; let: boolean; var: boolean };
  tsNode: ts.VariableDeclarationList;
}

export interface KSVariableDeclaration extends KSNodeBase {
  kind: 'VariableDeclaration';
  name: KSNode;  // Identifier or BindingPattern
  type: KSNode | undefined;  // type annotation
  initializer: KSNode | undefined;
  tsNode: ts.VariableDeclaration;
}

// ═══════════════════════════════════════════════════════════════════════
// Import / Export
// ═══════════════════════════════════════════════════════════════════════

export interface KSImportDeclaration extends KSNodeBase {
  kind: 'ImportDeclaration';
  importClause: KSNode | undefined;
  moduleSpecifier: KSNode;  // StringLiteral
  attributes: KSNode | undefined;  // import attributes
  tsNode: ts.ImportDeclaration;
}

export interface KSImportClause extends KSNodeBase {
  kind: 'ImportClause';
  isTypeOnly: boolean;
  name: KSIdentifier | undefined;  // default import
  namedBindings: KSNode | undefined;  // NamespaceImport or NamedImports
  tsNode: ts.ImportClause;
}

export interface KSNamedImports extends KSNodeBase {
  kind: 'NamedImports';
  elements: KSNode[];  // ImportSpecifier[]
  tsNode: ts.NamedImports;
}

export interface KSImportSpecifier extends KSNodeBase {
  kind: 'ImportSpecifier';
  isTypeOnly: boolean;
  name: KSIdentifier;
  propertyName: KSIdentifier | undefined;  // original name if renamed
  tsNode: ts.ImportSpecifier;
}

export interface KSNamespaceImport extends KSNodeBase {
  kind: 'NamespaceImport';
  name: KSIdentifier;
  tsNode: ts.NamespaceImport;
}

export interface KSExportDeclaration extends KSNodeBase {
  kind: 'ExportDeclaration';
  isTypeOnly: boolean;
  exportClause: KSNode | undefined;
  moduleSpecifier: KSNode | undefined;
  tsNode: ts.ExportDeclaration;
}

export interface KSExportAssignment extends KSNodeBase {
  kind: 'ExportAssignment';
  expression: KSNode;
  isExportEquals: boolean;
  tsNode: ts.ExportAssignment;
}

// ═══════════════════════════════════════════════════════════════════════
// Statements
// ═══════════════════════════════════════════════════════════════════════

export interface KSBlock extends KSNodeBase {
  kind: 'Block';
  statements: KSNode[];
  tsNode: ts.Block;
}

export interface KSExpressionStatement extends KSNodeBase {
  kind: 'ExpressionStatement';
  expression: KSNode;
  tsNode: ts.ExpressionStatement;
}

export interface KSReturnStatement extends KSNodeBase {
  kind: 'ReturnStatement';
  expression: KSNode | undefined;
  tsNode: ts.ReturnStatement;
}

export interface KSIfStatement extends KSNodeBase {
  kind: 'IfStatement';
  expression: KSNode;
  thenStatement: KSNode;
  elseStatement: KSNode | undefined;
  tsNode: ts.IfStatement;
}

export interface KSForStatement extends KSNodeBase {
  kind: 'ForStatement';
  initializer: KSNode | undefined;
  condition: KSNode | undefined;
  incrementor: KSNode | undefined;
  statement: KSNode;
  tsNode: ts.ForStatement;
}

export interface KSForOfStatement extends KSNodeBase {
  kind: 'ForOfStatement';
  initializer: KSNode;
  expression: KSNode;
  statement: KSNode;
  tsNode: ts.ForOfStatement;
}

export interface KSForInStatement extends KSNodeBase {
  kind: 'ForInStatement';
  initializer: KSNode;
  expression: KSNode;
  statement: KSNode;
  tsNode: ts.ForInStatement;
}

export interface KSWhileStatement extends KSNodeBase {
  kind: 'WhileStatement';
  expression: KSNode;
  statement: KSNode;
  tsNode: ts.WhileStatement;
}

export interface KSDoStatement extends KSNodeBase {
  kind: 'DoStatement';
  expression: KSNode;
  statement: KSNode;
  tsNode: ts.DoStatement;
}

export interface KSSwitchStatement extends KSNodeBase {
  kind: 'SwitchStatement';
  expression: KSNode;
  caseBlock: KSNode;
  tsNode: ts.SwitchStatement;
}

export interface KSThrowStatement extends KSNodeBase {
  kind: 'ThrowStatement';
  expression: KSNode;
  tsNode: ts.ThrowStatement;
}

export interface KSTryStatement extends KSNodeBase {
  kind: 'TryStatement';
  tryBlock: KSNode;
  catchClause: KSNode | undefined;
  finallyBlock: KSNode | undefined;
  tsNode: ts.TryStatement;
}

// ═══════════════════════════════════════════════════════════════════════
// Expressions
// ═══════════════════════════════════════════════════════════════════════

export interface KSCallExpression extends KSNodeBase {
  kind: 'CallExpression';
  expression: KSNode;
  typeArguments: KSNode[];
  arguments: KSNode[];
  tsNode: ts.CallExpression;
}

export interface KSPropertyAccessExpression extends KSNodeBase {
  kind: 'PropertyAccessExpression';
  expression: KSNode;
  name: KSIdentifier;
  tsNode: ts.PropertyAccessExpression;
}

export interface KSElementAccessExpression extends KSNodeBase {
  kind: 'ElementAccessExpression';
  expression: KSNode;
  argumentExpression: KSNode;
  tsNode: ts.ElementAccessExpression;
}

export interface KSBinaryExpression extends KSNodeBase {
  kind: 'BinaryExpression';
  left: KSNode;
  operatorToken: KSNode;
  right: KSNode;
  tsNode: ts.BinaryExpression;
}

export interface KSPrefixUnaryExpression extends KSNodeBase {
  kind: 'PrefixUnaryExpression';
  operator: string;  // ts.PrefixUnaryOperator name
  operand: KSNode;
  tsNode: ts.PrefixUnaryExpression;
}

export interface KSPostfixUnaryExpression extends KSNodeBase {
  kind: 'PostfixUnaryExpression';
  operator: string;
  operand: KSNode;
  tsNode: ts.PostfixUnaryExpression;
}

export interface KSArrowFunction extends KSNodeBase {
  kind: 'ArrowFunction';
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode;
  modifiers: KSNode[];
  tsNode: ts.ArrowFunction;
}

export interface KSFunctionExpression extends KSNodeBase {
  kind: 'FunctionExpression';
  name: KSIdentifier | undefined;
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode;
  modifiers: KSNode[];
  tsNode: ts.FunctionExpression;
}

export interface KSObjectLiteralExpression extends KSNodeBase {
  kind: 'ObjectLiteralExpression';
  properties: KSNode[];
  tsNode: ts.ObjectLiteralExpression;
}

export interface KSArrayLiteralExpression extends KSNodeBase {
  kind: 'ArrayLiteralExpression';
  elements: KSNode[];
  tsNode: ts.ArrayLiteralExpression;
}

export interface KSTemplateExpression extends KSNodeBase {
  kind: 'TemplateExpression';
  head: KSNode;
  templateSpans: KSNode[];
  tsNode: ts.TemplateExpression;
}

export interface KSConditionalExpression extends KSNodeBase {
  kind: 'ConditionalExpression';
  condition: KSNode;
  whenTrue: KSNode;
  whenFalse: KSNode;
  tsNode: ts.ConditionalExpression;
}

export interface KSNewExpression extends KSNodeBase {
  kind: 'NewExpression';
  expression: KSNode;
  typeArguments: KSNode[];
  arguments: KSNode[];
  tsNode: ts.NewExpression;
}

export interface KSAwaitExpression extends KSNodeBase {
  kind: 'AwaitExpression';
  expression: KSNode;
  tsNode: ts.AwaitExpression;
}

export interface KSSpreadElement extends KSNodeBase {
  kind: 'SpreadElement';
  expression: KSNode;
  tsNode: ts.SpreadElement;
}

export interface KSAsExpression extends KSNodeBase {
  kind: 'AsExpression';
  expression: KSNode;
  type: KSNode;
  tsNode: ts.AsExpression;
}

export interface KSParenthesizedExpression extends KSNodeBase {
  kind: 'ParenthesizedExpression';
  expression: KSNode;
  tsNode: ts.ParenthesizedExpression;
}

// ═══════════════════════════════════════════════════════════════════════
// Type nodes
// ═══════════════════════════════════════════════════════════════════════

export interface KSTypeReferenceNode extends KSNodeBase {
  kind: 'TypeReference';
  typeName: KSNode;  // Identifier or QualifiedName
  typeArguments: KSNode[];
  tsNode: ts.TypeReferenceNode;
}

export interface KSTypeLiteralNode extends KSNodeBase {
  kind: 'TypeLiteral';
  members: KSNode[];
  tsNode: ts.TypeLiteralNode;
}

export interface KSUnionType extends KSNodeBase {
  kind: 'UnionType';
  types: KSNode[];
  tsNode: ts.UnionTypeNode;
}

export interface KSIntersectionType extends KSNodeBase {
  kind: 'IntersectionType';
  types: KSNode[];
  tsNode: ts.IntersectionTypeNode;
}

export interface KSFunctionType extends KSNodeBase {
  kind: 'FunctionType';
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode;  // return type
  tsNode: ts.FunctionTypeNode;
}

export interface KSArrayType extends KSNodeBase {
  kind: 'ArrayType';
  elementType: KSNode;
  tsNode: ts.ArrayTypeNode;
}

export interface KSTupleType extends KSNodeBase {
  kind: 'TupleType';
  elements: KSNode[];
  tsNode: ts.TupleTypeNode;
}

export interface KSLiteralType extends KSNodeBase {
  kind: 'LiteralType';
  literal: KSNode;
  tsNode: ts.LiteralTypeNode;
}

export interface KSConditionalType extends KSNodeBase {
  kind: 'ConditionalType';
  checkType: KSNode;
  extendsType: KSNode;
  trueType: KSNode;
  falseType: KSNode;
  tsNode: ts.ConditionalTypeNode;
}

export interface KSMappedType extends KSNodeBase {
  kind: 'MappedType';
  typeParameter: KSNode;
  nameType: KSNode | undefined;
  type: KSNode | undefined;
  tsNode: ts.MappedTypeNode;
}

export interface KSIndexedAccessType extends KSNodeBase {
  kind: 'IndexedAccessType';
  objectType: KSNode;
  indexType: KSNode;
  tsNode: ts.IndexedAccessTypeNode;
}

export interface KSTypeQuery extends KSNodeBase {
  kind: 'TypeQuery';
  exprName: KSNode;
  tsNode: ts.TypeQueryNode;
}

// ═══════════════════════════════════════════════════════════════════════
// Identifiers and literals
// ═══════════════════════════════════════════════════════════════════════

export interface KSIdentifier extends KSNodeBase {
  kind: 'Identifier';
  escapedText: string;
  tsNode: ts.Identifier;
}

export interface KSStringLiteral extends KSNodeBase {
  kind: 'StringLiteral';
  value: string;  // the unquoted string value
  tsNode: ts.StringLiteral;
}

export interface KSNumericLiteral extends KSNodeBase {
  kind: 'NumericLiteral';
  value: string;  // text representation
  tsNode: ts.NumericLiteral;
}

export interface KSNoSubstitutionTemplateLiteral extends KSNodeBase {
  kind: 'NoSubstitutionTemplateLiteral';
  value: string;
  tsNode: ts.NoSubstitutionTemplateLiteral;
}

// ═══════════════════════════════════════════════════════════════════════
// Class / interface members
// ═══════════════════════════════════════════════════════════════════════

export interface KSPropertySignature extends KSNodeBase {
  kind: 'PropertySignature';
  name: KSNode;
  type: KSNode | undefined;
  questionToken: KSNode | undefined;
  modifiers: KSNode[];
  tsNode: ts.PropertySignature;
}

export interface KSPropertyDeclaration extends KSNodeBase {
  kind: 'PropertyDeclaration';
  name: KSNode;
  type: KSNode | undefined;
  initializer: KSNode | undefined;
  modifiers: KSNode[];
  tsNode: ts.PropertyDeclaration;
}

export interface KSMethodDeclaration extends KSNodeBase {
  kind: 'MethodDeclaration';
  name: KSNode;
  typeParameters: KSNode[];
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode | undefined;
  modifiers: KSNode[];
  tsNode: ts.MethodDeclaration;
}

export interface KSConstructorDeclaration extends KSNodeBase {
  kind: 'Constructor';
  parameters: KSNode[];
  body: KSNode | undefined;
  modifiers: KSNode[];
  tsNode: ts.ConstructorDeclaration;
}

export interface KSGetAccessorDeclaration extends KSNodeBase {
  kind: 'GetAccessor';
  name: KSNode;
  parameters: KSNode[];
  type: KSNode | undefined;
  body: KSNode | undefined;
  modifiers: KSNode[];
  tsNode: ts.GetAccessorDeclaration;
}

export interface KSSetAccessorDeclaration extends KSNodeBase {
  kind: 'SetAccessor';
  name: KSNode;
  parameters: KSNode[];
  body: KSNode | undefined;
  modifiers: KSNode[];
  tsNode: ts.SetAccessorDeclaration;
}

export interface KSParameter extends KSNodeBase {
  kind: 'Parameter';
  name: KSNode;
  type: KSNode | undefined;
  initializer: KSNode | undefined;
  dotDotDotToken: KSNode | undefined;
  questionToken: KSNode | undefined;
  modifiers: KSNode[];
  tsNode: ts.ParameterDeclaration;
}

export interface KSTypeParameter extends KSNodeBase {
  kind: 'TypeParameter';
  name: KSIdentifier;
  constraint: KSNode | undefined;
  default: KSNode | undefined;
  tsNode: ts.TypeParameterDeclaration;
}

// ═══════════════════════════════════════════════════════════════════════
// Other structural nodes
// ═══════════════════════════════════════════════════════════════════════

export interface KSPropertyAssignment extends KSNodeBase {
  kind: 'PropertyAssignment';
  name: KSNode;
  initializer: KSNode;
  tsNode: ts.PropertyAssignment;
}

export interface KSShorthandPropertyAssignment extends KSNodeBase {
  kind: 'ShorthandPropertyAssignment';
  name: KSIdentifier;
  tsNode: ts.ShorthandPropertyAssignment;
}

export interface KSComputedPropertyName extends KSNodeBase {
  kind: 'ComputedPropertyName';
  expression: KSNode;
  tsNode: ts.ComputedPropertyName;
}

export interface KSHeritageClause extends KSNodeBase {
  kind: 'HeritageClause';
  token: string;  // 'extends' or 'implements'
  types: KSNode[];
  tsNode: ts.HeritageClause;
}

export interface KSCatchClause extends KSNodeBase {
  kind: 'CatchClause';
  variableDeclaration: KSNode | undefined;
  block: KSNode;
  tsNode: ts.CatchClause;
}

export interface KSCaseBlock extends KSNodeBase {
  kind: 'CaseBlock';
  clauses: KSNode[];
  tsNode: ts.CaseBlock;
}

export interface KSCaseClause extends KSNodeBase {
  kind: 'CaseClause';
  expression: KSNode;
  statements: KSNode[];
  tsNode: ts.CaseClause;
}

export interface KSDefaultClause extends KSNodeBase {
  kind: 'DefaultClause';
  statements: KSNode[];
  tsNode: ts.DefaultClause;
}

// ═══════════════════════════════════════════════════════════════════════
// Keyword type nodes (leaf nodes)
// ═══════════════════════════════════════════════════════════════════════
// TrueKeyword, FalseKeyword, NullKeyword, UndefinedKeyword,
// VoidKeyword, AnyKeyword, NumberKeyword, StringKeyword, etc.
// Each has its own specific interface (e.g., KSTrueKeyword, KSAnyKeyword).

// ═══════════════════════════════════════════════════════════════════════
// Union of all specific node types
// ═══════════════════════════════════════════════════════════════════════

export type KSNode =
  // KSC additions
  | KSProgram
  | KSCompilationUnit
  // Declarations
  | KSTypeAliasDeclaration
  | KSInterfaceDeclaration
  | KSFunctionDeclaration
  | KSClassDeclaration
  | KSEnumDeclaration
  | KSVariableStatement
  | KSVariableDeclarationList
  | KSVariableDeclaration
  // Imports / Exports
  | KSImportDeclaration
  | KSImportClause
  | KSNamedImports
  | KSImportSpecifier
  | KSNamespaceImport
  | KSExportDeclaration
  | KSExportAssignment
  // Statements
  | KSBlock
  | KSExpressionStatement
  | KSReturnStatement
  | KSIfStatement
  | KSForStatement
  | KSForOfStatement
  | KSForInStatement
  | KSWhileStatement
  | KSDoStatement
  | KSSwitchStatement
  | KSThrowStatement
  | KSTryStatement
  // Expressions
  | KSCallExpression
  | KSPropertyAccessExpression
  | KSElementAccessExpression
  | KSBinaryExpression
  | KSPrefixUnaryExpression
  | KSPostfixUnaryExpression
  | KSArrowFunction
  | KSFunctionExpression
  | KSObjectLiteralExpression
  | KSArrayLiteralExpression
  | KSTemplateExpression
  | KSConditionalExpression
  | KSNewExpression
  | KSAwaitExpression
  | KSSpreadElement
  | KSAsExpression
  | KSParenthesizedExpression
  // Type nodes
  | KSTypeReferenceNode
  | KSTypeLiteralNode
  | KSUnionType
  | KSIntersectionType
  | KSFunctionType
  | KSArrayType
  | KSTupleType
  | KSLiteralType
  | KSConditionalType
  | KSMappedType
  | KSIndexedAccessType
  | KSTypeQuery
  // Identifiers & Literals
  | KSIdentifier
  | KSStringLiteral
  | KSNumericLiteral
  | KSNoSubstitutionTemplateLiteral
  // Members
  | KSPropertySignature
  | KSPropertyDeclaration
  | KSMethodDeclaration
  | KSConstructorDeclaration
  | KSGetAccessorDeclaration
  | KSSetAccessorDeclaration
  | KSParameter
  | KSTypeParameter
  // Structural
  | KSPropertyAssignment
  | KSShorthandPropertyAssignment
  | KSComputedPropertyName
  | KSHeritageClause
  | KSCatchClause
  | KSCaseBlock
  | KSCaseClause
  | KSDefaultClause
  // ... plus ~284 more specific interfaces for all remaining SyntaxKinds
  // (tokens, keywords, JSDoc, JSX, trivia, binding patterns, etc.)
  // See ast.ts for the complete 360-member union.
  ;
```

### `getChildren` function

```typescript
/**
 * Child accessor for stampTree.
 *
 * Every node already has a `children` array populated during conversion
 * (mirrors ts.forEachChild order). Plus Program has compilationUnits.
 */
export function getChildren(node: KSNode): KSNode[] {
  if (node.kind === 'Program') {
    return node.compilationUnits;
  }
  return node.children;
}
```

This is trivial because the conversion layer populates `children` on every node.

---

## Part 3: TS → KSC Conversion Layer

**File:** `src/pipeline/convert.ts`

### Conversion architecture

The converter walks the entire TS AST depth-first. For each `ts.Node`:

1. Recursively convert all children first (via `ts.forEachChild`)
2. Look up the SyntaxKind name
3. Dispatch to the registered converter for this kind (all 359 SyntaxKinds are registered)
4. If somehow an unregistered kind appears, throw an error (no silent generic fallback)

```typescript
import ts from 'typescript';
import type { KSNode, KSProgram, KSCompilationUnit } from './ast.js';
import { stampTree } from '../../libs/ag/src/index.js';
import { getChildren } from './ast.js';

export interface KSTree {
  root: KSProgram;
}

/**
 * Convert a TypeScript program into a KSC AST with tree navigation stamped on nodes.
 */
export function buildKSTree(tsProgram: ts.Program): KSTree {
  const compilationUnits: KSCompilationUnit[] = [];

  for (const sf of tsProgram.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    compilationUnits.push(convertSourceFile(sf));
  }

  const root: KSProgram = {
    kind: 'Program',
    compilationUnits,
    pos: 0,
    end: 0,
    text: '',
    children: compilationUnits,
    tsProgram,
  };

  stampTree(root, getChildren);
  return { root };
}

/**
 * Convert any ts.Node to a KSNode.
 *
 * This is the central dispatch. Specific converters handle known kinds;
 * everything else becomes KSGenericNode.
 */
function convertNode(node: ts.Node, sf: ts.SourceFile): KSNode {
  // Collect children first (ts.forEachChild order)
  const children: KSNode[] = [];
  ts.forEachChild(node, (child) => {
    children.push(convertNode(child, sf));
  });

  const kindName = ts.SyntaxKind[node.kind] ?? 'Unknown';
  const pos = node.getStart(sf);
  const end = node.getEnd();
  let text: string;
  try {
    const full = node.getText(sf);
    text = full.length > 200 ? full.slice(0, 200) : full;
  } catch {
    text = '';
  }

  // Dispatch to specific converters (all 359 SyntaxKinds are registered)
  const converter = specificConverters[node.kind];
  if (converter) {
    return converter(node, sf, children, pos, end, text);
  }

  // No generic fallback — throw for truly unknown kinds
  throw new Error(`Unhandled SyntaxKind: ${ts.SyntaxKind[node.kind] ?? node.kind}`);
}

/**
 * Registry of specific converters keyed by ts.SyntaxKind.
 * Each converter receives the ts.Node, SourceFile, pre-converted children,
 * and common fields, and returns a typed KSNode.
 */
// 359 converters registered via register() calls — one per SyntaxKind.
// ~77 hand-written converters with named child accessors.
// ~282 generated converters for leaf/simple nodes.
// See convert.ts for the full registry.

type SpecificConverter = (
  node: ts.Node,
  sf: ts.SourceFile,
  children: KSNode[],
  pos: number,
  end: number,
  text: string,
) => KSNode;
```

### Conversion principles

1. **Convert every node** — the full AST, not just statements. `ts.forEachChild` visits all syntactic children.
2. **Copy all fields** — specific converters extract every named property from the TS node. Nothing is dropped.
3. **`children` is always populated** — mirrors `ts.forEachChild` order. This is what `getChildren` returns for the AG tree.
4. **Named accessors on specific interfaces** — e.g., `KSTypeAliasDeclaration.name` is also in `children`, but having a named accessor makes attribute equations readable. Named accessors point to the same node objects that are in `children`.
5. **`tsNode` back-reference** — every KS node keeps its original TS node. Escape hatch for anything we haven't anticipated.
6. **Text extracted at conversion time** — `getText()`, `getStart()` require the SourceFile, so we do it once during conversion.

### How specific converters work (example)

```typescript
function convertTypeAliasDeclaration(
  node: ts.Node, sf: ts.SourceFile, children: KSNode[],
  pos: number, end: number, text: string,
): KSTypeAliasDeclaration {
  const decl = node as ts.TypeAliasDeclaration;
  // Named accessors — find the converted child nodes by matching tsNode
  const name = findChild(children, decl.name) as KSIdentifier;
  const typeParams = decl.typeParameters
    ? Array.from(decl.typeParameters).map(tp => findChild(children, tp)!)
    : [];
  const type = findChild(children, decl.type)!;
  const modifiers = extractModifiers(children, decl);

  return {
    kind: 'TypeAliasDeclaration',
    name, typeParameters: typeParams, type, modifiers,
    pos, end, text, children, tsNode: decl,
  };
}

/** Find the KSNode in children whose tsNode matches the given ts.Node. */
function findChild(children: KSNode[], tsTarget: ts.Node): KSNode | undefined {
  return children.find(c => c.tsNode === tsTarget);
}
```

---

## Part 4: Pipeline Rewrite

### Binder on KSC AST

**File:** `src/pipeline/binder.ts` (rewritten)

```typescript
import { match } from '../../libs/ag/src/match.js';
import { lookup } from '../../libs/ag/src/lookup.js';
import { applyAttributes } from '../../libs/ag/src/apply.js';
import type { KSNode, KSTypeAliasDeclaration } from './ast.js';
import type { KSTree } from './convert.js';
import type { KindDefinition } from './types.js';

export function applyBinderAttributes(ksTree: KSTree): void {
  let nextDefId = 0;

  // syn KindDef[] CompilationUnit.kindDefs
  const kindDefs = match<KSNode, KindDefinition[]>('kind', {
    CompilationUnit: (cu) => {
      const defs: KindDefinition[] = [];
      for (const stmt of cu.children) {
        if (stmt.kind !== 'TypeAliasDeclaration') continue;
        const def = tryExtractKindDef(stmt as KSTypeAliasDeclaration);
        if (def) defs.push(def);
      }
      return defs;
    },
    _: () => [],
  });

  // lookup: any node can resolve kind names (walks $parent to root)
  const defLookup = lookup<KSNode, string, KindDefinition>((node) => {
    if (node.kind !== 'CompilationUnit') return [];
    const defs: KindDefinition[] = (node as any).kindDefs;
    return defs.map((d) => [d.name, d] as [string, KindDefinition]);
  });

  applyAttributes(ksTree.root, { kindDefs, defLookup });
}
```

### Kind extraction on KSC nodes

No more `ts.isTypeReferenceNode()` etc. The conversion layer already structured the types:

```typescript
function tryExtractKindDef(node: KSTypeAliasDeclaration): KindDefinition | undefined {
  const aliasedType = node.type;
  if (aliasedType.kind !== 'TypeReference') return undefined;

  const typeRef = aliasedType as KSTypeReferenceNode;
  if (typeRef.typeName.kind !== 'Identifier') return undefined;
  if ((typeRef.typeName as KSIdentifier).escapedText !== 'Kind') return undefined;
  if (typeRef.typeArguments.length !== 1) return undefined;

  const arg = typeRef.typeArguments[0];
  if (arg.kind !== 'TypeLiteral') return undefined;

  const properties = extractPropertiesFromTypeLiteral(arg as KSTypeLiteralNode);
  return { id: `kdef-${nextId++}`, name: node.name.escapedText, properties, node };
}
```

### Program entry point

```typescript
export function createProgramFromTSProgram(
  tsProgram: ts.Program,
  config?: KindScriptConfig,
): KSProgramInterface {
  // 1. Convert TS AST → KSC AST (full depth, every node, tree navigation stamped)
  const ksTree = buildKSTree(tsProgram);

  // 2. Stamp binder attributes on the KSC tree nodes
  applyBinderAttributes(ksTree);

  // 3. Return the program interface
  return {
    getTSProgram: () => tsProgram,
    getSourceFiles: () => tsProgram.getSourceFiles(),
    getCompilerOptions: () => tsProgram.getCompilerOptions(),
    getTSTypeChecker: () => tsProgram.getTypeChecker(),
    getKindDefinitions: () => {
      const defs: KindDefinition[] = [];
      for (const cu of ksTree.root.compilationUnits) {
        defs.push(...(cu as any).kindDefs);
      }
      return defs;
    },
    getKSTree: () => ksTree,
  };
}
```

---

## Part 5: Implementation Phases

### Phase A: AG library additions — COMPLETE
1. Added `match.ts` to `libs/ag/src/` — typed per-production dispatch with configurable discriminant
2. Added `lookup.ts` to `libs/ag/src/` — reference attribute helper (coll + global inh composed)
3. Tests: 6 match tests + 5 lookup tests passing
4. Re-exported from `libs/ag/src/index.ts`

### Phase B: KSC AST types — COMPLETE
1. Created `src/pipeline/ast.ts` — **361 specific typed interfaces** covering ALL TypeScript SyntaxKinds
2. ~77 hand-written interfaces with named child accessors for commonly used nodes
3. ~284 generated interfaces for remaining SyntaxKinds (tokens, keywords, JSDoc, JSX, etc.)
4. **No KSGenericNode** — every SyntaxKind has its own specific interface with literal `kind` type
5. `KSNode` union has 360 members (all specific types)

### Phase C: TS → KSC conversion — COMPLETE
1. Created `src/pipeline/convert.ts` — `buildKSTree` + `convertNode` central dispatch
2. **359 registered converters** — one per SyntaxKind, no generic fallback
3. Unhandled SyntaxKinds throw rather than silently producing generic nodes
4. Tests: 12 tests passing (structure, types, full depth, all-kinds-covered verification)

### Phase D: Binder rewrite — COMPLETE
1. Rewrote `src/pipeline/binder.ts` to use KSC AST + AG attributes (`match`, `lookup`, `applyAttributes`)
2. Exports `applyBinderAttributes(ksTree)` — stamps `kindDefs` and `defLookup` on nodes
3. Deleted `src/pipeline/synthesized.ts` (replaced by `libs/ag`)
4. Removed module augmentation from `src/pipeline/types.ts`
5. Updated `src/program.ts` to use `buildKSTree` → `applyBinderAttributes` → property access
6. Tests: 11 binder tests passing

### Phase E: Dashboard + CLI update — COMPLETE
1. Updated `src/dashboard/export.ts` — uses `$parent` stamped property for tree navigation
2. Updated all tests
3. All tests pass: 38 root tests + 55 AG library tests = 93 total
4. `npx tsc --noEmit` clean for both projects

### Phase F: AG Library Redesign — COMPLETE
Full redesign from WeakMap-based to property-stamp architecture. See `docs/architecture/ag-node-attribution-redesign.md`.
1. All attributes stamp directly onto nodes via `Object.defineProperty` lazy getters
2. `stampTree` replaces `createTree` — stamps `$parent`/`$children`/`$index`/`$root`/`$prev`/`$next` on nodes
3. `applyAttributes` walks tree installing lazy getters from `AttributeDef` specs
4. All tree-navigating attributes (`down`, `coll`, `lookup`, `chain`) access `$parent`/`$children` directly — no `tree` parameter
5. 55 AG tests, 38 root tests — all passing

---

## Verification — ALL PASSING

- `cd libs/ag && npx tsc --noEmit` — clean
- `cd libs/ag && npx vitest run` — 55 tests passing (9 test files)
- Root `npx tsc --noEmit` — clean
- Root `npx vitest run` — 38 tests passing (5 test files)

---

## File Changes Summary

### New files
- `libs/ag/src/match.ts` — typed per-production dispatch
- `libs/ag/src/lookup.ts` — reference attribute helper
- `libs/ag/test/match.test.ts`
- `libs/ag/test/lookup.test.ts`
- `src/pipeline/ast.ts` — 361 specific KSC AST node interfaces (all SyntaxKinds)
- `src/pipeline/convert.ts` — TS → KSC conversion with 359 registered converters

### Modified files
- `libs/ag/src/index.ts` — add match, lookup exports
- `src/pipeline/binder.ts` — rewrite to use KSC AST + AG
- `src/pipeline/types.ts` — remove module augmentation, update KindDefinition
- `src/program.ts` — add buildKSTree step, expose KSTree
- `src/index.ts` — export new types
- `src/dashboard/export.ts` — use KSC AST
- `test/binder.test.ts` — update for new API
- `test/program.test.ts` — update for new API
- `test/convert.test.ts` — comprehensive tests including all-kinds coverage

### Deleted files
- `src/pipeline/synthesized.ts` — replaced by `libs/ag`
