# Dashboard Decoupling & AST-Only Visualization Plan

## Status: DRAFT — awaiting review

---

## 1. Current State Analysis

### 1.1 Dashboard Location & Dependencies

The dashboard lives at `src/dashboard/` inside the main compiler source tree:

```
src/dashboard/
  export.ts          — data serialization (imports from ../pipeline/)
  app/
    types.ts         — re-exports from ../export.ts
    sampleData.ts    — hardcoded demo data
    state/           — React reducer + actions + context
    components/      — React UI (TreeView, DetailPanel, ELK graph, Sidebar, etc.)
    hooks/           — useTooltip, useKeyboard
    utils/           — helpers (syntax highlighting, colors, escHtml)
    styles/          — CSS
    main.tsx         — React entry
    App.tsx          — root component
    index.html       — Vite entry HTML
```

**Direct coupling to compiler internals in `export.ts`:**
- Imports 10 AST node types from `../pipeline/ast.js` (KSCompilationUnit, KSNode, KSIdentifier, etc.)
- Imports `KSProgramInterface`, `KindDefinition`, `AttributeDepGraph` from `../pipeline/types.js`
- Imports `serializeKSNode`, `SerializedKSNode` from `../pipeline/serialize.js`
- Calls `program.getKSTree()`, `program.getKindDefinitions()`, `program.getDiagnostics()`, `program.getAttributeDepGraph()`

**Supporting files outside `src/dashboard/`:**
- `vite.config.dashboard.ts` — Vite config pointing at `src/dashboard/app`
- `tsconfig.dashboard.json` — separate tsconfig for the React app
- `docs/compiler-dashboard.html` — legacy standalone HTML dashboard (2,889 lines)
- `examples/showcase.ts` + `examples/showcase-utils.ts` — showcase entry point

### 1.2 Three AST Representations in Play

The dashboard currently juggles three distinct AST formats:

| Format | Defined In | Used For | Shape |
|--------|-----------|----------|-------|
| `ASTNode` | `src/dashboard/export.ts:26-33` | "TS AST" view in dashboard | `{kind, name?, pos, end, text, children}` — flat, no typed fields |
| `SerializedKSNode` | `src/pipeline/serialize.ts:18-37` | "KS AST" view in dashboard | `{kind, pos, end, text, children, name?, escapedText?, fileName?, ...}` — AG-library generic serializer |
| Schema-generated JSON | `ast-schema/generated/serialize.ts` | Not used by dashboard | `nodeToJSON`/`nodeFromJSON` — fully schema-aware, preserves all typed fields per-kind |

Key observations:
- `ASTNode` is a dumbed-down format produced by `extractAST()` which walks KSNodes but strips all typed properties
- `SerializedKSNode` uses the AG library's generic `serializeTree()` — it doesn't know about the schema's field metadata
- The schema-generated serializer (`ast-schema/generated/serialize.ts`) is the richest and most correct, but the dashboard doesn't use it at all

### 1.3 Current Visualizations Inventory

**Main Tree View (D3.js)** — one tree per stage tab:
1. **Parse tree** — `Program > [files] > [declarations]` hierarchy. Shows file names, declaration counts, line counts. Each declaration node shows kind badge (T/V/F/I/C/E) with color.
2. **Bind/Kinds tree** — `Kinds > [definitions] > [annotations]` hierarchy. Shows kind definitions with property chips, annotations with violation status.
3. **Check tree (by file)** — `Diagnostics > [violating files] > [errors] + [clean files]`. Red/green coloring.
4. **Check tree (by property)** — `Check Results > [property] > [violations]`. Groups errors by property name.

**Detail Panels** (right sidebar, context-dependent):
5. **ParseDetail** — file name, declaration kind badge, position, source preview, "View File" button
6. **KindsDetail (definition)** — properties chips, source file, related annotations list, cross-stage diagnostics
7. **KindsDetail (annotation)** — kind name chip, source file, diagnostics
8. **CheckDetail** — error code, property, message, location, source with violation line highlighted
9. **FileViewer** — stats bar, kind annotations, diagnostics list, declarations list, tabbed: Source | AST | Graph

**AST-Specific Views** (inside FileViewer):
10. **SourceTab** — syntax-highlighted source code with violation line markers
11. **ASTTab** — collapsible tree of AST nodes with kind coloring, name labels, AG attribute badges (when KS mode)
12. **ELK Graph Modal** — full-screen D3+ELK.js graph layout of AST with: collapse/expand, smart collapse, outline mode, depth-based collapse, direction toggle (LR/TD), click-to-inspect, double-click-to-collapse, animated transitions, legend, detail panel

**Sidebar** (left panel, per-stage):
13. **ParseSidebar** — file groups with declaration items, searchable
14. **KindsSidebar** — definitions group + annotations group with property chips
15. **CheckSidebar** — diagnostics grouped by file + clean files group

**Other UI:**
16. **Header** — title bar
17. **StageTabs** — Parse | Bind | Check tab bar
18. **Toolbar** — search input, check view toggle (by file / by property)
19. **StatusBar** — file/definition/diagnostic counts
20. **UploadOverlay** — drag-and-drop JSON upload when no data endpoint
21. **Tooltip** — hover tooltip system

**Legacy:**
22. **`docs/compiler-dashboard.html`** — standalone 2,889-line vanilla JS dashboard with all the same features reimplemented. Used as fallback by `showcase-utils.ts` when Vite isn't available.

**Exported but invisible:**
23. **`depGraph`** — `AttributeDepGraph` with attributes, edges, evaluation order, spec ownership. Serialized in export data but no component reads it.

### 1.4 Examples

- `examples/showcase.ts` — runs full pipeline (parse + bind + check), calls `exportDashboardData()`, serves via Vite
- `examples/showcase-utils.ts` — temp project setup (git clone fixed commit), file discovery, Vite serving with `/__data__` middleware, legacy HTML fallback

---

## 2. Goals

1. **Decouple the dashboard** into a standalone directory that doesn't import from `src/pipeline/`
2. **Use only our AST** (ast-schema/) — eliminate the `ASTNode` type, use the schema-generated serializer
3. **Remove non-AST visualizations** — the dashboard becomes an AST explorer, not a compiler pipeline viewer
4. **Simplify examples** — parse only, then visualize the AST

---

## 3. Visualizations: Keep vs Remove

For your confirmation — here's what I recommend keeping vs removing:

### REMOVE (compiler pipeline visualizations)

| # | Visualization | Reason |
|---|--------------|--------|
| 2 | Bind/Kinds tree | Compiler-specific (kind definitions, annotations) |
| 3 | Check tree (by file) | Compiler-specific (diagnostics) |
| 4 | Check tree (by property) | Compiler-specific (diagnostics) |
| 5 | ParseDetail | Tied to declaration extraction logic |
| 6 | KindsDetail (definition) | Compiler-specific |
| 7 | KindsDetail (annotation) | Compiler-specific |
| 8 | CheckDetail | Compiler-specific |
| 14 | KindsSidebar | Compiler-specific |
| 15 | CheckSidebar | Compiler-specific |
| 17 | StageTabs (3-tab bar) | No longer needed — single AST stage |
| 18 | Toolbar (check view toggle) | Check-specific UI |
| 22 | `docs/compiler-dashboard.html` | Legacy duplicate, fully superseded by React app |
| 23 | depGraph (invisible) | Remove from export; could be a separate tool later |

### KEEP (AST visualization)

| # | Visualization | Notes |
|---|--------------|-------|
| 1 | Parse tree (modified) | Becomes file list — `Program > [CompilationUnits]`. Simplified: no declarations sub-nodes, just files |
| 9 | FileViewer (modified) | Keeps Source + AST + Graph tabs. Remove diagnostics/annotations sections |
| 10 | SourceTab | Keep as-is — syntax-highlighted source view |
| 11 | ASTTab (modified) | Becomes the primary view. Remove TS/KS toggle — only KS AST. Show all typed fields from schema |
| 12 | ELK Graph Modal | Keep as-is — it already works on `ASTNode` shape which is compatible with schema JSON |
| 13 | ParseSidebar (modified) | Becomes file list sidebar with per-file node counts |
| 16 | Header (modified) | Retitle to "KSC AST Explorer" or similar |
| 19 | StatusBar (modified) | Show file count, total node count |
| 20 | UploadOverlay | Keep — allows loading exported JSON |
| 21 | Tooltip | Keep — generic infrastructure |

### REMOVE (from examples)

| Item | Reason |
|------|--------|
| `showcase-utils.ts` git clone logic | Overkill for an AST viewer demo |
| `showcase-utils.ts` legacy HTML fallback | `docs/compiler-dashboard.html` being removed |
| Binder/checker invocation in `showcase.ts` | Only parse is needed |

---

## 4. Options for Directory Structure

### Option A: Top-level `dashboard/` directory

```
ksc/
  dashboard/
    app/              — React UI (moved from src/dashboard/app/)
    data-contract.ts  — the JSON schema the dashboard consumes (standalone)
    vite.config.ts    — Vite config (moved from root)
    tsconfig.json     — dashboard tsconfig (moved from root)
    package.json      — optional, if we want it independently installable
  ast-schema/         — unchanged
  src/                — compiler (no dashboard code)
  examples/           — updated showcase
```

**Pros:** Clear separation at the filesystem level. Dashboard is visually a peer of `src/`, not nested inside it.
**Cons:** Changes every import path in the dashboard. Need to update root `package.json` scripts.

### Option B: Top-level `tools/dashboard/`

```
ksc/
  tools/
    dashboard/
      app/
      data-contract.ts
      vite.config.ts
      tsconfig.json
  ast-schema/
  src/
  examples/
```

**Pros:** Groups tools together (future: could add `tools/cli/`, `tools/lsp/`). Clearer that dashboard is a development tool, not part of the library.
**Cons:** Deeper nesting. `tools/` directory might feel premature with only one tool.

### Option C: Keep `src/dashboard/` but remove all `../pipeline/` imports

```
ksc/
  src/
    dashboard/
      app/            — React UI (same location)
      data-contract.ts — standalone types, no pipeline imports
    pipeline/         — no dashboard awareness
  examples/
```

**Pros:** Minimal file moves. Just clean up the import boundary.
**Cons:** Doesn't achieve the visual/structural decoupling goal. Still looks like dashboard is part of the compiler source.

**Recommendation:** Option A. It most clearly signals that the dashboard is a standalone tool that consumes a data contract, not part of the compiler internals.

---

## 5. Options for AST Data Contract

The core question: what JSON shape does the dashboard consume?

### Option X: Use `ast-schema/generated/serialize.ts` directly

The schema-generated `nodeToJSON()` already produces a richly-typed JSON:

```typescript
// From ast-schema/generated/serialize.ts
interface JSONNode {
  kind: string;
  pos: number;
  end: number;
  text: string;
  children: JSONNode[];
  // Plus ALL typed fields per-kind:
  // IfStatement → expression, thenStatement, elseStatement
  // Identifier → escapedText
  // VariableDeclarationList → declarationKind
  // etc.
}
```

The dashboard defines its own data contract type that mirrors this shape. The export function in `examples/` calls `nodeToJSON()` and wraps it in a thin envelope:

```typescript
interface ASTExplorerData {
  version: 1;
  project: { root: string; generatedAt: string };
  files: Array<{
    fileName: string;
    lineCount: number;
    source: string;
    ast: JSONNode;  // from nodeToJSON()
  }>;
}
```

**Pros:** Schema-generated serializer is the most complete and correct. Preserves all typed fields. Already generated, zero maintenance.
**Cons:** The dashboard needs to be able to render field metadata (which fields are children vs props). Could ship the field metadata table `F` alongside the data, or hardcode field display logic.

### Option Y: Define a dashboard-specific simplified format

Keep something like the current `ASTNode` but enriched:

```typescript
interface DashboardASTNode {
  kind: string;
  pos: number;
  end: number;
  text: string;
  children: DashboardASTNode[];
  properties?: Record<string, string | number | boolean>;  // scalar props
  fieldNames?: string[];  // names of child fields for display
}
```

**Pros:** Dashboard controls its own format. Can be simpler.
**Cons:** Yet another serialization format to maintain. Duplicates work the schema codegen already does.

### Option Z: Use `nodeToJSON()` + ship field metadata

Use `nodeToJSON()` as-is, but also export the `F` (field metadata) table from `ast-schema/generated/serialize.ts` so the dashboard can distinguish children from props and display field names:

```typescript
interface ASTExplorerData {
  version: 1;
  project: { root: string; generatedAt: string };
  fieldMetadata: Record<string, [string, 'c'|'o'|'l'|'p'][]>;  // from F table
  files: Array<{
    fileName: string;
    lineCount: number;
    source: string;
    ast: JSONNode;
  }>;
}
```

**Pros:** Best of both worlds — rich schema data + the dashboard knows how to interpret it. Field names appear in the AST tree view ("expression:", "thenStatement:", etc.).
**Cons:** Slightly larger payload. Dashboard needs rendering logic for field metadata.

**Recommendation:** Option Z. It gives the dashboard the richest possible view of the AST with zero custom serialization code. The field metadata table is small (~4KB) and enables the dashboard to show named child edges (e.g., `thenStatement: IfStatement` instead of just a child index).

---

## 6. Options for Export Function Location

Currently `exportDashboardData()` lives in `src/dashboard/export.ts` and does heavy lifting: walks the KS tree, extracts declarations, annotations, diagnostics, serializes ASTs. In the new model, the export is much simpler (just serialize the AST).

### Option I: Export function moves to `examples/`

The export is just a thin wrapper: call `buildKSTree()`, then `nodeToJSON()` per compilation unit, package into the data contract envelope. It lives in the showcase script, not in the library or dashboard.

```
examples/
  showcase.ts          — parse + export + serve
  showcase-utils.ts    — file discovery + Vite serving (simplified)
```

**Pros:** No export code in `src/` at all. Dashboard is purely a consumer. Examples own the glue code.
**Cons:** If other tools want to produce the same data, they'd duplicate the export logic.

### Option II: Export function lives in `dashboard/`

```
dashboard/
  export.ts            — standalone export function, imports only from ast-schema/
  app/                 — React UI
```

**Pros:** Dashboard package owns its data contract end-to-end. The export function is part of the dashboard's public API.
**Cons:** Dashboard directory has both producer (export) and consumer (app) code, which is a mild SoC concern.

### Option III: Export function stays in `src/` as a thin re-export

```
src/
  ast-export.ts        — wraps ast-schema/generated/serialize.ts for convenience
```

**Pros:** Library provides a clean `exportAST()` API. Dashboard and examples both use it.
**Cons:** Still couples `src/` to the dashboard data contract.

**Recommendation:** Option I for now. The export is ~20 lines of glue code. Keep it in `examples/` until there's a second consumer.

---

## 7. Implementation Plan

### Phase 1: Create standalone dashboard directory & data contract

1. Create `dashboard/` at project root
2. Move `src/dashboard/app/` → `dashboard/app/`
3. Move `vite.config.dashboard.ts` → `dashboard/vite.config.ts` (update paths)
4. Move `tsconfig.dashboard.json` → `dashboard/tsconfig.json` (update include)
5. Define `dashboard/data-contract.ts` with the new `ASTExplorerData` type (Option Z)
6. Update `package.json` scripts to point at new locations
7. Remove `src/dashboard/` entirely
8. Remove `exportDashboardData` and `DashboardExportData` from `src/index.ts`

### Phase 2: Strip compiler-specific visualizations from dashboard

9. Remove stage tabs (Parse/Bind/Check) — dashboard is single-view (AST explorer)
10. Remove `KindsSidebar.tsx`, `CheckSidebar.tsx`
11. Remove `KindsDetail.tsx`, `CheckDetail.tsx`, `ParseDetail.tsx`
12. Remove `buildBindTree()`, `buildCheckTreeByFile()`, `buildCheckTreeByProperty()` from `treeBuilders.ts`
13. Simplify `ParseSidebar.tsx` → `FileSidebar.tsx` (just file list)
14. Remove check-specific state: `checkView`, `activeStage` reducer logic
15. Simplify `types.ts` — remove `Stage`, `CheckView`, keep `FileViewerTab`
16. Update `reducer.ts` + `actions.ts` — remove stage switching, check view, kinds/check detail actions
17. Update `StatusBar.tsx` — show file count + node count only
18. Remove or simplify `Toolbar.tsx` — keep search, remove check view toggle
19. Update `DashboardShell.tsx` — remove `StageTabs`, simplify layout

### Phase 3: Switch to schema-generated AST format

20. Replace `ASTNode` type with schema JSON node type from data contract
21. Update `ASTTab.tsx` — render typed field names from metadata, remove TS/KS toggle (KS only)
22. Update `elkHelpers.ts` — use new node shape (compatible, minimal changes)
23. Update `FileViewer.tsx` — remove `astMode` toggle, always KS AST
24. Update `sampleData.ts` — generate sample data using `nodeToJSON()` from a small fixture, include field metadata
25. Update `UploadOverlay` — validate against new `ASTExplorerData` shape

### Phase 4: Simplify examples

26. Rewrite `examples/showcase.ts`:
    - Parse only: `createProgram()` → just `ts.createProgram()` + `buildKSTree()`
    - No binder/checker invocation
    - Inline the export: call `nodeToJSON()` per CU, build `ASTExplorerData` envelope
    - Serve via Vite
27. Simplify `examples/showcase-utils.ts`:
    - Remove git clone / fixed commit logic (or keep as opt-in)
    - Remove legacy HTML fallback (`serveDashboardLegacy`)
    - Keep `discoverRootFiles()` and `serveDashboard()` (Vite-only)

### Phase 5: Cleanup

28. Delete `docs/compiler-dashboard.html` (legacy standalone dashboard)
29. Delete dashboard-related architecture docs that are now obsolete:
    - `docs/architecture/dashboard-v2-migration.md`
    - `docs/architecture/dashboard-dual-ast-plan.md`
    - `docs/architecture/dashboard-ui-options.md`
    - `docs/architecture/compiler-dashboard-viz-design.md`
    - `docs/architecture/graph-viz-review.md`
    - `docs/architecture/showcase-plan.md`
30. Delete dashboard screenshot PNGs from project root
31. Remove `d3`, `elkjs`, `react`, `react-dom` from main `package.json` dependencies (move to dashboard-local if needed, or keep as devDependencies)
32. Remove `@types/d3`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react` from devDependencies if dashboard has its own package.json
33. Clean up `src/index.ts` — remove dashboard exports

---

## 8. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Schema-generated serializer doesn't produce the exact shape the dashboard needs | The `nodeToJSON()` output has `kind`, `pos`, `end`, `text`, `children` — identical structural shape to current `ASTNode`. Typed fields are additive. |
| ELK graph code assumes `ASTNode` shape | The ELK code only reads `.kind`, `.name`, `.children`, `.text`, `.pos`, `.end` — all present in schema JSON. Compatible. |
| Losing the TS AST view | The "TS AST" view was a simplified dump (`extractAST`) that was less useful than the KS AST. The KS AST is a faithful mirror of the TS AST with better structure. No information loss. |
| Breaking `npm run showcase` | Phase 4 rewrites it. Test immediately after. |
| Field metadata adds complexity to rendering | Start simple — just show field names as labels. Can enhance incrementally. |

---

## 9. Files Affected Summary

### Created
- `dashboard/data-contract.ts`
- `dashboard/vite.config.ts`
- `dashboard/tsconfig.json`

### Moved (src/dashboard/app/ → dashboard/app/)
- All 35 files in `src/dashboard/app/`

### Modified
- `dashboard/app/types.ts` — new data contract types
- `dashboard/app/sampleData.ts` — new sample data shape
- `dashboard/app/state/reducer.ts` — simplified state
- `dashboard/app/state/actions.ts` — simplified actions
- `dashboard/app/components/*` — stripped/simplified per Phase 2-3
- `examples/showcase.ts` — parse-only + new export
- `examples/showcase-utils.ts` — simplified
- `package.json` — updated scripts, possibly dependencies

### Deleted
- `src/dashboard/` (entire directory)
- `src/dashboard/export.ts`
- `docs/compiler-dashboard.html`
- `docs/architecture/dashboard-v2-migration.md`
- `docs/architecture/dashboard-dual-ast-plan.md`
- `docs/architecture/dashboard-ui-options.md`
- `docs/architecture/compiler-dashboard-viz-design.md`
- `docs/architecture/graph-viz-review.md`
- `docs/architecture/showcase-plan.md`
- `dashboard-*.png` (12 screenshot files)

---

## 10. Decision Matrix

| Decision | Options | Recommendation |
|----------|---------|---------------|
| Directory structure | A: top-level `dashboard/` / B: `tools/dashboard/` / C: keep `src/dashboard/` | **A** |
| AST data format | X: schema JSON only / Y: custom simplified / Z: schema JSON + field metadata | **Z** |
| Export function location | I: in `examples/` / II: in `dashboard/` / III: in `src/` | **I** |
