import type { NoConsole } from './kinds';

// These formatters should produce structured strings without console side effects.
// Run `npm run check` to find the violations.

export const formatMessage: NoConsole & ((level: string, msg: string) => string) = (level, msg) => {
  console.log(`Formatting: ${msg}`);
  return `[${level.toUpperCase()}] ${msg}`;
};

export const formatError: NoConsole & ((err: string, code: number) => string) = (err, code) => {
  console.error(`Error ${code}: ${err}`);
  return `ERROR-${code}: ${err}`;
};

export const formatWarning: NoConsole & ((msg: string) => string) = (msg) => {
  console.warn(`Warning: ${msg}`);
  return `WARN: ${msg}`;
};
