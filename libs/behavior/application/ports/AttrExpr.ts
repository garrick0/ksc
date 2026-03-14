/** Tagged wrapper for literal code strings that aren't function calls. */
export interface CodeLiteral {
  readonly __codeLiteral: true;
  readonly code: string;
}

/** Create a CodeLiteral wrapping a raw code expression. */
export function code(expr: string): CodeLiteral {
  return { __codeLiteral: true, code: expr };
}

/** Type guard for CodeLiteral. */
export function isCodeLiteral(value: unknown): value is CodeLiteral {
  return value !== null && typeof value === 'object' && '__codeLiteral' in value && value.__codeLiteral === true;
}

/**
 * What AttrDecl expression fields accept.
 * - Function: equation function reference (emitted as fn.name(this) or fn.name(this, param))
 * - null, number, boolean: literal values
 * - CodeLiteral: raw code expression string
 */
export type AttrExpr = Function | null | number | boolean | CodeLiteral;
