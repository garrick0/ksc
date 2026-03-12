// no-var — clean: only let and const

const x = 1;
let y = 'hello';

function foo() {
  const z = true;
  return z;
}

export { x, y, foo };
