// no-debugger — violations: uses debugger statement

function processData(input: number) {
  debugger;
  return input * 2;
}

export { processData };
