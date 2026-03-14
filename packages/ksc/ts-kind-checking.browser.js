import {
  createProgram as createProgramImpl,
  createProgramFromTSProgram as createProgramFromTSProgramImpl,
} from './internal/ts-kind-checking/check-program.js';
import { parseOnly as parseOnlyImpl } from '../../libs/grammar/application/parse-only.ts';
import { convertTSAST } from '../../libs/languages/ts-ast/src/translator/convert.ts';
import { extractASTData } from '../../libs/languages/ts-ast/src/extraction/extract.ts';

const translator = { convert: convertTSAST };

function nodeOnlyExport(name) {
  throw new Error(`${name} is not available in browser builds of ksc/ts-kind-checking.`);
}

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

export async function checkProject() {
  return nodeOnlyExport('checkProject');
}

export function findConfig() {
  return nodeOnlyExport('findConfig');
}

export function findRootFiles() {
  return nodeOnlyExport('findRootFiles');
}

export async function loadConfig() {
  return nodeOnlyExport('loadConfig');
}

export async function resolveConfig() {
  return nodeOnlyExport('resolveConfig');
}
