/** AUTO-GENERATED — do not edit. */
import type { KSNode, KindToNode } from '@ksc/language-mock/grammar/index.js';
import type { Ctx, KindCtx } from '@ksc/evaluation/index.js';
import type { DispatchConfig } from '@ksc/ag-ports';

// ── Dispatch functions ──
function dispatch_definitions(ctx: Ctx): never[] {
  return [];
}

function dispatch_diagnostics(ctx: Ctx): never[] {
  return [];
}

export const dispatchConfig: DispatchConfig = {
  definitions: { direction: 'syn', compute: dispatch_definitions },
  diagnostics: { direction: 'syn', compute: dispatch_diagnostics },
  nodeCount: { direction: 'collection', init: 1, combine: (acc, contrib) => acc + contrib },
};