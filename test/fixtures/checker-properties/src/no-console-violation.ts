import type { NoConsole } from './kinds';

export const logStuff: NoConsole & (() => void) = () => {
  console.log('hello');
};
