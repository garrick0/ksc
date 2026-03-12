// no-useless-catch: violations
try {
  doSomething();
} catch (e) {
  throw e;
}
function doSomething() {}
