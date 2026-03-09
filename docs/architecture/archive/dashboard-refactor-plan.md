# Dashboard Refactor: AST-Only Visualization

## Status: COMPLETE

## Architecture Decisions

1. **`parseOnly()`** — new function in `src/pipeline/parse.ts` that encapsulates TS parse + KS AST conversion without running binder/checker
2. **AST export utility** — `ast-schema/export.ts` provides `extractASTData(ksTree)` to produce dashboard-friendly data. This is an ast-schema concern, not a dashboard concern.
3. **Dashboard location** — moved to `dashboard/` at project root (physical decoupling)
4. **Data contract** — simplified `ASTDashboardData` type: just files with source + AST trees
5. **Visualizations kept** — AST Tree View, ELK AST Graph, Source Code Viewer, File Viewer (Source/AST/Graph tabs)
6. **Visualizations removed** — Stage tabs, Parse/Kinds/Check D3 trees, Parse/Kinds/Check detail panels, all sidebars (replaced with file list)

## Execution Plan

### Phase 0: New utilities [DONE]
- [x] `src/pipeline/parse.ts` — `parseOnly(rootNames, options): KSTree`
- [x] `ast-schema/export.ts` — `ASTDashboardData` type + `extractASTData(ksTree)` function
- [x] Export from `src/index.ts`

### Phase 1: Move dashboard to `dashboard/` [DONE]
- [x] Move `src/dashboard/app/` → `dashboard/app/`
- [x] Move `vite.config.dashboard.ts` → `dashboard/vite.config.ts`
- [x] Delete `src/dashboard/` entirely (export.ts replaced by ast-schema/export.ts)
- [x] Update `package.json` scripts
- [x] Update `tsconfig.json` excludes

### Phase 2: Strip dashboard to AST-only [DONE]
- [x] Delete: StageTabs, KindsSidebar, CheckSidebar, ParseSidebar, KindsDetail, CheckDetail, ParseDetail
- [x] Rewrite types.ts — `ASTDashboardData` + `ASTNode` (self-contained)
- [x] Rewrite actions.ts — remove stage/check actions
- [x] Rewrite reducer.ts — remove kinds/check state
- [x] Rewrite Sidebar.tsx — file list instead of stage-specific sidebars
- [x] Rewrite DashboardShell.tsx — simplified layout
- [x] Rewrite FileViewer.tsx — Source/AST/Graph tabs only
- [x] Rewrite DetailPanel.tsx — file viewer only
- [x] Rewrite treeBuilders.ts — AST structure tree (Program → Files → top-level AST nodes)
- [x] Rewrite ASTTab.tsx — remove TS/KS toggle, remove AG attributes
- [x] Rewrite Header.tsx — simplified stats
- [x] Rewrite Toolbar.tsx — AST legend only
- [x] Rewrite StatusBar.tsx — file count only
- [x] Rewrite sampleData.ts — AST-only sample
- [x] Update UploadOverlay.tsx

### Phase 3: Update examples [DONE]
- [x] Rewrite `examples/showcase.ts` — use `parseOnly()` + `extractASTData()`
- [x] Simplify `examples/showcase-utils.ts`
- [x] Update package.json scripts

### Phase 4: Cleanup [DONE]
- [x] Delete `docs/compiler-dashboard.html`
- [x] Remove old `src/dashboard/` directory
- [x] Clean `src/index.ts` (remove old dashboard exports)
- [x] Remove `exportDashboardData` imports from `test/e2e.test.ts` and `test/serialize.test.ts`
- [x] Fix `tsconfig.dashboard.json` path (`src/dashboard/app` → `dashboard/app`)
- [x] Verify build (`tsc --noEmit` clean) + tests (131 passed, 11 files)
