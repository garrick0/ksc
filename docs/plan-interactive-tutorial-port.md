# Plan: Port Interactive Tutorial to KSC

## Goal

Copy the interactive tutorial system from `~/dev/kindscript/website/` into this repo (`~/dev/ksc/`). Strip all 21 lessons and replace with a single "Hello World" tutorial. Keep the sandbox mode.

---

## Implementation Progress

| Step | Status | Notes |
|------|--------|-------|
| 1. Create website app directory | DONE | `apps/website/` with full directory tree |
| 2. Install dependencies | DONE | All deps in `apps/website/package.json`, installed via workspace |
| 3. Copy COOP/COEP middleware | DONE | `src/middleware.ts` + `next.config.mjs` headers |
| 4. Copy WebContainer infrastructure | DONE | `singleton.ts`, `utils.ts`, `storage.ts`, `export.ts` |
| 5. Copy all tutorial components | DONE | All 19 files copied verbatim |
| 6. Copy lesson types and template | DONE | `types.ts` + `template.ts`, storybook skipped |
| 7. Create hello-world lesson | DONE | Full lesson with starter + solution + content.mdx |
| 8. Copy + adapt codegen script | DONE | Storybook refs removed, `generate:lessons` produces output |
| 9. Create Next.js pages | DONE | Root layout, redirect page, tutorial pages, sandbox page |
| 10. Configure Next.js | DONE | `next.config.mjs`, `tsconfig.json` (lesson data excluded from typecheck) |
| 11. Update CodeEditor types | DONE | Types match the published `kindscript@2.0.3` npm package used in WebContainer — no changes needed |
| 12. Wire up workspace | DONE | Root `package.json` updated with workspace + convenience scripts |
| 13. Verify | DONE | `next build` succeeds — all 5 routes compile |

### Additional items discovered during implementation

| Item | Status | Notes |
|------|--------|-------|
| Create `sandbox-templates.ts` | DONE | SandboxLayout imports this; created with clean-architecture + blank templates |
| Replace `globals.css` | DONE | Original referenced Nextra/Tailwind; replaced with minimal CSS reset |
| Exclude lesson data from tsconfig | DONE | `starter/` and `solution/` dirs contain `kindscript` imports that would fail typecheck |

---

## Source Inventory

The tutorial system in `~/dev/kindscript/website/` consists of:

### Infrastructure (copy verbatim)
| File | Purpose |
|------|---------|
| `src/lib/webcontainer/singleton.ts` | WebContainer boot + singleton (window cache + sessionStorage) |
| `src/lib/webcontainer/utils.ts` | `filesToFileSystemTree()` converter |
| `src/lib/tutorial/storage.ts` | Auto-save + named saves via localStorage |
| `src/lib/tutorial/export.ts` | ZIP download (jszip) + clipboard copy |
| `src/middleware.ts` | COOP/COEP headers (required for SharedArrayBuffer) |

### Components (copy verbatim)
| File | Purpose |
|------|---------|
| `src/components/tutorial/TutorialLayout.tsx` | Lesson orchestrator (3-panel IDE layout) |
| `src/components/tutorial/SandboxLayout.tsx` | Free-form sandbox orchestrator |
| `src/components/tutorial/WebContainerProvider.tsx` | Headless WebContainer lifecycle manager |
| `src/components/tutorial/CodeEditor.tsx` | Monaco editor wrapper (includes KindScript type defs) |
| `src/components/tutorial/Terminal.tsx` | xterm.js terminal |
| `src/components/tutorial/FileTree.tsx` | Read-only file tree (lessons) |
| `src/components/tutorial/EditableFileTree.tsx` | CRUD file tree (sandbox) |
| `src/components/tutorial/EditorTabs.tsx` | Tab bar with split view toggle |
| `src/components/tutorial/LessonContent.tsx` | Markdown renderer for lesson prose |
| `src/components/tutorial/LessonNav.tsx` | Prev/Next lesson navigation |
| `src/components/tutorial/SaveMenu.tsx` | Save/Load/Export dropdown |
| `src/components/tutorial/SaveDialog.tsx` | Named save modal |
| `src/components/tutorial/LoadDialog.tsx` | Load save modal |
| `src/components/tutorial/ResumeBanner.tsx` | Auto-save resume prompt |
| `src/components/tutorial/Toast.tsx` | Toast notifications + `useToast()` hook |
| `src/components/tutorial/LoadingOverlay.tsx` | Boot/install progress overlay |
| `src/components/tutorial/BrowserCheck.tsx` | SharedArrayBuffer capability gate |
| `src/components/tutorial/ErrorBoundary.tsx` | React error boundary |
| `src/components/tutorial/lesson-content.css` | Markdown content styles |

### Pages (copy and adapt)
| File | Purpose |
|------|---------|
| `src/app/tutorial/page.tsx` | Tutorial index (lesson list) |
| `src/app/tutorial/layout.tsx` | Tutorial layout wrapper |
| `src/app/tutorial/[lesson]/page.tsx` | Dynamic lesson page |
| `src/app/sandbox/page.tsx` | Sandbox page |

### Lesson Data (replace with hello-world)
| File | Purpose |
|------|---------|
| `src/lib/lessons/types.ts` | `Lesson`, `Part`, `LessonFile` types |
| `src/lib/lessons/template.ts` | WebContainer template (package.json + tsconfig.json) |
| `src/lib/lessons/storybook-files.ts` | Storybook shared files (NOT needed — drop) |
| `src/lib/lessons/<slug>/` | 21 lesson folders (REPLACE with 1) |
| `scripts/generate-lessons.mjs` | Codegen script for lesson data |

### Build Config
| File | Purpose |
|------|---------|
| `next.config.mjs` | COOP/COEP headers (fallback to middleware) |
| `package.json` | Tutorial-specific dependencies |

---

## Steps

### Step 1: Create the website app directory ✅

Created `apps/website/` as a new Next.js app within the ksc monorepo.

```
apps/website/
  package.json
  next.config.mjs
  tsconfig.json
```

Added `"apps/website"` to the root `package.json` workspaces array.

### Step 2: Install dependencies ✅

All tutorial npm packages added to `apps/website/package.json`:

```json
{
  "dependencies": {
    "next": "^15.3.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@webcontainer/api": "^1.6.0",
    "@monaco-editor/react": "^4.7.0",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "react-resizable-panels": "^2.1.9",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "rehype-highlight": "^7.0.2",
    "jszip": "^3.10.1"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^22.0.0"
  }
}
```

### Step 3: Copy COOP/COEP middleware ✅

Copied `src/middleware.ts` to `apps/website/src/middleware.ts`. Sets `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` headers for SharedArrayBuffer support.

Also added equivalent `headers()` config into `next.config.mjs` as a fallback.

### Step 4: Copy WebContainer infrastructure ✅

Copied into `apps/website/src/lib/`:

```
apps/website/src/lib/
  webcontainer/
    singleton.ts
    utils.ts
  tutorial/
    storage.ts
    export.ts
    sandbox-templates.ts   ← NEW: created for SandboxLayout (clean-architecture + blank templates)
```

### Step 5: Copy all tutorial components ✅

Copied all 19 files from `src/components/tutorial/` verbatim.

### Step 6: Copy lesson types and template ✅

Copied `types.ts` and `template.ts`. Skipped `storybook-files.ts`.

### Step 7: Create the hello-world lesson ✅

Created:

```
apps/website/src/lib/lessons/1-1-hello-world/
  lesson.json           ← slug, title, partTitle, focus
  content.mdx           ← walkthrough: define architecture, run check, break + fix
  starter/src/
    context.ts           ← 3-layer clean architecture with noDependency
    domain/user.ts       ← domain entity
    application/register-user.ts  ← app-layer use case
    infrastructure/user-repo.ts   ← infra adapter
  solution/src/
    (same as starter — hello-world starts correct)
```

### Step 8: Copy and adapt the lesson codegen script ✅

Copied `scripts/generate-lessons.mjs`. Removed all storybook-files handling.

Run `npm run generate:lessons` produces:
- `src/lib/lessons/1-1-hello-world.generated.ts`
- `src/lib/lessons/index.ts`
- `public/lessons/1-1-hello-world.mdx`

### Step 9: Create Next.js pages ✅

```
apps/website/src/app/
  layout.tsx            ← NEW: root layout (html + body + globals.css)
  page.tsx              ← NEW: redirects to /tutorial
  globals.css           ← NEW: minimal CSS reset (replaced Nextra/Tailwind original)
  tutorial/
    layout.tsx          ← copied (100vh wrapper)
    page.tsx            ← copied (lesson index with sandbox link)
    [lesson]/
      page.tsx          ← copied (dynamic lesson route)
  sandbox/
    page.tsx            ← copied
```

### Step 10: Configure Next.js ✅

**`next.config.mjs`**: COOP/COEP headers for `/tutorial/*` and `/sandbox`.

**`tsconfig.json`**: Configured with `@/*` path alias, `moduleResolution: "bundler"`, and excluded `src/lib/lessons/*/starter` and `src/lib/lessons/*/solution` from typecheck (they contain `kindscript` imports that fail without the package installed in the website).

### Step 11: Update CodeEditor KindScript types ✅

Verified: `KINDSCRIPT_TYPES` in `CodeEditor.tsx` matches the published `kindscript@2.0.3` npm package API (`Kind<N, Members, Constraints>`, `Instance`, `Carrier`, `MemberMap`). This is the version installed inside the WebContainer, and the lesson files import from it. The `src/api.ts` in this repo uses a different API shape (`Kind<R extends PropertySet>`) — that's expected since it's a different version. No changes needed.

### Step 12: Wire up workspace ✅

Root `package.json` updated:
- Added `"apps/website"` to workspaces
- Added `website:dev` and `website:build` convenience scripts

### Step 13: Verify ✅

`next build` succeeds — all routes compile:

```
Route (app)                                 Size  First Load JS
┌ ○ /                                      126 B         103 kB
├ ○ /sandbox                             7.17 kB         162 kB
├ ○ /tutorial                            1.94 kB         108 kB
└ ƒ /tutorial/[lesson]                   98.2 kB         256 kB
```

---

## What NOT to copy

- All 21 lesson folders (replaced by 1 hello-world)
- `storybook-files.ts` and storybook-related lesson data
- Nextra docs configuration (the tutorial doesn't depend on it)
- `tailwind.config.js` / `postcss.config.mjs` (tutorial components use inline styles)
- `pagefind` search integration
- Agent docs sync scripts
- Marketing pages / landing page
- `formspree.json` / waitlist form

---

## File Count Summary

| Category | Files copied | Files created new | Files skipped |
|----------|-------------|------------------|---------------|
| Components | 19 | 0 | 0 |
| Lib/infra | 4 | 1 (sandbox-templates) | 0 |
| Lesson types + template | 2 | 0 | 1 (storybook) |
| Lesson content | 0 | 7 (hello-world lesson) | ~80 (21 lessons) |
| Pages | 5 | 2 (root layout + redirect) | 0 |
| Config | 1 (middleware) | 3 (package.json, next.config, tsconfig) | 3 (tailwind, postcss, pagefind) |
| Scripts | 1 (generate-lessons) | 0 | 3 (other scripts) |
| Styles | 0 | 1 (globals.css) | 0 |
| **Total** | **32** | **14** | **~87** |
