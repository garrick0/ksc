/**
 * Multiple imports — only the used ones should produce violations.
 */
import type { NoImports } from './kinds';
import { helper, other } from './helpers';

// Uses both `helper` and `other` — both should be violations
export const f: NoImports & ((a: number) => number) = (a) => helper(a) + other(a);

// Clean function — uses only parameters
export const g: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;
