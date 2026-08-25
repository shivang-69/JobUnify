const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

router.get('/count', async (req, res) => {
  try {
    const total = await mongoose.connection.db
      .collection('jobs')
      .countDocuments({});
      
    const platforms = await mongoose.connection.db
      .collection('jobs')
      .distinct('source');

    res.json({
      total,
      platformsCount: platforms.length,
      platforms
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { source, location, type, search, page = 1, limit = 50 } = req.query;

    // CS/IT-only Whitelist/Blacklist Regexes
    const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
    const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

    const csFilter = {
      title: { $regex: csWhitelist },
      $and: [
        { title: { $not: { $regex: csBlacklist } } }
      ]
    };

    const seniorityBlacklist = /\bsenior\b|\bsr\b|\blead\b|\bmanager\b|\barchitect\b|\bprincipal\b|\bdirector\b|\bhead\b|\bexpert\b|\bvp\b|\bavp\b|\bgm\b|\bdgm\b|\bem\b|\bchief\b|\bmid-level\b|\bmid\s+level\b|\bmid\b|\bintermediate\b/i;
    const expDescBlacklist1 = /\b(?:[2-9]|\d{2,})\+?\s*(?:to|-)?\s*(?:\d+)?\s*years?(?:\s*of)?\s*experience\b/i;
    const expDescBlacklist2 = /\bexperience\b.{0,20}\b(?:[2-9]|\d{2,})\+?\s*years?\b/i;
    const expDescBlacklist3 = /\b(?:experience|exp)\b\s*:\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:-|to)\s*(?:\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i;
    const expDescBlacklist4 = /\b(?:experience|exp)\b\s*:\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:\+)?\s*(?:years?|yrs?)\b/i;
    const expDescBlacklist5 = /\b(?:[2-9]|\d{2,})(?:\.\d+)?\s*-\s*(?:\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:exp|experience)\b/i;
    const expDescBlacklist6 = /\b(?:experience|exp)\b\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:\+)?\s*(?:years?|yrs?)\b/i;

    const experienceFilter = {
      $and: [
        { title: { $not: { $regex: seniorityBlacklist } } },
        // Apply each blacklist to both description and experience_raw
        { $or: [ { description: { $not: { $regex: expDescBlacklist1 } } }, { experience_raw: { $not: { $regex: expDescBlacklist1 } } } ] },
        { $or: [ { description: { $not: { $regex: expDescBlacklist2 } } }, { experience_raw: { $not: { $regex: expDescBlacklist2 } } } ] },
        { $or: [ { description: { $not: { $regex: expDescBlacklist3 } } }, { experience_raw: { $not: { $regex: expDescBlacklist3 } } } ] },
        { $or: [ { description: { $not: { $regex: expDescBlacklist4 } } }, { experience_raw: { $not: { $regex: expDescBlacklist4 } } } ] },
        { $or: [ { description: { $not: { $regex: expDescBlacklist5 } } }, { experience_raw: { $not: { $regex: expDescBlacklist5 } } } ] },
        { $or: [ { description: { $not: { $regex: expDescBlacklist6 } } }, { experience_raw: { $not: { $regex: expDescBlacklist6 } } } ] },
        {
          $or: [
            { min_experience: { $exists: false } },
            { min_experience: null },
            { min_experience: { $lt: 2 } }
          ]
        }
      ]
    };
    
    let conditions = [];
    if (source) conditions.push({ source });
    if (location) conditions.push({ location: new RegExp(location, 'i') });
    if (type) conditions.push({ type });
    if (search) {
      conditions.push({
        $or: [
          { title: new RegExp(search, 'i') },
          { company: new RegExp(search, 'i') }
        ]
      });
    }

    // Freshness & expiration conditions: LinkedIn = 2 days, Naukri = 4 days, Others = 7 days
    const todayStr = new Date().toISOString().split('T')[0];
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fourDaysAgoStr = fourDaysAgo.toISOString().split('T')[0];

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

    conditions.push({
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
    });

    conditions.push(csFilter);
    conditions.push(experienceFilter);

    const filter = { $and: conditions };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const jobs = await mongoose.connection.db
      .collection('jobs')
      .aggregate([
        { $match: filter },
        {
          $addFields: {
            isLinkedIn: { $cond: { if: { $eq: ["$source", "LinkedIn"] }, then: 1, else: 0 } },
            sortDate: { $ifNull: ["$date_posted", "$scrapedAt"] }
          }
        },
        { $sort: { isLinkedIn: 1, sortDate: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ])
      .toArray();

    const total = await mongoose.connection.db
      .collection('jobs')
      .countDocuments(filter);

    res.json({
      jobs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// New search endpoint (logged‑in view)
function logSearch(query, count) {
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, 'search.log');
  const line = `${new Date().toISOString()} SEARCH query="${query}" results=${count}\n`;
  fs.appendFileSync(logFile, line);
}
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';

    // CS/IT-only Whitelist/Blacklist Regexes
    const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
    const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

    const csFilter = {
      title: { $regex: csWhitelist },
      $and: [
        { title: { $not: { $regex: csBlacklist } } }
      ]
    };

    const seniorityBlacklist = /\bsenior\b|\bsr\b|\blead\b|\bmanager\b|\barchitect\b|\bprincipal\b|\bdirector\b|\bhead\b|\bexpert\b|\bvp\b|\bavp\b|\bgm\b|\bdgm\b|\bem\b|\bchief\b|\bmid-level\b|\bmid\s+level\b|\bmid\b|\bintermediate\b/i;
    const expDescBlacklist1 = /\b(?:[2-9]|\d{2,})\+?\s*(?:to|-)?\s*(?:\d+)?\s*years?(?:\s*of)?\s*experience\b/i;
    const expDescBlacklist2 = /\bexperience\b.{0,20}\b(?:[2-9]|\d{2,})\+?\s*years?\b/i;
    const expDescBlacklist3 = /\b(?:experience|exp)\b\s*:\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:-|to)\s*(?:\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i;
    const expDescBlacklist4 = /\b(?:experience|exp)\b\s*:\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:\+)?\s*(?:years?|yrs?)\b/i;
    const expDescBlacklist5 = /\b(?:[2-9]|\d{2,})(?:\.\d+)?\s*-\s*(?:\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:exp|experience)\b/i;
    const expDescBlacklist6 = /\b(?:experience|exp)\b\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:\+)?\s*(?:years?|yrs?)\b/i;

    const experienceFilter = {
      $and: [
        { title: { $not: { $regex: seniorityBlacklist } } },
        { description: { $not: { $regex: expDescBlacklist1 } } },
        { description: { $not: { $regex: expDescBlacklist2 } } },
        { description: { $not: { $regex: expDescBlacklist3 } } },
        { description: { $not: { $regex: expDescBlacklist4 } } },
        { description: { $not: { $regex: expDescBlacklist5 } } },
        { description: { $not: { $regex: expDescBlacklist6 } } },
        { experience_raw: { $not: { $regex: expDescBlacklist3 } } },
        { experience_raw: { $not: { $regex: expDescBlacklist4 } } },
        { experience_raw: { $not: { $regex: expDescBlacklist5 } } },
        { experience_raw: { $not: { $regex: expDescBlacklist6 } } },
        {
          $or: [
            { min_experience: { $exists: false } },
            { min_experience: null },
            { min_experience: { $lt: 2 } }
          ]
        }
      ]
    };

    const todayStr = new Date().toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fourDaysAgoStr = fourDaysAgo.toISOString().split('T')[0];

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

    const freshnessFilter = {
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

    let filter;
    if (!q) {
      filter = {
        $and: [
          freshnessFilter,
          csFilter,
          experienceFilter
        ]
      };
    } else {
      const regex = new RegExp(q, 'i');
      filter = {
        $and: [
          freshnessFilter,
          csFilter,
          experienceFilter,
          { $or: [ { title: regex }, { company: regex }, { location: regex } ] }
        ]
      };
    }

    console.log('Search query:', q);
    const jobs = await mongoose.connection.db
      .collection('jobs')
      .find(filter)
      .toArray();
    console.log('Found jobs count:', jobs.length);
    logSearch(q, jobs.length);
    res.json({ jobs, total: jobs.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// New endpoint to check if a job URL is broken
router.post('/check-link', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    // Use fetch to ping the URL.
    try {
      const isInternshala = url.includes('internshala.com');
      const method = isInternshala ? 'GET' : 'HEAD';
      const response = await fetch(url, {
        method: method,
        redirect: 'follow', // Follow redirects to catch Adzuna 404s
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (response.status >= 400) {
        return res.json({ status: 'broken' });
      }

      if (isInternshala && response.status === 200) {
        const text = await response.text();
        const lowerText = text.toLowerCase();
        if (lowerText.includes('applications are closed') || lowerText.includes('is closed') || lowerText.includes('expired')) {
          return res.json({ status: 'broken' });
        }
      }

      return res.json({ status: 'ok' });
    } catch (fetchErr) {
      // If we cannot reach it (e.g. CORS or network error on backend), assume ok as a fallback
      return res.json({ status: 'ok' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Batch endpoint to check multiple links before rendering
router.post('/check-links', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls)) return res.status(400).json({ error: 'Array of urls required' });

    const results = {};
    const chunkSize = 20;
    
    for (let i = 0; i < urls.length; i += chunkSize) {
      const chunk = urls.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (url) => {
        try {
          const isInternshala = url.includes('internshala.com');
          const method = isInternshala ? 'GET' : 'HEAD';
          const response = await fetch(url, {
            method: method,
            redirect: 'follow', // Follow redirects for Adzuna
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (response.status >= 400) {
            results[url] = 'broken';
          } else if (isInternshala && response.status === 200) {
            const text = await response.text();
            const lowerText = text.toLowerCase();
            if (lowerText.includes('applications are closed') || lowerText.includes('is closed') || lowerText.includes('expired')) {
              results[url] = 'broken';
            } else {
              results[url] = 'ok';
            }
          } else {
            results[url] = 'ok';
          }
        } catch (err) {
          results[url] = 'ok';
        }
      }));
    }
    
    return res.json({ results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
