// no-empty-interface: clean — non-empty or multi-extends

interface NonEmpty {
  x: number;
}

interface Base1 {
  a: string;
}

interface Base2 {
  b: number;
}

interface MultiExtends extends Base1, Base2 {}
