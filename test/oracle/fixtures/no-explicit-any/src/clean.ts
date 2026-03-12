// no-explicit-any — clean: uses unknown instead

const x: unknown = 1;

function foo(a: unknown): unknown {
  return a;
}

function bar(items: unknown[]) {
  return (items as { length: number }).length;
}

export { x, foo, bar };
