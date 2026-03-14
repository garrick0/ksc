/**
 * Hand-written AG evaluator engine.
 *
 * AGNode: a decorated AST node with dynamic caching, cycle detection,
 * and direction-aware attribute dispatch.
 *
 * evaluate(): build a decorated tree for one evaluation run.
 */

import type { ASTNode, FieldDef, Grammar } from '@ksc/grammar/index.js';
/** ASTNode with index signature for dynamic field access by FieldDef name. */
type IndexedNode = ASTNode & { readonly [key: string]: unknown };
import type {
  DispatchConfig,
  DispatchEntry,
  AGNodeInterface,
  TypedAGNode,
  BuildTreeArgs,
  EvaluateArgs,
} from './ports.js';

// ── Shared tree config (identical for all nodes in a tree) ───────────

interface AGTreeConfig {
  readonly dispatch: DispatchConfig;
  readonly fileContainerKind: string;
  readonly fileNameField: string;
}

// ── AGNode ────────────────────────────────────────────────────────────

class AGNode implements AGNodeInterface {
  readonly node: ASTNode;
  readonly parent: AGNode | undefined;
  readonly children: readonly AGNode[];
  readonly isRoot: boolean;
  readonly fieldName: string | undefined;

  private readonly _cache = new Map<string, unknown>();
  private readonly _paramCache = new Map<string, Map<unknown, unknown>>();
  private readonly _cyc = new Set<string>();
  private readonly _config: AGTreeConfig;

  constructor(
    node: ASTNode,
    parent: AGNode | undefined,
    children: AGNode[],
    fieldName: string | undefined,
    config: AGTreeConfig,
  ) {
    this.node = node;
    this.parent = parent;
    this.children = children;
    this.isRoot = !parent;
    this.fieldName = fieldName;
    this._config = config;
  }

  // ── Attribute access ──

  attr(name: string, ...args: unknown[]): any {
    const entry = this._config.dispatch[name];
    if (!entry) throw new Error(`Unknown attribute '${name}' on ${this.node.kind ?? 'node'}`);

    const param = args[0];
    const isParameterized = param !== undefined;

    // Cache check
    if (isParameterized) {
      const pCache = this._paramCache.get(name);
      if (pCache?.has(param)) return pCache.get(param);
    } else {
      if (this._cache.has(name)) return this._cache.get(name);
    }

    // Cycle detection
    const cycKey = isParameterized ? `${name}:${param}` : name;
    if (this._cyc.has(cycKey)) {
      const label = isParameterized ? `${name}(${param})` : name;
      throw new Error(`Circular attribute access: '${label}' on ${this.node.kind}`);
    }
    this._cyc.add(cycKey);

    try {
      let result: unknown;

      switch (entry.direction) {
        case 'syn': {
          result = entry.compute(this, ...args);
          break;
        }
        case 'inh': {
          if (this.isRoot) {
            result = entry.computeRoot(this, ...args);
          } else {
            let overridden = false;
            if (entry.computeParent) {
              const override = entry.computeParent(this, ...args);
              if (override !== undefined) {
                result = override;
                overridden = true;
              }
            }
            if (!overridden) {
              // Copy-down from parent
              result = this.parent!.attr(name, ...args);
            }
          }
          break;
        }
        case 'collection': {
          let acc = typeof entry.init === 'object' && entry.init !== null
            ? Array.isArray(entry.init) ? [...entry.init] : { ...entry.init }
            : entry.init;
          for (const child of this.children) {
            acc = entry.combine(acc, child.attr(name, ...args));
          }
          result = acc;
          break;
        }
        default: {
          const _exhaustive: never = entry;
          throw new Error(`Unknown dispatch direction: ${(_exhaustive as DispatchEntry).direction}`);
        }
      }

      // Store in cache
      if (isParameterized) {
        if (!this._paramCache.has(name)) this._paramCache.set(name, new Map());
        this._paramCache.get(name)!.set(param, result);
      } else {
        this._cache.set(name, result);
      }

      return result;
    } finally {
      this._cyc.delete(cycKey);
    }
  }

  // ── Structural queries ──

  parentIs(kind: string, field?: string): boolean {
    if (!this.parent) return false;
    if (this.parent.node.kind !== kind) return false;
    if (field !== undefined) return this.fieldName === field;
    return true;
  }

  private _fileName: string | undefined;

  findFileName(): string {
    if (this._fileName !== undefined) return this._fileName;
    // Check this node first (handles case where equation runs ON the file container)
    let current: AGNode | undefined = this as AGNode;
    while (current && current.node.kind !== this._config.fileContainerKind) {
      current = current.parent;
    }
    this._fileName = current ? (current.node as IndexedNode)[this._config.fileNameField] as string : '<unknown>';
    return this._fileName;
  }
}

// ── Tree builder ──────────────────────────────────────────────────────

function buildAGTree(
  root: ASTNode,
  fieldDefs: Record<string, readonly FieldDef[]>,
  config: AGTreeConfig,
): AGNode {
  function build(
    raw: ASTNode,
    parent: AGNode | undefined,
    fieldName: string | undefined,
  ): AGNode {
    const children: AGNode[] = [];
    const dnode = new AGNode(raw, parent, children, fieldName, config);

    const defs = fieldDefs[raw.kind];
    if (defs) {
      for (const f of defs) {
        if (f.tag === 'prop') continue;
        const val = (raw as IndexedNode)[f.name];
        if (val == null) continue;
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item == null) continue;
            children.push(build(item as ASTNode, dnode, f.name));
          }
        } else {
          children.push(build(val as ASTNode, dnode, f.name));
        }
      }
    }

    return dnode;
  }

  return build(root, undefined, undefined);
}

// ── Runtime helpers ───────────────────────────────────────────────────

/**
 * Validate that dispatch config has entries for all declared attributes.
 * Call at the composition root to catch wiring errors early.
 */
export function validateDispatch(dispatch: DispatchConfig, attrNames: readonly string[]): void {
  const missing = attrNames.filter(name => !(name in dispatch));
  if (missing.length > 0) {
    throw new Error(`Missing dispatch entries for attributes: ${missing.join(', ')}`);
  }
  const extra = Object.keys(dispatch).filter(name => !attrNames.includes(name));
  if (extra.length > 0) {
    throw new Error(`Extra dispatch entries not in spec: ${extra.join(', ')}`);
  }
}

export function buildTree<M = Record<string, unknown>, K extends string = string>(
  args: BuildTreeArgs<K>,
): TypedAGNode<M> {
  const { dispatch, grammar, root } = args;
  const { fieldDefs, fileContainerKind, fileNameField } = grammar;
  const treeConfig: AGTreeConfig = { dispatch, fileContainerKind, fileNameField };
  return buildAGTree(root, fieldDefs, treeConfig) as unknown as TypedAGNode<M>;
}

export function evaluate<M = Record<string, unknown>, K extends string = string>(
  args: EvaluateArgs<K>,
): TypedAGNode<M> {
  args.setup?.();
  return buildTree<M, K>(args);
}
