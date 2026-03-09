import type { Immutable } from './kinds';

export const double: Immutable & ((x: number) => number) = (x) => {
  const result = x * 2;
  return result;
};
