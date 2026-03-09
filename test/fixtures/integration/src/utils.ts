// Utility functions and constants — imported by main.ts

export function add(a: number, b: number): number {
  return a + b;
}

export function identity<T>(x: T): T {
  return x;
}

export async function fetchData(url: string): Promise<string> {
  return url;
}

export function* range(start: number, end: number): Generator<number> {
  for (let i = start; i < end; i++) {
    yield i;
  }
}

export const VERSION = '1.0.0';

export default class Logger {
  constructor(public name: string) {}
  log(msg: string): void {
    console.log(`[${this.name}] ${msg}`);
  }
}
