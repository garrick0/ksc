// no-shadow: no shadowing — clean cases

const x = 1;

function foo(y: number) {
  return y;
}

function bar() {
  const a = 2;
  if (true) {
    const b = 3;
    console.log(b);
  }
}

export { x, foo, bar };
