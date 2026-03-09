import type { Static } from './kinds';

export const staticFunc: Static & ((x: number) => number) = (x) => x * 2;
