import type { Ctx } from './Ctx.js';

export interface SynDispatchEntry {
  direction: 'syn';
  /** Compute the attribute value. Called with (ctx) or (ctx, param). */
  compute: (ctx: Ctx, ...args: any[]) => any;
}

export interface InhDispatchEntry {
  direction: 'inh';
  /** Compute the root value. Called with (ctx) or (ctx, param). */
  computeRoot: (ctx: Ctx, ...args: any[]) => any;
  /**
   * Compute parent override for an inherited attribute.
   *
   * IMPORTANT: `ctx` refers to the **child** node requesting the attribute,
   * not the parent. Use `ctx.parent` to access the parent node.
   * This convention allows the equation to inspect the child's position
   * (e.g., `ctx.node.kind`, `ctx.fieldName`) when deciding overrides.
   *
   * Return `undefined` to trigger copy-down (inherit parent's value).
   * Return any other value (including `null`) to override.
   */
  computeParent?: (ctx: Ctx, ...args: any[]) => any;
}

export interface CollectionDispatchEntry {
  direction: 'collection';
  /** Initial value for the fold. */
  init: any;
  /** Binary combine function: (accumulator, childContribution) => combined. */
  combine: (acc: any, contrib: any) => any;
}

export type DispatchEntry = SynDispatchEntry | InhDispatchEntry | CollectionDispatchEntry;

/** Per-attribute dispatch config: attrName → dispatch entry. */
export type DispatchConfig = Record<string, DispatchEntry>;
