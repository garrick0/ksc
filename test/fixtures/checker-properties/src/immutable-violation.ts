import type { Immutable } from './kinds';

export const compute: Immutable & ((x: number) => number) = (x) => {
  let result = x;
  return result * 2;
};
