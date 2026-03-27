import type { AxeResults, Result } from 'axe-core'
import { attachment } from 'allure-js-commons'

/** Format axe violations into a readable summary. */
function formatViolations(violations: Result[]): string[] {
  return violations.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance${v.nodes.length > 1 ? 's' : ''})`
  )
}

/** Filter violations by critical or serious impact. */
export function filterCritical(violations: Result[]): Result[] {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

/**
 * Attach axe-core scan results to the Allure report.
 *
 * - Always attaches: even when there are zero violations (shows "No violations").
 * - Attaches the full JSON as a collapsible detail.
 * - Attaches a human-readable summary as text.
 */
export async function attachAxeResults(
  label: string,
  results: AxeResults
): Promise<void> {
  const { violations, passes } = results
  const critical = filterCritical(violations)

  const summary = [
    `Scan: ${label}`,
    `Violations: ${violations.length} (critical/serious: ${critical.length})`,
    `Passes: ${passes.length}`,
    '',
    ...(violations.length > 0
      ? ['Violations:', ...formatViolations(violations)]
      : ['No violations found.']),
  ].join('\n')

  await attachment(`axe-core: ${label}`, Buffer.from(summary, 'utf-8'), 'text/plain')

  await attachment(
    `axe-core JSON: ${label}`,
    Buffer.from(JSON.stringify({ violations, passes: passes.length }, null, 2), 'utf-8'),
    'application/json'
  )
}
