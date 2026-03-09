/**
 * Mock convert.ts generator.
 *
 * Uses the shared TS convert skeleton for infrastructure.
 * No helper imports or checker initialization (mock grammar doesn't
 * need semantic analysis features).
 */

import type { ConvertGeneratorInput } from '../../../grammar/convert-codegen.js';
import { buildConverterEntries, emitConverterRegistrations } from '../../../grammar/convert-codegen.js';
import { emitConvertPreamble, emitConvertPostamble } from '../../../grammar/convert-skeleton.js';

export function generateMockConvert(input: ConvertGeneratorInput): string {
  const entries = buildConverterEntries(input);
  const registrations = emitConverterRegistrations(entries, (kind) => {
    const override = input.syntaxKindOverrides[kind];
    return override !== undefined
      ? `${override} as ts.SyntaxKind`
      : `ts.SyntaxKind.${kind}`;
  });

  return [
    emitConvertPreamble(),
    '// ── Generated converters ──\n',
    ...registrations,
    emitConvertPostamble(),
  ].join('\n');
}
