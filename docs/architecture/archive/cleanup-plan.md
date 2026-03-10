# Post-Restructure Cleanup Plan

Track: cleanup, verification, and backward-compat removal after the directory restructure.

## High Priority

### 1. Fix tsconfig.json — add `compiler/` to include
**Status:** DONE
- Added `compiler/` and `grammar/` to include array
- Scripts excluded (use `import.meta` which requires ESM, run with `tsx` not `tsc`)
- Added comments explaining the split (prod dirs vs scripts/test/dashboard)

### 2. Delete `.showcase-tmp/` stale directory
**Status:** DONE
- Deleted stale temp directory

### 3. Deduplicate field extractors
**Status:** DONE
- Created `scripts/field-extractors.ts` with `buildFieldExtractors(nodes)` function
- Updated `scripts/codegen-grammar.ts` and `scripts/codegen-all.ts` to import from shared module
- ~70 lines of duplication removed

### 4. Archive historical architecture docs
**Status:** DONE
- Moved 43 historical docs to `docs/architecture/archive/`
- Kept only `restructure-plan.md` and `cleanup-plan.md` in active directory

## Medium Priority

### 5. Add tests for untested modules
**Status:** DONE
- `test/violation-builder.test.ts` — 4 tests for `compiler/violation.ts`
- `test/export.test.ts` — 8 tests for `grammar/export.ts` (extractASTData)
- `test/codegen-scripts.test.ts` — 6 tests for field extractors + codegen pipeline + cross-validation
- `test/cli.test.ts` — 27 tests for CLI arg parsing, config discovery, file discovery

### 6. Remove `analysis/binder.ts` re-export shim
**Status:** DONE
- Removed `export type { DefIdCounter } from './types.js'` shim
- Updated `compiler/analysis.ts` codegen template to import `DefIdCounter` from `analysis/types.js`
- Regenerated `generated/evaluator.ts`

### 7. Tighten `as any` casts in `analysis/spec.ts`
**Status:** DONE
- Removed `as any` from `kindAnnotations` cases/default equations
- Removed `as any` from `nodeCount` contribute function
- Kept minimal casts for `nodeCount` combine (contravariant parameter issue with `unknown`)

### 8. CLI improvements
**Status:** DONE
- Added `--watch` / `-w` mode (file watcher with debounce)
- Added `init` command (generates `ksc.config.ts` scaffold)
- Added proper exit codes: 0=success, 1=violations, 2=error
- Added `--depth <parse|bind|check>` flag
- Check output now reports violations with messages
- JSON output includes violations array
- Enhanced error messages with hints (e.g., "No TypeScript files found" → suggests src/ and --config)
- Guarded main() so CLI module is testable via import

### 9. Dashboard integration tests
**Status:** DONE (covered by item 5)
- `test/export.test.ts` tests `extractASTData()` with real fixtures
- Validates file structure, AST node shape, field indices, props types, schema info

## Round 2 — DX & Polish

### 10. package.json `exports` and `files` fields
**Status:** DONE
- Added `"exports"` field with types + default subpath
- Added `"files": ["dist"]` to exclude tests/docs/examples from npm package

### 11. Barrel exports for `compiler/` and `grammar/`
**Status:** DONE
- Created `compiler/index.ts` — re-exports functors, validation, violation builder, types
- Created `grammar/index.ts` — re-exports builder API, data export, types

### 12. JSDoc on public API
**Status:** DONE
- Added module-level examples (basic, with config, dashboard export)
- Added per-export JSDoc comments with examples

### 13. Programmatic API example
**Status:** DONE
- Created `examples/programmatic-api.ts`
- Demonstrates: createProgram, defineConfig, extractASTData, dep graph
- Verified: runs successfully with `npx tsx examples/programmatic-api.ts`

### 14. CLI test coverage
**Status:** DONE
- `test/cli.test.ts` — 27 tests covering:
  - parseArgv: all flags, combined flags, help/version variants, unknown commands
  - findConfig: no config, kindscript.config.ts, ksc.config.ts, precedence
  - findRootFiles: fixtures, src/ preference, fallback, skip dirs, skip .d.ts, empty
  - Exit code constants

### 15. README improvements
**Status:** DONE
- Added CLI section with all commands and config file discovery docs
- Added CI/CD integration example (GitHub Actions YAML)
- Fixed node count discrepancy (364 total = 362 TS + 2 KSC-only)
- Fixed programmatic API example (actual function names, working code)
- Added project structure section
- Removed stale `ast-schema/schema.ts` reference → `grammar/nodes.ts`

### 16. tsconfig comments
**Status:** DONE
- Added comments explaining include/exclude rationale

### 17. Enhanced CLI error messages
**Status:** DONE
- "No TypeScript files found" now shows searched directory and suggests src/ or --config

## Verification

After all changes:
- [x] `npx tsc --noEmit` passes
- [x] `npx vitest run --testTimeout=30000` passes (253 tests, 20 files)
- [x] `npx tsx scripts/codegen-all.ts` regenerates cleanly
- [x] `npx tsx examples/programmatic-api.ts` runs successfully
- [x] No backward-compat shims remain
