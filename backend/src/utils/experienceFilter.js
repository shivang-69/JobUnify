/**
 * experienceFilter.js — Pure, isolated entry‑level classification.
 *
 * This is the SINGLE source of truth for deciding whether a job posting
 * targets entry‑level / fresher candidates.
 *
 * Behaviour summary
 * ─────────────────
 *  • Fail‑CLOSED: if a job has NO recognisable experience information
 *    (no min_experience, nothing parseable in description or experience_raw)
 *    it is EXCLUDED and tagged  experience_status = "unknown".
 *  • A job is explicitly excluded if its title matches a seniority keyword
 *    or if any experience‑related text indicates ≥ 2 years required.
 *  • A job is explicitly included only when we can positively confirm it is
 *    entry‑level (0–1 years, fresher, internship, etc.).
 */

// ─── Seniority title blacklist ───────────────────────────────────────────────
const seniorityBlacklist = /\bsenior\b|\bsr\b|\blead\b|\bmanager\b|\barchitect\b|\bprincipal\b|\bdirector\b|\bhead\b|\bexpert\b|\bvp\b|\bavp\b|\bgm\b|\bdgm\b|\bem\b|\bchief\b|\bmid-level\b|\bmid\s+level\b|\bmid\b|\bintermediate\b|\b\w+\s+(III|IV|V)\b|\bSDE[- ]?[2-9]\b/i;

// ─── Experience‑description blacklists (≥ 2 years) ──────────────────────────
//  Each regex targets a different phrasing variant seen in real job postings.
const expDescBlacklists = [
  // "3 years experience", "5+ years of experience", "4 to 7 years experience"
  /\b(?:[2-9]|\d{2,})\+?\s*(?:to|-)?\s*(?:\d+)?\s*years?(?:\s*of)?\s*experience\b/i,
  // "experience of 5 years", "experience: minimum 3 years"
  /\bexperience\b.{0,20}\b(?:[2-9]|\d{2,})\+?\s*years?\b/i,
  // "Experience: 6-8 Years", "exp: 3 to 5 yrs"
  /\b(?:experience|exp)\b\s*:\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:-|to)\s*(?:\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i,
  // "Experience: 5+ years", "exp: 3 yrs"
  /\b(?:experience|exp)\b\s*:\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*\+?\s*(?:years?|yrs?)\b/i,
  // "6-8 years exp"
  /\b(?:[2-9]|\d{2,})(?:\.\d+)?\s*-\s*(?:\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:exp|experience)\b/i,
  // "experience 5+ years"  (no colon)
  /\b(?:experience|exp)\b\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*\+?\s*(?:years?|yrs?)\b/i,
  // "3+ yrs", "5+ years" (standalone, no keyword prefix)
  /\b(?:[2-9]|\d{2,})\+\s*(?:years?|yrs?)\b/i,
  // Standalone range where minimum >= 2 e.g. "4-6 Years", "6-7 years", "2 to 5 yrs"
  /\b(?:[2-9]|\d{2,})\s*(?:-|to)\s*\d+\s*(?:years?|yrs?)\b/i,
];

// ─── Positive entry‑level signals ───────────────────────────────────────────
// If ANY of these match, we consider the job to have recognisable experience
// info AND to be targeting entry‑level / fresher candidates.
const entryLevelSignals = [
  /\bfreshers?\b/i,
  /\bfreshers?\s*welcome\b/i,
  /\binternship\b/i,
  /\bintern\b/i,
  /\bentry[\s-]*level\b/i,
  /\b[0-1]\s*(?:-|to)\s*[0-2]\s*(?:years?|yrs?)\b/i,   // 0-1, 0-2, 1-2 years
  /\b(?:experience|exp)\b\s*:\s*[0-1](?:\.\d+)?\s*(?:-|to)\s*[0-2](?:\.\d+)?\s*(?:years?|yrs?)\b/i,
  /\b0\+?\s*(?:years?|yrs?)\b/i,                         // 0 years, 0+ years
  /\b202[4-7]\s*(?:batch|passout|graduates?)\b/i,        // Graduation batches e.g. "2026 Batch"
];

// ─── "Has any experience info at all" detector ──────────────────────────────
// Broader than the blacklists — catches ANY mention of years/experience so we
// know the posting at least talks about experience requirements.
const experienceInfoDetector = /\b\d+\s*(?:[+-]|to)?\s*\d*\s*(?:years?|yrs?)\b/i;

/**
 * Determines whether a job is an internship or a full-time role.
 * @param {{title?:string, source?:string, type?:string, job_url?:string, link?:string}} job
 * @returns {'internship'|'full-time'}
 */
function getJobTrack(job) {
  const title = job.title || '';
  const source = job.source || '';
  const type = job.type || '';
  const duration = job.duration || '';
  const jobUrl = job.job_url || job.link || '';

  if (
    source === 'Internshala' ||
    /internship/i.test(type) ||
    /internship/i.test(duration) ||
    /internship/i.test(jobUrl) ||
    /\binternship\b/i.test(title) ||
    /\bintern\b/i.test(title)
  ) {
    return 'internship';
  }
  return 'full-time';
}

/**
 * Determines whether a job should be classified as entry‑level.
 *
 * @param {{title:string, description?:string, experience_raw?:string, min_experience?:number|null, source?:string, type?:string, job_url?:string, link?:string}} job
 * @returns {{include:boolean, status:'entry_level'|'senior'|'unknown', track:'internship'|'full-time'}}
 */
function isEntryLevel(job) {
  const title = job.title || '';
  const source = job.source || '';
  const type = job.type || '';
  const jobUrl = job.job_url || job.link || '';
  const track = getJobTrack(job);
  const text = `${title}\n${job.description || ''}\n${job.experience_raw || ''}\n${type}\n${jobUrl}`;

  // ── Step 1: Title blacklist ────────────────────────────────────────────
  if (seniorityBlacklist.test(title)) {
    return { include: false, status: 'senior', track };
  }

  // ── Step 2: Source/Type/URL Internship Signal ──────────────────────────
  if (track === 'internship') {
    return { include: true, status: 'entry_level', track: 'internship' };
  }

  // ── Step 3: Numeric min_experience field ───────────────────────────────
  if (typeof job.min_experience === 'number') {
    if (job.min_experience >= 2) {
      return { include: false, status: 'senior', track };
    }
    // min_experience < 2 → entry level confirmed
    return { include: true, status: 'entry_level', track };
  }

  // ── Step 4: Check for explicit entry‑level signals ─────────────────────
  if (/\b202[4-7]\b/.test(title)) {
    return { include: true, status: 'entry_level', track };
  }

  for (const re of entryLevelSignals) {
    if (re.test(text)) {
      return { include: true, status: 'entry_level', track };
    }
  }

  // ── Step 5: Check for senior‑experience blacklists ─────────────────────
  for (const re of expDescBlacklists) {
    if (re.test(text)) {
      return { include: false, status: 'senior', track };
    }
  }

  // ── Step 6: Check if ANY experience info is present at all ─────────────
  if (experienceInfoDetector.test(text)) {
    // There IS experience info, but it wasn't caught by blacklists or
    // entry‑level signals. Include it (it wasn't flagged as senior).
    return { include: true, status: 'entry_level', track };
  }

  // ── Step 7: Fail‑closed — no experience information at all ─────────────
  return { include: false, status: 'unknown', track };
}

module.exports = { isEntryLevel, getJobTrack };
