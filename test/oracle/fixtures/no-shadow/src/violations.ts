// no-shadow: variable shadowing — violation cases

const a = 1;

function foo(a: number) {
  return a;
}

function bar() {
  const b = 2;
  if (true) {
    const b = 3;
    console.log(b);
  }
}

export { a, foo, bar };
