/**
 * dateFormatter.test.js — Unit tests for formatPostedDate()
 */

const { formatPostedDate } = require('./dateFormatter');

describe('dateFormatter unit tests', () => {
  // Let's set a fixed relativeTo date: August 26, 2026
  const anchorDate = new Date('2026-08-26T12:00:00Z');

  test('Posted today', () => {
    // Same day
    expect(formatPostedDate('2026-08-26', anchorDate)).toBe('Posted today');
    expect(formatPostedDate('2026-08-26T00:00:00Z', anchorDate)).toBe('Posted today');
    expect(formatPostedDate('2026-08-26T23:59:59Z', anchorDate)).toBe('Posted today');
  });

  test('Posted yesterday', () => {
    // 1 day ago
    expect(formatPostedDate('2026-08-25', anchorDate)).toBe('Posted yesterday');
    expect(formatPostedDate('2026-08-25T12:00:00Z', anchorDate)).toBe('Posted yesterday');
  });

  test('Posted X days ago (2-6 days)', () => {
    // 2 days ago
    expect(formatPostedDate('2026-08-24', anchorDate)).toBe('Posted 2 days ago');
    // 3 days ago
    expect(formatPostedDate('2026-08-23', anchorDate)).toBe('Posted 3 days ago');
    // 4 days ago
    expect(formatPostedDate('2026-08-22', anchorDate)).toBe('Posted 4 days ago');
    // 5 days ago
    expect(formatPostedDate('2026-08-21', anchorDate)).toBe('Posted 5 days ago');
    // 6 days ago
    expect(formatPostedDate('2026-08-20', anchorDate)).toBe('Posted 6 days ago');
  });

  test('Posted 1 week ago (7-13 days)', () => {
    // Exactly 7 days ago
    expect(formatPostedDate('2026-08-19', anchorDate)).toBe('Posted 1 week ago');
    // 10 days ago
    expect(formatPostedDate('2026-08-16', anchorDate)).toBe('Posted 1 week ago');
    // 13 days ago
    expect(formatPostedDate('2026-08-13', anchorDate)).toBe('Posted 1 week ago');
  });

  test('Posted multiple weeks ago (14+ days)', () => {
    // Exactly 14 days ago (2 weeks)
    expect(formatPostedDate('2026-08-12', anchorDate)).toBe('Posted 2 weeks ago');
    // 20 days ago (2 weeks)
    expect(formatPostedDate('2026-08-06', anchorDate)).toBe('Posted 2 weeks ago');
    // Exactly 21 days ago (3 weeks)
    expect(formatPostedDate('2026-08-05', anchorDate)).toBe('Posted 3 weeks ago');
  });

  test('Missing or invalid dates', () => {
    expect(formatPostedDate('', anchorDate)).toBe('');
    expect(formatPostedDate(null, anchorDate)).toBe('');
    expect(formatPostedDate(undefined, anchorDate)).toBe('');
    expect(formatPostedDate('N/A', anchorDate)).toBe('');
    expect(formatPostedDate('invalid-date-string', anchorDate)).toBe('');
  });

  test('Future dates (gracefully handled as today)', () => {
    expect(formatPostedDate('2026-08-27', anchorDate)).toBe('Posted today');
  });
});
