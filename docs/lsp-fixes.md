# LSP Review Fixes — Implementation Tracker

All items complete. 452/452 tests pass, zero type errors.

## Fix Now (correctness)

- [x] **1. URI handling** — Created `apps/lsp/server/uri.ts` using `vscode-uri` (`URI.file()`, `URI.parse().fsPath`). Removed duplicates from `server.ts` and `ts-host.ts`. Both now import from `uri.ts`. Added `test/lsp/uri.test.ts` (5 tests) covering round-tripping, spaces, and encoding.
- [x] **2. Config loading race** — `loadKSConfig()` now calls `scheduleAnalysis()` in its `.then()` callback, ensuring re-analysis runs after the real config loads.
- [x] **3. Enable flag not respected** — Added `enabled` flag in `server.ts`, checked at the top of `runAnalysis()`. `onDidChangeConfiguration` sets the flag and clears diagnostics when disabled. Re-enabling triggers fresh analysis.
- [x] **4. tsconfig parse error handling** — Extracted `parseTsConfig()` helper in `ts-host.ts` that checks `configFile.error` and `parsed.errors`, logs them via `HostLogger`, and falls back to defaults on failure. Used in both constructor and `reloadConfig()`.
- [x] **5. `.vscodeignore` stale reference** — Updated `esbuild.js` → `esbuild.cjs`.

## Fix Soon (quality)

- [x] **6. `console.error` in analyzer** — Added `AnalyzerLogger` interface. `Analyzer` constructor accepts optional logger. Server passes `connection.console.error`. No more direct `console.error`.
- [x] **7. Unused parameter** — Removed `document` from `detectWritePattern` signature and call site.
- [x] **8. Test gaps** — Added:
  - `test/lsp/uri.test.ts` — 5 tests (round-trip, spaces, encoding)
  - `test/lsp/ts-host.test.ts` — 9 tests (tsconfig reading, file names, snapshots, versions, defaults, reload)
  - Setter fix TextEdit output test (verifies `user.setName("test")`)
  - Element access code action test (verifies `user['name']` → `user.getName()`)
  - `textDocumentFromFile` tests (real file + nonexistent file)
  - Fixed analyzer tests to use `beforeEach` for fresh `Analyzer` instances (no ordering dependency)
  - Total: 43 LSP tests across 6 files (up from 24 across 4 files)
- [x] **9. Shutdown cleanup** — Added `connection.onShutdown()` handler that calls `scheduler.dispose()` and `tsLanguageService.dispose()`.

## Summary

| Metric | Before | After |
|--------|--------|-------|
| LSP test files | 4 | 6 |
| LSP tests | 24 | 43 |
| Total tests | 433 | 452 |
| URI handling | hand-rolled, broken on spaces/Windows | `vscode-uri`, correct |
| Config race | first analysis uses empty config | re-analysis after config loads |
| Enable flag | only checked on config change event | checked on every analysis run |
| tsconfig errors | unhandled, could crash | logged via HostLogger, falls back to defaults |
| Error logging | `console.error` (breaks stdio) | `AnalyzerLogger` callback |
| Shutdown | no cleanup | disposes scheduler + TS LanguageService |
