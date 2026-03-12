import type { NoImports } from './kinds';

export const add: NoImports & ((a: number, b: number) => number) = (a, b) => a + b;

export const multiply: NoImports & ((a: number, b: number) => number) = (a, b) => a * b;
