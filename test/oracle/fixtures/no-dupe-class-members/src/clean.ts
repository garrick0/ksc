// no-dupe-class-members: clean
class Foo {
  bar() { return 1; }
  baz() { return 2; }
  get x() { return 1; }
  set x(v: number) { /* empty */ v; }
}
