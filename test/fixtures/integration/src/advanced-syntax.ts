// Advanced syntax: decorators, abstract, private fields, overloads, index signatures, etc.

// --- Abstract class ---
export abstract class Shape {
  abstract area(): number;
  abstract perimeter(): number;

  describe(): string {
    return `Area: ${this.area()}, Perimeter: ${this.perimeter()}`;
  }
}

export class Circle extends Shape {
  constructor(public radius: number) {
    super();
  }

  area(): number {
    return Math.PI * this.radius ** 2;
  }

  perimeter(): number {
    return 2 * Math.PI * this.radius;
  }
}

// --- Private fields (#) ---
export class Counter {
  #count = 0;
  #max: number;

  constructor(max: number) {
    this.#max = max;
  }

  increment(): boolean {
    if (this.#count >= this.#max) return false;
    this.#count++;
    return true;
  }

  get value(): number {
    return this.#count;
  }
}

// --- Overloaded function signatures ---
export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}

// --- Index signatures ---
export interface StringMap {
  [key: string]: string;
}

export interface NumberTuple {
  [index: number]: number;
  length: number;
}

// --- Construct signatures ---
export interface Constructable {
  new (name: string): { name: string };
}

// --- Declare / ambient ---
declare const __VERSION__: string;
declare function __log__(msg: string): void;

// --- Assertion functions ---
export function assertDefined<T>(val: T | undefined): asserts val is T {
  if (val === undefined) throw new Error('undefined');
}

// --- Accessor keyword (ES2022) ---
export class Observed {
  accessor value: number = 0;
}

// --- Satisfies expressions ---
const palette = {
  red: [255, 0, 0],
  green: '#00ff00',
} satisfies Record<string, string | number[]>;

// --- Conditional types with infer ---
export type ReturnOf<T> = T extends (...args: any[]) => infer R ? R : never;
export type ElementType<T> = T extends (infer E)[] ? E : T;

// --- Template literal types ---
export type EventName = `on${Capitalize<'click' | 'hover'>}`;

// --- Mapped type with modifiers ---
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export type Required2<T> = { [K in keyof T]-?: T[K] };

// --- Intersection types ---
export type Named = { name: string } & { id: number };

// --- Tuple types ---
export type Pair<A, B> = [A, B];
export type NamedTuple = [first: string, second: number];

// --- Optional tuple elements ---
export type OptionalTuple = [string, number?];

// --- Rest elements in tuples ---
export type RestTuple = [string, ...number[]];

// --- Typeof in type position ---
const sample = { x: 1, y: 2 };
export type SampleType = typeof sample;

// --- Keyof ---
export type SampleKeys = keyof typeof sample;

// --- Indexed access types ---
export type XType = (typeof sample)['x'];

// --- BigInt literal ---
const big = 100n;

// --- Regex literal ---
const re = /^test\d+$/gi;
