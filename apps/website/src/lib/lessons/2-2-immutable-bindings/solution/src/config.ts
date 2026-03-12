import type { Immutable } from './kinds';

// These functions use only const bindings internally.

export const buildGreeting: Immutable & ((name: string, title: string) => string) = (name, title) => {
  const greeting = `Hello, ${title} ${name}`;
  const suffix = '!';
  return greeting + suffix;
};

export const formatPrice: Immutable & ((amount: number, currency: string) => string) = (amount, currency) => {
  const formatted = amount.toFixed(2);
  const label = `${currency} ${formatted}`;
  return label;
};

export const buildList: Immutable & ((items: string[]) => string) = (items) => {
  const header = 'Items:';
  const body = items.join(', ');
  return `${header} ${body}`;
};
