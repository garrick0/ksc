/** Normalised violation format shared between ESLint and KindScript outputs. */
export interface NormalisedViolation {
  /** Relative file path within fixture directory. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** 0-based column offset. */
  column: number;
  /** ESLint rule ID (e.g., 'eqeqeq', 'no-var'). */
  ruleId: string;
}

/** Configuration for a single oracle rule test. */
export interface OracleRule {
  /** ESLint rule ID (e.g., 'eqeqeq', '@typescript-eslint/no-explicit-any'). */
  eslintRuleId: string;
  /** KSC attribute name that maps to this rule. */
  kscRuleId: string;
  /** Fixture directory name under test/oracle/fixtures/. */
  fixture: string;
  /** ESLint rule config value (default: 'error'). */
  eslintConfig?: unknown;
}
