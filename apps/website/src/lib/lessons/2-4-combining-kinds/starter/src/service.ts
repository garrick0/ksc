import type { StrictValue } from './kinds';

// A configuration service where values must be immutable, console-free, and mutation-free.
// Run `npm run check` to find the violations.

export const buildEndpoint: StrictValue & ((base: string, path: string) => string) = (base, path) => {
  let url = `${base}/${path}`;
  console.log(`Building endpoint: ${url}`);
  return url;
};

export const buildHeaders: StrictValue & ((token: string) => Record<string, string>) = (token) => {
  const headers: Record<string, string> = {};
  headers['Authorization'] = `Bearer ${token}`;
  headers['Content-Type'] = 'application/json';
  return headers;
};
