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
    
    let filter = {};
    if (source) filter.source = source;
    if (location) filter.location = new RegExp(location, 'i');
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const jobs = await mongoose.connection.db
      .collection('jobs')
      .find(filter)
      .skip(skip)
      .limit(parseInt(limit))
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
    if (!q) {
      // No query – return all jobs
      const allJobs = await mongoose.connection.db
        .collection('jobs')
        .find({})
        .toArray();
      return res.json({ jobs: allJobs, total: allJobs.length });
    }
    const regex = new RegExp(q, 'i');
    const filter = { $or: [ { title: regex }, { company: regex }, { location: regex } ] };
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
