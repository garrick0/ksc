/**
 * Use case: Check project — resolve config, find files, run kind-checking analysis.
 *
 * Higher-level than createProgram: takes a root directory and handles
 * config resolution + file discovery automatically.
 *
 * Pure function — receives all dependencies via the deps parameter.
 * Pre-wired version is exported from the barrel (index.ts).
 */

import type { KindDefinition, Diagnostic } from '../adapters/analysis/spec/ts-kind-checking/index.js';
import type { AnalysisDepth } from '../api.js';
import type { CheckDeps, CheckProjections } from './types.js';
import { resolveConfig } from './config.js';
import { findRootFiles, type FindFilesOptions } from './find-files.js';
import { createProgram } from './check-program.js';

// ── Types ────────────────────────────────────────────────────────────

export interface ProjectCheckResult {
  definitions: KindDefinition[];
  diagnostics: Diagnostic[];
  fileCount: number;
}

// ── Use case ─────────────────────────────────────────────────────────

/**
 * Check a project directory: resolve config, discover .ts files, evaluate.
 * Returns an empty result (fileCount: 0) if no TypeScript files are found.
 */
export async function checkProject<M = Record<string, unknown>, P extends CheckProjections = CheckProjections>(
  deps: CheckDeps<M, P>,
  rootDir: string,
  options?: {
    configPath?: string;
    depth?: AnalysisDepth;
  },
): Promise<ProjectCheckResult> {
  const config = await resolveConfig({
    configPath: options?.configPath,
    rootDir,
    overrides: options?.depth !== undefined ? { analysisDepth: options.depth } : undefined,
  });

  const fileOpts: FindFilesOptions = {
    include: config.include ? [...config.include] : undefined,
    exclude: config.exclude ? [...config.exclude] : undefined,
  };
  const rootFiles = findRootFiles(rootDir, fileOpts);
  if (rootFiles.length === 0) {
    return { definitions: [], diagnostics: [], fileCount: 0 };
  }

  const program = createProgram(deps, rootFiles, config, {
    strict: true,
    noEmit: true,
    rootDir,
  });

  return {
    definitions: program.getKindDefinitions(),
    diagnostics: program.getDiagnostics(),
    fileCount: rootFiles.length,
  };
}
