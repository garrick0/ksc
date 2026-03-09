// Interfaces, type aliases, mapped types, conditional types

export interface Container<T> {
  value: T;
  readonly label: string;
  transform(input: T): T;
}

export interface Disposable {
  dispose(): void;
}

export type Mapper<A, B> = (input: A) => B;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type Readonly2<T> = { readonly [K in keyof T]: T[K] };

export type IsString<T> = T extends string ? true : false;

export type IndexOf<T, K extends keyof T> = T[K];

export type Nullable<T> = T | null | undefined;

export enum Color {
  Red = 0,
  Green = 1,
  Blue = 2,
}

export const enum Direction {
  Up = 'UP',
  Down = 'DOWN',
}
