/**
 * Grammar port contracts — pure interfaces implemented by all grammars.
 *
 * Ports defined here:
 *   - ASTNode        — base shape for all AST nodes
 *   - FieldDef       — field metadata (child/prop/list/optChild)
 *   - Grammar<K>     — a grammar's complete runtime metadata
 *   - Frontend<I, R, O> — source-language → KS AST converter contract
 */

// ═══════════════════════════════════════════════════════════════════════
// Base contracts — implemented by all grammars
// ═══════════════════════════════════════════════════════════════════════

/** Base shape for all AST nodes. */
export interface ASTNode {
  kind: string;
  pos: number;
  end: number;
  text: string;
  children: ASTNode[];
}

/** Field metadata for child/optChild/list fields — references a child node kind. */
export type ChildFieldDef = {
  name: string;
  tag: 'child' | 'optChild' | 'list';
  typeRef?: string;
};

/** Field metadata for prop fields — carries a property type string and optional default. */
export type PropFieldDef = {
  name: string;
  tag: 'prop';
  propType: string;
  default?: unknown;
};

/** Field metadata — canonical definition used by schema-utils and evaluators. */
export type FieldDef = ChildFieldDef | PropFieldDef;

// ═══════════════════════════════════════════════════════════════════════
// Grammar — first-class runtime object
// ═══════════════════════════════════════════════════════════════════════

/** A grammar's complete runtime metadata — the consumer-facing interface. */
export interface Grammar<K extends string = string> {
  readonly fieldDefs: Readonly<Record<string, readonly FieldDef[]>>;
  readonly allKinds: ReadonlySet<K>;
  readonly rootKind: K;
  readonly fileNameField: string;
  readonly sumTypeMembers: Readonly<Record<string, readonly string[]>>;
  readonly sumTypeMembership: Readonly<Record<string, readonly string[]>>;
}

// ═══════════════════════════════════════════════════════════════════════
// Frontend — source-language converter contract
// ═══════════════════════════════════════════════════════════════════════

/**
 * Port: Frontend converter — translates source-language input into a KS AST.
 *
 * Each language target implements this contract:
 *   - Input type varies by target (e.g., ts.Program for TypeScript)
 *   - Root type varies by grammar (e.g., KSProgram for TS AST)
 *   - Opts type narrows the optional conversion options (e.g., AnalysisDepth)
 *
 * The composition root knows both concrete types; the generic machinery
 * only requires that the output root extends ASTNode.
 *
 * @example
 *   // Adapter: specs/ts-ast/frontend/convert.ts
 *   export const frontend: Frontend<ts.Program, KSProgram, AnalysisDepth> = {
 *     convert: buildKSTree,
 *   };
 */
export interface Frontend<Input = unknown, Root extends ASTNode = ASTNode, Opts = unknown> {
  convert(input: Input, opts?: Opts): { root: Root };
}
