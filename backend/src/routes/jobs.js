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
    const { source, location, type, search, page = 1, limit = 250 } = req.query;
    
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

module.exports = router;
