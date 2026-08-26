/**
 * dateFormatter.js — Pure, isolated relative date formatter.
 *
 * Formats a date string (e.g. "YYYY-MM-DD" or ISO string) into a user-friendly
 * relative time string:
 *  - "Posted today"
 *  - "Posted yesterday"
 *  - "Posted X days ago" (for 2-6 days)
 *  - "Posted X weeks ago" (for 7+ days)
 *
 * Scoped at day-level granularity only. No hour/minute-level outputs.
 */

/**
 * Formats a date string into relative day/week strings.
 *
 * @param {string|Date} dateString The date to format.
 * @param {Date} [relativeTo] Optional date to anchor calculations against (default: now).
 * @returns {string} Relative time message (e.g., "Posted 3 days ago").
 */
function formatPostedDate(dateString, relativeTo = new Date()) {
  if (!dateString || dateString === 'N/A' || dateString === 'null' || dateString === 'undefined') {
    return '';
  }

  const postedDate = new Date(dateString);
  if (isNaN(postedDate.getTime())) {
    return '';
  }

  // Set time of both to midnight to perform day-level subtraction cleanly
  const postedMidnight = new Date(postedDate.getFullYear(), postedDate.getMonth(), postedDate.getDate());
  const relativeMidnight = new Date(relativeTo.getFullYear(), relativeTo.getMonth(), relativeTo.getDate());

  // Difference in days
  const diffTime = relativeMidnight.getTime() - postedMidnight.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // If the date is theoretically in the future, treat it as today
    return 'Posted today';
  }

  if (diffDays === 0) {
    return 'Posted today';
  }

  if (diffDays === 1) {
    return 'Posted yesterday';
  }

  if (diffDays >= 2 && diffDays <= 6) {
    return `Posted ${diffDays} days ago`;
  }

  if (diffDays >= 7) {
    const weeks = Math.floor(diffDays / 7);
    if (weeks === 1) {
      return 'Posted 1 week ago';
    }
    return `Posted ${weeks} weeks ago`;
  }

  return '';
}

module.exports = { formatPostedDate };
