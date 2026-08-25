const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { getJobTrack } = require('../src/utils/experienceFilter');

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
  const jobs = await collection.find({}).toArray();
  console.log(`Found ${jobs.length} total jobs to migrate`);

  let updated = 0;
  for (const job of jobs) {
    const track = getJobTrack(job);
    await collection.updateOne(
      { _id: job._id },
      { $set: { job_track: track } }
    );
    updated++;
  }

  console.log(`Successfully migrated ${updated} jobs with job_track field!`);
  await mongoose.disconnect();
}

migrate().catch(console.error);
