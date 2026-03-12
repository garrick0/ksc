// no-empty-static-block: clean
class Foo {
  static x = 1;
  static {
    Foo.x = 2;
  }
}
