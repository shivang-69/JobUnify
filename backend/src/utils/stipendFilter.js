/**
 * stipendFilter.js — Pure, isolated stipend / paid-internship classification.
 *
 * Determines whether an internship listing should be considered "paid".
 *
 * Behaviour summary
 * ─────────────────
 *  • Fail-OPEN: if a job has a stipend field that does NOT clearly match a
 *    known "unpaid" pattern, it is INCLUDED (treated as paid). This prevents
 *    unrecognized future formats from silently hiding paid listings.
 *  • A job is explicitly excluded ONLY when its stipend string clearly and
 *    unambiguously signals zero compensation (see UNPAID_PATTERNS below).
 *  • Only applies to internship-track jobs. Full-time roles are unaffected.
 */

// ─── Unpaid signal patterns ───────────────────────────────────────────────────
// Order: most specific → most general.
// A match on ANY of these → exclude (unpaid).
const UNPAID_PATTERNS = [
  /\bunpaid\b/i,               // "Unpaid", "UNPAID", "unpaid"
  /\bno[\s-]*stipend\b/i,      // "No stipend", "No Stipend", "no-stipend"
  /\bwithout\s*stipend\b/i,    // "without stipend"
  /₹\s*0\b/,                  // "₹0", "₹ 0"
  /\$\s*0\b/,                  // "$0", "$ 0"
  /\b0\s*(?:per\s*month|\/month|p\.m\.)\b/i, // "0 per month", "0/month"
  /\bno\s*pay\b/i,             // "no pay"
  /\bvolunteer\b/i,            // "volunteer" (used by some platforms to mean unpaid)
];

/**
 * Returns true if the internship is considered paid (should be INCLUDED in
 * results), false if it is explicitly unpaid (should be EXCLUDED).
 *
 * Fail-OPEN: unrecognized / null / missing stipend → include (paid by default).
 *
 * @param {{stipend?: string|null, salary?: string|null}} job
 * @returns {{ paid: boolean, reason: string }}
 */
function isPaidInternship(job) {
  const rawStipend = job.stipend || job.salary || '';
  const stipend = String(rawStipend).trim();

  // No stipend info at all → fail-open (treat as paid, include)
  if (!stipend || stipend === 'null' || stipend === 'undefined') {
    return { paid: true, reason: 'no_stipend_data' };
  }

  // Check every unpaid pattern
  for (const pattern of UNPAID_PATTERNS) {
    if (pattern.test(stipend)) {
      return { paid: false, reason: 'explicitly_unpaid' };
    }
  }

  // Anything else (₹ ranges, $ values, numeric strings, etc.) → paid
  return { paid: true, reason: 'paid_stipend' };
}

module.exports = { isPaidInternship };
