import type { NoImports } from './kinds';

export type ModuleKind = NoImports;

export function handle(x: number): number {
  return x * 2;
}
