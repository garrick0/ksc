import type { NoIO } from './kinds';

export const add: NoIO & ((a: number, b: number) => number) = (a, b) => a + b;
