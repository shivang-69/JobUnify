const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

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

  const googleJobs = await collection.find({ source: 'GoogleJobs' }).toArray();
  console.log(`Total GoogleJobs documents in DB: ${googleJobs.length}`);

  // Count coverage
  let countWithDatePosted = 0;
  let countWithScrapedAt = 0;
  let countWithExpiration = 0;

  for (const job of googleJobs) {
    if (job.date_posted && job.date_posted !== 'N/A') {
      countWithDatePosted++;
    }
    if (job.scrapedAt) {
      countWithScrapedAt++;
    }
    if (job.expiration_date) {
      countWithExpiration++;
    }
  }

  console.log(`\nDate Coverage Metrics:`);
  console.log(`  - Has date_posted (resolved date): ${countWithDatePosted} / ${googleJobs.length}`);
  console.log(`  - Has scrapedAt (native Date):     ${countWithScrapedAt} / ${googleJobs.length}`);
  console.log(`  - Has expiration_date:             ${countWithExpiration} / ${googleJobs.length}`);

  console.log(`\n==================================================`);
  console.log(`10 SAMPLE GOOGLEJOBS DOCUMENTS RAW FIELDS`);
  console.log(`==================================================`);

  googleJobs.slice(0, 10).forEach((j, index) => {
    console.log(`\n[Job ${index + 1}] Title: "${j.title}" | Company: "${j.company}"`);
    console.log(`  - date_posted:     ${JSON.stringify(j.date_posted)}`);
    console.log(`  - scrapedAt:       ${j.scrapedAt} (${typeof j.scrapedAt})`);
    console.log(`  - expiration_date: ${JSON.stringify(j.expiration_date)}`);
    console.log(`  - stipend:         ${JSON.stringify(j.stipend)}`);
    console.log(`  - duration:        ${JSON.stringify(j.duration)}`);
    console.log(`  - job_track:       ${JSON.stringify(j.job_track)}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
