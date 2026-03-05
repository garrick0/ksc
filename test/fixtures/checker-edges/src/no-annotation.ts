/**
 * No Kind annotation — using imports should NOT produce a violation.
 */
import { helper } from './helpers';

export const f = (a: number) => helper(a);
