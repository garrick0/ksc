import type { ASTNode } from './ASTNode.js';

/**
 * Port: AST translator — translates source-language input into a KS AST.
 *
 * Each language target implements this contract:
 *   - Input type varies by target (e.g., ts.Program for TypeScript)
 *   - Root type varies by grammar (e.g., KSProgram for TS AST)
 *   - Opts type narrows the optional conversion options (e.g., AnalysisDepth)
 *
 * The composition root knows both concrete types; the generic machinery
 * only requires that the output root extends ASTNode.
 */
export interface AstTranslatorPort<Input = unknown, Root extends ASTNode = ASTNode, Opts = unknown> {
  convert(input: Input, opts?: Opts): { root: Root };
}
