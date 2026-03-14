/**
 * CLI error types and exit codes.
 */

// ── Exit codes ────────────────────────────────────────────────────────

export const EXIT_SUCCESS = 0;
export const EXIT_VIOLATIONS = 1;
export const EXIT_ERROR = 2;

// ── Errors ───────────────────────────────────────────────────────────

export class CLIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CLIError';
  }
}
