// array-type: using Array<T> instead of T[]

const a: Array<number> = [1, 2, 3];
const b: Array<string> = ['a', 'b'];

function f(x: Array<boolean>): Array<number> {
  return [];
}
