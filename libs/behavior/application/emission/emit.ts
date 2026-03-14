import type {
  AttrDecl,
  SynAttr,
  InhAttr,
  CollectionAttr,
  AttrExpr,
  ParamDef,
  EquationFn,
} from '../../domain/ports.js';
import { isCodeLiteral } from '../../domain/ports.js';
import type { BehaviorPlan } from '../../domain/plan.js';
import type { GeneratedFile, GeneratedImports, CompiledAnalyzer } from '../../domain/types.js';

// ── AttrExpr → generated code ───────────────────────────────────────

function emitExpr(value: AttrExpr, param?: ParamDef, kind?: string): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (isCodeLiteral(value)) return value.code;
  const ctx = kind ? `ctx as unknown as KindCtx<KindToNode['${kind}']>` : 'ctx';
  if (param) return `${value.name}(${ctx}, ${param.name})`;
  return `${value.name}(${ctx})`;
}

// ── Collect equation function names for auto-import ─────────────────

function collectEquationFunctions(attrs: AttrDecl[]): Set<string> {
  const names = new Set<string>();
  function addIfFn(v: AttrExpr | undefined) {
    if (typeof v === 'function' && v.name) names.add(v.name);
  }
  for (const attr of attrs) {
    switch (attr.direction) {
      case 'syn':
        addIfFn(attr.default);
        if (attr.equations) {
          for (const fn of Object.values(attr.equations)) {
            if (fn && fn.name) names.add(fn.name);
          }
        }
        break;
      case 'inh':
        addIfFn(attr.rootValue);
        if (attr.parentEquations) {
          for (const fn of Object.values(attr.parentEquations)) {
            if (fn && fn.name) names.add(fn.name);
          }
        }
        break;
      case 'collection':
        addIfFn(attr.init);
        break;
    }
  }
  return names;
}

// ── Per-attribute dispatch function generation ───────────────────────

function generateSynDispatch(L: string[], a: SynAttr, allKinds?: ReadonlySet<string>): void {
  const p = a.parameter;
  const equations = a.equations as Record<string, EquationFn> | undefined;
  const hasDefault = a.default !== undefined;
  const hasEquations = equations && Object.keys(equations).length > 0;

  const params = p ? `ctx: Ctx, ${p.name}: ${p.type}` : 'ctx: Ctx';
  L.push(`function dispatch_${a.name}(${params}): ${a.type} {`);

  if (hasEquations) {
    const equationKinds = new Set(Object.keys(equations!));
    const exhaustive = allKinds && allKinds.size > 0;
    const remainingKinds = exhaustive
      ? [...allKinds].filter(k => !equationKinds.has(k)).sort()
      : [];

    if (exhaustive) {
      L.push(`  const _kind = (ctx.node as KSNode).kind;`);
    }
    L.push(`  switch (${exhaustive ? '_kind' : '(ctx.node as KSNode).kind'}) {`);

    for (const [kind, fn] of Object.entries(equations!)) {
      L.push(`    case '${kind}': return ${emitExpr(fn, p, kind)};`);
    }

    if (exhaustive) {
      if (hasDefault && remainingKinds.length > 0) {
        for (const kind of remainingKinds) {
          L.push(`    case '${kind}':`);
        }
        L.push(`      return ${emitExpr(a.default!, p)};`);
      }
      L.push(`    default: { const _exhaustive: never = _kind; throw new Error(\`Unhandled kind: \${_exhaustive}\`); }`);
    } else {
      L.push(`    default: return ${emitExpr(a.default!, p)};`);
    }
    L.push(`  }`);
  } else {
    L.push(`  return ${emitExpr(a.default!, p)};`);
  }
  L.push(`}`);
  L.push(``);
}

function generateInhRootDispatch(L: string[], a: InhAttr): void {
  const p = a.parameter;
  const params = p ? `ctx: Ctx, ${p.name}: ${p.type}` : 'ctx: Ctx';
  L.push(`function dispatch_${a.name}_root(${params}): ${a.type} {`);
  L.push(`  return ${emitExpr(a.rootValue, p)};`);
  L.push(`}`);
  L.push(``);
}

function generateInhParentDispatch(L: string[], a: InhAttr, allKinds?: ReadonlySet<string>): void {
  const parentEquations = a.parentEquations as Record<string, EquationFn> | undefined;
  if (!parentEquations || Object.keys(parentEquations).length === 0) return;

  const p = a.parameter;
  const params = p ? `ctx: Ctx, ${p.name}: ${p.type}` : 'ctx: Ctx';

  L.push(`function dispatch_${a.name}_parent(${params}): ${a.type} | undefined {`);

  const equationKinds = new Set(Object.keys(parentEquations));
  const exhaustive = allKinds && allKinds.size > 0;
  const remainingKinds = exhaustive
    ? [...allKinds].filter(k => !equationKinds.has(k)).sort()
    : [];

  L.push(`  const _pKind = (ctx.parent!.node as KSNode).kind;`);
  L.push(`  switch (_pKind) {`);

  for (const [kind, fn] of Object.entries(parentEquations)) {
    L.push(`    case '${kind}': return ${emitExpr(fn, p)};`);
  }

  if (exhaustive) {
    for (const kind of remainingKinds) {
      L.push(`    case '${kind}':`);
    }
    L.push(`      return undefined;`);
    L.push(`    default: { const _exhaustive: never = _pKind; throw new Error(\`Unhandled parent kind: \${_exhaustive}\`); }`);
  } else {
    L.push(`    default: return undefined;`);
  }

  L.push(`  }`);
  L.push(`}`);
  L.push(``);
}

// ── Emission Use Case ────────────────────────────────────────────────

export function emitAdapters(plan: BehaviorPlan, opts?: GeneratedImports): CompiledAnalyzer {
  const specImportPath = opts?.specImportPath ?? './spec.js';
  const grammarImportPath = opts?.grammarImportPath ?? '@ksc/grammar/index.js';
  const evaluatorImportPath = opts?.evaluatorImportPath ?? '@ksc/evaluation/index.js';
  const equationsImportPath = opts?.equationsImportPath ?? specImportPath.replace(/\/spec\.js$/, '/equations/index.js');

  const { allAttrs, decl, grammar, depGraph } = plan;
  const allKinds = grammar.allKinds;

  // 1. Generate dispatch.ts
  const dispatchL: string[] = [];
  dispatchL.push(`/** AUTO-GENERATED — do not edit. */`);
  const hasDispatchFunctions = allAttrs.some(a => a.direction !== 'collection');
  if (hasDispatchFunctions) {
    dispatchL.push(`import type { KSNode, KindToNode } from '${grammarImportPath}';`);
    dispatchL.push(`import type { Ctx, KindCtx } from '${evaluatorImportPath}';`);
    dispatchL.push(`import type { DispatchConfig } from '@ksc/ag-ports';`);
  } else {
    dispatchL.push(`import type { DispatchConfig } from '@ksc/ag-ports';`);
  }
  dispatchL.push(``);

  const eqFnNames = collectEquationFunctions(allAttrs);
  if (eqFnNames.size > 0) {
    dispatchL.push(`import {`);
    for (const name of eqFnNames) dispatchL.push(`  ${name},`);
    dispatchL.push(`} from '${equationsImportPath}';`);
    dispatchL.push(``);
  }

  if (decl.typeImports) {
    const importLines = decl.typeImports({ specImportPath });
    for (const line of importLines) dispatchL.push(line);
    dispatchL.push(``);
  }

  dispatchL.push(`// ── Dispatch functions ──`);
  const kindsForExhaustive = allKinds.size > 0 ? allKinds : undefined;
  for (const a of allAttrs) {
    if (a.direction === 'syn') generateSynDispatch(dispatchL, a as SynAttr, kindsForExhaustive);
    if (a.direction === 'inh') {
      generateInhRootDispatch(dispatchL, a as InhAttr);
      generateInhParentDispatch(dispatchL, a as InhAttr, kindsForExhaustive);
    }
  }

  dispatchL.push(`export const dispatchConfig: DispatchConfig = {`);
  for (const a of allAttrs) {
    if (a.direction === 'syn') dispatchL.push(`  ${a.name}: { direction: 'syn', compute: dispatch_${a.name} },`);
    if (a.direction === 'inh') {
      const hasParentEqs = (a as InhAttr).parentEquations && Object.keys((a as InhAttr).parentEquations!).length > 0;
      const parentExpr = hasParentEqs ? `, computeParent: dispatch_${a.name}_parent` : '';
      dispatchL.push(`  ${a.name}: { direction: 'inh', computeRoot: dispatch_${a.name}_root${parentExpr} },`);
    }
    if (a.direction === 'collection') {
      const ca = a as CollectionAttr;
      dispatchL.push(`  ${a.name}: { direction: 'collection', init: ${emitExpr(ca.init)}, combine: ${ca.combine.code} },`);
    }
  }
  dispatchL.push(`};`);

  // 2. Generate attr-types.ts
  const attrL: string[] = [];
  attrL.push(`/** AUTO-GENERATED — do not edit. */`);
  if (decl.typeImports) {
    const importLines = decl.typeImports({ specImportPath });
    for (const line of importLines) attrL.push(line);
    attrL.push(``);
  }
  attrL.push(`export interface KSCAttrMap {`);
  for (const a of allAttrs.filter(at => !at.parameter)) {
    const t = a.type.includes('=>') ? `(${a.type})` : a.type;
    attrL.push(`  ${a.name}: ${t};`);
  }
  attrL.push(`}`);

  // 3. Generate dep-graph.ts
  const graphL: string[] = [];
  graphL.push(`/** AUTO-GENERATED — do not edit. */`);
  graphL.push(`import type { AttributeDepGraph } from '@ksc/grammar';`);
  graphL.push(``);
  graphL.push(`export const depGraph: AttributeDepGraph = ${JSON.stringify(depGraph, null, 2)};`);

  return {
    dispatchFile: { path: 'dispatch.ts', content: dispatchL.join('\n') },
    attrTypesFile: { path: 'attr-types.ts', content: attrL.join('\n') },
    depGraphFile: { path: 'dep-graph.ts', content: graphL.join('\n') },
    attrs: allAttrs.map(a => ({ name: a.name, direction: a.direction, type: a.type })),
    depGraph,
  };
}
