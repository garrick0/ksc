import type { NoMutation } from './kinds';

export const mutator: NoMutation & ((x: number) => number) = (x) => {
  let y = x;
  y = y + 1;
  y++;
  return y;
};
