/**
 * Nested function with outer parameter shadowing the import.
 * The inner function references `helper` which is the outer parameter, not the import.
 * Should NOT produce a violation.
 */
import type { NoImports } from './kinds';
import { helper } from './helpers';

export const f: NoImports & ((helper: number) => () => number) = (helper) => {
  const inner = () => helper + 1;
  return inner;
};
