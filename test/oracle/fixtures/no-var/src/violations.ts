// no-var — violations: uses var

var x = 1;
var y = 'hello';

function foo() {
  var z = true;
  return z;
}

export { x, y, foo };
