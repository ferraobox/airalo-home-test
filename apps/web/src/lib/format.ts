/**
 * Normalise price strings for comparison.
 * Strips currency symbols, letter-based currency codes, and whitespace.
 * Converts commas to dots.
 *
 * Examples: "US$4.50" → "4.50", "4.00 €" → "4.00"
 */
export function normalisePrice(raw: string): string {
  return raw
    .replaceAll(/[^\d.,]/g, '')
    .replaceAll(',', '.')
    .trim()
}

/** Format a metric value with its unit for assertion messages. */
export function fmtMetric(value: number, unit: string): string {
  return unit ? `${value.toFixed(0)}${unit}` : value.toFixed(3)
}
