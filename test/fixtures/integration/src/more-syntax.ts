// Additional syntax constructs for integration test coverage

import { add } from './utils';

// --- for await...of ---
async function* asyncNumbers(): AsyncGenerator<number> {
  yield 1;
  yield 2;
  yield 3;
}

export async function consumeAsync(): Promise<number> {
  let total = 0;
  for await (const n of asyncNumbers()) {
    total += n;
  }
  return total;
}

// --- debugger statement ---
export function withDebugger(): void {
  debugger;
}

// --- import.meta ---
export function getMetaUrl(): string {
  return import.meta.url;
}

// --- export default function ---
export default function defaultFunction(): string {
  return 'default';
}

// --- Computed enum members ---
export enum ComputedEnum {
  A = 1 + 2,
  B = 'hello'.length,
  C = A * 2,
}

// --- typeof import() in type position (exercises ImportType with isTypeOf) ---
export type UtilsModule = typeof import('./utils');

// --- import() in type position without typeof (isTypeOf = false) ---
export type UtilsPromise = import('./utils').default;

// --- Empty interface (no members) ---
export interface Empty {}

// --- Void return type ---
export type VoidFn = () => void;

// --- Never return type ---
export function throwAlways(): never {
  throw new Error('always');
}

// --- Type predicate ---
export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

// --- Assertion function with asserts ---
export function assertNumber(x: unknown): asserts x is number {
  if (typeof x !== 'number') throw new Error('not number');
}
