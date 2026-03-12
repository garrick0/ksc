// max-params: functions with more than 3 parameters

function tooMany(a: number, b: number, c: number, d: number) {
  return a + b + c + d;
}

const arrowTooMany = (a: number, b: number, c: number, d: number) => a + b + c + d;

class MyClass {
  method(a: number, b: number, c: number, d: number) {
    return a + b + c + d;
  }
}
