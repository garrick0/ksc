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

import type { AnalysisProjections, TypedAGNode } from '@kindscript/core-evaluator';
import type { KindDefinition, Diagnostic, KSCProjections } from './types.js';
import type { KSCAttrMap } from './generated/attr-types.js';
import { resetCounter } from './equations/definitions.js';
import { PROTOBUF_CHECKING_ENABLED } from './equations/protobuf.js';

export type { KSCProjections } from './types.js';

export const analysisProjections: AnalysisProjections<KSCAttrMap, KSCProjections> = {
  projections: {
    definitions: (root: TypedAGNode<KSCAttrMap>): KindDefinition[] =>
      root.children.flatMap(cu => cu.attr('kindDefs')),
    diagnostics: (root: TypedAGNode<KSCAttrMap>): Diagnostic[] => [
      ...root.attr('allViolations'),
      ...(PROTOBUF_CHECKING_ENABLED ? root.attr('allProtobufViolations') : []),
    ],
  },
  setup: resetCounter,
};
