/**
 * Grammar spec factory for the mock grammar.
 *
 * Takes a GrammarBuilder, populates it with mock node definitions,
 * and assembles the GrammarSpec.
 */

import type { GrammarBuilder } from '../../../grammar/builder.js';
import type { GrammarSpec } from '../../../grammar/types.js';
import { defineGrammar } from './nodes.js';
import { generateMockConvert } from './convert-generator.js';

export function buildGrammarSpec(builder: GrammarBuilder): GrammarSpec {
  defineGrammar(builder);
  const { nodes, sumTypes } = builder.build();

  const skipConvert = new Set(['MockProgram']);
  const jsDocMembers = new Set<string>();

  return {
    nodes,
    sumTypes,
    convertGenerator: () => generateMockConvert({
      nodes, sumTypes,
      fieldExtractors: {},
      skipConvert,
      syntaxKindOverrides: {},
      jsDocMembers,
    }),
  };
}
