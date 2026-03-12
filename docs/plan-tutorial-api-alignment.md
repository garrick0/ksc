# Plan: Align Tutorial with KSC API and Project Patterns

## Goal

The tutorial currently teaches the `kindscript@2.0.3` API (`Kind<N, Members, Constraints>`,
`Instance`, `noDependency`, layer-based architecture). This repo's API is completely different:
`Kind<R extends PropertySet>` — phantom types for property-based annotations on values.

Update everything so the tutorial teaches **this repo's actual API**.

---

## Implementation Progress

| Step | Status | Notes |
|------|--------|-------|
| 1. Update CodeEditor KINDSCRIPT_TYPES | DONE | Replaced with `PropertySet`, `Kind<R>`, `KindScriptConfig`, `defineConfig` |
| 2. Update WebContainer template | DONE | Kept `kindscript@2.0.3` — lesson files define types locally (like test fixtures) |
| 3. Rewrite hello-world lesson content | DONE | Teaches `Kind<{ noImports: true }>`, intersection annotations, violation detection |
| 4. Rewrite hello-world lesson files | DONE | `kinds.ts` + `math.ts` + `helpers.ts` — matches test fixture patterns |
| 5. Update sandbox templates | DONE | `property-kinds` template (kinds + math + helpers) replaces `clean-architecture` |
| 6. Run lesson generator | DONE | Regenerated `1-1-hello-world.generated.ts`, `index.ts`, public MDX |
| 7. Verify build | DONE | `next build` succeeds — all 5 routes compile |

---

## Current vs Target API

### Current (wrong — from kindscript@2.0.3)
```typescript
import type { Kind, Instance } from 'kindscript';

type DomainLayer = Kind<"DomainLayer">;
type InfraLayer = Kind<"InfrastructureLayer">;

type App = Kind<"App", {
  domain: [DomainLayer, './domain'];
  infra: [InfraLayer, './infrastructure'];
}, {
  noDependency: [["domain", "infra"]];
}>;

export const app = { domain: {}, infra: {} } satisfies Instance<App, '.'>;
```

### Target (correct — this repo's API)
```typescript
import type { Kind, PropertySet } from 'kindscript';

type NoImports = Kind<{ noImports: true }>;

export const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;
```

Key differences:
- `Kind<R extends PropertySet>` not `Kind<N, Members, Constraints>`
- No `Instance`, `Carrier`, `MemberMap`, `KindRef`, `Constraints` types
- Properties are `noImports`, `noConsole`, `immutable`, `static`, `noSideEffects`, `noMutation`, `noIO`, `pure`
- Kinds annotate individual values via intersection types, not entire directory structures
- Violations are about specific code patterns (imports, console, mutation), not architecture layers

---

## Steps

### Step 1: Update CodeEditor KINDSCRIPT_TYPES

Replace the `KINDSCRIPT_TYPES` constant in `CodeEditor.tsx` with type declarations
matching this repo's `src/api.ts`:

```typescript
declare module 'kindscript' {
  export interface PropertySet {
    readonly noImports?: true;
    readonly noConsole?: true;
    readonly immutable?: true;
    readonly static?: true;
    readonly noSideEffects?: true;
    readonly noMutation?: true;
    readonly noIO?: true;
    readonly pure?: true;
  }
  export type Kind<R extends PropertySet> = { readonly __kind?: R };
  export type AnalysisDepth = 'parse' | 'bind' | 'check';
  export interface KindScriptConfig {
    readonly analysisDepth?: AnalysisDepth;
    readonly include?: readonly string[];
    readonly exclude?: readonly string[];
  }
  export function defineConfig(config: KindScriptConfig): KindScriptConfig;
}
```

### Step 2: Update WebContainer template

In `template.ts`, the WebContainer installs `kindscript@2.0.3` from npm. This needs to
reference a version that has the property-based API. Since this repo's version (0.1.0)
may not be published to npm, we have two options:

- **Option A**: Keep pointing to a published npm version but ensure the types match
- **Option B**: Bundle the types inline (the checker runs in WebContainer but the types
  are what matter for the tutorial)

For now: update the check script and keep the version reference. The lesson files will
define `Kind` and `PropertySet` locally (like the test fixtures do), avoiding the npm
dependency mismatch.

### Step 3: Rewrite hello-world lesson content

Replace `content.mdx` to teach the property-based API:
- Define a `Kind` type and `PropertySet` interface
- Create a `NoImports` kind
- Annotate a function with the kind
- Run `ksc check` — 0 violations
- Introduce a violation (add an import to an annotated function)
- Run check again — see the violation
- Fix it

### Step 4: Rewrite hello-world lesson files

Replace the layer-architecture files with property-based examples:

**starter/**:
- `src/kinds.ts` — defines `PropertySet`, `Kind`, `NoImports`
- `src/math.ts` — clean function annotated with `NoImports` (no violations)

**solution/**:
- Same as starter (hello-world starts clean)

### Step 5: Update sandbox templates

Replace the `clean-architecture` template with a property-based example.
Keep the `blank` template.

### Step 6: Run lesson generator

`npm run generate:lessons` to regenerate `*.generated.ts` and `index.ts`.

### Step 7: Verify build

`next build` — all routes should compile.
