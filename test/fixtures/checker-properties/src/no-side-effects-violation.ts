import type { NoSideEffects } from './kinds';

const sideEffect = (x: number) => { /* no-op */ };

export const worker: NoSideEffects & ((x: number) => number) = (x) => {
  sideEffect(x);
  return x * 2;
};
