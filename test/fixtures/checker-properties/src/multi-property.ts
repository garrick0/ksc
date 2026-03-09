import type { StrictFunc } from './kinds';
import { readFileSync } from 'fs';

// StrictFunc has noImports + noConsole + immutable + noMutation
// This should trigger violations for: console.log, let binding, assignment, import usage
export const messy: StrictFunc & (() => void) = () => {
  let x = 0;
  x = 1;
  console.log(x);
  readFileSync('/tmp/test', 'utf-8');
};
