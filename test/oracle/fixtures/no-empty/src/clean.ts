// no-empty — clean: all blocks have content

function nonEmptyIf(x: number) {
  if (x > 0) {
    return 1;
  }
  return 0;
}

function nonEmptyElse(x: number) {
  if (x > 0) {
    return 1;
  } else {
    return 0;
  }
}

export { nonEmptyIf, nonEmptyElse };
