/**
 * freshnessFilter.js — Helper to build MongoDB freshness query conditions.
 *
 * Scopes:
 *   - LinkedIn: 2 days
 *   - Naukri: 4 days
 *   - Others: 7 days
 *
 * Prevents date-vs-string type mismatches by checking both native Dates and ISO strings.
 */

function buildFreshnessFilter(now = new Date()) {
  const todayStr = now.toISOString().split('T')[0];
  
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const fourDaysAgo = new Date(now);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  const fourDaysAgoStr = fourDaysAgo.toISOString().split('T')[0];

  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

  return {
    $or: [
      {
        $and: [
          { source: "LinkedIn" },
          {
            $or: [
              { date_posted: { $gte: twoDaysAgoStr } },
              { expiration_date: { $gte: todayStr } },
              {
                $and: [
                  { date_posted: { $not: { $gte: "0000-00-00" } } },
                  { expiration_date: { $exists: false } },
                  {
                    $or: [
                      { scrapedAt: { $gte: twoDaysAgo } },
                      { scrapedAt: { $gte: twoDaysAgo.toISOString() } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        $and: [
          { source: "Naukri" },
          {
            $or: [
              { date_posted: { $gte: fourDaysAgoStr } },
              { expiration_date: { $gte: todayStr } },
              {
                $and: [
                  { date_posted: { $not: { $gte: "0000-00-00" } } },
                  { expiration_date: { $exists: false } },
                  {
                    $or: [
                      { scrapedAt: { $gte: fourDaysAgo } },
                      { scrapedAt: { $gte: fourDaysAgo.toISOString() } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        $and: [
          { source: { $nin: ["LinkedIn", "Naukri"] } },
          {
            $or: [
              { date_posted: { $gte: sevenDaysAgoStr } },
              { expiration_date: { $gte: todayStr } },
              {
                $and: [
                  { date_posted: { $not: { $gte: "0000-00-00" } } },
                  { expiration_date: { $exists: false } },
                  {
                    $or: [
                      { scrapedAt: { $gte: sevenDaysAgo } },
                      { scrapedAt: { $gte: sevenDaysAgo.toISOString() } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

module.exports = { buildFreshnessFilter };
