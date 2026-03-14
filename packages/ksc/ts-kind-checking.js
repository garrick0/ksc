import {
  createProgram as createProgramImpl,
  createProgramFromTSProgram as createProgramFromTSProgramImpl,
} from './internal/ts-kind-checking/check-program.js';
import { checkProject as internalCheckProject } from './internal/ts-kind-checking/check-project.js';
import {
  findConfig as internalFindConfig,
  loadConfig as internalLoadConfig,
  resolveConfig as internalResolveConfig,
} from './internal/ts-kind-checking/config.js';
import { findRootFiles as internalFindRootFiles } from './internal/ts-kind-checking/find-files.js';
import { parseOnly as parseOnlyImpl } from '../../libs/grammar/application/parse-only.ts';
import { convertTSAST } from '../../libs/languages/ts-ast/src/translator/convert.ts';
import { extractASTData } from '../../libs/languages/ts-ast/src/extraction/extract.ts';

const translator = { convert: convertTSAST };

export { extractASTData };

export function createProgram(rootNames, config, options) {
  return createProgramImpl(rootNames, config, options);
}

export function createProgramFromTSProgram(tsProgram, config) {
  return createProgramFromTSProgramImpl(tsProgram, config);
}

export function parseOnly(rootNames, options, depth) {
  return parseOnlyImpl(translator, rootNames, options, depth);
}

export async function checkProject(rootDir, options) {
  return internalCheckProject(rootDir, options);
}

export function findConfig(rootDir) {
  return internalFindConfig(rootDir);
}

export function findRootFiles(rootDir, options) {
  return internalFindRootFiles(rootDir, options);
}

export async function loadConfig(configPath) {
  return internalLoadConfig(configPath);
}

export async function resolveConfig(options) {
  return internalResolveConfig(options);
}
