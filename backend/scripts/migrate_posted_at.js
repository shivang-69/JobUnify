const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

async function migrate() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.db.collection('jobs');
  const query = { source: { $in: ['Internshala', 'Unstop'] } };
  const jobs = await collection.find(query).toArray();
  console.log(`Found ${jobs.length} Internshala/Unstop jobs to migrate`);

  let updated = 0;
  for (const job of jobs) {
    let postedAt = null;

    if (job.date_posted && job.date_posted !== 'N/A') {
      const date = new Date(job.date_posted);
      if (!isNaN(date.getTime())) {
        postedAt = date;
      }
    }

    // Fallback to scrapedAt if date_posted is missing/invalid
    if (!postedAt && job.scrapedAt) {
      const date = new Date(job.scrapedAt);
      if (!isNaN(date.getTime())) {
        postedAt = date;
      }
    }

    if (postedAt) {
      await collection.updateOne(
        { _id: job._id },
        { $set: { posted_at: postedAt } }
      );
      updated++;
    }
  }

  console.log(`Successfully migrated ${updated} jobs with posted_at field!`);
  await mongoose.disconnect();
}

migrate().catch(console.error);
