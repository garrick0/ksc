import type { NoConsole } from './kinds';

// These formatters produce structured strings without console side effects.

export const formatMessage: NoConsole & ((level: string, msg: string) => string) = (level, msg) => {
  return `[${level.toUpperCase()}] ${msg}`;
};

export const formatError: NoConsole & ((err: string, code: number) => string) = (err, code) => {
  return `ERROR-${code}: ${err}`;
};

export const formatWarning: NoConsole & ((msg: string) => string) = (msg) => {
  return `WARN: ${msg}`;
};
