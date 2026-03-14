// complexity: cyclomatic complexity > 2 — violation cases

function tooComplex(x: number, y: number) {
  if (x > 0) {
    if (y > 0) {
      return x + y;
    }
  }
  return 0;
}

export { tooComplex };
