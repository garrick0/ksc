import { resolveConfig } from './config.js';
import { findRootFiles } from './find-files.js';
import { createProgram } from './check-program.js';

export async function checkProject(rootDir, options) {
  const config = await resolveConfig({
    configPath: options?.configPath,
    rootDir,
    overrides: options?.depth !== undefined ? { analysisDepth: options.depth } : undefined,
  });

  const fileOpts = {
    include: config.include ? [...config.include] : undefined,
    exclude: config.exclude ? [...config.exclude] : undefined,
  };
  const rootFiles = findRootFiles(rootDir, fileOpts);
  if (rootFiles.length === 0) {
    return { definitions: [], diagnostics: [], fileCount: 0 };
  }

  const program = createProgram(rootFiles, config, {
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
