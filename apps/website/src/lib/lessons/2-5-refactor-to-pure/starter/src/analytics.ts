import type { Pure } from './kinds';
import { formatEvent } from './format';

// Analytics computations should be pure — no imports, no console, no mutation.
// Run `npm run check` to find the violations.

export const computeAverage: Pure & ((values: number[]) => number) = (values) => {
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return values.length > 0 ? sum / values.length : 0;
};

export const computeTotal: Pure & ((items: { price: number; qty: number }[]) => number) = (items) => {
  let total = 0;
  for (const item of items) {
    total += item.price * item.qty;
  }
  console.log(`Total: ${total}`);
  return total;
};

export const formatSummary: Pure & ((name: string, value: number) => string) = (name, value) => {
  return formatEvent(name, value);
};
