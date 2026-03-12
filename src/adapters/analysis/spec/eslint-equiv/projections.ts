/**
 * ESLint-equiv Analysis Projections — lightweight runtime module.
 *
 * Exports AnalysisProjections for the evaluator composition root.
 * NO equation imports, NO codegen machinery — only projection functions.
 */

import type { AnalysisProjections, TypedAGNode } from '@kindscript/core-evaluator';
import type { EslintEquivDiagnostic, EslintEquivProjections } from './types.js';
import type { KSCAttrMap } from './generated/attr-types.js';

export type EslintEquivAttrMap = KSCAttrMap;

export const analysisProjections: AnalysisProjections<EslintEquivAttrMap, EslintEquivProjections> = {
  projections: {
    violations: (root: TypedAGNode<EslintEquivAttrMap>): Record<string, EslintEquivDiagnostic[]> => {
      const all = root.attr('allEslintViolations');
      // Group by ruleId
      const byRule: Record<string, EslintEquivDiagnostic[]> = {};
      for (const d of all) {
        if (!byRule[d.ruleId]) byRule[d.ruleId] = [];
        byRule[d.ruleId].push(d);
      }
      return byRule;
    },
  },
};
