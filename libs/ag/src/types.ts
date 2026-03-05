/**
 * Core types for the attribute grammar library.
 *
 * Attributes are installed directly on AST nodes as lazy properties
 * (JastAdd-style). No external WeakMaps or data structures.
 */

/** A node with tree navigation stamped on it by stampTree(). */
export interface StampedNode {
  $parent: StampedNode | undefined;
  $children: StampedNode[];
  $index: number;
  $root: boolean;
  $prev: StampedNode | undefined;
  $next: StampedNode | undefined;
}

/**
 * An attribute definition that can be installed on nodes.
 *
 * This is the compiled output of compile(decl, eq) — it knows HOW
 * to compute the attribute and HOW to cache it. Call install() to
 * put a lazy getter on a specific node under a specific key.
 */
export interface AttributeDef<N extends object, V = any> {
  install(node: N, key: string): void;
}

/** Map of named attribute definitions (compiled equations). */
export type AttributeMap<N extends object> = Record<string, AttributeDef<N>>;
