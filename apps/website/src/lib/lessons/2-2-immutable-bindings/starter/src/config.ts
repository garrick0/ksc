import type { Immutable } from './kinds';

// These functions should use only const bindings internally.
// Run `npm run check` to find the violations.

export const buildGreeting: Immutable & ((name: string, title: string) => string) = (name, title) => {
  let greeting = `Hello, ${title} ${name}`;
  let suffix = '!';
  return greeting + suffix;
};

export const formatPrice: Immutable & ((amount: number, currency: string) => string) = (amount, currency) => {
  let formatted = amount.toFixed(2);
  let label = `${currency} ${formatted}`;
  return label;
};

export const buildList: Immutable & ((items: string[]) => string) = (items) => {
  let header = 'Items:';
  let body = items.join(', ');
  return `${header} ${body}`;
};
