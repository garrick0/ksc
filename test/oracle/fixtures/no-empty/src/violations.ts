// no-empty — violations: empty block statements

function emptyIf(x: number) {
  if (x > 0) {
  }
  return x;
}

function emptyElse(x: number) {
  if (x > 0) {
    return 1;
  } else {
  }
  return 0;
}

export { emptyIf, emptyElse };
