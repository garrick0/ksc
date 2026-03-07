/**
 * Destructured parameter shadows the import.
 * Should NOT produce a violation — the destructured `helper` is a local param.
 */
import type { NoImports } from './kinds';
import { helper } from './helpers';

export const f: NoImports & (({helper}: {helper: number}) => number) = ({helper}) => helper + 1;
