/**
 * Attribute compilation: declaration + equation -> AttributeDef.
 *
 * This is the single point where domain (declaration), rules (equation),
 * and strategy (caching/evaluation mechanism) fuse into an installable
 * AttributeDef. The strategy is derived from the declaration's direction.
 */

import type { AttributeDef } from './types.js';
import type { AttrDecl, SynDecl, InhDecl, CircularDecl, CollectionDecl } from './decl.js';
import { installLazy } from './stamp.js';

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Compile a declaration + equation into an AttributeDef.
 *
 * @param name - Attribute name (for error messages)
 * @param decl - The attribute declaration (direction + domain metadata)
 * @param eq   - The equation (computation function or production map)
 */
export function compile<N extends object>(
  name: string,
  decl: AttrDecl,
  eq: unknown,
): AttributeDef<N> {
  switch (decl.direction) {
    case 'syn':
      return compileSyn<N>(name, decl, eq);
    case 'inh':
      return compileInh<N>(name, decl as InhDecl, eq);
    case 'circular':
      return compileCircular<N>(name, decl as CircularDecl, eq as (node: N) => any);
    case 'collection':
      return compileCollection<N>(name, decl as CollectionDecl, eq);
    case 'paramSyn':
      return compileParamSyn<N>(name, eq as (node: N, param: any) => any);
    default:
      throw new Error(`Unknown attribute direction: ${(decl as any).direction}`);
  }
}

// ── Syn ──────────────────────────────────────────────────────────────────

function compileSyn<N extends object>(
  name: string,
  decl: SynDecl,
  eq: unknown,
): AttributeDef<N> {
  const compute = typeof eq === 'function'
    ? eq as (node: N) => any
    : makeDispatch<N>(
        eq as Record<string, (node: any) => any>,
        decl.discriminant ?? 'kind',
      );

  if (decl.uncached) {
    return {
      install(node: N, key: string) {
        Object.defineProperty(node, key, {
          configurable: true,
          enumerable: true,
          get() { return compute(node); },
        });
      },
    };
  }

  return {
    install(node: N, key: string) {
      installLazy(node, key, compute);
    },
  };
}

function makeDispatch<N extends object>(
  equations: Record<string, (node: any) => any>,
  discriminant: string,
): (node: N) => any {
  return (node: N): any => {
    const key = (node as Record<string, unknown>)[discriminant] as string;
    const eq = equations[key];
    if (eq) return eq(node);
    if (equations._) return equations._(node);
    throw new Error(
      `match: no equation for '${key}' and no default '_' provided`,
    );
  };
}

// ── Inh ──────────────────────────────────────────────────────────────────

function compileInh<N extends object>(
  _name: string,
  decl: InhDecl,
  eq: unknown,
): AttributeDef<N> {
  const rootValue = decl.root;
  const parentEq = eq as
    | ((parent: N, child: N, childIndex: number) => any | undefined)
    | undefined;

  return {
    install(node: N, key: string) {
      installLazy(node, key, (n: N): any => {
        const na = n as any;

        // Root: use rootValue
        if (na.$root) {
          return typeof rootValue === 'function'
            ? (rootValue as (root: N) => any)(n)
            : rootValue;
        }

        const parent = na.$parent as N;
        const childIndex = na.$index as number;

        // If eq is provided, call it
        if (parentEq) {
          const result = parentEq(parent, n, childIndex);
          if (result !== undefined) return result;
        }

        // Auto-propagate: use parent's own value for this attribute
        return (parent as any)[key];
      });
    },
  };
}

// ── Circular (Magnusson-Hedin fixed-point) ───────────────────────────────

const CIRC_STATE = Symbol('ag:circular');

interface CycleEntry {
  node: any;
  key: string;
  compute: (node: any) => any;
  equals: (a: any, b: any) => boolean;
}

let inCycle = false;
let changed = false;
let cycleEntries: CycleEntry[] = [];

function compileCircular<N extends object>(
  _name: string,
  decl: CircularDecl,
  compute: (node: N) => any,
): AttributeDef<N> {
  const init = decl.bottom;
  const equals = decl.equals ?? ((a: any, b: any) => a === b);

  return {
    install(node: N, key: string) {
      Object.defineProperty(node, key, {
        configurable: true,
        enumerable: true,
        get() {
          const nodeAny = node as any;
          if (!nodeAny[CIRC_STATE]) {
            nodeAny[CIRC_STATE] = {};
          }
          const state = nodeAny[CIRC_STATE];

          // Already fully computed
          if (state[key]?.ready) return state[key].value;

          // Inside a cycle — return current approximation
          if (inCycle) {
            if (!state[key]) {
              state[key] = { value: init, ready: false };
              cycleEntries.push({ node, key, compute: compute as any, equals });
            }
            return state[key].value;
          }

          // We are the cycle driver — run Magnusson-Hedin fixed-point
          state[key] = { value: init, ready: false };
          cycleEntries = [{ node, key, compute: compute as any, equals }];
          inCycle = true;

          try {
            do {
              changed = false;
              const len = cycleEntries.length;
              for (let i = 0; i < len; i++) {
                const entry = cycleEntries[i];
                const entryState = (entry.node as any)[CIRC_STATE][entry.key];
                const newValue = entry.compute(entry.node);
                if (!entry.equals(entryState.value, newValue)) {
                  entryState.value = newValue;
                  changed = true;
                }
              }
              if (cycleEntries.length > len) changed = true;
            } while (changed);

            // Stamp final values as frozen data properties
            for (const entry of cycleEntries) {
              const entryState = (entry.node as any)[CIRC_STATE][entry.key];
              entryState.ready = true;
              Object.defineProperty(entry.node, entry.key, {
                value: entryState.value,
                writable: false,
                configurable: false,
                enumerable: true,
              });
            }

            return state[key].value;
          } finally {
            inCycle = false;
            cycleEntries = [];
          }
        },
      });
    },
  };
}

// ── Collection (bottom-up aggregation) ────────────────────────────────────

function compileCollection<N extends object>(
  name: string,
  decl: CollectionDecl,
  eq: unknown,
): AttributeDef<N> {
  const { initial, combine } = decl;

  // The equation is a contribution function (or production map).
  // It returns the node's own contribution, or `initial` for no contribution.
  const contribute = typeof eq === 'function'
    ? eq as (node: N) => any
    : typeof eq === 'object' && eq !== null
      ? makeDispatch<N>(
          eq as Record<string, (node: any) => any>,
          'kind',
        )
      : () => initial;

  return {
    install(node: N, key: string) {
      installLazy(node, key, (n: N): any => {
        // Start with this node's own contribution
        let result = contribute(n);

        // Combine with all children's collection values
        const kids: N[] = (n as any).$children ?? [];
        for (const child of kids) {
          const childValue = (child as any)[key];
          result = combine(result, childValue);
        }

        return result;
      });
    },
  };
}

// ── ParamSyn ─────────────────────────────────────────────────────────────

function compileParamSyn<N extends object>(
  _name: string,
  compute: (node: N, param: any) => any,
): AttributeDef<N> {
  return {
    install(node: N, key: string) {
      const cache = new Map<any, any>();
      Object.defineProperty(node, key, {
        value: (param: any): any => {
          if (cache.has(param)) return cache.get(param)!;
          const value = compute(node, param);
          cache.set(param, value);
          return value;
        },
        writable: false,
        configurable: false,
        enumerable: true,
      });
    },
  };
}
