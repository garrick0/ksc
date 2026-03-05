/**
 * Parameter shadowing: the parameter name `helper` shadows the import.
 * Should NOT produce a violation.
 */
import type { NoImports } from './kinds';
import { helper } from './helpers';

export const f: NoImports & ((helper: number) => number) = (helper) => helper + 1;
