# Dashboard UI Options

## Current State

The dashboard is a single 2,600-line HTML file (`docs/compiler-dashboard.html`) with embedded CSS and vanilla JS. It uses D3.js and ELK.js from CDN for graph visualization. Data is injected by string-replacing a `SAMPLE_DATA` variable into the HTML before serving it via `http.createServer`.

This works but has real limits: no module system, no type safety in the UI code, no hot reload, no component reuse, and the monolithic file is hard to maintain.

## What Stays the Same (All Options)

- **Data contract**: `DashboardExportData` from `src/dashboard/export.ts` — unchanged
- **Compiler pipeline**: `createProgram()` → `exportDashboardData()` — unchanged
- **Serving model**: Local dev server started by showcase script — unchanged
- **No authentication / no deployment target** — this is a local developer tool

## The Three Options

### Option A: Vite + Vanilla TypeScript

Keep the no-framework philosophy but add real tooling.

**Structure:**
```
src/dashboard/
  index.html
  main.ts
  styles.css
  views/
    parse-view.ts
    bind-view.ts
    check-view.ts
  components/
    sidebar.ts
    source-viewer.ts
    ast-tree.ts
    elk-graph.ts
  lib/
    data.ts          # typed DashboardExportData access
    dom-helpers.ts   # createElement wrappers
```

**How it works:**
- Vite dev server proxies `/api/data` to the compiler backend
- `showcase.ts` starts both the Vite dev server and a tiny API server
- Production: `vite build` → static bundle, data injected at serve time
- D3 and ELK imported as npm deps (tree-shaken)

**Pros:**
- Closest to what exists — extraction, not rewrite
- No framework learning curve, no virtual DOM overhead
- Full TypeScript in the UI, proper imports, HMR
- Smallest bundle size

**Cons:**
- Manual DOM management stays tedious for complex state
- No component model — as views grow, you reinvent one
- Harder to add features like drag-and-drop panels, modals, etc.

**Effort:** ~2 days to extract and wire up. Mostly mechanical.

---

### Option B: Vite + Svelte

Svelte compiles away at build time — closest to vanilla in spirit but with a real component model.

**Structure:**
```
src/dashboard/
  index.html
  App.svelte
  main.ts
  lib/
    data.ts
    stores.ts        # writable stores for selected file, stage, etc.
  components/
    Sidebar.svelte
    SourceViewer.svelte
    ASTTree.svelte
    ELKGraph.svelte
    DiagnosticList.svelte
  views/
    ParseView.svelte
    BindView.svelte
    CheckView.svelte
```

**How it works:**
- Same Vite dev server + API proxy setup as Option A
- Svelte stores replace global state (`activeStage`, `selectedFile`, etc.)
- Reactive declarations replace manual DOM updates
- D3/ELK used inside `<svelte:component>` with `use:action` for bindings

**Pros:**
- Compiled away — no runtime framework overhead, tiny bundles
- Reactive by default — `$: derivedValue = ...` replaces all manual re-renders
- Scoped CSS per component (the dashboard already has a design system)
- Feels like writing enhanced HTML — low learning curve
- Strong TypeScript support

**Cons:**
- Smaller ecosystem than React (but sufficient for this scope)
- D3/ELK integration needs `onMount` + action wrappers
- One more compile step (though Vite handles it transparently)

**Effort:** ~3 days. Some rewrite of rendering logic into components.

---

### Option C: Vite + React

The conventional choice. Largest ecosystem, most familiar to most developers.

**Structure:**
```
src/dashboard/
  index.html
  App.tsx
  main.tsx
  hooks/
    useData.ts
    useStage.ts
  components/
    Sidebar.tsx
    SourceViewer.tsx
    ASTTree.tsx
    ELKGraph.tsx
    DiagnosticList.tsx
  views/
    ParseView.tsx
    BindView.tsx
    CheckView.tsx
```

**How it works:**
- Same Vite + API proxy
- React context for `DashboardExportData`, `useReducer` for stage/selection state
- D3/ELK used via refs (`useRef` + `useEffect`)

**Pros:**
- Largest ecosystem — easy to find components for trees, code viewers, etc.
- Most developers already know it
- Rich tooling (React DevTools, etc.)
- Could use existing components like `react-syntax-highlighter`, `react-arborist`

**Cons:**
- Heaviest runtime (~40KB min+gz for react + react-dom)
- JSX is a bigger departure from the current vanilla HTML style
- D3 integration is awkward (imperative D3 vs declarative React)
- More boilerplate (hooks, contexts, memoization)

**Effort:** ~4 days. More rewrite needed due to paradigm shift.

---

## Comparison

| Dimension             | A: Vanilla TS     | B: Svelte         | C: React          |
|-----------------------|--------------------|--------------------|---------------------|
| Bundle size           | Smallest (~5KB+D3) | Small (~8KB+D3)   | Larger (~50KB+D3)  |
| Type safety           | Full               | Full               | Full               |
| Component model       | DIY                | Built-in           | Built-in           |
| D3/ELK integration    | Native             | Actions            | Refs+Effects       |
| HMR                   | Yes                | Yes                | Yes                |
| Learning curve (here) | None               | Low                | Medium             |
| Ecosystem for extras  | Small              | Medium             | Large              |
| Paradigm fit          | Closest to current | Close to current   | Different           |
| Maintenance burden    | Grows with features| Stays manageable   | Stays manageable   |

## Data Flow (All Options)

```
showcase.ts
  → createProgram() → exportDashboardData()
  → starts API server:  GET /api/data → JSON
  → starts Vite dev server (proxies /api → API server)
  → browser loads Vite app → fetch('/api/data') → render
```

Production/static mode stays possible: `vite build` produces a dist/ folder, data injected at serve time same as today.

## Recommendation

**Option B (Svelte)** is the best fit for this project:

1. The dashboard is a visualization-heavy developer tool — Svelte's compiled output and action system work naturally with D3/ELK
2. The current code is already structured as "render functions per stage" — maps directly to Svelte components
3. No runtime overhead aligns with the project's minimal-dependency philosophy
4. Scoped styles map cleanly from the existing CSS custom properties
5. Reactive stores replace the current global state management without introducing Redux/Context complexity

Option A is fine if you want to avoid any framework. Option C makes sense only if React is already in your workflow and you want to leverage its ecosystem.
