import type { NoImports } from './kinds';
import { helper } from './helpers';

export const add: NoImports & ((a: number, b: number) => number) = (a, b) => helper(a) + b;
