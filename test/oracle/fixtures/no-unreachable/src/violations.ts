// no-unreachable: unreachable code — violation cases

function a() {
  return 1;
  const x = 2;
}

function b() {
  throw new Error("oops");
  const y = 3;
}

export { a, b };
