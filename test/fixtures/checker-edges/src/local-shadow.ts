/**
 * Local variable shadows the import.
 * `helper` inside the body is a local const, not the import.
 * Should NOT produce a violation.
 */
import type { NoImports } from './kinds';
import { helper } from './helpers';

export const f: NoImports & ((a: number) => number) = (a) => {
  const helper = (x: number) => x * 10;
  return helper(a);
};
