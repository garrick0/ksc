// Comprehensive fixture exercising many TS syntax forms

import { add, identity, range } from './utils';
import type { Container, Color, Mapper, Result } from './types';
import Logger from './utils';

// --- Variable declarations (var / let / const) ---
var globalCounter = 0;
let mutableValue = 'hello';
const CONSTANT = 42;

// --- Arrow functions ---
const double = (x: number): number => x * 2;
const noop = () => {};

// --- Exported function with destructuring + rest + default ---
export function processItems(
  { name, count = 0 }: { name: string; count?: number },
  ...rest: string[]
): string[] {
  const results: string[] = [];

  // For loop
  for (let i = 0; i < count; i++) {
    results.push(`${name}-${i}`);
  }

  // For-of
  for (const item of rest) {
    results.push(item);
  }

  // For-in
  const obj: Record<string, number> = { a: 1 };
  for (const key in obj) {
    results.push(key);
  }

  // While
  let w = 0;
  while (w < 2) {
    w++;
  }

  // Do-while
  do {
    w--;
  } while (w > 0);

  // Switch
  switch (name) {
    case 'special':
      results.push('found');
      break;
    default:
      results.push('other');
  }

  // Try-catch-finally
  try {
    const val = JSON.parse('{}');
  } catch (e) {
    throw new Error('parse failed');
  } finally {
    mutableValue = 'done';
  }

  // If-else
  if (count > 10) {
    return results;
  } else {
    return [...results, ...rest];
  }
}

// --- Labeled statement + break/continue ---
export function labeledLoop(): number {
  let sum = 0;
  outer: for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      if (j === 3) continue outer;
      if (i === 4) break outer;
      sum += i + j;
    }
  }
  return sum;
}

// --- Class with many member types ---
export class Widget implements Container<number> {
  value = 0;
  readonly label: string;
  private _cache: Map<string, number> = new Map();
  static instanceCount = 0;

  constructor(label: string) {
    this.label = label;
    Widget.instanceCount++;
  }

  transform(input: number): number {
    return input * 2;
  }

  get cached(): number {
    return this._cache.size;
  }

  set size(val: number) {
    this.value = val;
  }

  async loadData(url: string): Promise<string> {
    const result = await identity(url);
    return result;
  }

  *generateIds(): Generator<number> {
    yield 1;
    yield 2;
    yield 3;
  }
}

// --- Namespace ---
export namespace MathUtils {
  export function clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }
}

// --- Expressions ---
export function expressions(a: number, b: number): void {
  // Binary operators
  const sum = a + b;
  const diff = a - b;
  const prod = a * b;
  const div = a / b;
  const mod = a % b;
  const exp = a ** b;
  const cmp = a > b;
  const eq = a === b;
  const neq = a !== b;
  const and = a > 0 && b > 0;
  const or = a > 0 || b > 0;
  const bitor = a | b;
  const bitand = a & b;
  const bitxor = a ^ b;
  const shl = a << 1;
  const shr = a >> 1;
  const ushr = a >>> 1;

  // Assignment operators
  let x = a;
  x += 1;
  x -= 1;
  x *= 2;
  x /= 2;
  x %= 3;
  x **= 2;
  x &&= 1;
  x ||= 0;
  x ??= 5;

  // Prefix / postfix unary
  x++;
  x--;
  ++x;
  --x;
  const neg = -a;
  const pos = +a;
  const not = !cmp;
  const bitnot = ~a;

  // Conditional (ternary)
  const flag = a > 0 ? true : false;

  // Template literal
  const msg = `sum is ${sum}`;

  // Type assertion (as)
  const val = ({} as Container<string>);

  // Non-null assertion
  const arr: number[] | undefined = [1, 2];
  const first = arr!.length;

  // Optional chaining + nullish coalescing
  const obj: { a?: { b: number } } | undefined = { a: { b: 1 } };
  const safe = obj?.a?.b ?? 0;

  // Typeof / void / delete
  const t = typeof a;
  void 0;
  const o: Record<string, number> = { k: 1 };
  delete o['k'];

  // Comma expression
  const comma = (1, 2, 3);

  // Parenthesized
  const paren = (a + b) * 2;

  // Array / object literals
  const ary = [1, 2, ...arr!];
  const obj2 = { x: 1, y: 2, [msg]: 3 };

  // New expression
  const w = new Widget('test');

  // Element access
  const e = ary[0];

  // Property access
  const l = ary.length;

  // Spread in call
  add(...[1, 2] as [number, number]);

  // Tagged template
  function tag(strings: TemplateStringsArray, ...values: unknown[]) {
    return strings.join('');
  }
  const tagged = tag`hello ${'world'}`;
}

// --- Destructuring ---
export function destructuring(): void {
  // Array destructuring with rest
  const [first, second, ...remaining] = [1, 2, 3, 4, 5];

  // Object destructuring with rename and default
  const { a: renamed, b = 10, ...rest } = { a: 1, c: 3 };

  // Nested destructuring
  const { x: { y } } = { x: { y: 42 } };

  // Function parameter destructuring
  const fn = ([a, b]: [number, number]) => a + b;
}

// --- Generics ---
export function mapResult<T, U>(
  result: Result<T>,
  mapper: Mapper<T, U>,
): Result<U> {
  if (result.ok) {
    return { ok: true, value: mapper(result.value) };
  }
  return result;
}

// --- Type assertions and satisfies ---
export function typeExpressions(): void {
  const a = 42 as const;
  const b = 'hello' satisfies string;
  const c: unknown = 'test';
  const d = c as string;
}

// --- Dynamic import (to exercise CallExpression with ImportKeyword) ---
export async function dynamicLoad() {
  const mod = await import('./utils');
  return mod.VERSION;
}

// --- Regular expression ---
const pattern = /^hello\s+world$/gi;

// --- Cross-file usage (import verification) ---
export function crossFileUsage(): number {
  const logger = new Logger('test');
  logger.log('started');

  const sum = add(1, 2);
  const id = identity(42);

  let total = 0;
  for (const n of range(0, 5)) {
    total += n;
  }

  return total + sum + id;
}
