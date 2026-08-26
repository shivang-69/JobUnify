const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { isEntryLevel } = require('../utils/experienceFilter');
const { isPaidInternship } = require('../utils/stipendFilter');
const { buildFreshnessFilter } = require('../utils/freshnessFilter');
const { formatPostedDate } = require('../utils/dateFormatter');

function parseSalary(salaryStr) {
  if (!salaryStr || typeof salaryStr !== 'string') return null;
  const s = salaryStr.toLowerCase();
  if (s.includes('not disclosed') || s.includes('unpaid') || s.includes('competitive') || s.includes('best in industry')) {
    return null;
  }

  // Remove commas to avoid splitting numbers like 10,000
  const cleanStr = s.replace(/,/g, '');
  
  // Match numbers (including decimals)
  const matches = cleanStr.match(/\d+(\.\d+)?/g);
  if (!matches || matches.length === 0) return null;

  let numbers = matches.map(Number);

  // Check if it is LPA / Lakhs Per Annum
  const isLpa = s.includes('lpa') || s.includes('lakh') || s.includes('lac') || s.includes('annum') || s.includes('annual');

  if (isLpa) {
    // If it's lakh/LPA, multiply numbers < 100 by 100,000 (e.g. 3.6 -> 360000)
    numbers = numbers.map(n => n < 100 ? n * 100000 : n);
  }

  // Filter out any numbers that are too small to be a monthly or annual salary/stipend
  const validNumbers = numbers.filter(n => n >= 500);
  if (validNumbers.length === 0) return null;

  let minVal, maxVal;
  if (validNumbers.length === 1) {
    minVal = validNumbers[0];
    maxVal = validNumbers[0];
  } else {
    minVal = Math.min(...validNumbers);
    maxVal = Math.max(...validNumbers);
  }

  const unitText = isLpa ? "YEAR" : "MONTH";

  return {
    "@type": "MonetaryAmount",
    "currency": "INR",
    "value": {
      "@type": "QuantitativeValue",
      "minValue": minVal,
      "maxValue": maxVal,
      "unitText": unitText
    }
  };
}

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
    const { source, location, type, search, track, page = 1, limit = 50 } = req.query;

    // CS/IT-only Whitelist/Blacklist Regexes
    const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
    const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

    const csFilter = {
      title: { $regex: csWhitelist },
      $and: [
        { title: { $not: { $regex: csBlacklist } } }
      ]
    };

    // Experience filtering is now done in application code via isEntryLevel()
    
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
    conditions.push(buildFreshnessFilter());
    conditions.push(csFilter);
    // Exclude retired sources — data preserved in DB but not served
    conditions.push({ source: { $nin: ['Unstop', 'LinkedIn'] } });

    const filter = { $and: conditions };

    // Fetch candidate jobs from DB (without experience filter)
    const candidateJobs = await mongoose.connection.db
      .collection('jobs')
      .aggregate([
        { $match: filter },
        {
          $addFields: {
            isLinkedIn: { $cond: { if: { $eq: ["$source", "LinkedIn"] }, then: 1, else: 0 } },
            sortDate: { $ifNull: ["$date_posted", "$scrapedAt"] }
          }
        },
        { $sort: { isLinkedIn: 1, sortDate: -1 } }
      ])
      .toArray();


    // Apply experience filter in application code
    const entryLevelJobs = candidateJobs.filter(job => isEntryLevel(job).include);

    // Apply stipend filter: exclude explicitly-unpaid internships (fail-open for missing data)
    const visibleJobs = entryLevelJobs.filter(job => {
      const { track } = isEntryLevel(job);
      if (track === 'internship') return isPaidInternship(job).paid;
      return true; // full-time jobs are unaffected
    });

    // Calculate track counts (post-stipend-filter)
    const fullTimeCount  = visibleJobs.filter(job => isEntryLevel(job).track === 'full-time').length;
    const internshipCount = visibleJobs.filter(job => isEntryLevel(job).track === 'internship').length;

    let filtered = visibleJobs;
    if (track) {
      filtered = visibleJobs.filter(job => isEntryLevel(job).track === track);
    }

    // Apply sort if sort=newest is requested
    const sort = req.query.sort;
    if (sort === 'newest') {
      filtered.sort((a, b) => {
        const dateA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
        const dateB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
        if (dateA !== dateB) {
          return dateB - dateA;
        }
        const fallbackA = new Date(a.date_posted || a.scrapedAt || 0).getTime();
        const fallbackB = new Date(b.date_posted || b.scrapedAt || 0).getTime();
        return fallbackB - fallbackA;
      });
    }

    const total = filtered.length;

    // Apply pagination on filtered results
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const jobs = filtered.slice(skip, skip + parseInt(limit));

    res.json({
      jobs,
      total,
      counts: {
        total: visibleJobs.length,
        fullTime: fullTimeCount,
        internship: internshipCount
      },
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

  // ---------------------------------------------------
  // New: Job Detail page (HTML with JobPosting schema)
  // ---------------------------------------------------
  router.get('/detail/:id', async (req, res) => {
    try {
      const job = await mongoose.connection.db.collection('jobs').findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
      if (!job) {
        return res.status(404).send('Job not found');
      }
      // Build JSON-LD schema
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": job.title || 'Job',
        "description": job.description || `${job.title} at ${job.company}`,
        "datePosted": job.date_posted || job.scrapedAt,
        "hiringOrganization": {
          "@type": "Organization",
          "name": job.company || 'Company'
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": job.location || 'Location',
            "addressCountry": "India"
          }
        },
        "employmentType": job.type || (job.track === 'internship' ? 'INTERNSHIP' : 'FULL_TIME'),
        "directApply": true,
        "url": `https://job-unify.vercel.app/api/jobs/detail/${job._id}`
      };

      const salaryData = parseSalary(job.stipend || job.salary);
      if (salaryData) {
        jsonLd.baseSalary = salaryData;
      }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${job.title} - ${job.company} | JobUnify</title>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root {
      --primary: #6c63ff;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 2rem 1rem;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      max-width: 650px;
      width: 100%;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 1.8rem;
      margin-top: 0;
      color: #fff;
    }
    .company {
      font-size: 1.1rem;
      color: var(--primary);
      font-weight: 600;
      margin-bottom: 1.5rem;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding: 1rem 0;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .meta-item {
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .meta-item strong {
      display: block;
      color: var(--text);
      font-size: 0.95rem;
      margin-bottom: 0.2rem;
    }
    .description {
      line-height: 1.6;
      color: #cbd5e1;
      font-size: 0.95rem;
      margin-bottom: 2rem;
      white-space: pre-line;
    }
    .apply-btn {
      display: inline-block;
      background: var(--primary);
      color: #fff;
      text-decoration: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      text-align: center;
      transition: opacity 0.2s;
    }
    .apply-btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${job.title}</h1>
    <div class="company">${job.company}</div>
    
    <div class="meta-grid">
      <div class="meta-item">
        <strong>Location</strong>
        ${job.location || 'N/A'}
      </div>
      <div class="meta-item">
        <strong>Posted</strong>
        ${formatPostedDate(job.date_posted || job.scrapedAt)}
      </div>
      <div class="meta-item">
        <strong>Source</strong>
        ${job.source || 'N/A'}
      </div>
    </div>

    <div class="description">
      ${job.description || 'No description provided.'}
    </div>

    ${job.job_url ? `<a href="${job.job_url}" class="apply-btn" target="_blank" rel="noopener">Apply Now →</a>` : '<button class="apply-btn" disabled style="opacity: 0.5; cursor: not-allowed;">Apply Not Available</button>'}
  </div>
</body>
</html>`;
      res.send(html);
    } catch (err) {
      res.status(500).send(err.message);
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
    };    // Experience filtering is now done in application code via isEntryLevel()

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

    // Exclude retired sources in all query branches
    const retiredSourceFilter = { source: { $nin: ['Unstop', 'LinkedIn'] } };

    let filter;
    if (!q) {
      filter = {
        $and: [
          freshnessFilter,
          csFilter,
          retiredSourceFilter
        ]
      };
    } else {
      const regex = new RegExp(q, 'i');
      filter = {
        $and: [
          freshnessFilter,
          csFilter,
          retiredSourceFilter,
          { $or: [ { title: regex }, { company: regex }, { location: regex } ] }
        ]
      };
    }

    const track = req.query.track;
    console.log('Search query:', q, 'track:', track);
    const candidateJobs = await mongoose.connection.db
      .collection('jobs')
      .find(filter)
      .toArray();
    
    // Apply experience filter in application code
    const entryLevelJobs = candidateJobs.filter(job => isEntryLevel(job).include);

    // Apply stipend filter: exclude explicitly-unpaid internships (fail-open for missing data)
    const visibleJobs = entryLevelJobs.filter(job => {
      const { track } = isEntryLevel(job);
      if (track === 'internship') return isPaidInternship(job).paid;
      return true;
    });

    const fullTimeCount  = visibleJobs.filter(job => isEntryLevel(job).track === 'full-time').length;
    const internshipCount = visibleJobs.filter(job => isEntryLevel(job).track === 'internship').length;

    let jobs = visibleJobs;
    if (track) {
      jobs = visibleJobs.filter(job => isEntryLevel(job).track === track);
    }

    // Apply sort if sort=newest is requested
    const sort = req.query.sort;
    if (sort === 'newest') {
      jobs.sort((a, b) => {
        const dateA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
        const dateB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
        if (dateA !== dateB) {
          return dateB - dateA;
        }
        const fallbackA = new Date(a.date_posted || a.scrapedAt || 0).getTime();
        const fallbackB = new Date(b.date_posted || b.scrapedAt || 0).getTime();
        return fallbackB - fallbackA;
      });
    }

    console.log('Found jobs count:', jobs.length);
    logSearch(q, jobs.length);
    res.json({
      jobs,
      total: jobs.length,
      counts: {
        total: visibleJobs.length,
        fullTime: fullTimeCount,
        internship: internshipCount
      }
    });
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
