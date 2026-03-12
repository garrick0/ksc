/**
 * Equation utilities — helpers for adapter authors writing equation functions.
 *
 * Provides:
 *   - withDeps()     — attach dependency metadata to an equation function
 *   - collectDepsForAttr() — collect all dep names from an AttrDecl
 */

import type { AttrDecl, AttrExpr, EquationFn } from './ports.js';

/**
 * Attach dependency metadata to an equation function.
 * Mutates the function in place (preserves fn.name for import generation).
 */
export function withDeps<F extends EquationFn>(deps: string[], fn: F): F & { deps: string[] } {
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

  function addFromRecord(rec: Partial<Record<string, EquationFn>> | undefined) {
    if (!rec) return;
    for (const fn of Object.values(rec)) {
      if (fn && Array.isArray(fn.deps)) {
        for (const d of fn.deps!) deps.add(d);
      }
    }
  }

  switch (attr.direction) {
    case 'syn':
      addFromValue(attr.default);
      addFromRecord(attr.equations);
      break;
    case 'inh':
      addFromValue(attr.rootValue);
      addFromRecord(attr.parentEquations);
      break;
    case 'collection':
      addFromValue(attr.init);
      break;
  }

  return [...deps];
}
