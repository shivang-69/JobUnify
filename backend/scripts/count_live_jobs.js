const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { buildFreshnessFilter } = require('../src/utils/freshnessFilter');
const { isEntryLevel } = require('../src/utils/experienceFilter');
const { isPaidInternship } = require('../src/utils/stipendFilter');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

async function run() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('jobs');

  // Query MongoDB using the official production freshness filter
  const query = buildFreshnessFilter();
  const freshJobs = await collection.find(query).toArray();
  
  const countsBySource = {};
  const liveCountsBySource = {};
  let totalLive = 0;

  for (const job of freshJobs) {
    const src = job.source || 'Unknown';
    countsBySource[src] = (countsBySource[src] || 0) + 1;

    const entryCheck = isEntryLevel(job);
    let passStipend = true;
    if (entryCheck.track === 'internship') {
      passStipend = isPaidInternship(job).paid;
    }

    if (entryCheck.include && passStipend) {
      liveCountsBySource[src] = (liveCountsBySource[src] || 0) + 1;
      totalLive++;
    }
  }

  // Also query total documents in DB for comparison
  const totalInDb = await collection.countDocuments({});
  const dbCounts = await collection.aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } }
  ]).toArray();

  console.log('\n==================================================');
  console.log('TOTAL DATABASE AND LIVE JOB STATS (OFFICIAL QUERY)');
  console.log('==================================================');
  console.log(`Total Documents in Database: ${totalInDb}\n`);

  console.log('--- Document Count by Source in DB ---');
  for (const item of dbCounts) {
    console.log(`  ${item._id || 'Unknown'}: ${item.count}`);
  }

  console.log('\n--- Fresh & Whitelisted Live Job Count by Source ---');
  for (const src of ['Internshala', 'Unstop', 'Naukri', 'GoogleJobs', 'LinkedIn']) {
    console.log(`  ${src}: ${liveCountsBySource[src] || 0}`);
  }

  console.log(`\n==================================================`);
  console.log(`TOTAL LIVE JOBS SERVED ON FRONTEND: ${totalLive}`);
  console.log(`==================================================`);

  await mongoose.disconnect();
}

run().catch(console.error);
