import { helper } from './helper';

export function greet(name: string): string {
  const msg = helper(name);
  let count = 0;
  count++;
  return msg;
}

export class Counter {
  value = 0;
  increment() { this.value++; }
}

const internal = (x: number) => x * 2;
