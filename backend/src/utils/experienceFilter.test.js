/**
 * experienceFilter.test.js — Comprehensive test suite for isEntryLevel().
 *
 * Categories covered:
 *   1. Real mis-filtered jobs (Mulesoft/Kadel Labs, Python/Apex 2000)
 *   2. Range-format experience ("0-2 years" passes, "2-5 years" fails)
 *   3. "freshers welcome" with unrelated senior keywords elsewhere
 *   4. Abbreviated formats like "3+ yrs"
 *   5. Internship postings
 *   6. Missing experience data → fail-closed (unknown)
 *   7. Subtle senior titles ("Lead Python Developer", "Python Developer III")
 *   8. Genuine entry-level jobs that MUST pass
 */

const { isEntryLevel } = require('./experienceFilter');

// ═══════════════════════════════════════════════════════════════════════════
// Category 1: Real mis-filtered jobs (MUST be excluded)
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 1: Real mis-filtered jobs', () => {
  test('Mulesoft Developer / Kadel Labs — experience_raw "Experience: 6-8 Years"', () => {
    const result = isEntryLevel({
      title: 'Mulesoft Developer',
      description: 'About the Role We are seeking an experienced MuleSoft Developer to design, develop, and maintain robust integration solutions using the MuleSoft Anypoint Platform.',
      experience_raw: 'Experience: 6-8 Years',
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('Python Developer / Apex 2000 — no experience_raw, no min_experience (fail-closed)', () => {
    const result = isEntryLevel({
      title: 'Python Developer',
      description: 'We are seeking a skilled and enthusiastic Python Developer to join our dynamic team. You will be responsible for coordinating with development teams to determine application requirements, writing scalable code, testing and debugging applications.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('unknown');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category 2: Range-format experience
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 2: Range-format experience', () => {
  test('"0-2 years experience" → should PASS (entry level)', () => {
    const result = isEntryLevel({
      title: 'Software Developer',
      description: 'Looking for candidates with 0-2 years experience in web development.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('"0-1 years" → should PASS (entry level)', () => {
    const result = isEntryLevel({
      title: 'Junior Developer',
      description: 'Ideal candidates have 0-1 years of relevant experience.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('"2-5 years experience" → should FAIL (senior)', () => {
    const result = isEntryLevel({
      title: 'Python Developer',
      description: 'Requires 2-5 years experience in Python and Django.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"4 to 7 years experience" → should FAIL (senior)', () => {
    const result = isEntryLevel({
      title: 'Java Developer',
      description: 'Must have 4 to 7 years experience in Java backend development.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"1-2 years" → should PASS (entry level)', () => {
    const result = isEntryLevel({
      title: 'Frontend Developer',
      description: 'Experience: 1-2 years working with React or Angular.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category 3: "freshers welcome" with unrelated senior keywords elsewhere
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 3: Freshers welcome phrasing', () => {
  test('"Freshers welcome" with "senior management" in description → should PASS', () => {
    const result = isEntryLevel({
      title: 'Software Developer',
      description: 'Freshers welcome. You will report to senior management and work on exciting projects.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('"Fresher" keyword alone → should PASS', () => {
    const result = isEntryLevel({
      title: 'QA Engineer',
      description: 'Open for fresher candidates. Training provided.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category 4: Abbreviated formats
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 4: Abbreviated formats', () => {
  test('"3+ yrs" → should FAIL (senior)', () => {
    const result = isEntryLevel({
      title: 'Backend Developer',
      description: 'Requires 3+ yrs of backend experience with Node.js.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"5+ years" → should FAIL (senior)', () => {
    const result = isEntryLevel({
      title: 'DevOps Engineer',
      description: 'Must have 5+ years working with AWS and CI/CD pipelines.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"exp: 4 yrs" → should FAIL (senior)', () => {
    const result = isEntryLevel({
      title: 'React Developer',
      description: 'Build modern UIs. Exp: 4 yrs minimum.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"Experience 3+ years" (no colon) → should FAIL (senior)', () => {
    const result = isEntryLevel({
      title: 'Data Engineer',
      description: 'Experience 3+ years in data pipeline development.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category 5: Internship postings (MUST pass)
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 5: Internship postings', () => {
  test('Internship posting with no experience info → should PASS', () => {
    const result = isEntryLevel({
      title: 'Software Developer Internship',
      description: 'Join us for a 6-month internship program working on real projects.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('Internship posting with "intern" in description → should PASS', () => {
    const result = isEntryLevel({
      title: 'Web Developer',
      description: 'This is an intern position. Stipend: 15000/month.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('Internshala posting with source: "Internshala" → should PASS', () => {
    const result = isEntryLevel({
      title: 'Web Development',
      company: 'Nynex Realty',
      source: 'Internshala',
      job_url: 'https://internshala.com/internship/detail/web-development-internship123',
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category 6: Missing experience data → fail-closed (unknown)
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 6: Missing experience data (fail-closed)', () => {
  test('No description, no experience_raw, no min_experience → EXCLUDED as unknown', () => {
    const result = isEntryLevel({
      title: 'Data Analyst',
      description: null,
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('unknown');
  });

  test('Generic description, no experience keywords → EXCLUDED as unknown', () => {
    const result = isEntryLevel({
      title: 'Cloud Engineer',
      description: 'Work with AWS services to build scalable infrastructure. Strong communication skills required.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('unknown');
  });

  test('Empty strings for description and experience_raw → EXCLUDED as unknown', () => {
    const result = isEntryLevel({
      title: 'Python Developer',
      description: '',
      experience_raw: '',
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('unknown');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category 7: Subtle senior titles
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 7: Subtle senior titles', () => {
  test('"Lead Python Developer" → should FAIL (seniority in title)', () => {
    const result = isEntryLevel({
      title: 'Lead Python Developer',
      description: 'Build and maintain Python services. 0-1 years is fine.',
      experience_raw: null,
      min_experience: 0,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"Python Developer III" → should FAIL (level III seniority)', () => {
    const result = isEntryLevel({
      title: 'Python Developer III',
      description: 'Join our engineering team. Entry level welcome.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"AVP - Technology" → should FAIL (seniority in title)', () => {
    const result = isEntryLevel({
      title: 'AVP - Technology',
      description: 'Lead technology initiatives across the organization.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"Senior Software Engineer" → should FAIL (seniority in title)', () => {
    const result = isEntryLevel({
      title: 'Senior Software Engineer',
      description: 'Work on distributed systems. 0 years experience is fine.',
      experience_raw: null,
      min_experience: 0,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category 8: Genuine entry-level jobs (MUST pass)
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 8: Genuine entry-level jobs', () => {
  test('Junior developer with min_experience=0 → should PASS', () => {
    const result = isEntryLevel({
      title: 'Junior Software Developer',
      description: 'Great opportunity for freshers to learn modern web development.',
      experience_raw: 'Experience: 0-1 Years',
      min_experience: 0,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('Entry-level React developer with min_experience=1 → should PASS', () => {
    const result = isEntryLevel({
      title: 'React Developer',
      description: 'Looking for enthusiastic developers. 1 year experience preferred.',
      experience_raw: null,
      min_experience: 1,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('Fresher job with "0 years" → should PASS', () => {
    const result = isEntryLevel({
      title: 'Software Engineer',
      description: 'Open for candidates with 0 years of experience. Freshers welcome.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('Graduate trainee with "entry-level" keyword → should PASS', () => {
    const result = isEntryLevel({
      title: 'Graduate Trainee - Software',
      description: 'This is an entry-level position for recent CS graduates.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });

  test('min_experience=0 with generic description → should PASS', () => {
    const result = isEntryLevel({
      title: 'Backend Developer',
      description: 'Build APIs with Node.js and Express.',
      experience_raw: null,
      min_experience: 0,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category 9: Edge cases / additional coverage
// ═══════════════════════════════════════════════════════════════════════════

describe('Category 9: Edge cases', () => {
  test('"experience_raw" only has senior info, description is clean → should FAIL', () => {
    const result = isEntryLevel({
      title: 'Java Developer',
      description: 'Build enterprise applications.',
      experience_raw: 'Experience: 5-7 Years',
      min_experience: null,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('min_experience=5 overrides entry-level keywords in description → should FAIL', () => {
    const result = isEntryLevel({
      title: 'Python Developer',
      description: 'Freshers welcome.',
      experience_raw: null,
      min_experience: 5,
    });
    expect(result.include).toBe(false);
    expect(result.status).toBe('senior');
  });

  test('"1 year experience" in description, no other fields → should PASS', () => {
    const result = isEntryLevel({
      title: 'DevOps Engineer',
      description: 'Need 1 year experience with Docker and Kubernetes.',
      experience_raw: null,
      min_experience: null,
    });
    expect(result.include).toBe(true);
    expect(result.status).toBe('entry_level');
  });
});
