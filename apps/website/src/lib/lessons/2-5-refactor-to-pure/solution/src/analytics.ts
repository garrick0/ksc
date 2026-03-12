import type { Pure } from './kinds';

// Analytics computations — pure functions with no imports, no console, no mutation.

export const computeAverage: Pure & ((values: number[]) => number) = (values) => {
  return values.length > 0
    ? values.reduce((acc, v) => acc + v, 0) / values.length
    : 0;
};

export const computeTotal: Pure & ((items: { price: number; qty: number }[]) => number) = (items) => {
  return items.reduce((acc, item) => acc + item.price * item.qty, 0);
};

export const formatSummary: Pure & ((name: string, value: number) => string) = (name, value) => {
  return `${name}: ${value.toFixed(2)}`;
};
