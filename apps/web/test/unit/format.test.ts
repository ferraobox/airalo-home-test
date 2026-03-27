import { normalisePrice, fmtMetric } from '../../src/lib/format'

// ── normalisePrice — thorough edge-case coverage ────────────

describe('normalisePrice', () => {
  describe('currency symbol stripping', () => {
    it.each([
      ['US$4.50', '4.50', 'US$ prefix'],
      ['$22.12', '22.12', '$ prefix'],
      ['€9.99', '9.99', 'euro symbol'],
      ['£15.00', '15.00', 'pound symbol'],
      ['¥1200', '1200', 'yen symbol'],
      ['₩5000', '5000', 'won symbol'],
      ['22.12 USD', '22.12', 'USD suffix'],
      ['CHF 45.00', '45.00', 'CHF prefix with space'],
    ])('"%s" → "%s" (%s)', (input, expected) => {
      expect(normalisePrice(input)).toBe(expected)
    })
  })

  describe('decimal and thousand separators', () => {
    it.each([
      ['4,50', '4.50', 'comma as decimal'],
      ['4.50', '4.50', 'standard dot decimal'],
    ])('"%s" → "%s" (%s)', (input, expected) => {
      expect(normalisePrice(input)).toBe(expected)
    })

    it('converts ALL commas to dots — thousands separator not handled', () => {
      expect(normalisePrice('1,234.56')).toBe('1.234.56')
    })

    it('European format: dot-thousands + comma-decimal both become dots', () => {
      expect(normalisePrice('1.234,56')).toBe('1.234.56')
    })
  })

  describe('whitespace handling', () => {
    it.each([
      ['  US$4.50  ', '4.50', 'leading/trailing spaces'],
      ['\tUS$4.50\n', '4.50', 'tabs and newlines'],
      ['US$ 4.50', '4.50', 'space between currency and amount'],
      ['  ', '', 'whitespace-only input'],
    ])('"%s" → "%s" (%s)', (input, expected) => {
      expect(normalisePrice(input)).toBe(expected)
    })
  })

  describe('boundary values', () => {
    it('returns empty string for empty input', () => {
      expect(normalisePrice('')).toBe('')
    })

    it('handles zero price', () => {
      expect(normalisePrice('US$0.00')).toBe('0.00')
    })

    it('handles price without decimals', () => {
      expect(normalisePrice('US$5')).toBe('5')
    })

    it('handles very large price', () => {
      expect(normalisePrice('US$99999.99')).toBe('99999.99')
    })

    it('handles very small price', () => {
      expect(normalisePrice('$0.01')).toBe('0.01')
    })

    it('returns only digits and dots for pure text input', () => {
      expect(normalisePrice('no price here')).toBe('')
    })

    it('handles multiple dots (malformed)', () => {
      const result = normalisePrice('1.2.3')
      expect(result).toBe('1.2.3')
    })
  })

  describe('idempotency', () => {
    it('normalising an already-normalised value is stable', () => {
      const once = normalisePrice('US$4.50')
      const twice = normalisePrice(once)
      expect(twice).toBe(once)
    })
  })

  describe('comparison correctness', () => {
    it('same price in different formats normalises to equal values', () => {
      expect(normalisePrice('US$4.50')).toBe(normalisePrice('4.50 USD'))
      expect(normalisePrice('$22.12')).toBe(normalisePrice('22.12'))
    })

    it('different prices do NOT normalise to equal values', () => {
      expect(normalisePrice('$4.50')).not.toBe(normalisePrice('$5.50'))
    })
  })

  describe('numeric conversion safety', () => {
    it.each([
      ['US$4.50', 4.5],
      ['$0.00', 0],
      ['$99.99', 99.99],
      ['$0.01', 0.01],
    ])('parseFloat(normalisePrice("%s")) === %s', (input, expected) => {
      expect(Number.parseFloat(normalisePrice(input))).toBe(expected)
    })

    it('empty input produces NaN when parsed', () => {
      expect(Number.parseFloat(normalisePrice(''))).toBeNaN()
    })

    it('text-only input produces NaN when parsed', () => {
      expect(Number.parseFloat(normalisePrice('free'))).toBeNaN()
    })
  })
})

// ── fmtMetric ───────────────────────────────────────────────

describe('fmtMetric', () => {
  it('formats value with unit', () => {
    expect(fmtMetric(1800, 'ms')).toBe('1800ms')
  })

  it('formats value without unit using decimal notation', () => {
    expect(fmtMetric(0.05, '')).toBe('0.050')
  })

  it('rounds to zero decimal places when unit is present', () => {
    expect(fmtMetric(1800.7, 'ms')).toBe('1801ms')
  })
})
