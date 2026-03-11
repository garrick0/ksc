/**
 * KSC Analysis Projections — lightweight runtime module.
 *
 * Exports AnalysisProjections<KSCProjections> for the evaluator composition root.
 * This module has NO equation imports, NO pivot machinery — only the small
 * projection functions and setup needed at runtime.
 *
 * Import chain: projections.ts → definitions.ts → types.ts (all lightweight).
 * Codegen-time declarations (attrs, typeImports) live in spec.ts.
 */

import type { AnalysisProjections, Ctx } from '@kindscript/core-evaluator';
import type { KindDefinition, Diagnostic, KSCProjections } from './types.js';
import { resetCounter } from './equations/definitions.js';

export type { KSCProjections } from './types.js';

export const analysisProjections: AnalysisProjections<KSCProjections> = {
  projections: {
    definitions: (root: Ctx): KindDefinition[] =>
      root.children.flatMap(cu => cu.attr('kindDefs')),
    diagnostics: (root: Ctx): Diagnostic[] => root.attr('allViolations'),
  },
  setup: resetCounter,
};
