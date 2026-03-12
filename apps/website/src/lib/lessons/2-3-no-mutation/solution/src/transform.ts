import type { NoMutation } from './kinds';

// These functions use functional patterns — no mutation.

export const sum: NoMutation & ((nums: number[]) => number) = (nums) => {
  return nums.reduce((acc, n) => acc + n, 0);
};

export const incrementAll: NoMutation & ((nums: number[]) => number[]) = (nums) => {
  return nums.map((n) => n + 1);
};

export const countdown: NoMutation & ((start: number) => number[]) = (start) => {
  return Array.from({ length: start }, (_, i) => start - i);
};
