/**
 * Equation utilities — helpers for adapter authors writing equation functions.
 *
 * Provides:
 *   - EquationFn     — equation function with optional dep metadata
 *   - withDeps()     — attach dependency metadata to an equation function
 *   - collectDepsForAttr() — collect all dep names from an AttrDecl
 */

import type { AttrDecl, AttrExpr } from './types.js';

/** An equation function with optional dependency metadata attached by withDeps(). */
export interface EquationFn {
  (...args: unknown[]): unknown;
  deps?: string[];
}

/**
 * Attach dependency metadata to an equation function.
 * Mutates the function in place (preserves fn.name for import generation).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withDeps<F extends (...args: any[]) => any>(deps: string[], fn: F): F & { deps: string[] } {
  (fn as EquationFn).deps = deps;
  return fn as F & { deps: string[] };
}

/**
 * Collect all dependency names for an attribute by reading .deps from
 * all Function-typed values in the attr declaration.
 */
export function collectDepsForAttr(attr: AttrDecl): string[] {
  const deps = new Set<string>();

  function addFromValue(v: AttrExpr | undefined) {
    if (typeof v === 'function' && Array.isArray((v as EquationFn).deps)) {
      for (const d of (v as EquationFn).deps!) deps.add(d);
    }
  }

  function addFromRecord(rec: Partial<Record<string, Function>> | undefined) {
    if (!rec) return;
    for (const fn of Object.values(rec)) {
      if (fn && Array.isArray((fn as EquationFn).deps)) {
        for (const d of (fn as EquationFn).deps!) deps.add(d);
      }
    }
  }

  switch (attr.direction) {
    case 'syn':
      addFromValue(attr.default);
      addFromRecord(attr.equations as Partial<Record<string, Function>> | undefined);
      break;
    case 'inh':
      addFromValue(attr.rootValue);
      addFromRecord(attr.parentEquations as Partial<Record<string, Function>> | undefined);
      break;
    case 'collection':
      addFromValue(attr.init);
      break;
  }

  return [...deps];
}
