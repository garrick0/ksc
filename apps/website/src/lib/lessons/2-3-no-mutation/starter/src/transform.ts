import type { NoMutation } from './kinds';

// These functions should use functional patterns — no mutation allowed.
// Run `npm run check` to find the violations.

export const sum: NoMutation & ((nums: number[]) => number) = (nums) => {
  let total = 0;
  for (const n of nums) {
    total += n;
  }
  return total;
};

export const incrementAll: NoMutation & ((nums: number[]) => number[]) = (nums) => {
  for (let i = 0; i < nums.length; i++) {
    nums[i] = nums[i] + 1;
  }
  return nums;
};

export const countdown: NoMutation & ((start: number) => number[]) = (start) => {
  const result: number[] = [];
  let current = start;
  while (current > 0) {
    result.push(current);
    current--;
  }
  return result;
};
