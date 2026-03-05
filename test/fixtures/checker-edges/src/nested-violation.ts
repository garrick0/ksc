/**
 * Nested function referencing an import — should produce a violation.
 * `helper` inside the inner arrow is the imported function, not a local.
 */
import type { NoImports } from './kinds';
import { helper } from './helpers';

export const f: NoImports & ((a: number) => () => number) = (a) => {
  const inner = () => helper(a);
  return inner;
};
