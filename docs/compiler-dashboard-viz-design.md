# KindScript Compiler Dashboard — Visualization Design Doc

> Design analysis for a per-stage compiler dashboard inspired by the universe-explorer tree view in `kindscript.worktrees/ts-alignment-impl`.

---

## 1. Goal

Build a self-contained HTML visualization that acts as a **KindScript Compiler Dashboard**. The dashboard is segmented by compiler stage — **Parse**, **Bind**, **Check** — with each stage panel showing its output data in a tree view. The visualization should feel like an IDE-integrated inspector: dark theme, collapsible trees, hover details, and cross-stage linking.

The universe-explorer already demonstrates a D3-powered tree view with sidebar navigation, expand/collapse, tooltips, carrier badge dots, and a right panel for file/detail inspection. We adapt those patterns to the three-stage compiler pipeline rather than the carrier/governance domain.

---

## 2. Reference: Universe Explorer Tree View

### What it does well

| Feature | Implementation | Reuse potential |
|---------|---------------|-----------------|
| **D3 tree layout** | `d3.tree().nodeSize([26, 180])`, horizontal depth spread | Direct reuse — same layout engine |
| **Expand/collapse** | `d._children` / `d.children` swap + 350ms transitions | Direct reuse — exact same pattern |
| **Sidebar tree** | DOM-based, recursive `renderNode()` with search filter | Adapt — replace carrier nodes with symbol nodes |
| **Right panel** | Dual-tab file/carrier viewer with code highlighting | Adapt — show declaration details, property specs |
| **Tooltips** | Fixed-position div, auto-repositioned near edges | Direct reuse |
| **Zoom/pan** | `d3.zoom().scaleExtent([0.15, 3])` on SVG | Direct reuse |
| **Colored badge dots** | Per-carrier type coloring (path/glob/package) | Adapt — color by role/valueKind/violation |
| **Governance indicators** | Green (governed) / red (ungoverned) dots on file nodes | Adapt — green (clean) / red (has violations) |
| **Status bar** | Bottom bar with aggregate stats | Direct reuse — show per-stage counts |

### What we change

The universe explorer operates on a single flat data model (carriers → files → declarations). Our dashboard operates on **three layered data models**, one per compiler stage, where each stage augments the previous:

```
Parse output  → TS AST + SourceFiles
Bind output   → Parse + KindSymbolTable (definitions + values + properties)
Check output  → Parse + Bind + KSDiagnostic[] + ComputedPropertySpec
```

The central organizational axis shifts from "carrier hierarchy" to "compiler stage".

---

## 3. Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│  KindScript Compiler Dashboard        [Load] [Sample]    │  <- Header
├──────────┬───────────────────────────────────────────────┤
│          │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│ Sidebar  │  │  PARSE  │ │  BIND   │ │  CHECK  │  Tabs   │  <- Stage selector
│          │  └─────────┘ └─────────┘ └─────────┘         │
│ (context │ ┌────────────────────────────┬───────────────┐│
│  depends │ │                            │               ││
│  on      │ │   Tree View (D3)           │  Detail Panel ││
│  active  │ │   per-stage data           │  (right)      ││
│  stage)  │ │                            │               ││
│          │ │                            │               ││
│          │ └────────────────────────────┴───────────────┘│
├──────────┴───────────────────────────────────────────────┤
│  Status: 4 source files │ 12 symbols │ 3 diagnostics    │  <- Status bar
└──────────────────────────────────────────────────────────┘
```

### Stage tabs

Three persistent tabs at the top of the content area. The active tab determines:
- What data the tree view renders
- What the sidebar shows
- What the detail panel displays

Tabs are color-coded:
- **Parse** — `#4f8ef7` (blue) — raw structure
- **Bind** — `#a78bfa` (purple) — semantic enrichment
- **Check** — `#4ade80` (green, clean) / `#f87171` (red, violations) — enforcement

### Sidebar

Context-sensitive to the active stage:

| Stage | Sidebar contents |
|-------|-----------------|
| Parse | Source file list with line counts |
| Bind  | KindSymbol list grouped by role (definitions / values), searchable |
| Check | Diagnostics grouped by file, filterable by error code |

### Detail panel

Slide-in panel on the right (same as universe-explorer's `#right-panel`). Shows contextual detail when a tree node is clicked:

| Stage | Detail panel shows |
|-------|-------------------|
| Parse | File source with line numbers, AST node type annotations |
| Bind  | Symbol metadata: role, valueKind, declaredProperties, path, members |
| Check | Diagnostic detail: code, message, source location, property name |

---

## 4. Per-Stage Tree Views

### 4a. Parse Stage Tree

**Data source:** `program.getSourceFiles()` — the TypeScript source files in the program.

**Tree structure:**
```
Program (root)
├── context.ts (SourceFile)
│   ├── type KSDir<...> (TypeAliasDeclaration)
│   ├── type PropertySpec (TypeAliasDeclaration)
│   ├── type Kind<...> (TypeAliasDeclaration)
│   ├── type PureLayer (TypeAliasDeclaration)        <- Kind definition
│   ├── declare const ks (VariableStatement)
│   └── const pureDir: PureLayer (VariableStatement)  <- Kind value
├── src/pure/math.ts (SourceFile)
│   ├── export function add(...) (FunctionDeclaration)
│   └── export function multiply(...) (FunctionDeclaration)
└── [other source files...]
```

**Hierarchy:** `d3.hierarchy` built from TS AST. Each SourceFile is a root child. Top-level declarations are children of their file. We only go **1 level deep** by default (file → top-level declarations). Expanding a function/class node could optionally show its body statements, but this is a stretch goal.

**Node rendering:**

| Element | Visual |
|---------|--------|
| SourceFile | Blue folder icon, bold name, `(N decls)` count |
| TypeAliasDeclaration | Purple `T` badge, name |
| VariableStatement | Blue `V` badge, variable name + type annotation preview |
| FunctionDeclaration | Yellow `F` badge, name + param count |
| InterfaceDeclaration | Cyan `I` badge, name |
| ImportDeclaration | Gray `→` badge, module specifier |

**Key interactions:**
- Click file → detail panel shows source code
- Click declaration → detail panel shows that node's source range highlighted
- Hover → tooltip with `SyntaxKind`, position, text preview

**Data extraction:**
```typescript
interface ParseStageNode {
  name: string;
  kind: ts.SyntaxKind;       // AST node type
  pos: number;               // start offset
  end: number;               // end offset
  fileName?: string;         // for SourceFile nodes
  children: ParseStageNode[];
  text?: string;             // truncated source text for preview
}
```

Build by walking `ts.forEachChild(sourceFile, ...)` one level deep, extracting the declaration name via `node.name?.getText()` or similar.

---

### 4b. Bind Stage Tree

**Data source:** `program.getKindSymbolTable()` — the `KindSymbolTable` (WeakMap) resolved into a list.

**Tree structure:**
```
KindSymbolTable (root)
├── Definitions
│   ├── PureLayer (Kind definition)
│   │   properties: { noConsole: true, immutable: true, noSideEffects: true }
│   │   base: KSDir
│   └── StrictModule (Kind definition)
│       properties: { pure: true, static: true }
│       base: KSFile
├── Values
│   ├── pureDir: PureLayer (directory value)
│   │   path: "./src/pure"
│   │   resolves to: [src/pure/math.ts]
│   ├── configModule: StrictModule (file value)
│   │   path: "./config.ts"
│   └── appKernel (composite value)
│       ├── api: ApiLayer (member)
│       └── core: CoreLayer (member)
└── [Ungoverned files — files in program not covered by any value]
```

**Hierarchy:** Two top-level groups: **Definitions** and **Values**. Under Values, composite kinds expand into their members. This mirrors the universe-explorer's carrier hierarchy but with Kind semantics.

**Node rendering:**

| Symbol role | Visual |
|-------------|--------|
| Kind definition | Purple circle, name, property chips |
| Value (function) | Yellow `λ` badge |
| Value (file) | Blue file icon, path shown |
| Value (directory) | Blue folder icon, path + file count |
| Value (composite) | Orange compound icon, member count |
| Composite member | Indented under parent, own kind label |

**Property chips** — small inline badges showing declared properties:
```
PureLayer  [noConsole] [immutable] [noSideEffects]
```
Colored by category: green for clean/declarative, orange for restriction.

**Key interactions:**
- Click definition → detail panel shows PropertySpec, base type, member list
- Click value → detail panel shows resolved files/nodes, declared vs. computed properties
- Click composite member → detail panel shows that member's definition + resolved nodes
- Hover → tooltip with symbol metadata

**Data extraction:**
```typescript
interface BindStageNode {
  name: string;
  role: 'definition' | 'value';
  valueKind?: 'function' | 'file' | 'directory' | 'composite';
  declaredProperties: PropertySpec;
  path?: string;
  resolvedFiles?: string[];      // for file/dir values
  members?: BindStageNode[];     // for composites
  kindDefinitionName?: string;   // what Kind this value is typed as
  sourceFile: string;
  sourcePos: number;
}
```

Extracted by iterating the program's source files, looking up each file's TS symbols in the KindSymbolTable, and collecting the KindSymbol metadata.

---

### 4c. Check Stage Tree

**Data source:** `program.getKindDiagnostics()` — the `KSDiagnostic[]` array, plus optionally `ComputedPropertySpec` per symbol.

**Tree structure (diagnostics view):**
```
Diagnostics (root)  [3 errors]
├── context.ts
│   ├── KS70009: noConsole — console usage in "logFunc" body
│   │   line 24, col 4: console.log('hello')
│   └── KS70013: noMutation — mutation in "counter" body
│       line 31, col 4: x = 1
├── src/impure/messy.ts
│   ├── KS70010: immutable — mutable declaration "let counter"
│   │   line 6, col 0: let counter = 0
│   ├── KS70009: noConsole — console usage
│   │   line 8, col 0: console.log('module loaded')
│   └── KS70012: noSideEffects — top-level call
│       line 8, col 0: console.log('module loaded')
└── ✓ All clean (files with no violations listed at bottom, collapsed)
```

**Alternative view — property matrix:**
```
Check Results (root)
├── noConsole
│   ├── ✓ pureDir — clean (0 violations)
│   └── ✗ impureDir — 1 violation
│       └── src/impure/messy.ts:8 — console.log(...)
├── immutable
│   ├── ✓ pureDir — clean
│   └── ✗ impureDir — 1 violation
│       └── src/impure/messy.ts:6 — let counter
├── noSideEffects
│   └── ✗ impureDir — 1 violation
│       └── src/impure/messy.ts:8 — console.log(...)
└── noMutation
    └── ✗ noMutationFunc — 2 violations
        ├── context.ts:31 — x = 1
        └── context.ts:32 — x++
```

Both views should be available via a toggle (like universe-explorer's view buttons: Tree / Treemap / Sunburst / Graph). Here: **By File** / **By Property** / **Summary**.

**Node rendering:**

| Diagnostic state | Visual |
|-----------------|--------|
| File with errors | Red dot, file name, error count badge |
| File clean | Green dot, file name, `✓` |
| Diagnostic | Red warning icon, error code badge, message preview |
| Property group (clean) | Green dot, property name, `✓ N values` |
| Property group (violations) | Red dot, property name, violation count |

**Key interactions:**
- Click diagnostic → detail panel shows source file with the violation line highlighted
- Click file → shows all diagnostics for that file with inline annotations
- Click property group → shows all values checked for that property
- Hover diagnostic → tooltip with full message, code, category

**Data extraction:**
```typescript
interface CheckStageNode {
  // By-file view
  file: string;
  diagnostics: Array<{
    code: number;
    codeLabel: string;        // "KS70009"
    property: string;         // "noConsole"
    message: string;
    line: number;
    column: number;
    length: number;
    sourcePreview: string;    // truncated source at violation
  }>;

  // By-property view
  property: string;
  values: Array<{
    name: string;
    clean: boolean;
    violations: PropertyViolation[];
  }>;
}
```

---

## 5. Cross-Stage Linking

A key differentiator from the universe-explorer: our stages are **additive**. Each stage enriches the same underlying source files. Cross-stage navigation lets the user follow a concept from parse to bind to check:

### Linking patterns

| From | To | Trigger |
|------|----|---------|
| Parse: VariableStatement | Bind: KindSymbol (if annotated) | Click "Show in Bind" button on declaration |
| Bind: Value symbol | Check: Diagnostics for that value | Click "Show Diagnostics" on value node |
| Check: Diagnostic | Parse: Source location | Click "Show Source" on diagnostic |
| Check: Diagnostic | Bind: Symbol that owns the value | Click "Show Symbol" on diagnostic |
| Bind: Directory value | Parse: Resolved source files | Expand "Resolved Files" in detail panel |

### Implementation

Each node carries a `links` map:
```typescript
interface DashboardNode {
  // ...stage-specific fields
  links?: {
    parseNode?: string;   // ID into parse tree
    bindSymbol?: string;  // ID into bind tree
    checkDiags?: string[]; // IDs into check tree
  };
}
```

Navigation buttons in the detail panel switch the active stage tab and highlight/scroll to the linked node.

---

## 6. Data Pipeline

### How data flows from the compiler to the dashboard

```
User code (*.ts files)
    │
    ▼
createProgram(rootFiles, options)
    │
    ├──► program.getSourceFiles()          → Parse stage data
    │
    ├──► program.getKindSymbolTable()      → Bind stage data
    │
    └──► program.getKindDiagnostics()      → Check stage data
```

### Serialization format

The dashboard needs a JSON snapshot to operate on (same pattern as universe-explorer's `CarrierExportData`). Define a `DashboardExportData` shape:

```typescript
interface DashboardExportData {
  version: 1;
  project: {
    root: string;
    generatedAt: string;
    rootFiles: string[];
  };

  parse: {
    sourceFiles: Array<{
      fileName: string;
      lineCount: number;
      declarations: Array<{
        id: string;
        name: string;
        kind: string;           // SyntaxKind name
        pos: number;
        end: number;
        text: string;           // first 120 chars of source
      }>;
      source?: string;          // full source text (optional, for detail view)
    }>;
  };

  bind: {
    symbols: Array<{
      id: string;
      name: string;
      role: 'definition' | 'value';
      valueKind?: 'function' | 'file' | 'directory' | 'composite';
      declaredProperties: Record<string, boolean | number>;
      path?: string;
      resolvedFiles?: string[];
      members?: string[];       // IDs of member symbols
      kindDefinitionId?: string;
      sourceFile: string;
      sourcePos: number;
    }>;
  };

  check: {
    diagnostics: Array<{
      id: string;
      file: string;
      code: number;
      property: string;
      message: string;
      start: number;
      length: number;
      line: number;
      column: number;
      symbolId?: string;        // link back to bind symbol
    }>;
    summary: {
      totalFiles: number;
      totalSymbols: number;
      totalDiagnostics: number;
      cleanFiles: number;
      violatingFiles: number;
      byProperty: Record<string, { checked: number; violations: number }>;
    };
  };
}
```

### Export function (new addition to `src/index.ts`)

```typescript
export function exportDashboardData(program: KSProgram): DashboardExportData
```

This function walks the program's source files, symbol table, and diagnostics to produce the serialized snapshot.

---

## 7. Reusable Components from Universe Explorer

### Direct reuse (copy + adapt CSS/JS)

1. **D3 tree layout engine** — `d3.tree().nodeSize([26, 180])` with expand/collapse
2. **Zoom/pan** — `d3.zoom()` on SVG container
3. **Tooltip system** — fixed-position div with auto-repositioning
4. **Sidebar search** — input + recursive filter + highlight
5. **Right detail panel** — slide-in panel with tabs and close button
6. **Status bar** — bottom bar with stats
7. **CSS variables** — dark theme palette (identical `:root` block)
8. **Link path** — cubic Bezier `linkPath(s, t)` function
9. **Transition timing** — 350ms for tree animations

### Adapt (modify for our domain)

1. **Sidebar tree** — replace carrier hierarchy with stage-specific node lists
2. **Node badges** — replace carrier type dots with syntax kind / role badges
3. **Governance indicators** — replace governed/ungoverned with clean/violated
4. **Explorer tree** — replace filesystem tree with AST tree (parse stage)
5. **Upload overlay** — replace "Load Carrier Data" with "Load Dashboard Data"
6. **Legend** — replace carrier types with stage-specific semantics

### New components

1. **Stage tab bar** — three tabs for Parse/Bind/Check with color indicators
2. **Property chips** — inline property spec badges on bind nodes
3. **Cross-stage navigation buttons** — "Show in Bind →", "Show Source →"
4. **Summary view** — aggregate pass/fail grid for check stage
5. **Error code badge** — `KS70009` styled badges on diagnostic nodes

---

## 8. Implementation Plan

### Phase 1: Scaffold + Parse view

1. Create `docs/compiler-dashboard.html` with the base layout (header, sidebar, content, status bar)
2. Port CSS from universe-explorer (dark theme, tree styles, tooltip, panel)
3. Embed D3 v7 from CDN
4. Implement `DashboardExportData` sample data for a small fixture
5. Build parse-stage tree: source files → top-level declarations
6. Wire expand/collapse, tooltips, detail panel for parse nodes

### Phase 2: Bind view

1. Add bind-stage sidebar (symbols grouped by role)
2. Build bind-stage tree: definitions and values with property chips
3. Composite member expansion
4. Detail panel for symbols: properties, resolved files, kind definition link
5. Cross-stage link: parse declaration → bind symbol

### Phase 3: Check view

1. Add check-stage tree with two sub-views (by file, by property)
2. Diagnostic nodes with error code badges and source previews
3. Summary sub-view with property × value pass/fail grid
4. Detail panel for diagnostics: source code with violation line highlighted
5. Cross-stage links: diagnostic → source, diagnostic → symbol

### Phase 4: Export function + CLI integration

1. Implement `exportDashboardData()` in `src/index.ts`
2. Add CLI command: `ksc dashboard --output data.json`
3. Wire the upload overlay to load exported JSON
4. Test with real fixture programs

---

## 9. Open Questions

1. **Source text in export** — Should the full source text of each file be included in the JSON export? Adds size but enables the code viewer without filesystem access. The universe-explorer uses `data._fileContents` for this. **Recommendation:** Include it, gated by a `--include-source` flag.

2. **AST depth** — Should the parse tree go deeper than top-level declarations (e.g., show function body statements, class members)? **Recommendation:** Default to 1 level. Allow on-demand expansion via lazy loading from the source text.

3. **Live mode vs. snapshot** — Should the dashboard support live reloading when files change? **Recommendation:** Snapshot-first (JSON file). Live mode is a future enhancement via a watch server.

4. **Treemap/Sunburst views** — The universe-explorer has four view modes. Should the dashboard also support treemap and sunburst? **Recommendation:** Start with tree view only. Add treemap for the check stage (violation density by file size) as a stretch goal.

5. **D3 dependency** — The universe-explorer uses D3 v7 from CDN. Should the dashboard be zero-dependency? **Recommendation:** Use D3 from CDN (same as universe-explorer). The tree layout and zoom/pan are significantly better with D3 than a hand-rolled solution.
