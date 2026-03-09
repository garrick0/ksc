/**
 * TS-specific convert.ts generator.
 *
 * Uses the shared TS convert skeleton for infrastructure (identity map, comment
 * handling, child lookup, dispatch, buildKSTree) and shared per-kind generation
 * helpers for the data-driven register() calls.
 */

import type * as Helpers from './convert-helpers.js';
import type { ConvertGeneratorInput } from '../../../grammar/convert-codegen.js';
import { buildConverterEntries, emitConverterRegistrations } from '../../../grammar/convert-codegen.js';
import { emitConvertPreamble, emitConvertPostamble } from '../../../grammar/convert-skeleton.js';

/** Names exported from convert-helpers.ts that generated convert.ts imports. */
const HELPER_EXPORTS = [
  'hasSymFlag', 'checkIsDefinitionSite', 'isImportReference',
  'getResolvedFileName', 'isNodeExported', 'getLocalCount',
  'getTypeString', 'getResolvedModulePath', 'getImportModuleSpecifier',
  'extractJSDocComment', 'getDeclarationKind',
  'prefixUnaryOperatorMap', 'postfixUnaryOperatorMap',
  'typeOperatorMap', 'heritageTokenMap', 'metaPropertyKeywordMap',
] as const satisfies readonly (keyof typeof Helpers)[];

/** Set of known helper names for expression validation. */
export const HELPER_NAMES: ReadonlySet<string> = new Set(HELPER_EXPORTS);

const HELPERS_MODULE_PATH = '../../../specs/ts-ast/grammar/convert-helpers.js';

export function generateTsConvert(input: ConvertGeneratorInput): string {
  const entries = buildConverterEntries(input);
  const registrations = emitConverterRegistrations(entries, (kind) => {
    const override = input.syntaxKindOverrides[kind];
    return override !== undefined
      ? `${override} as ts.SyntaxKind`
      : `ts.SyntaxKind.${kind}`;
  });

  const config = {
    helperImport: { module: HELPERS_MODULE_PATH, names: [...HELPER_EXPORTS] },
    buildKSTreeInit: `const checker = depth !== 'parse' ? tsProgram.getTypeChecker() : undefined;\n  _ctx = { checker, depth };`,
    usesConvertContext: true,
  };

  return [
    emitConvertPreamble(config),
    '// ── Generated converters ──\n',
    ...registrations,
    emitConvertPostamble(config),
  ].join('\n');
}
