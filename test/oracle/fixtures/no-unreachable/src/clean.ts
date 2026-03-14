// no-unreachable: reachable code — clean cases

function a() {
  const x = 2;
  return x;
}

function b() {
  if (Math.random() > 0.5) {
    return 1;
  }
  return 2;
}

export { a, b };
