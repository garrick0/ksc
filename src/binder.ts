/**
 * The KindScript Binder.
 *
 * Converts a KindScriptConfig into KindSymbols for the checker.
 * Each config entry becomes a KindSymbol with its declared rules.
 */

import type { KindSymbol, PropertySpec } from './types.js';
import type { KindScriptConfig } from './config.js';
import { isCompositeEntry } from './config.js';

// ── Result type ──

export interface BinderResult {
  /** All symbols including composite members (for export/introspection). */
  symbols: KindSymbol[];
  /** Top-level config entries only (for checking). */
  targets: KindSymbol[];
}

// ── Path analysis ──

/**
 * Determine if a path refers to a file or directory.
 * Paths with file extensions are files; everything else is a directory.
 */
function detectValueKind(path: string): 'file' | 'directory' {
  return /\.\w+$/.test(path) ? 'file' : 'directory';
}

// ── Main entry point ──

/**
 * Run the KindScript binder on a config object.
 *
 * Converts each config entry into a KindSymbol. Composite entries
 * produce member symbols plus a parent composite symbol.
 */
export function ksBind(config: KindScriptConfig): BinderResult {
  const symbols: KindSymbol[] = [];
  const targets: KindSymbol[] = [];
  let nextId = 0;

  function assignId(): string {
    return `sym-${nextId++}`;
  }

  for (const [name, entry] of Object.entries(config)) {
    if (isCompositeEntry(entry)) {
      // Composite: create member symbols, then the parent
      const members = new Map<string, KindSymbol>();

      for (const [memberName, member] of Object.entries(entry.members)) {
        const memberSym: KindSymbol = {
          id: assignId(),
          name: memberName,
          declaredProperties: (member.rules ?? {}) as PropertySpec,
          path: member.path,
          valueKind: detectValueKind(member.path),
        };
        members.set(memberName, memberSym);
        symbols.push(memberSym);
      }

      const sym: KindSymbol = {
        id: assignId(),
        name,
        declaredProperties: (entry.rules ?? {}) as PropertySpec,
        members,
        valueKind: 'composite',
      };
      symbols.push(sym);
      targets.push(sym);
    } else {
      // Simple target: file or directory
      const sym: KindSymbol = {
        id: assignId(),
        name,
        declaredProperties: (entry.rules ?? {}) as PropertySpec,
        path: entry.path,
        valueKind: detectValueKind(entry.path),
      };
      symbols.push(sym);
      targets.push(sym);
    }
  }

  return { symbols, targets };
}
