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
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const collection = mongoose.connection.db.collection('jobs');

  for (const src of ['Naukri', 'LinkedIn']) {
    console.log(`\n--- Newest 3 ${src} docs in DB:`);
    const docs = await collection.find({ source: src })
      .sort({ scrapedAt: -1 })
      .limit(3)
      .toArray();
    for (const d of docs) {
      console.log(`  title: "${d.title}"`);
      console.log(`  scrapedAt: ${d.scrapedAt}`);
      console.log(`  date_posted: ${d.date_posted}`);
      console.log(`  expiration_date: ${d.expiration_date}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
