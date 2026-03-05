/**
 * Type-only imports should not count as value imports.
 * No violations expected.
 */
import type { NoImports } from './kinds';

export const f: NoImports & ((a: number) => number) = (a) => a + 1;
