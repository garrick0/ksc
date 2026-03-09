import type { NoConsole } from './kinds';

export const add: NoConsole & ((a: number, b: number) => number) = (a, b) => a + b;
