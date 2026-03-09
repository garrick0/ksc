import type { NoSideEffects } from './kinds';

export const pureCalc: NoSideEffects & ((x: number) => number) = (x) => x * 2 + 1;
