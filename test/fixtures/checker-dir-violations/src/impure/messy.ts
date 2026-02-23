// This file violates multiple constraints:
// - Uses console (noConsole violation)
// - Has let declaration at module scope (immutable violation)
// - Has a top-level function call (noSideEffects violation)

let counter = 0;

console.log('module loaded');

export function increment() {
  return ++counter;
}
