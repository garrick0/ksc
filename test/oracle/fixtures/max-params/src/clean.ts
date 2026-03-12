// max-params: clean — 3 or fewer parameters

function ok(a: number, b: number, c: number) {
  return a + b + c;
}

const arrowOk = (a: number) => a * 2;

class MyClass {
  method(a: number, b: number) {
    return a + b;
  }
}
