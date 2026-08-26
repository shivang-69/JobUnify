/**
 * freshnessFilter.test.js — Unit tests for buildFreshnessFilter()
 */

const { buildFreshnessFilter } = require('./freshnessFilter');

// A simple in-memory MongoDB query interpreter for testing
function matches(doc, query) {
  if (!query || typeof query !== 'object') return false;

  for (const key of Object.keys(query)) {
    const val = query[key];

    if (key === '$or') {
      if (!Array.isArray(val)) return false;
      if (!val.some(q => matches(doc, q))) return false;
    } else if (key === '$and') {
      if (!Array.isArray(val)) return false;
      if (!val.every(q => matches(doc, q))) return false;
    } else if (key === '$nin') {
      if (!Array.isArray(val)) return false;
      if (val.includes(doc)) return false;
    } else if (key === '$not') {
      if (matches(doc, val)) return false;
    } else if (key === '$exists') {
      const exists = doc !== undefined && doc !== null;
      if (val !== exists) return false;
    } else if (key === '$gte') {
      if (doc === undefined || doc === null) return false;
      // In JavaScript, Date vs Date, String vs String work with comparison operators.
      // If we compare Date vs String, we must handle type conversions just like we want.
      // But in MongoDB, they must match types.
      // So here we require strict type compatibility to simulate the bug!
      const docVal = doc instanceof Date ? doc.getTime() : doc;
      const targetVal = val instanceof Date ? val.getTime() : val;
      
      // Strict type check to prevent Date-vs-string comparison passing silently
      if (typeof docVal !== typeof targetVal) {
        return false; 
      }
      if (docVal < targetVal) return false;
    } else {
      // Field path query
      const docFieldVal = doc[key];
      if (val && typeof val === 'object' && !(val instanceof Date)) {
        if (!matches(docFieldVal, val)) return false;
      } else {
        // Direct value equality
        if (docFieldVal instanceof Date && val instanceof Date) {
          if (docFieldVal.getTime() !== val.getTime()) return false;
        } else if (docFieldVal !== val) {
          return false;
        }
      }
    }
  }
  return true;
}

describe('Freshness Filter Query Tests', () => {
  const anchorDate = new Date('2026-08-26T12:00:00Z');
  const twoDaysAgo = new Date(anchorDate);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const fourDaysAgo = new Date(anchorDate);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  const sevenDaysAgo = new Date(anchorDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const filter = buildFreshnessFilter(anchorDate);

  test('Query structure contains both Date and ISO string fallbacks', () => {
    // Check that we have both Date object and ISO string in the scrapedAt $or for Naukri
    const naukriBranch = filter.$or.find(branch => 
      branch.$and && branch.$and.some(cond => cond.source === 'Naukri')
    );
    expect(naukriBranch).toBeDefined();

    const conds = naukriBranch.$and[1].$or[2].$and[2].$or;
    expect(conds).toBeDefined();
    expect(conds).toContainEqual({ scrapedAt: { $gte: fourDaysAgo } });
    expect(conds).toContainEqual({ scrapedAt: { $gte: fourDaysAgo.toISOString() } });
  });

  test('Naukri: document with native Date scrapedAt passes', () => {
    const doc = {
      source: 'Naukri',
      date_posted: null,
      scrapedAt: new Date(anchorDate.getTime() - 1000 * 60 * 60) // 1 hour ago (Date)
    };
    expect(matches(doc, filter)).toBe(true);
  });

  test('Naukri: document with ISO String scrapedAt passes', () => {
    const doc = {
      source: 'Naukri',
      date_posted: null,
      scrapedAt: new Date(anchorDate.getTime() - 1000 * 60 * 60).toISOString() // 1 hour ago (String)
    };
    expect(matches(doc, filter)).toBe(true);
  });

  test('Naukri: document with stale date_posted from 2024 does NOT fall back to scrapedAt', () => {
    const doc = {
      source: 'Naukri',
      date_posted: '2024-07-31', // valid but stale date_posted
      scrapedAt: new Date() // scraped today
    };
    // Should be excluded because date_posted is stale and is not null/missing
    expect(matches(doc, filter)).toBe(false);
  });

  test('Naukri: document with very old scrapedAt fails', () => {
    const doc = {
      source: 'Naukri',
      date_posted: null,
      scrapedAt: new Date(anchorDate.getTime() - 1000 * 60 * 60 * 24 * 5) // 5 days ago (stale)
    };
    expect(matches(doc, filter)).toBe(false);
  });

  test('LinkedIn: document with native Date scrapedAt passes', () => {
    const doc = {
      source: 'LinkedIn',
      date_posted: null,
      scrapedAt: new Date(anchorDate.getTime() - 1000 * 60 * 60) // 1 hour ago (Date)
    };
    expect(matches(doc, filter)).toBe(true);
  });

  test('LinkedIn: document with ISO String scrapedAt passes', () => {
    const doc = {
      source: 'LinkedIn',
      date_posted: null,
      scrapedAt: new Date(anchorDate.getTime() - 1000 * 60 * 60).toISOString() // 1 hour ago (String)
    };
    expect(matches(doc, filter)).toBe(true);
  });

  test('LinkedIn: document with stale scrapedAt fails', () => {
    const doc = {
      source: 'LinkedIn',
      date_posted: null,
      scrapedAt: new Date(anchorDate.getTime() - 1000 * 60 * 60 * 24 * 3) // 3 days ago (stale)
    };
    expect(matches(doc, filter)).toBe(false);
  });

  test('Date-vs-string type mismatch prevention', () => {
    // Test that the interpreter itself catches type mismatches
    // if we did NOT have the string fallback condition
    const badFilter = {
      $or: [
        {
          $and: [
            { source: 'Naukri' },
            {
              $or: [
                { scrapedAt: { $gte: fourDaysAgo } } // ONLY Date comparison
              ]
            }
          ]
        }
      ]
    };

    const docWithString = {
      source: 'Naukri',
      scrapedAt: new Date(anchorDate.getTime() - 1000 * 60 * 60).toISOString() // String
    };

    // The document with string scrapedAt must fail under the bad filter because of type mismatch
    expect(matches(docWithString, badFilter)).toBe(false);
  });
});
