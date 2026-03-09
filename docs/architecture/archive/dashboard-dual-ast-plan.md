> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# Dashboard Dual-AST Support: Plan & Design Decisions

## Problem Statement

The compiler dashboard has three gaps:

1. **Missing export sections** — `exportDashboardData()` produces `parse` + `kinds` but the HTML expects `check` (diagnostics, summary) and `kinds.annotations`. This means live data never populates the check tab.

2. **TS-only AST view** — The `extractAST()` function walks `ts.SourceFile` directly to produce a serializable `ASTNode` tree. We now have a full KS AST representation (`src/pipeline/ast.ts`) with 400+ typed node interfaces, but the dashboard never sees it.

3. **No AG attribute visibility** — After `evaluateAll()`, KS AST nodes carry stamped AG attributes (`kindDefs`, `defLookup`, `fileImports`, `importViolation`, etc.) plus tree navigation (`$parent`, `$children`, ...). None of this is visible in the dashboard.

---

## Current Architecture

```
ts.Program ─→ extractAST(sf)           ─→ ASTNode tree (JSON) ─→ dashboard
           ─→ extractDeclarations(sf)   ─→ declarations array
           ─→ getKindDefinitions()      ─→ kinds.definitions
           ─→ getDiagnostics()          ─→ (NOT exported)
```

The `ASTNode` type used by the dashboard:
```typescript
interface ASTNode {
  kind: string;        // SyntaxKind name
  name?: string;       // identifier name if applicable
  pos: number;
  end: number;
  text: string;        // truncated source text
  children: ASTNode[];
}
```

The `KSNodeBase` type from the pipeline:
```typescript
interface KSNodeBase {
  kind: string;        // SyntaxKind name (same as above)
  pos: number;
  end: number;
  text: string;        // full source text
  children: KSNode[];  // typed children
  tsNode: ts.Node;     // back-reference (not serializable)
}
```

These shapes are nearly identical — `KSNodeBase` adds `tsNode` and typed child arrays.

---

## Work Items

### 1. Complete the Export Function (Fix `check` + `annotations` gap)

`exportDashboardData()` needs to produce the full data shape the HTML already consumes.

**Add to `DashboardExportData`:**
```typescript
kinds: {
  definitions: [...],
  annotations: Array<{     // NEW — from checker's kindAnnotations attribute
    id: string;
    kindName: string;
    name: string;           // annotated variable name
    sourceFile: string;
  }>;
};
check: {                    // NEW — from getDiagnostics()
  diagnostics: Array<{
    id: string;
    file: string;
    code: number;           // e.g., 70200
    property: string;
    message: string;
    start: number;
    length: number;
    line: number;
    column: number;
  }>;
  summary: {
    totalFiles: number;
    totalDefinitions: number;
    totalAnnotations: number;
    totalDiagnostics: number;
    cleanFiles: number;
    violatingFiles: number;
    byProperty: Record<string, { checked: number; violations: number }>;
  };
};
```

**Where the data comes from:**
- `check.diagnostics` — map `program.getDiagnostics()` to the expected shape, computing `line`/`column` from the KS AST's `lineStarts`
- `check.summary` — derived from diagnostics + definitions + annotations
- `kinds.annotations` — walk the KS tree looking for `VariableDeclaration` nodes that have `kindAnnotations` (AG attribute). This requires the checker to have been evaluated.

**Design Decision 1: Error codes**

> The HTML expects `code: number` (e.g., `70200`) for diagnostics. Do we:
>
> **Option A: Single code for all kind violations** — Use `70200` for every `noImports` violation. Simple, matches the current sample data.
>
> **Option B: Per-property error codes** — `70201` = noImports, `70202` = noConsole, etc. More informative as we add properties.
>
> **Recommendation:** Option A for now — we only have one property. Add per-property codes when we add the second property.

---

### 2. KS AST Serialization

The KS AST nodes carry three categories of non-serializable data:

| Category | Examples | Serializable? |
|----------|----------|---------------|
| **Core fields** | `kind`, `pos`, `end`, `text`, `children` | Yes |
| **Typed properties** | `name`, `type`, `modifiers`, `typeParameters` | Yes (they're child KSNodes) |
| **Back-references** | `tsNode`, `tsProgram` | No (circular, TS-internal) |
| **AG navigation** | `$parent`, `$prev`, `$next` | No (circular refs) |
| **AG attributes** | `kindDefs`, `fileImports`, `importViolation` | Some (see below) |

**Core serialization function:**
```typescript
function serializeKSNode(node: KSNode): SerializedKSNode {
  return {
    kind: node.kind,
    pos: node.pos,
    end: node.end,
    text: node.text,
    // typed properties extracted per-kind
    ...extractTypedProperties(node),
    children: node.children.map(serializeKSNode),
  };
}
```

**Design Decision 2: Where does `serializeKSNode` live?**

> **Option A: In `src/dashboard/export.ts`** — Alongside `extractAST`. It's dashboard-specific serialization.
>
> **Option B: In `src/pipeline/serialize.ts`** (new) — A general-purpose KS AST serializer. Could be reused by CLI, language server, etc.
>
> **Option C: In `libs/ag/src/serialize.ts`** (new) — A generic AG tree serializer that works on any stamped tree, not just KS nodes.
>
> **Recommendation:** Option B + Option C together. The AG library gets a generic `serializeTree()` that handles `$parent`/`$children`/attribute stripping. The pipeline gets a KS-specific `serializeKSNode()` that handles `tsNode` stripping and typed property extraction. The dashboard export uses both.

---

### 3. AG Library: `serializeTree` / `deserializeTree`

The AG library needs serialization primitives for any attributed tree.

**`libs/ag/src/serialize.ts` (new):**

```typescript
interface SerializeOptions {
  /** Include computed AG attributes in output? Default: false */
  includeAttributes?: boolean;
  /** Attribute names to include (if includeAttributes=true). Default: all */
  attributeFilter?: string[];
  /** Custom property filter — return false to exclude a property */
  propertyFilter?: (key: string, value: unknown) => boolean;
}

/**
 * Serialize a stamped tree to a JSON-safe structure.
 * Strips $parent, $prev, $next (circular refs).
 * Optionally includes computed attribute values.
 */
function serializeTree<N extends object>(
  root: N,
  getChildren: (node: N) => N[],
  options?: SerializeOptions,
): unknown;

/**
 * Deserialize a tree and stamp navigation properties.
 * Returns the root, ready for applyAttributes().
 */
function deserializeTree<N extends object>(
  data: unknown,
  getChildren: (node: N) => N[],
): N;
```

**Design Decision 3: AG attribute serialization**

> When serializing an attributed tree, should computed attributes be included?
>
> **Option A: Never** — Only serialize the raw tree structure. Attributes are always recomputed by running the AG spec on the deserialized tree.
>
> **Option B: Opt-in per attribute** — `serializeTree(root, getChildren, { includeAttributes: true, attributeFilter: ['kindDefs', 'allViolations'] })`. Useful for caching/transport without re-evaluation.
>
> **Option C: Always** — Serialize everything except circular references.
>
> **Recommendation:** Option B. For the dashboard, we want to include some attributes (like `kindDefs`, `importViolation`, `allViolations`) so the dashboard can display them without running AG specs in the browser. But we don't want to include internal intermediaries like `enclosingLocals` or `fileImports`.

**Design Decision 4: Deserialization and re-evaluation**

> After deserializing a KS AST (e.g., from a `.json` file), should we be able to run AG specs on it again?
>
> **Option A: Yes — full round-trip** — `deserializeTree` produces nodes that can be stamped and attributed. This means the serialized format must preserve enough structure for `getChildren` to work.
>
> **Option B: Read-only consumption** — Deserialized trees are for display/inspection only. No re-evaluation.
>
> **Recommendation:** Option A. The `children` array is already in the serialized format. After deserialization, `stampTree(root, n => n.children)` works. This enables offline analysis: save a KS tree as JSON, load it later, run new/different AG specs on it.

---

### 4. KS-Specific Serialization (`src/pipeline/serialize.ts`)

Handles the KS-specific concerns on top of the AG library's generic serializer.

```typescript
/**
 * The serialized form of a KSNode — JSON-safe, no TS references.
 */
interface SerializedKSNode {
  kind: string;
  pos: number;
  end: number;
  text: string;
  children: SerializedKSNode[];
  // Typed properties vary by kind:
  name?: string;                    // for identifiers, declarations
  fileName?: string;                // for CompilationUnit
  escapedText?: string;             // for Identifier
  sourceText?: string;              // for CompilationUnit (optional, can be large)
  // ... other per-kind properties
}

/** Serialize a KSTree to JSON-safe format */
function serializeKSTree(ksTree: KSTree, options?: {
  includeSource?: boolean;
  includeAttributes?: boolean;
}): SerializedKSTree;

/** Deserialize back to a KSTree (without tsNode refs) */
function deserializeKSTree(data: SerializedKSTree): KSTree;
```

**Design Decision 5: How much per-kind property extraction?**

> KS AST nodes have typed properties like `name: KSIdentifier`, `type: KSNode`, `modifiers: KSNode[]`. These are always reachable through `children`, but having them as named properties is ergonomic.
>
> **Option A: Minimal — just core fields** — `{kind, pos, end, text, children}`. The dashboard walks `children` like it already does for the TS AST.
>
> **Option B: Full extraction — all typed properties** — Serialize `name`, `type`, `modifiers`, `typeParameters`, etc. as named references (indices into children array or inline).
>
> **Option C: Key properties only** — Serialize `name` (as string), `fileName`, `escapedText`, `isDeclarationFile`, etc. — the scalar properties that aren't just child references.
>
> **Recommendation:** Option C. Scalar properties (`name`, `fileName`, `escapedText`, etc.) add real value. Child-reference properties (`type`, `modifiers`) don't add value over `children` for the dashboard. Keeps the serialized format compact and understandable.

---

### 5. Dashboard Export Update (`src/dashboard/export.ts`)

The export function needs to support both AST formats.

**Updated `DashboardExportData` (v3):**
```typescript
interface DashboardExportData {
  version: 3;
  project: { root: string; generatedAt: string; rootFiles: string[] };
  parse: {
    sourceFiles: Array<{
      fileName: string;
      lineCount: number;
      declarations: Declaration[];
      source?: string;
      tsAst?: ASTNode;              // Renamed from 'ast' — TS AST view
      ksAst?: SerializedKSNode;     // NEW — KS AST view
    }>;
  };
  kinds: {
    definitions: Array<{ id, name, properties, sourceFile }>;
    annotations: Array<{ id, kindName, name, sourceFile }>;  // NEW
  };
  check: {                          // NEW
    diagnostics: Array<{ id, file, code, property, message, start, length, line, column }>;
    summary: { totalFiles, totalDefinitions, totalAnnotations, totalDiagnostics, cleanFiles, violatingFiles, byProperty };
  };
}
```

**Design Decision 6: Version bump strategy**

> **Option A: Bump to v3, breaking** — The dashboard HTML checks `data.version === 3` and rejects old format.
>
> **Option B: Extend v2, additive** — Add `check`, `annotations`, `tsAst`/`ksAst` as optional fields. The dashboard gracefully degrades (empty check tab if no `check` section).
>
> **Recommendation:** Option B. The dashboard already has hardcoded sample data in v2 format. Additive changes mean old exports still work, and new exports get the full experience. Bump version to 3 only when we eventually make a breaking schema change.

---

### 6. Dashboard HTML Updates

The HTML needs to:
1. Handle the new `check` data from the export (currently only from hardcoded sample)
2. Support toggling between TS AST and KS AST views
3. Show AG attributes in the detail panel when viewing KS AST nodes

**Design Decision 7: AST view toggle UI**

> **Option A: Separate tabs** — Add "TS AST" and "KS AST" as top-level stage tabs alongside Parse/Bind/Check.
>
> **Option B: Toggle within parse detail** — When viewing a file's AST, a toggle button switches between TS and KS views. Both are tree visualizations in the same panel.
>
> **Option C: Side-by-side** — Split the detail panel to show TS AST on left, KS AST on right for the same file.
>
> **Recommendation:** Option B. The AST view is already inside the parse detail panel. Adding a toggle button ("TS AST | KS AST") is minimal UI change and keeps the layout clean. Side-by-side (Option C) is a possible enhancement later.

**Dashboard changes needed:**
- `renderASTTree()` — already handles `ASTNode` shape; the KS `SerializedKSNode` has the same shape, so no change needed
- `showParseDetail()` — add toggle between `sf.tsAst` and `sf.ksAst`
- `showCheckDetail()` — already works with the `check.diagnostics` format
- `updateCounts()` / `updateStatusBar()` — guard against missing `check` section
- Add attribute display in AST node detail (when KS AST is selected)

---

### 7. AG Attribute Visibility in Dashboard (Stretch Goal)

When viewing a KS AST node in the dashboard, show its computed AG attributes:

```
Node: VariableDeclaration "greet"
├── kindAnnotations: [{ name: "NoConsole", ... }]
├── noImportsContext: null
└── importViolation: null
```

This requires serializing selected attributes into the KS AST export (see Decision 3).

**Design Decision 8: Which attributes to expose?**

> **Option A: All non-internal** — Serialize every AG attribute that isn't a Set/Map/function. Display everything.
>
> **Option B: Curated list** — Only serialize: `kindDefs`, `kindAnnotations`, `importViolation`, `allViolations`, `valueImports`, `localBindings`. Skip internal intermediaries.
>
> **Option C: None initially** — Ship AST view first, add attributes later.
>
> **Recommendation:** Option B. The curated attributes tell the story of what the compiler found. Internal attributes like `enclosingLocals` and `isReference` are implementation details. Function-valued attributes (`defLookup`) can't be serialized at all.

For serializing Set values: convert to arrays. For KindDefinition values in attributes: serialize as `{ name, properties }` references (not the full node).

---

## Implementation Order

### Phase 1: Complete the export (fix the gap)
1. Add `check` section to `DashboardExportData` and `exportDashboardData()`
2. Add `kinds.annotations` extraction
3. Add defensive guards in dashboard HTML for missing `check` section
4. Update sample data or verify HTML works with both old and new format

### Phase 2: KS AST serialization
5. Create `libs/ag/src/serialize.ts` — generic `serializeTree`/`deserializeTree`
6. Create `src/pipeline/serialize.ts` — KS-specific `serializeKSNode`/`serializeKSTree`
7. Add `ksAst` to export alongside existing `tsAst`
8. Tests for round-trip serialization

### Phase 3: Dashboard AST toggle
9. Rename `ast` → `tsAst` in export (backward-compat: dashboard checks both)
10. Add AST view toggle button in dashboard HTML
11. Wire toggle to switch between `tsAst` and `ksAst` in `renderASTTree()`

### Phase 4: AG attribute visibility (stretch)
12. Add `includeAttributes` option to KS AST serialization
13. Add attribute display section to dashboard's AST node detail view
14. Curate which attributes are serialized for display

---

## Files Summary

| Action | File | Phase |
|--------|------|-------|
| UPDATE | `src/dashboard/export.ts` | 1, 2, 3 |
| UPDATE | `src/pipeline/types.ts` | 1 (if needed for annotation type) |
| CREATE | `libs/ag/src/serialize.ts` | 2 |
| CREATE | `src/pipeline/serialize.ts` | 2 |
| UPDATE | `libs/ag/src/index.ts` | 2 |
| UPDATE | `docs/compiler-dashboard.html` | 1, 3, 4 |
| UPDATE | `examples/showcase-utils.ts` | 1 (if serve logic changes) |
| CREATE | `libs/ag/test/serialize.test.ts` | 2 |
| CREATE | `test/serialize.test.ts` | 2 |
| UPDATE | `test/export.test.ts` | 1 |

---

## Resolved Questions

1. **KS AST node `text` field** — Keep full text. Truncation is a display concern, not a serialization concern.

2. **CompilationUnit `sourceText`** — Always serialize. Don't worry about export size.

3. **`tsNode` after deserialization** — Just document that AG specs on deserialized trees can't use `tsNode`. No special flag needed.

---

## Implementation Progress

- [x] Phase 1: Complete the export (77 tests pass, clean compile)
- [x] Phase 2: KS AST serialization (88 root tests, 77 AG tests pass)
- [x] Phase 3: Dashboard AST toggle (88 root tests, 77 AG tests pass)
- [ ] Phase 4: AG attribute visibility
