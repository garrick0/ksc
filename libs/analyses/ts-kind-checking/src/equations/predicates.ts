/**
 * Violation detection constants and helpers for the kind-checking analysis.
 *
 * Provides:
 *   ASSIGNMENT_OPS   — operator tokens that represent assignments
 *   IO_MODULES       — Node.js modules considered I/O
 *   SIDE_EFFECT_EXPR_KINDS — expression kinds considered side-effectful
 *   getKindCtx()     — retrieve the active KindDefinition for a property
 *   diag()           — construct a Diagnostic from a violation
 */

import type { KindDefinition, Diagnostic } from '../types.js';
import type { Ctx, KindCtx } from '@ksc/evaluation/domain/evaluator-index.js';
import type { TSNodeKind, KSNode } from '@ksc/language-ts-ast/grammar/index.js';
import { sumTypeMembers } from '@ksc/language-ts-ast/grammar/index.js';

// ── Violation predicate constants ────────────────────────────────────
// Derived from grammar sum types — auto-update when grammar changes.

export const ASSIGNMENT_OPS: ReadonlySet<TSNodeKind> = new Set<TSNodeKind>(
  sumTypeMembers['AssignmentOperator'] as TSNodeKind[],
);

export const IO_MODULES = new Set([
  'fs', 'fs/promises', 'path', 'net', 'http', 'https',
  'child_process', 'cluster', 'dgram', 'dns', 'tls',
  'crypto', 'zlib', 'stream', 'readline', 'worker_threads',
  'node:fs', 'node:fs/promises', 'node:path', 'node:net',
  'node:http', 'node:https', 'node:child_process', 'node:cluster',
  'node:dgram', 'node:dns', 'node:tls', 'node:crypto', 'node:zlib',
  'node:stream', 'node:readline', 'node:worker_threads',
]);

export const SIDE_EFFECT_EXPR_KINDS: ReadonlySet<TSNodeKind> = new Set<TSNodeKind>(
  sumTypeMembers['SideEffectExpression'] as TSNodeKind[],
);

// ── Violation helpers ────────────────────────────────────────────────

export function getKindCtx(ctx: Ctx, property: string): KindDefinition | null {
  return ctx.attr('contextFor', property) as KindDefinition | null;
}

export function diag(ctx: KindCtx<KSNode>, def: KindDefinition, property: string, message: string): Diagnostic {
  return {
    node: ctx.node,
    message,
    kindName: def.name,
    property,
    pos: ctx.node.pos,
    end: ctx.node.end,
    fileName: ctx.findFileName(),
  };
}
