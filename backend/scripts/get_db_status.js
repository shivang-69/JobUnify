const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { buildFreshnessFilter } = require('../src/utils/freshnessFilter');
const { isEntryLevel } = require('../src/utils/experienceFilter');
const { isPaidInternship } = require('../src/utils/stipendFilter');

// Load env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

async function getStatus() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.db.collection('jobs');

  const filter = buildFreshnessFilter();
  const candidateJobs = await collection.find(filter).toArray();
  console.log(`Candidate jobs matching freshness: ${candidateJobs.length}`);

  // Apply experience and stipend filters
  const visibleJobs = candidateJobs.filter(job => {
    const entryCheck = isEntryLevel(job);
    if (!entryCheck.include) return false;
    if (entryCheck.track === 'internship') {
      return isPaidInternship(job).paid;
    }
    return true;
  });

  console.log(`Total active/passing entry-level jobs: ${visibleJobs.length}`);
  
  const breakdown = {};
  for (const job of visibleJobs) {
    const track = isEntryLevel(job).track;
    breakdown[track] = (breakdown[track] || 0) + 1;
  }
  console.log('Breakdown by track:', breakdown);

  const srcBreakdown = {};
  for (const job of visibleJobs) {
    srcBreakdown[job.source] = (srcBreakdown[job.source] || 0) + 1;
  }
  console.log('Breakdown by source:', srcBreakdown);

  await mongoose.disconnect();
}

getStatus().catch(console.error);
