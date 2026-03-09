/**
 * Spec validation.
 *
 * Validates that an AnalysisSpec's attribute dependencies are self-consistent
 * (every dep name references an existing attribute).
 */

import type { AnalysisSpec } from './types.js';
import { collectDepsForAttr } from './types.js';

export interface ValidationDiagnostic {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Validate an AnalysisSpec's internal consistency.
 * Returns diagnostics for invalid attribute dependency references.
 */
export function validateSpec(
  spec: AnalysisSpec,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const attrNames = new Set(spec.attrs.map(a => a.name));

  for (const attr of spec.attrs) {
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
