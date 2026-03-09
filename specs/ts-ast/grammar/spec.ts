/**
 * Grammar spec factory for the TypeScript AST grammar.
 *
 * Takes a GrammarBuilder, populates it with TS AST node definitions,
 * and assembles the complete GrammarSpec.
 */

import type { GrammarBuilder } from '../../../grammar/builder.js';
import type { GrammarSpec } from '../../../grammar/types.js';
import { assembleFieldExtractors } from '../../../grammar/field-extractors.js';
import { validateFieldExpressions } from '../../../grammar/convert-codegen.js';
import { defineGrammar } from './nodes.js';
import { EXTRACTOR_CONFIG, SKIP_CONVERT, SYNTAX_KIND_OVERRIDES } from './extractors.js';
import { generateTsConvert, HELPER_NAMES } from './convert-generator.js';

export function buildGrammarSpec(builder: GrammarBuilder): GrammarSpec {
  defineGrammar(builder);
  const { nodes, sumTypes } = builder.build();

  const fieldExtractors = assembleFieldExtractors(nodes, EXTRACTOR_CONFIG);
  const skipConvert = SKIP_CONVERT;
  const syntaxKindOverrides = SYNTAX_KIND_OVERRIDES;
  const jsDocMembers = new Set(sumTypes.get('JSDocNode')?.members ?? []);

  // Validate that extractor expressions reference known helpers
  const exprDiags = validateFieldExpressions(fieldExtractors, HELPER_NAMES);
  if (exprDiags.length > 0) {
    for (const d of exprDiags) {
      console.warn(`[spec] Unknown helper '${d.unknownRef}' in ${d.kind}.${d.field}: ${d.expr}`);
    }
  }

  return {
    nodes,
    sumTypes,
    convertGenerator: () => generateTsConvert({
      nodes, sumTypes, fieldExtractors,
      skipConvert, syntaxKindOverrides, jsDocMembers,
    }),
  };
}
