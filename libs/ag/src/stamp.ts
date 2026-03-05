/**
 * Node stamping — the core mechanism for on-node attribute caching.
 *
 * installLazy: JastAdd's _computed/_value pattern in JavaScript.
 *   - First property access triggers a getter → computes value
 *   - Getter replaces itself with a data property → cached
 *   - Subsequent accesses are direct property reads (zero overhead)
 *
 * stampTree: Stamps $parent, $children, $index, $root, $prev, $next
 *   directly on every node. Replaces the old WeakMap-based createTree.
 */

/**
 * Install a lazy-computing getter on a node.
 *
 * On first access of `node[key]`:
 *   1. Calls `compute(node)` to get the value
 *   2. Replaces the getter with a plain data property
 *   3. Returns the cached value
 *
 * This is the JS equivalent of JastAdd's:
 *   if (attrName_computed) return attrName_value;
 *   attrName_computed = true;
 *   attrName_value = equation();
 *   return attrName_value;
 */
export function installLazy<N extends object, V>(
  node: N,
  key: string,
  compute: (node: N) => V,
): void {
  Object.defineProperty(node, key, {
    configurable: true,
    enumerable: true,
    get() {
      const value = compute(node);
      Object.defineProperty(node, key, {
        value,
        writable: false,
        configurable: false,
        enumerable: true,
      });
      return value;
    },
  });
}

/**
 * Stamp tree navigation properties directly onto every node.
 *
 * After calling stampTree(root, getChildren), every node has:
 *   $parent   — parent node (undefined for root)
 *   $children — array of child nodes
 *   $index    — child index in parent (-1 for root)
 *   $root     — true only for root node
 *   $prev     — previous sibling (undefined if first/root)
 *   $next     — next sibling (undefined if last/root)
 *
 * Replaces the old createTree() which stored this in 3 WeakMaps.
 */
export function stampTree<N extends object>(
  root: N,
  getChildren: (node: N) => N[],
): void {
  const stamp = (node: N, key: string, value: unknown) => {
    Object.defineProperty(node, key, {
      value,
      writable: false,
      configurable: true,
      enumerable: false,
    });
  };

  // BFS traversal
  const queue: N[] = [root];
  stamp(root, '$parent', undefined);
  stamp(root, '$index', -1);
  stamp(root, '$root', true);
  stamp(root, '$prev', undefined);
  stamp(root, '$next', undefined);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const kids = getChildren(node);
    stamp(node, '$children', kids);

    for (let i = 0; i < kids.length; i++) {
      const child = kids[i];
      stamp(child, '$parent', node);
      stamp(child, '$index', i);
      stamp(child, '$root', false);
      stamp(child, '$prev', i > 0 ? kids[i - 1] : undefined);
      stamp(child, '$next', i < kids.length - 1 ? kids[i + 1] : undefined);
      queue.push(child);
    }
  }
}
