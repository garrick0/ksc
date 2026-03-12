// no-useless-constructor: clean
class Foo {
  constructor(private x: number) {}
}
class Bar {
  x: number;
  constructor(x: number) {
    this.x = x;
  }
}
