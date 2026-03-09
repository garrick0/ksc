# Gap Analysis: ksc-ag-integration.md vs Actual Codebase

Generated: 2026-03-04

This document compares the design doc (`docs/architecture/ksc-ag-integration.md`) against the actual implementation state, identifies discrepancies, and tracks their resolution.

---

## Summary

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| 1 | Doc describes "Two-tier node system" with KSGenericNode — code has no KSGenericNode | Doc stale | **FIXED** |
| 2 | Doc code samples show KSGenericNode interface definition and union member | Doc stale | **FIXED** |
| 3 | Doc convert.ts sample shows generic fallback — code throws on unknown | Doc stale | **FIXED** |
| 4 | Doc says "~40+ specific interfaces" — code has 361 | Doc stale | **FIXED** |
| 5 | showcase.ts references non-existent `annotations` and `check.diagnostics` | **Runtime crash** | **FIXED** |
| 6 | Doc binder sample imports `syn, coll` from AG — actual only uses `match, lookup` | Doc stale | **FIXED** |
| 7 | Doc keyword type comment says "All handled by KSGenericNode" — they have specific interfaces | Doc stale | **FIXED** |
| 8 | `config` parameter accepted but unused in `createProgramFromTSProgram` | Intentional (future use) | N/A |

---

## Gap Details

### Gap 1: "Two-tier node system" heading is obsolete

**Doc says (Part 2 heading):**
> Architecture: Two-tier node system

**Doc says (body):**
> TypeScript has ~350 SyntaxKind values. We define:
> 1. KSNodeBase — common fields
> 2. Specific typed interfaces (~40+) for node types KSC will pattern-match on
> 3. KSGenericNode for remaining node types

**Reality:** The code has 361 specific typed interfaces. `KSGenericNode` was removed entirely. Every `ts.SyntaxKind` has its own interface with a literal `kind` type. The union `KSNode` has 360 members, none generic.

**Fix:** Update heading and description to reflect full SyntaxKind coverage.

---

### Gap 2: KSGenericNode in code samples

**Doc shows:**
```typescript
export interface KSGenericNode extends KSNodeBase {
  kind: string;  // any SyntaxKind name not covered by specific interfaces
}
```
And in the union:
```typescript
export type KSNode =
  ...
  // Generic (all remaining ~250+ SyntaxKinds)
  | KSGenericNode;
```

**Reality:** `KSGenericNode` doesn't exist. All 360 union members are specific typed interfaces.

**Fix:** Remove KSGenericNode definition and union member from doc code samples.

---

### Gap 3: Generic fallback in convert.ts sample

**Doc shows (line ~1001-1002):**
```typescript
// Generic fallback — preserves kind identity, children, position
return { kind: kindName, pos, end, text, children, tsNode: node };
```

**Reality:** The fallback now throws:
```typescript
throw new Error(`Unhandled SyntaxKind: ${ts.SyntaxKind[node.kind] ?? node.kind}`);
```

**Fix:** Update convert.ts code sample in doc.

---

### Gap 4: Interface count mismatch

**Doc says:** "Specific typed interfaces (~40+)"
**Phase B status says:** "361 specific typed interfaces"

The body text and the status sections contradict each other.

**Fix:** Update body text to say "361 specific typed interfaces" (or "every SyntaxKind").

---

### Gap 5: showcase.ts references non-existent fields (RUNTIME BUG)

**File:** `examples/showcase.ts` lines 81-82

```typescript
console.log(`  Kinds: ${data.kinds.definitions.length} definitions, ${data.kinds.annotations.length} annotations`);
console.log(`  Check: ${data.check.diagnostics.length} diagnostics\n`);
```

**Reality:** `DashboardExportData` has no `kinds.annotations` field and no `check` section at all. These are forward-looking fields for features not yet implemented (annotation tracking, checker diagnostics).

Running `npm run showcase` or `npm run showcase:live` would crash at this point.

**Fix:** Remove references to non-existent fields. Use only `data.kinds.definitions.length`.

---

### Gap 6: Doc binder sample imports don't match actual

**Doc shows:**
```typescript
import { syn, coll, match, lookup } from '../../libs/ag/src/index.js';
```

**Reality (`src/pipeline/binder.ts`):**
```typescript
import { match } from '../../libs/ag/src/match.js';
import { lookup } from '../../libs/ag/src/lookup.js';
import type { Attribute } from '../../libs/ag/src/types.js';
```

The binder doesn't directly use `syn` or `coll` — `match` uses `syn` internally, and `lookup` uses `coll` + `atRoot` internally.

**Fix:** Update doc import to match actual.

---

### Gap 7: Keyword type node comment says "All handled by KSGenericNode"

**Doc comment (around line 803):**
```typescript
// TrueKeyword, FalseKeyword, NullKeyword, UndefinedKeyword,
// VoidKeyword, AnyKeyword, NumberKeyword, StringKeyword, etc.
// All handled by KSGenericNode — kind = the keyword name, children = []
```

**Reality:** These all have specific interfaces (e.g., `KSTrueKeyword`, `KSFalseKeyword`, etc.) with literal `kind` types.

**Fix:** Update comment to reflect that each keyword has its own interface.

---

### Gap 8: `config` parameter unused (NOT A BUG)

`createProgramFromTSProgram(tsProgram, config?)` and `createProgram(rootNames, config?, options?)` both accept a `KindScriptConfig` but don't use it. This is intentional — the parameter is in place for when the checker is implemented (config will drive rule enforcement).

**Status:** N/A — intentional forward declaration.

---

## Non-Gap Observations

These were checked and found to be consistent:

- **AG library (libs/ag):** All 9 modules match the design doc's Phase 1 description. 53 tests pass.
- **AST conversion (src/pipeline/convert.ts):** 359 registered converters, no generic fallback. Matches Phase C status.
- **Binder (src/pipeline/binder.ts):** Uses `match` + `lookup` from AG library. Matches Phase D status.
- **Program (src/program.ts):** Creates TS program → KSTree → binder. Matches doc.
- **Dashboard export (src/dashboard/export.ts):** Serializes parse + kinds stages. Consistent with `DashboardExportData` type.
- **CLI (src/cli/cli.ts):** `ksc check` discovers files, creates program, reports kind definitions. Working.
- **Test suite:** 38 root tests + 53 AG tests = 91 total, all passing. tsc clean.
- **PropertySet:** Only `noImports` — matches `src/api/kinds.ts`. Limited but consistent.
