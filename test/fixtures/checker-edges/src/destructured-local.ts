/**
 * Destructured local variable shadows the import.
 * Should NOT produce a violation — the destructured `helper` is a local binding.
 */
import type { NoImports } from './kinds';
import { helper } from './helpers';

export const f: NoImports & ((a: number) => number) = (a) => {
  const { helper } = { helper: (x: number) => x * 10 };
  return helper(a);
};
