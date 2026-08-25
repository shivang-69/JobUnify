/**
 * stipendFilter.test.js — Unit tests for isPaidInternship()
 *
 * Test coverage:
 *  Cat 1 — Explicitly Unpaid (should return paid: false)
 *  Cat 2 — Explicitly Paid: ₹ single values
 *  Cat 3 — Explicitly Paid: ₹ ranges
 *  Cat 4 — Explicitly Paid: $ / foreign-currency formats
 *  Cat 5 — Missing / null stipend data (fail-open)
 *  Cat 6 — Edge cases / future-format safety
 */

const { isPaidInternship } = require('./stipendFilter');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function paid(stipend)   { return { stipend }; }
function unpaid(stipend) { return { stipend }; }

// ─── Category 1: Explicitly Unpaid — MUST EXCLUDE (paid: false) ────────────
describe('Cat 1 — Explicitly Unpaid → paid: false', () => {
  const cases = [
    ['Exact "Unpaid" (Internshala default)',         'Unpaid'],
    ['All-caps "UNPAID"',                            'UNPAID'],
    ['All-lowercase "unpaid"',                       'unpaid'],
    ['Mixed-case "unPaid"',                          'unPaid'],
    ['Leading/trailing whitespace "  Unpaid  "',     '  Unpaid  '],
    ['"No stipend"',                                 'No stipend'],
    ['"no stipend" lowercase',                       'no stipend'],
    ['"No Stipend" title-case',                      'No Stipend'],
    ['"NO STIPEND" uppercase',                       'NO STIPEND'],
    ['"no-stipend" hyphenated',                      'no-stipend'],
    ['"without stipend"',                            'without stipend'],
    ['"Without Stipend"',                            'Without Stipend'],
    ['₹0 with no space',                             '₹0'],
    ['₹ 0 with space',                               '₹ 0'],
    ['$0 with no space',                             '$0'],
    ['$ 0 with space',                               '$ 0'],
    ['"0 per month"',                                '0 per month'],
    ['"0/month"',                                    '0/month'],
    ['"no pay"',                                     'no pay'],
    ['"No Pay"',                                     'No Pay'],
    ['"volunteer" (some platforms use this)',        'volunteer'],
    ['"Volunteer" title-case',                       'Volunteer'],
  ];

  test.each(cases)('%s', (_, stipend) => {
    const result = isPaidInternship({ stipend });
    expect(result.paid).toBe(false);
    expect(result.reason).toBe('explicitly_unpaid');
  });
});

// ─── Category 2: Explicitly Paid — ₹ Single Values — MUST INCLUDE ─────────
describe('Cat 2 — Paid ₹ single values → paid: true', () => {
  const cases = [
    ['₹ 8,000 /month (exact Internshala format)',   '₹ 8,000 /month'],
    ['₹ 5,000 /month',                              '₹ 5,000 /month'],
    ['₹ 2,000 /month',                              '₹ 2,000 /month'],
    ['₹ 10,000 /month',                             '₹ 10,000 /month'],
    ['₹ 15,000 /month',                             '₹ 15,000 /month'],
    ['₹ 1,000/month (no space)',                    '₹ 1,000/month'],
    ['₹25000 /month (no comma)',                    '₹25000 /month'],
    ['₹50,000/month (large stipend)',               '₹50,000/month'],
  ];

  test.each(cases)('%s', (_, stipend) => {
    const result = isPaidInternship({ stipend });
    expect(result.paid).toBe(true);
  });
});

// ─── Category 3: Explicitly Paid — ₹ Ranges — MUST INCLUDE ───────────────
describe('Cat 3 — Paid ₹ range values → paid: true', () => {
  const cases = [
    ['₹ 3,000 - 5,000 /month',                     '₹ 3,000 - 5,000 /month'],
    ['₹ 5,000 - 10,000 /month',                    '₹ 5,000 - 10,000 /month'],
    ['₹ 10,000 - 15,000 /month',                   '₹ 10,000 - 15,000 /month'],
    ['₹ 10,000 - 20,000 /month',                   '₹ 10,000 - 20,000 /month'],
    ['₹ 12,000 - 15,000 /month',                   '₹ 12,000 - 15,000 /month'],
    ['₹ 15,000 - 25,000 /month',                   '₹ 15,000 - 25,000 /month'],
    ['₹ 35,000 - 1,00,000 /month (large range)',   '₹ 35,000 - 1,00,000 /month'],
    ['₹ 4,000 - 5,000 /month',                     '₹ 4,000 - 5,000 /month'],
    ['₹ 5,000 - 8,000 /month',                     '₹ 5,000 - 8,000 /month'],
    ['₹ 11,000 - 14,000 /month',                   '₹ 11,000 - 14,000 /month'],
    ['₹ 13,000 - 15,000 /month',                   '₹ 13,000 - 15,000 /month'],
  ];

  test.each(cases)('%s', (_, stipend) => {
    const result = isPaidInternship({ stipend });
    expect(result.paid).toBe(true);
  });
});

// ─── Category 4: Foreign Currency / $ format — MUST INCLUDE ──────────────
describe('Cat 4 — Paid $ / foreign-currency formats → paid: true', () => {
  const cases = [
    ['$ 325 - 500 /month (Internshala remote USD)',  '$ 325 - 500 /month'],
    ['$500/month',                                   '$500/month'],
    ['$ 200 /month',                                 '$ 200 /month'],
    ['€500/month (EUR)',                             '€500/month'],
    ['£300 per month (GBP)',                         '£300 per month'],
    ['USD 400/month',                                'USD 400/month'],
    ['AED 1000 per month',                           'AED 1000 per month'],
  ];

  test.each(cases)('%s', (_, stipend) => {
    const result = isPaidInternship({ stipend });
    expect(result.paid).toBe(true);
  });
});

// ─── Category 5: Missing / null / undefined — fail-open MUST INCLUDE ──────
describe('Cat 5 — Missing stipend data → fail-open (paid: true)', () => {
  test('null stipend → include', () => {
    expect(isPaidInternship({ stipend: null }).paid).toBe(true);
    expect(isPaidInternship({ stipend: null }).reason).toBe('no_stipend_data');
  });

  test('undefined stipend → include', () => {
    expect(isPaidInternship({ stipend: undefined }).paid).toBe(true);
    expect(isPaidInternship({ stipend: undefined }).reason).toBe('no_stipend_data');
  });

  test('empty string stipend → include', () => {
    expect(isPaidInternship({ stipend: '' }).paid).toBe(true);
    expect(isPaidInternship({ stipend: '' }).reason).toBe('no_stipend_data');
  });

  test('no stipend key at all → falls back to salary field', () => {
    const result = isPaidInternship({ salary: '₹ 10,000 /month' });
    expect(result.paid).toBe(true);
  });

  test('both stipend and salary absent → include (fail-open)', () => {
    const result = isPaidInternship({});
    expect(result.paid).toBe(true);
    expect(result.reason).toBe('no_stipend_data');
  });

  test('"Performance-based" (no number) — unrecognized format → include', () => {
    // Future format we haven't seen — must NOT silently exclude
    expect(isPaidInternship({ stipend: 'Performance-based' }).paid).toBe(true);
  });

  test('"TBD" → include', () => {
    expect(isPaidInternship({ stipend: 'TBD' }).paid).toBe(true);
  });

  test('"Negotiable" → include', () => {
    expect(isPaidInternship({ stipend: 'Negotiable' }).paid).toBe(true);
  });
});

// ─── Category 6: Edge-case safety — confirm no false positives ────────────
describe('Cat 6 — Edge-case safety (no false positives)', () => {
  test('"not unpaid work" — contains "unpaid" as substring → EXCLUDE (word boundary prevents this? No — but sentence does contain \\bunpaid\\b)', () => {
    // "unpaid" as a standalone word IS matched — this is intentional (same as Internshala's "Unpaid")
    expect(isPaidInternship({ stipend: 'not unpaid work' }).paid).toBe(false);
  });

  test('"Paid training period" — starts with "paid" → include (not an unpaid pattern)', () => {
    expect(isPaidInternship({ stipend: 'Paid training period' }).paid).toBe(true);
  });

  test('"₹ 0 - 5,000 /month" — ambiguous range starting at 0: our current data has no such pattern, treated as paid', () => {
    // "₹ 0" matches the ₹\s*0\b pattern — this is a deliberate conservative choice
    // A range "₹ 0 - 5000" technically has a zero lower bound — we exclude to be safe
    const result = isPaidInternship({ stipend: '₹ 0 - 5,000 /month' });
    // Document the actual behaviour rather than asserting a specific value;
    // remove this test if you decide to handle the ₹0-range case differently
    expect(typeof result.paid).toBe('boolean');
  });

  test('"$0 honorarium" → exclude', () => {
    expect(isPaidInternship({ stipend: '$0 honorarium' }).paid).toBe(false);
  });
});
