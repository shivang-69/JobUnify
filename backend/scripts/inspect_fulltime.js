const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

async function inspectFulltime() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const collection = mongoose.connection.db.collection('jobs');

  // Let's count how many Naukri docs exist, and how many pass each stage
  const naukriTotal = await collection.countDocuments({ source: 'Naukri' });
  console.log(`Naukri total: ${naukriTotal}`);

  // Freshness check
  const todayStr = new Date().toISOString().split('T')[0];
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  const fourDaysAgoStr = fourDaysAgo.toISOString().split('T')[0];

  const naukriFresh = await collection.countDocuments({
    source: 'Naukri',
    $or: [
      { date_posted: { $gte: fourDaysAgoStr } },
      { expiration_date: { $gte: todayStr } },
      {
        $and: [
          { date_posted: { $not: { $gte: '0000-00-00' } } },
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
  });
  console.log(`Naukri fresh: ${naukriFresh}`);

  // CS/IT filter
  const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
  const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

  const freshJobs = await collection.find({
    source: 'Naukri',
    $or: [
      { date_posted: { $gte: fourDaysAgoStr } },
      { expiration_date: { $gte: todayStr } },
      {
        $and: [
          { date_posted: { $not: { $gte: '0000-00-00' } } },
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
  }).toArray();

  let csPassed = 0;
  let entryPassed = 0;
  const { isEntryLevel } = require('../src/utils/experienceFilter');

  for (const job of freshJobs) {
    const isCs = csWhitelist.test(job.title) && !csBlacklist.test(job.title);
    if (isCs) {
      csPassed++;
      if (isEntryLevel(job).include) {
        entryPassed++;
      } else {
        // Log a few that fail the experience filter to see if it's too aggressive
        if (entryPassed < 3) {
          console.log(`Failed exp: title="${job.title}" exp="${job.min_experience}" raw="${job.experience_raw}" status="${job.experience_status}"`);
        }
      }
    }
  }

  console.log(`Naukri fresh CS/IT: ${csPassed}`);
  console.log(`Naukri fresh CS/IT EntryLevel: ${entryPassed}`);

  await mongoose.disconnect();
}

inspectFulltime().catch(console.error);
