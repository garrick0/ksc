import type { NoMutation } from './kinds';

export const pureAdd: NoMutation & ((a: number, b: number) => number) = (a, b) => a + b;
