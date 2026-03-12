// consistent-type-definitions: clean — interfaces and non-object type aliases

interface Foo {
  x: number;
  y: string;
}

type Union = string | number;
type Primitive = string;
type Callback = () => void;
