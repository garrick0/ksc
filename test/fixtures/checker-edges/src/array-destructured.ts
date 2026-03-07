/**
 * Array destructuring in parameter shadows the import.
 * Should NOT produce a violation.
 */
import type { NoImports } from './kinds';
import { helper } from './helpers';

export const f: NoImports & (([helper, b]: [number, number]) => number) = ([helper, b]) => helper + b;
