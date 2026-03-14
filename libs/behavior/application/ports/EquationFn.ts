/**
 * Typed equation function: receives context, returns attribute value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EquationFn<T = unknown> = ((ctx: any, ...args: any[]) => T) & { deps?: string[] };

/** Per-kind equation map: kind → equation function. */
export type EquationMap<K extends string, T = unknown> = Partial<Record<K, EquationFn<T>>>;

/**
 * Equation map with per-kind ctx narrowing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TypedEquationMap<
  K extends string,
  CtxMap extends Partial<Record<K, unknown>>,
  T = unknown,
> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [Kind in K]?: ((ctx: Kind extends keyof CtxMap ? CtxMap[Kind] : unknown, ...args: any[]) => T) & { deps?: string[] };
};
