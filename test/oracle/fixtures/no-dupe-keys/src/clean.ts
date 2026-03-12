// no-dupe-keys: clean — no duplicate keys

const a = { x: 1, y: 2, z: 3 };
const b = { foo: 'a', bar: 'b', baz: 'c' };
const c = { [Symbol.iterator]: 1 }; // computed key — not checked
