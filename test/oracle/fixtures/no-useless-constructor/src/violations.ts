// no-useless-constructor: violations
class Foo {
  constructor() {}
}
class Bar extends Base {
  constructor(x: number) {
    super(x);
  }
}
class Base {
  constructor(x: number) { this.init(x); }
  init(x: number) { return x; }
}
