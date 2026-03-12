import type { StrictValue } from './kinds';

// A configuration service — immutable, console-free, and mutation-free.

export const buildEndpoint: StrictValue & ((base: string, path: string) => string) = (base, path) => {
  const url = `${base}/${path}`;
  return url;
};

export const buildHeaders: StrictValue & ((token: string) => Record<string, string>) = (token) => {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};
