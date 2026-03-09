# AST Graph Visualization — Review & Improvement Options

**Date:** 2026-02-23
**Scope:** `docs/compiler-dashboard.html` — ELK.js + D3 AST graph modal

---

## Current Implementation Summary

The AST graph renders inside a fullscreen modal triggered by a **Graph** tab in the file viewer.
It uses **ELK.js** (layered/Sugiyama algorithm, orthogonal edge routing) for layout and **D3.js** for SVG rendering with zoom/pan.

**Key behavior:**
- Nodes are color-coded by AST category (Declaration, Statement, Expression, Literal, Type, Other)
- Nodes with children show a collapse arrow (▾) and a "+N" badge when collapsed
- Auto-collapses depth >= 3 on initial open
- Toolbar: Expand All, Collapse Depth 2+, Fit View, Close
- Single click on a branch node = toggle collapsed state + full re-layout
- Hover = tooltip with node details (Kind, Name, Pos, Children, Text)

---

## Issues Found

### 1. Click = Collapse is Disorienting (Primary Problem)

**What happens:** Clicking any branch node immediately collapses/expands it and triggers a full async ELK re-layout. The entire SVG is destroyed and rebuilt from scratch.

**Why it feels like "navigating to a new page":**
- Going from 29 visible nodes to 1 (clicking SourceFile) is a complete scene change
- No transition animation — nodes teleport to entirely new positions
- The viewport resets (zoom/pan state is lost on re-render)
- The user has no spatial continuity — the mental map of "where things are" is destroyed

**Root cause:** `renderELKGraph()` at line 1920 calls `oldSvg.remove()` then rebuilds everything. There is no incremental update or animated transition.

### 2. Tooltip Gets Stuck After Click

**What happens:** The hover tooltip (`#tooltip` div, line 1657) shows node details on `mousemove`. When a click triggers `renderELKGraph()`, the old SVG element (and its `mouseleave` handler) is removed before the leave event fires. The tooltip stays visible indefinitely.

**Observed:** After clicking a node and re-layout completing, the old tooltip card (showing Kind, Name, Pos, etc.) remains floating over the new graph. It even persists across different file graphs — opening math.ts still showed the Block tooltip from no-console.ts.

**Root cause:** The `mouseleave → hideTooltip()` handler (line 2123) is attached to the old SVG `<g>` element which gets destroyed during re-render. No cleanup call to `hideTooltip()` exists in `renderELKGraph()`.

### 3. No Separation Between "Inspect" and "Collapse"

**What happens:** There is only one click interaction on branch nodes, and it always toggles collapse state. There is no way to:
- Select/highlight a node without collapsing it
- View node details in a persistent panel
- Navigate to the corresponding source code location

Leaf nodes have no click handler at all — they only respond to hover.

### 4. No Transition Animation

**What happens:** When collapsing/expanding, nodes appear/disappear instantly. There is no:
- Fade in/out for appearing/disappearing nodes
- Position interpolation for nodes that move
- Edge path morphing

This makes it hard to track what changed, especially when collapsing a node that causes many siblings to shift position.

### 5. Layout Direction is Suboptimal for Deep Trees

**What happens:** The layout uses `elk.direction: 'RIGHT'` (horizontal, left-to-right). ASTs are typically deep (10+ levels) and moderately wide. A horizontal layout means the graph extends far to the right, requiring horizontal scrolling/zooming even for modest trees. The 39-node math.ts tree already fills the viewport width when fully expanded.

### 6. Node Text Readability at Default Zoom

**What happens:** At the default zoom level (fit-to-view), node labels become very small for larger trees. The 39-node math.ts graph has text at roughly 8-9px effective size, making labels like "PropertyAccessExpression" hard to read without zooming in.

### 7. D3 `mouseleave` Handler Overwrite

**What happens:** Line 2108 sets `ng.on('mouseleave', ...)` for hover stroke effects. Line 2123 sets `ng.on('mouseleave', ...)` for tooltip hiding. D3's `.on()` replaces the previous handler for the same event name, so the hover stroke-width reset is lost.

**Fix is trivial:** Combine both handlers or use D3 namespaced events (e.g., `mouseleave.stroke` and `mouseleave.tooltip`).

---

## Improvement Options

### Option A: Minimal Fixes (Quick Wins)

**Effort:** Small (1-2 hours)
**Scope:** Fix bugs without changing interaction model

1. **Hide tooltip on re-render:** Add `hideTooltip()` at top of `renderELKGraph()`
2. **Fix mouseleave overwrite:** Use namespaced events or combine handlers
3. **Preserve zoom on re-render:** Save and restore `d3.zoomTransform` across re-renders
4. **Add click on leaf nodes:** Show tooltip on click for leaf nodes (same as hover, but persistent)

### Option B: Animated Transitions

**Effort:** Medium (half day)
**Scope:** Add smooth transitions to collapse/expand

1. **Incremental SVG update instead of full rebuild:**
   - Compute new ELK layout
   - Use D3 data-join (enter/update/exit) with `.transition().duration(300)`
   - Nodes that stay: animate `transform` to new position
   - Nodes that appear: fade in at parent's position, then move
   - Nodes that disappear: move to parent's position, then fade out
   - Edges: morph path `d` attribute

2. **Requires:** Stable node IDs (already implemented via `_elkId`), keyed data join on SVG `<g>` elements

3. **Trade-off:** More complex code, but dramatically better UX. This is the standard approach in D3 tree visualizations.

### Option C: Separate Click Actions (Inspect vs Collapse)

**Effort:** Medium (half day)
**Scope:** Redesign interaction model

1. **Single click = select/inspect** (highlight node, show detail in side panel or persistent card)
2. **Double click = toggle collapse/expand**
3. **Or:** Click node body = inspect, click collapse arrow icon = toggle

Benefits:
- Users can explore the tree without accidentally collapsing it
- Selected node can be highlighted with a distinct border color
- Detail panel can show: source text snippet, position in file, parent chain (breadcrumb)
- Could link back to the Source tab at the correct line

### Option D: Layout Direction Toggle

**Effort:** Small (1-2 hours)
**Scope:** Add layout direction control

1. **Add toolbar toggle:** LEFT-RIGHT vs TOP-DOWN
2. Top-down (vertical) is better for deep ASTs — uses vertical space more efficiently
3. Change `elk.direction` from `'RIGHT'` to `'DOWN'` based on toggle
4. Could auto-detect: if tree depth > width, use vertical; otherwise horizontal

### Option E: Semantic Collapsing / Smart Defaults

**Effort:** Medium (half day)
**Scope:** Better auto-collapse heuristics

Currently collapses at depth >= 3 regardless of content. Smarter options:

1. **Collapse by AST significance:** Always show Declaration and Statement nodes, auto-collapse Expression subtrees (which tend to be deep chains like `CallExpression → PropertyAccessExpression → Identifier`)
2. **Collapse by subtree size:** Only collapse nodes with > N descendants
3. **"Outline" mode:** Show only the structural skeleton (SourceFile → declarations → blocks) — like a table of contents
4. **"Focus" mode:** Click a node to make it the new root, with breadcrumb navigation back up

### Option F: Full Rebuild — Canvas Renderer

**Effort:** Large (1-2 days)
**Scope:** Replace SVG with HTML5 Canvas for performance

Only relevant if the graph needs to handle very large trees (hundreds/thousands of nodes). SVG with D3 transitions (Option B) handles up to ~200-300 nodes well. Canvas would be needed beyond that.

Not recommended unless real-world ASTs are significantly larger than the current sample data.

---

## Recommended Priority

| Priority | Option | Impact | Effort |
|----------|--------|--------|--------|
| 1 | **A: Minimal Fixes** | Fixes real bugs (stuck tooltip, lost zoom) | Small |
| 2 | **C: Separate Click Actions** | Fixes the core UX complaint | Medium |
| 3 | **B: Animated Transitions** | Makes collapse/expand feel smooth | Medium |
| 4 | **D: Layout Direction Toggle** | Improves readability for deep trees | Small |
| 5 | **E: Smart Defaults** | Better initial view, less manual work | Medium |
| 6 | **F: Canvas Renderer** | Only if perf becomes an issue | Large |

Options A + C together would address the user's primary complaint ("clicking takes me to a new page") by fixing the bugs and separating inspect from collapse. Adding B on top would make the experience feel polished.

---

## Implementation Log

### All Options Implemented (2026-02-23)

**Option A — Minimal Fixes:**
- `hideTooltip()` called at top of `renderELKGraph()` — fixes stuck tooltip
- D3 namespaced events (`mouseenter.stroke`, `mouseleave.stroke`, `mousemove.tooltip`, `mouseleave.tooltip`) — fixes handler overwrite
- Zoom transform saved/restored via `elkSavedTransform` across re-renders — preserves pan/zoom
- All nodes now have click handler (leaf + branch) for inspect

**Option B — Animated Transitions:**
- `elkPrevPositions` map stores `{x,y}` of every node before re-render
- Nodes that existed before: animate from old position to new with `d3.easeCubicOut` over 400ms
- New nodes: `findParentPosition()` walks up the ID path to find nearest visible ancestor, fade in from that position
- Edges: fade in with opacity transition
- Direction changes skip animation (positions meaningless across layout axes)

**Option C — Separate Click Actions:**
- Single click = select/inspect: highlights node with white border, shows persistent detail panel (`#ast-graph-detail`) in top-right corner
- Double-click = toggle collapse/expand (branch nodes only)
- Click on SVG background = deselect
- Detail panel shows: Kind, Name, Pos, Children count, Hidden descendants, Text preview
- Legend updated with hint: "Click=inspect · Dbl-click=collapse"

**Option D — Layout Direction Toggle:**
- Two toolbar buttons: `LR` (left-right) and `TD` (top-down)
- Active state highlighted with purple accent
- `elkDirection` state variable used in `buildELKGraph()` layout options
- Direction change resets zoom (fresh fit-to-view) and skips transition animation

**Option E — Semantic Collapsing:**
- `elkSmartCollapse()`: collapses Expression subtrees at depth >= 2, structural nodes at depth >= 4, any subtree with > 8 descendants at depth >= 3
- `elkOutlineMode()`: collapses all non-structural nodes, showing only SourceFile/Declaration/Statement/Block skeleton
- Smart collapse is now the default on open (replaces old "depth >= 3" heuristic)
- Three toolbar buttons: "Expand All", "Depth 2+" (collapse depth), "Smart" (semantic), "Outline" (skeleton)

**Option F — Canvas Renderer:** Not implemented (not needed for current scale).

### Verification Results (Playwright MCP Screenshots)

All features tested and passing:

1. **Smart collapse on open** — math.ts opens with 33/39 visible, BinaryExpression subtrees auto-collapsed
2. **Single click = inspect** — FunctionDeclaration: add clicked, detail panel appears in top-right, graph stays at 33 nodes (no collapse)
3. **Double-click = collapse** — FunctionDeclaration: add double-clicked, collapses to +15 badge, graph animates from 33 to 21 nodes with transitions
4. **TD layout toggle** — Clicked TD, tree flows top-down, active button highlighted
5. **Outline mode** — Shows 25/39 visible, Parameter nodes collapsed
6. **Expand All with animation** — 39/39 visible, nodes animate to new positions
7. **Leaf node click** — StringKeyword clicked, detail panel shows Kind/Pos/Text, no graph change
8. **No stale tooltip across files** — Opened no-console.ts graph after math.ts, no leftover tooltip
9. **Detail panel close** — X button closes panel, background click deselects
10. **Legend hint** — "Click=inspect · Dbl-click=collapse" visible in legend area
