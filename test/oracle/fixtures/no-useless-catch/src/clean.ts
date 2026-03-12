// no-useless-catch: clean — catch does something useful
try {
  doSomething();
} catch (e) {
  console.error(e);
  throw new Error('wrapped');
}
function doSomething() {}
