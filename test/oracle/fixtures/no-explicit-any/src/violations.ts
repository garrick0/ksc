// no-explicit-any — violations: uses any type

const x: any = 1;

function foo(a: any): any {
  return a;
}

function bar(items: any[]) {
  return items.length;
}

export { x, foo, bar };
