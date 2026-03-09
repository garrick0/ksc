# Binding/Scope Visualization Uplift Plan

> **Goal**: Bring binding, scope, lattice, and violation visualization from the
> scratch-abstract-interpreters project into the KSC dashboard, adapted to
> KSC's AG evaluator architecture and stamped-field data model.

## Reference: scratch-abstract-interpreters Visualizations

The reference codebase has two visualization systems worth mining:

### 1. Binding Viz (`viz.html` / `src/viz.ts`)

| Feature | Description | Adaptation Needed |
|---------|-------------|-------------------|
| **Scope bars** | Colored vertical bars in source gutter showing which scopes span each line (module=blue, function=purple, block=grey, for=green, catch=orange) | Derive from AST node kinds that create scopes + pos/end ranges |
| **Scope tree** | Nested colored boxes with kind badge + binding pills (small colored chips per declaration in scope) | Build from AST structure using scope-container kinds |
| **Declarations table** | Name, kind, line, scope, hoisted status — sortable, clickable | Extract from `isDefinitionSite` Identifiers + parent context |
| **References table** | Name, resolved target, hop count, line — color-coded by resolution distance | Requires evaluator binding data (not yet exported) |
| **Scope lattice** | SVG Hasse diagram: nodes = equivalence classes of scopes with same visibility set, edges = covering relations. Shows `{visible names}` per node | Compute from scope tree + declarations |
| **Interactivity** | Click ref → highlight declaration; click scope → highlight source lines; click lattice node → show full environment; hover tooltips | Wire into React state |

### 2. Interpreter Viz (`src/ts-interp/viz.ts`)

| Feature | Description | Adaptation Needed |
|---------|-------------|-------------------|
| **Multi-overlay** | Source code with inline annotation markers from multiple analysis domains, color-coded | Map to KSC violation types (noImports, noConsole, etc.) |
| **Annotation markers** | Inline `<span>` markers: declarations (background tint), references (underline color = hop count), violations (red underline), badges (complexity) | Use checker diagnostics + stamped fields |
| **Annotation detail panel** | Right panel listing all annotations grouped by interpreter, with click-to-navigate | Group by violation property |
| **Toggleable overlays** | Per-interpreter toggle buttons with dot color and count badge | Per-property toggles (noImports, noConsole, etc.) |

---

## Current KSC Data Availability

### Already in the dashboard (via stamped fields on ASTNode.props)

| Field | Present On | Binding Relevance |
|-------|-----------|-------------------|
| `isDefinitionSite` | Identifier | Marks declaration sites |
| `escapedText` | Identifier | The binding name |
| `resolvedFileName` | Identifier | Cross-file resolution target |
| `resolvesToImport` | Identifier | Whether binding comes from import |
| `importModuleSpecifier` | Identifier | Module specifier string |
| `sym*` (18 flags) | Identifier | Symbol classification (isFunction, isClass, isVariable, etc.) |
| `typeString` | Expression/Declaration nodes | Type at that position |
| `isExported` | 10 declaration kinds | Export visibility |
| `localCount` | 11 scope container kinds | Number of locals in scope |
| `declarationKind` | VariableDeclarationList | var/let/const |

### Available from evaluator but NOT yet exported

| Data | Source | Description |
|------|--------|-------------|
| `KindDefinition[]` | `evaluate().definitions` | Extracted `type X = Kind<{...}>` annotations |
| `CheckerDiagnostic[]` | `evaluate().diagnostics` | Violation messages with node, property, kindName |
| `AttributeDepGraph` | `evaluate().getDepGraph()` | 22 attributes, 26 edges, eval order |
| Per-node contexts | `KSCDNode.attr('noImportsContext')` etc. | Which kind annotation is active at each node |
| Per-node violations | `KSCDNode.attr('importViolation')` etc. | Whether a specific node violates |

### Derivable from AST structure (no evaluator needed)

| Data | Derivation |
|------|-----------|
| **Scope boundaries** | Nodes of kinds: CompilationUnit, FunctionDeclaration, FunctionExpression, ArrowFunction, Block, ForStatement, ForOfStatement, ForInStatement, CatchClause, ClassDeclaration, ModuleBlock |
| **Scope tree** | Parent-child relationships from AST nesting of scope-container nodes |
| **Declarations per scope** | Walk children, find Identifier nodes where `isDefinitionSite === true`, group by nearest scope ancestor |
| **Binding kind** | Infer from parent: VariableDeclaration → var/let/const (via grandparent VariableDeclarationList.declarationKind), FunctionDeclaration → function, Parameter → parameter, ClassDeclaration → class, ImportSpecifier → import |
| **Scope lattice** | Compute visibility sets per scope (walk chain collecting declarations), group by identical sets, build Hasse diagram |

---

## Implementation Plan

### Phase 1: Data Pipeline — Export Evaluator Results

**Goal**: Extend `ASTDashboardData` to carry binding/scope/violation data.

#### 1a. Extend types (`dashboard/app/types.ts` + `ast-schema/export.ts`)

```typescript
// New types for dashboard
interface ScopeInfo {
  id: number;
  kind: 'module' | 'function' | 'block' | 'for' | 'catch' | 'class';
  label: string;              // e.g., "function greet" or "block (if)"
  parentId: number | null;
  startLine: number;
  endLine: number;
  declarations: DeclInfo[];   // Bindings declared in this scope
}

interface DeclInfo {
  name: string;
  kind: 'var' | 'let' | 'const' | 'function' | 'parameter' | 'class' | 'import';
  line: number;
  column: number;
  scopeId: number;
  nodePos: number;            // For linking back to AST node
}

interface RefInfo {
  name: string;
  line: number;
  column: number;
  scopeId: number;
  resolvedDeclName: string | null;
  resolvedDeclLine: number | null;
  resolvedScopeId: number | null;
  hops: number;               // -1 if unresolved
  nodePos: number;
}

interface ViolationInfo {
  message: string;
  kindName: string;
  property: string;           // noImports, noConsole, etc.
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  nodeKind: string;
  nodePos: number;
}

interface KindDefInfo {
  id: string;
  name: string;
  properties: string[];       // ["noImports", "noConsole", ...]
  line: number;
}

interface LatticeNode {
  id: string;
  scopeIds: number[];
  labels: string[];
  kind: string;
  visibleNames: string[];
}

interface LatticeEdge {
  from: string;
  to: string;
}

// Add to ASTDashboardData
interface ASTDashboardData {
  // ... existing fields ...
  binding?: {
    scopes: ScopeInfo[];
    declarations: DeclInfo[];
    references: RefInfo[];
    lattice: { nodes: LatticeNode[]; edges: LatticeEdge[] };
  };
  checker?: {
    violations: ViolationInfo[];
    kindDefinitions: KindDefInfo[];
    depGraph: AttributeDepGraph;
  };
}
```

#### 1b. Build scope/binding data from AST (`ast-schema/export.ts`)

Add a `extractBindingData(astNode, source)` function that:
1. Walks the AST identifying scope-creating nodes (by kind)
2. Assigns scope IDs, builds parent-child relationships
3. Collects `isDefinitionSite` Identifiers, classifies their binding kind from parent context
4. For each non-definition Identifier, finds nearest declaration by walking scope chain
5. Computes scope lattice using the same algorithm as scratch-abstract-interpreters (`lattice.ts`)

This can work purely from the AST + stamped fields — no evaluator required. The scope container kinds are:

```
CompilationUnit      → 'module'
FunctionDeclaration  → 'function'
FunctionExpression   → 'function'
ArrowFunction        → 'function'
MethodDeclaration    → 'function'
Constructor          → 'function'
GetAccessor          → 'function'
SetAccessor          → 'function'
Block                → 'block' (unless direct child of function, then skip)
ForStatement         → 'for'
ForOfStatement       → 'for'
ForInStatement       → 'for'
CatchClause          → 'catch'
ClassDeclaration     → 'class' (not a traditional scope, but contains method scopes)
```

#### 1c. Export evaluator results (`ast-schema/export.ts` or new file)

Add an optional `extractCheckerData(ksTree)` function that:
1. Calls `evaluate(ksTree.root)` to get definitions, diagnostics, depGraph
2. Maps CheckerDiagnostic → ViolationInfo (with line/column from pos)
3. Maps KindDefinition → KindDefInfo
4. Returns the checker data structure

The showcase entry point (`examples/showcase.ts`) would call both:
```typescript
const astData = extractASTData(ksTree, 'check');
const checkerData = extractCheckerData(ksTree);  // optional, only at check depth
astData.checker = checkerData;
```

**Key**: binding data extraction must work at ALL analysis depths (parse/bind/check) since scope structure is purely structural. Checker data only at check depth.

---

### Phase 2: Scope Visualization Panel

**New component**: `dashboard/app/components/DetailPanel/ScopeTab.tsx`

Add a "Scope" tab alongside Source/AST/Graph in FileViewer.

#### Layout (2 columns)

```
┌─────────────────────────┬──────────────────────┐
│  Source with Scope Bars  │  Scope Tree          │
│                          │                      │
│  1 │▐▐│ import fs...     │  ┌─ module: app.ts   │
│  2 │▐▐│                  │  │  ├─ const: fs      │
│  3 │▐▐▌│ function greet  │  │  ├─ func: greet    │
│  4 │▐▐▌│   const msg =   │  │  │  ├─ param: n    │
│  5 │▐▐▌│   if (n > 0) {  │  │  │  ├─ const: msg  │
│  6 │▐▐▌▎│     console..  │  │  │  └─ block (if)  │
│  7 │▐▐▌│   }             │  │  └─ func: add      │
│  8 │▐▐│                  │  └───────────────────  │
│  9 │▐▐│ function add...  │                        │
│                          │  ── Selected Scope ──  │
│                          │  Scope #3: block (if)  │
│                          │  Lines 5-7             │
│                          │  Declarations: (none)  │
│                          │  Visible: n, msg, fs,  │
│                          │           greet, add   │
└─────────────────────────┴──────────────────────┘
```

#### Features

1. **Scope bars in gutter**: Colored vertical bars (3px wide) per active scope, using the same color scheme as scratch-abstract-interpreters (module=blue, function=purple, block=grey, for=green, catch=orange). Each scope gets its own bar column.

2. **Scope tree**: Nested boxes with:
   - Kind badge (colored, uppercase)
   - Scope label (function name, or "block (if)", etc.)
   - Line range
   - Binding pills: small colored chips for each declaration (`const x`, `function f`, `param n`)
   - Click to select → highlights source lines

3. **Selected scope detail**: Shows:
   - Full scope info (kind, lines)
   - Declarations in this scope
   - Full visibility set (all names reachable via scope chain, with shadowing)
   - Parent scope chain

4. **Interactions**:
   - Click scope in tree → highlight corresponding source lines
   - Click declaration pill → navigate to AST node
   - Hover declaration → tooltip with type + reference count

#### Styling (CSS variables, matching existing dashboard theme)

```css
/* Scope kind colors */
--scope-module: var(--parse-color);     /* blue */
--scope-function: #bc8cff;              /* purple */
--scope-block: var(--text3);            /* grey */
--scope-for: var(--check-color);        /* green */
--scope-catch: #db6d28;                 /* orange */
--scope-class: #f778ba;                 /* pink */
```

---

### Phase 3: Binding Resolution View

**Enhance**: `ASTTab.tsx` inspector + new overlay on `SourceTab.tsx`

#### 3a. Source overlay: Declaration + Reference markers

On the Source tab, add an optional "Bindings" overlay toggle that:

1. **Highlights declaration sites**: Background tint on `isDefinitionSite` Identifiers, colored by declaration kind (same palette as scope bars: var=yellow, let/const=blue, function=purple, parameter=green, class=pink, import=green)

2. **Underlines references**: Non-definition Identifiers get a colored bottom border based on resolution hop count:
   - 0 hops (same scope) = green
   - 1 hop = yellow
   - 2 hops = orange
   - 3+ hops = red
   - Unresolved = red dashed

3. **Click interaction**: Click a reference → highlight its resolved declaration + show resolution chain in detail. Click a declaration → highlight all references to it.

4. **Resolution detail** (in right panel or tooltip): Shows the scope chain walk:
   ```
   Resolving "msg" at line 6, scope #4 (block)
   ── scope #4 block (if): not found
   ── scope #3 function (greet): found "const msg" (line 4)
   Result: 1 hop
   ```

#### 3b. AST inspector enhancements

When an Identifier node is selected in the AST tab inspector, add a "Binding" section:

- **Definition site**: If `isDefinitionSite`, show "Declares: `const msg`" with scope info
- **Reference**: If not definition, show "References: `const msg` at line 4 (1 hop)" with link to navigate
- **Symbol info**: Already shown (sym* flags), but add a summary line like "Function-scoped variable, exported"
- **Type**: Already shown (typeString), no changes needed

---

### Phase 4: Scope Lattice Visualization

**New component**: `dashboard/app/components/DetailPanel/LatticeTab.tsx`

Add a "Lattice" tab in FileViewer (alongside Source/AST/Graph/Scope).

#### SVG Lattice Diagram

Port the lattice rendering approach from scratch-abstract-interpreters:

1. **Layout**: Layer nodes by visibility set size (bottom=fewest names, top=most). Within each layer, space nodes evenly. Use the same algorithm from `viz.html` lines 780-866.

2. **Nodes**: Rounded rectangles with:
   - Scope label text (e.g., "#3 function: greet")
   - Visible names set (e.g., `{fs, greet, n, msg}`)
   - Color by scope kind
   - Special nodes: `bot` (empty visibility), `top` (all names)

3. **Edges**: Dashed lines for covering relations (Hasse diagram). Lower node → upper node direction.

4. **Interaction**:
   - Click node → highlight corresponding scope(s) in scope tree + source lines
   - Show full environment detail (name, kind, declaring line, from which scope)

5. **Properties bar** below lattice:
   - `bot = {} (0 names)`
   - `top = {all names} (N names)`
   - `|L| = M elements`
   - `ordering: visible(A) subset visible(B)`

#### Lattice computation

Port `buildLattice()` from scratch-abstract-interpreters `src/lattice.ts`:
1. For each scope, compute full visibility set (walk scope chain, closer shadows farther)
2. Group scopes with identical visibility sets
3. Add bot/top if no scope has empty/complete visibility
4. Compute Hasse diagram edges (covering relations only: A < B with no C between)

This is a pure function of the scope tree + declarations — no evaluator needed.

---

### Phase 5: Violation Overlay

**New component**: `dashboard/app/components/DetailPanel/ViolationsTab.tsx`

Add a "Violations" tab, plus violation markers on the Source tab.

#### 5a. Source tab violation overlay

When checker data is present (check depth), add toggleable violation markers:

1. **Per-property toggles** in a toolbar: `[noImports] [noConsole] [immutable] [static] [noSideEffects] [noMutation] [noIO]` — each a pill button with dot color + count badge

2. **Inline markers**: On violating lines, highlight the offending expression/statement with:
   - Red underline + faint red background for violations
   - Tooltip showing: "noConsole violation in Pure scope: console.log is not allowed"

3. **Kind annotation regions**: When a variable is annotated with a kind type, shade its scope region with a subtle tint to show "this region enforces noImports + noConsole"

#### 5b. Violations list tab

A dedicated tab showing all violations in a table:

| Property | Kind | Message | Line | Node |
|----------|------|---------|------|------|
| noConsole | Pure | console.log usage... | 12 | PropertyAccessExpression |
| immutable | Immutable | let binding in... | 8 | VariableDeclarationList |

- Click row → navigate to node in AST tab
- Group by property or by kind definition
- Show kind definitions at top (e.g., "`Pure = Kind<{ noImports, noConsole, noSideEffects }>`")

#### 5c. Kind definitions sidebar

Show extracted kind definitions with their property sets:
```
NoConsole = Kind<{ noConsole }>
Immutable = Kind<{ immutable }>
Pure = Kind<{ noImports, noConsole, noSideEffects, noMutation, noIO }>
```

Each clickable to filter violations to that kind.

---

### Phase 6: Attribute Dependency Graph

**New component**: `dashboard/app/components/DepGraphPanel.tsx`

A separate panel (accessible from toolbar or status bar) showing the AG attribute dependency graph.

#### Visualization

Use the ELK graph engine (already in the project) to render:
- **Nodes**: 22 attribute names, colored by spec (binder=blue, checker=green)
- **Edges**: Dependency arrows (source depends on target)
- **Grouping**: Cluster by spec ownership (binder group, checker group)
- **Metadata**: Click node → show direction (syn/inh/coll), equation source location, which AST node kinds have custom dispatch

This reuses the existing ELK infrastructure (`useELKGraph.ts`, `elkHelpers.ts`) with a different data source.

---

## Phase Priority & Dependencies

```
Phase 1 (Data Pipeline) ──────────────────────── REQUIRED FIRST
  │
  ├─► Phase 2 (Scope Panel)        ← needs scope data from Phase 1a/1b
  │     │
  │     └─► Phase 4 (Lattice)      ← needs scope tree from Phase 2
  │
  ├─► Phase 3 (Binding Resolution) ← needs scope + ref data from Phase 1b
  │
  ├─► Phase 5 (Violations)         ← needs checker data from Phase 1c
  │
  └─► Phase 6 (Dep Graph)          ← needs depGraph from Phase 1c
```

Phases 2-6 are independent of each other (can be done in any order after Phase 1).

**Recommended order**: 1 → 2 → 3 → 4 → 5 → 6

Rationale: Scope visualization is the foundation (most visual impact, no evaluator dependency). Binding resolution builds on it. Lattice is a natural extension. Violations require evaluator integration (more plumbing). Dep graph is a nice-to-have.

---

## File Changes Summary

### New files
| File | Purpose |
|------|---------|
| `ast-schema/binding-extract.ts` | Extract scope/binding/lattice data from AST |
| `ast-schema/checker-extract.ts` | Extract violations/kindDefs from evaluator |
| `dashboard/app/components/DetailPanel/ScopeTab.tsx` | Scope visualization panel |
| `dashboard/app/components/DetailPanel/LatticeTab.tsx` | Lattice diagram |
| `dashboard/app/components/DetailPanel/ViolationsTab.tsx` | Violations list + overlay |
| `dashboard/app/components/DepGraphPanel.tsx` | Attribute dependency graph |

### Modified files
| File | Changes |
|------|---------|
| `dashboard/app/types.ts` | Add binding, checker, lattice types |
| `ast-schema/export.ts` | Import and call binding/checker extractors |
| `examples/showcase.ts` | Call checker extractor when at check depth |
| `dashboard/app/sampleData.ts` | Add sample binding/checker data |
| `dashboard/app/components/DetailPanel/FileViewer.tsx` | Add Scope, Lattice, Violations tabs |
| `dashboard/app/components/DetailPanel/SourceTab.tsx` | Add binding overlay + violation markers |
| `dashboard/app/components/DetailPanel/ASTTab.tsx` | Add binding section to inspector |
| `dashboard/app/components/StatusBar.tsx` | Add scope/violation counts |
| `dashboard/app/styles/index.css` | Scope bars, lattice, violation marker styles |
| `dashboard/app/state/reducer.ts` | Add binding/violation selection state |
| `dashboard/app/state/actions.ts` | Add selection actions |

---

## Design Decisions

### Why derive scopes from AST structure (not from evaluator)?

The KSC evaluator's binder attributes (`defEnv`, `defLookup`, `kindDefs`) are about *kind definitions* — not about JavaScript variable binding. JavaScript scope/binding analysis is done implicitly by the TypeScript compiler, and KSC stamps the results as fields (`isDefinitionSite`, `resolvedFileName`, sym* flags, `localCount`).

So we reconstruct the scope tree from:
- AST node kinds (which kinds create scopes)
- `isDefinitionSite` (which Identifiers are declarations)
- `declarationKind` (var/let/const classification)
- `localCount` (validation of our scope extraction)

This approach:
1. Works at all analysis depths (even parse-only has the structural info)
2. Doesn't require running the evaluator for scope visualization
3. Matches what the scratch-abstract-interpreters binder does, but using already-stamped fields

### Why separate binding-extract from checker-extract?

Binding data is purely structural (derivable from AST + stamped fields). Checker data requires running the evaluator. Keeping them separate means:
- Scope/lattice visualization works even at parse depth
- Checker visualization is opt-in (only when evaluator has run)
- Clear separation of concerns

### Lattice algorithm: direct port from scratch-abstract-interpreters

The `buildLattice()` function in `src/lattice.ts` is clean, self-contained, and well-documented. It operates on a generic scope/declaration model. Port it directly, adapting only the input types (ScopeInfo/DeclInfo instead of Scope/Declaration).

### SVG rendering: inline React (not D3)

The lattice SVG is simple enough to render directly in React JSX (no D3 needed). The reference implementation uses string concatenation to build SVG — we'll use React elements instead. The ELK graph already demonstrates this pattern in the dashboard.
