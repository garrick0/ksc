import type { Grammar, AttributeDepGraph } from '@ksc/grammar/index.js';
import type { AnalysisDecl, AttrDecl, AttrExpr } from '../domain/ports.js';
import type { DispatchConfig } from '@ksc/ag-ports';
import { isCodeLiteral } from '../domain/ports.js';
import { buildDepGraph } from './compile.js';

function resolveExpr(expr: AttrExpr): any {
  if (typeof expr === 'function') {
    return expr;
  }
  if (expr === null || typeof expr === 'number' || typeof expr === 'boolean') {
    return () => expr;
  }
  if (isCodeLiteral(expr)) {
    try {
      // eslint-disable-next-line no-new-func
      return new Function('ctx', `return ${expr.code};`);
    } catch (e) {
      throw new Error(`Failed to compile code literal at runtime: ${expr.code}. Error: ${e}`);
    }
  }
  return () => undefined;
}

function resolveStaticValue(expr: AttrExpr): any {
  if (isCodeLiteral(expr)) {
    // eslint-disable-next-line no-new-func
    return new Function(`return ${expr.code};`)();
  }
  return expr;
}

export function buildDispatchFromDecl<K extends string>(
  grammar: Grammar<K>,
  decl: AnalysisDecl<K>,
): { dispatch: DispatchConfig; depGraph: AttributeDepGraph } {
  const dispatch: DispatchConfig = {};

  for (const attr of decl.attrs) {
    switch (attr.direction) {
      case 'syn': {
        const defaultFn = attr.default !== undefined ? resolveExpr(attr.default) : undefined;
        const eqMap = (attr.equations ?? {}) as Record<string, Function>;
        
        dispatch[attr.name] = {
          direction: 'syn' as const,
          compute: attr.parameter
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (ctx: any, param: unknown) => {
                const eq = eqMap[ctx.node.kind];
                if (eq) return eq(ctx, param);
                if (defaultFn) return defaultFn(ctx, param);
                throw new Error(`Unhandled kind '${ctx.node.kind}' for syn attr '${attr.name}'`);
              }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (ctx: any) => {
                const eq = eqMap[ctx.node.kind];
                if (eq) return eq(ctx);
                if (defaultFn) return defaultFn(ctx);
                throw new Error(`Unhandled kind '${ctx.node.kind}' for syn attr '${attr.name}'`);
              },
        };
        break;
      }
      case 'inh': {
        const rootFn = resolveExpr(attr.rootValue);
        const parentEqMap = (attr.parentEquations ?? {}) as Record<string, Function>;
        
        dispatch[attr.name] = {
          direction: 'inh' as const,
          computeRoot: rootFn,
          computeParent: Object.keys(parentEqMap).length > 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (ctx: any, ...args: unknown[]) => {
                const pKind = ctx.parent!.node.kind;
                const eq = parentEqMap[pKind];
                return eq ? eq(ctx, ...args) : undefined;
              }
            : undefined,
        };
        break;
      }
      case 'collection': {
        const initVal = resolveStaticValue(attr.init);
        const combineFn = resolveStaticValue(attr.combine);
        
        dispatch[attr.name] = {
          direction: 'collection' as const,
          init: initVal,
          combine: combineFn,
        };
        break;
      }
    }
  }

  const depGraph = buildDepGraph(decl.attrs);
  return { dispatch, depGraph };
}
