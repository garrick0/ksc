# Dashboard v2 Migration Plan

Migrate `docs/compiler-dashboard.html` from v1 data format to v2.

## Format Comparison

### v1 (current dashboard — remove)

```
data.bind.symbols[] → { id, name, valueKind, declaredProperties, path, resolvedFiles }
data.check.summary.totalSymbols
```

### v2 (current compiler output — use)

```
data.kinds.definitions[] → { id, name, properties, sourceFile }
data.kinds.annotations[] → { id, kindName, name, sourceFile }
data.check.summary.totalDefinitions
data.check.summary.totalAnnotations
```

Key differences from the original plan:
- `rules` was renamed to `properties` in the pipeline redesign
- `scope` field was removed from annotations
- No `resolvedFiles`, `path`, or `valueKind` — the v2 model is definition/annotation-based, not directory/file/composite-based

## Changes

### 1. Replace SAMPLE_DATA (lines 488–701)

New sample data in v2 format. Use the same 5 source files. Replace `bind.symbols` with:

```js
kinds: {
  definitions: [
    { id: "kdef-0", name: "NoConsole", properties: { noConsole: true }, sourceFile: "src/kinds.ts" },
    { id: "kdef-1", name: "NoMutation", properties: { noMutation: true }, sourceFile: "src/kinds.ts" },
    { id: "kdef-2", name: "NoImports", properties: { noImports: true }, sourceFile: "src/kinds.ts" },
  ],
  annotations: [
    { id: "kann-0", kindName: "NoConsole", name: "greet", sourceFile: "src/funcs/no-console.ts" },
    { id: "kann-1", kindName: "NoMutation", name: "mutate", sourceFile: "src/funcs/no-mutation.ts" },
    { id: "kann-2", kindName: "NoImports", name: "handle", sourceFile: "src/domain/handler.ts" },
  ],
},
check: {
  summary: {
    totalFiles: 6,
    totalDefinitions: 3,
    totalAnnotations: 3,
    totalDiagnostics: 4,
    cleanFiles: 4,
    violatingFiles: 2,
    byProperty: { ... }
  }
}
```

Set `version: 2`.

### 2. Rename BIND tab → KINDS tab

- Line 382: Change displayed text from `BIND` to `KINDS`
- Keep `data-stage="bind"` and `bind-count` IDs internally to minimize churn

### 3. Update `updateCounts()` (line 750–754)

```
data.bind.symbols.length → data.kinds.definitions.length
```

### 4. Update `updateStatusBar()` (lines 757–766)

```
data.bind.symbols.length → data.kinds.definitions.length
```

Change "symbols" label → "kinds" in header stats.

### 5. Update status bar HTML (line 420)

Change `<strong id="sb-symbols">0</strong> symbols` → `<strong id="sb-symbols">0</strong> kinds`

### 6. Update `updateLegend()` (lines 776–779)

Replace Directory/File/Composite legend with Definition/Annotation legend:

```js
leg('D','var(--blue)','Definition'), leg('A','var(--cyan)','Annotation')
```

### 7. Rewrite `renderBindSidebar()` (lines 839–874)

Group by definitions and annotations instead of directory/file/composite:

```
Definitions (3)
  ├ NoConsole          properties: noConsole
  ├ NoMutation         properties: noMutation
  └ NoImports          properties: noImports

Annotations (3)
  ├ greet              kind: NoConsole
  ├ mutate             kind: NoMutation
  └ handle             kind: NoImports
```

- Filter by search query on `name`/`kindName`/`properties`
- Use `propsChips()` for definition properties
- Show `kindName` chip for annotations

### 8. Rewrite `showBindDetail()` (lines 989–1033)

**For definitions:** show name, properties, sourceFile, and list annotations that reference this definition. Cross-stage: find diagnostics in files matching annotations of this definition.

**For annotations:** show name, kindName, sourceFile.

Add a `_type` field to sidebar click data so the detail function knows whether it received a definition or annotation.

### 9. Update `showFileViewer()` (lines 1065–1093)

- Line 1071: Replace `data.bind.symbols.filter(s => (s.resolvedFiles || []).includes(fileName))` with:
  `data.kinds.annotations.filter(a => a.sourceFile === fileName)`
- "Governed By" section: show annotation kindNames as chips instead of symbol names
- `navigateToSymbol()` call → `navigateToDefinition()` using kindName to find the definition

### 10. Rewrite `buildBindTree()` (lines 1514–1537)

New tree structure:

```
Kinds
├─ Definitions
│  ├─ NoConsole [properties chips]
│  │  └─ greet (annotation)
│  ├─ NoMutation [properties chips]
│  │  └─ mutate (annotation)
│  └─ NoImports [properties chips]
│     └─ handle (annotation)
└─ Unlinked Annotations (if any)
```

Root node: "Kinds" with tooltip showing counts.
Each definition node has its annotations as children.

### 11. Rewrite `buildBindNode()` (lines 1539–1576)

Replace symbol-based node with definition-based node:
- `declaredProperties` → `properties`
- Remove `resolvedFiles` child nodes → use annotation children instead
- Remove `valueKind` badge → use "DEF" badge for definitions
- Color: blue for definitions

Add a new `buildAnnotationNode()`:
- Badge: "ANN"
- Color: cyan
- Shows `kindName` chip

### 12. Update `buildCheckTreeByProperty()` line 1661

Replace:
```js
const sym = data.bind.symbols.find(s => (s.resolvedFiles || []).includes(d.file));
```
With:
```js
const ann = data.kinds.annotations.find(a => a.sourceFile === d.file);
const label = ann ? ann.name : shortFileName(d.file);
```

### 13. Update `navigateToSymbol()` (lines 1285–1295)

Rename to `navigateToDefinition(defId)`:
```js
data.bind.symbols.find(s => s.id === symId) → data.kinds.definitions.find(d => d.id === defId)
```

### 14. Replace helper functions (lines 1766–1790)

- `valueKindColor()` → replace with `kindItemColor(item)`: returns blue for definitions, cyan for annotations
- `vkBadge()` → replace with badge logic: "DEF" for definitions, "ANN" for annotations
- `propsChips()` — keep as-is, works with `properties` object (same shape as old `declaredProperties`)

## Execution Order

1. [x] Replace SAMPLE_DATA with v2 format
2. [x] Update `updateCounts()` and `updateStatusBar()`
3. [x] Update tab label text (BIND → KINDS)
4. [x] Update status bar HTML label (symbols → kinds)
5. [x] Update legend
6. [x] Rewrite `renderBindSidebar()`
7. [x] Rewrite `showBindDetail()`
8. [x] Update `showFileViewer()`
9. [x] Rewrite `buildBindTree()` and `buildBindNode()` → now `buildDefinitionNode()`
10. [x] Update `buildCheckTreeByProperty()` line 1661
11. [x] Update `navigateToSymbol()` → `navigateToDefinition()`
12. [x] Replace `valueKindColor()` and `vkBadge()` → `kindItemColor()` and `kindItemBadge()`

## Verification

1. [x] `npx tsc --noEmit` — compiles clean
2. [x] `npx vitest run` — all 38 tests pass (5 test files)
3. [x] Open `docs/compiler-dashboard.html` via HTTP server — sample data loads correctly
4. [x] Test all 3 tabs: PARSE (7 files), KINDS (3 defs, 6 anns), CHECK (4 diagnostics)
5. [x] Test detail panels — definition detail shows properties, annotations, cross-stage diagnostics
6. [x] Test By Property view — annotation names resolve correctly via `data.kinds.annotations`
