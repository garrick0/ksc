/**
 * Spec validation.
 *
 * Validates that an AnalysisDecl's attribute dependencies are self-consistent
 * (every dep name references an existing attribute).
 */

import type { AnalysisDecl } from './ports.js';
import { collectDepsForAttr } from './equation-utils.js';

export interface ValidationDiagnostic {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Validate an analysis declaration's internal consistency.
 * Returns diagnostics for invalid attribute dependency references.
 */
export function validateSpec(
  decl: AnalysisDecl,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const attrNames = new Set(decl.attrs.map(a => a.name));

  for (const attr of decl.attrs) {
    for (const dep of collectDepsForAttr(attr)) {
      if (!attrNames.has(dep)) {
        diagnostics.push({
          level: 'error',
          message: `Attribute '${attr.name}': depends on unknown attribute '${dep}'`,
        });
      }
    }
  }

  return diagnostics;
}
