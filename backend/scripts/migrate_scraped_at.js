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
  
  // Find all documents where scrapedAt is a string (BSON type 2 is String)
  const jobs = await collection.find({ scrapedAt: { $type: 'string' } }).toArray();
  console.log(`Found ${jobs.length} jobs with string scrapedAt to migrate`);

  let updated = 0;
  for (const job of jobs) {
    const stringVal = job.scrapedAt;
    const dateVal = new Date(stringVal);
    
    // Validate date is valid
    if (isNaN(dateVal.getTime())) {
      console.warn(`Skipping invalid date for job ${job._id}: ${stringVal}`);
      continue;
    }

    await collection.updateOne(
      { _id: job._id },
      { $set: { scrapedAt: dateVal } }
    );
    updated++;
  }

  console.log(`Successfully migrated ${updated} jobs to native Date scrapedAt!`);
  
  // Verify remaining string scrapedAt
  const remaining = await collection.countDocuments({ scrapedAt: { $type: 'string' } });
  console.log(`Remaining jobs with string scrapedAt: ${remaining}`);

  await mongoose.disconnect();
}

migrate().catch(console.error);
