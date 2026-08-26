const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load env
const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

async function diagnose() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('CONNECTED TO MONGO');

  const collection = mongoose.connection.db.collection('jobs');

  // Task 4: Total docs across all sources
  const totalDocs = await collection.countDocuments({});
  console.log(`\n--- DB Counts ---`);
  console.log(`Total documents in DB: ${totalDocs}`);

  const sources = await collection.distinct('source');
  for (const src of sources) {
    const srcCount = await collection.countDocuments({ source: src });
    const hasPostedAt = await collection.countDocuments({ source: src, posted_at: { $exists: true } });
    console.log(`  Source "${src}": total=${srcCount}, has_posted_at=${hasPostedAt}`);
  }

  // Task 3: Check what filters are being applied in backend/src/routes/jobs.js
  // Let's run the exact query sequence from jobs.js
  const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
  const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

  const csFilter = {
    title: { $regex: csWhitelist },
    $and: [
      { title: { $not: { $regex: csBlacklist } } }
    ]
  };

  let conditions = [];
  const todayStr = new Date().toISOString().split('T')[0];
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  const fourDaysAgoStr = fourDaysAgo.toISOString().split('T')[0];

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

  conditions.push({
    $or: [
      {
        $and: [
          { source: "LinkedIn" },
          {
            $or: [
              { date_posted: { $gte: twoDaysAgoStr } },
              { expiration_date: { $gte: todayStr } },
              {
                $and: [
                  { date_posted: { $not: { $gte: "0000-00-00" } } },
                  { expiration_date: { $exists: false } },
                  {
                    $or: [
                      { scrapedAt: { $gte: twoDaysAgo } },
                      { scrapedAt: { $gte: twoDaysAgo.toISOString() } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        $and: [
          { source: "Naukri" },
          {
            $or: [
              { date_posted: { $gte: fourDaysAgoStr } },
              { expiration_date: { $gte: todayStr } },
              {
                $and: [
                  { date_posted: { $not: { $gte: "0000-00-00" } } },
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
          }
        ]
      },
      {
        $and: [
          { source: { $nin: ["LinkedIn", "Naukri"] } },
          {
            $or: [
              { date_posted: { $gte: sevenDaysAgoStr } },
              { expiration_date: { $gte: todayStr } },
              {
                $and: [
                  { date_posted: { $not: { $gte: "0000-00-00" } } },
                  { expiration_date: { $exists: false } },
                  {
                    $or: [
                      { scrapedAt: { $gte: sevenDaysAgo } },
                      { scrapedAt: { $gte: sevenDaysAgo.toISOString() } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  });

  conditions.push(csFilter);
  const filter = { $and: conditions };

  console.log(`\n--- MongoDB Filter object ---`);
  console.log(JSON.stringify(filter, null, 2));

  // Get raw matching docs from Mongo
  const candidateJobs = await collection.aggregate([
    { $match: filter },
    {
      $addFields: {
        isLinkedIn: { $cond: { if: { $eq: ["$source", "LinkedIn"] }, then: 1, else: 0 } },
        sortDate: { $ifNull: ["$date_posted", "$scrapedAt"] }
      }
    },
    { $sort: { isLinkedIn: 1, sortDate: -1 } }
  ]).toArray();

  console.log(`\nCandidate jobs returned by Mongo: ${candidateJobs.length}`);

  const { isEntryLevel } = require('../backend/src/utils/experienceFilter');
  const { isPaidInternship } = require('../backend/src/utils/stipendFilter');

  const entryLevelJobs = candidateJobs.filter(job => isEntryLevel(job).include);
  console.log(`Jobs passing isEntryLevel filter: ${entryLevelJobs.length}`);

  const visibleJobs = entryLevelJobs.filter(job => {
    const { track } = isEntryLevel(job);
    if (track === 'internship') return isPaidInternship(job).paid;
    return true;
  });
  console.log(`Jobs passing stipend filter: ${visibleJobs.length}`);

  const fullTime = visibleJobs.filter(job => isEntryLevel(job).track === 'full-time');
  const internships = visibleJobs.filter(job => job.job_track === 'internship' || isEntryLevel(job).track === 'internship');
  console.log(`  Full-Time: ${fullTime.length}`);
  console.log(`  Internship: ${internships.length}`);

  await mongoose.disconnect();
}

diagnose().catch(console.error);
