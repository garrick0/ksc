/**
 * CLI output formatting — renders check results as JSON or human-readable text.
 */

import type { ProjectCheckResult } from 'ksc/ts-kind-checking';

// ── Types ────────────────────────────────────────────────────────────

type CheckResult = ProjectCheckResult;

// ── Formatters ───────────────────────────────────────────────────────

export function formatCheckJSON(result: CheckResult): string {
  return JSON.stringify({
    definitions: result.definitions.map(d => d.name),
    violations: result.diagnostics,
    fileCount: result.fileCount,
  }, null, 2);
}

export function formatCheckText(result: CheckResult): string {
  const lines: string[] = [];

  if (result.diagnostics.length > 0) {
    lines.push('');
    for (const diag of result.diagnostics) {
      lines.push(`  ${diag.message}`);
    }
    lines.push('');
  }

  const status = result.diagnostics.length > 0
    ? `${result.diagnostics.length} violation${result.diagnostics.length === 1 ? '' : 's'} found`
    : 'no violations';
  lines.push(`ksc: ${result.fileCount} files, ${result.definitions.length} kinds, ${status}.`);

  return lines.join('\n');
}
