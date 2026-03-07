/**
 * Attribute type registry for KSC specs.
 *
 * Maps each attribute name to its computed value type.
 * Used by KSCDNode and the Ctx interface for typed attribute access:
 *   ctx.attr('kindDefs')  // => KindDefinition[]  (auto-typed!)
 */

import type { KindDefinition, CheckerDiagnostic } from './types.js';

/** All attributes declared across KSC specs (binder + checker). */
export interface KSCAttrMap {
  // Binder attributes
  kindDefs: KindDefinition[];
  defEnv: Map<string, KindDefinition>;
  defLookup: (name: string) => KindDefinition | undefined;

  // Checker attributes
  kindAnnotations: KindDefinition[];
  noImportsContext: KindDefinition | null;
  importViolation: CheckerDiagnostic | null;
  allViolations: CheckerDiagnostic[];
}
