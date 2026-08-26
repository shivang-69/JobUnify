const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { buildFreshnessFilter } = require('../src/utils/freshnessFilter');
const { isEntryLevel, getJobTrack } = require('../src/utils/experienceFilter');
const { isPaidInternship } = require('../src/utils/stipendFilter');

// Load env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// Simple Mongo filter matcher for freshness (since we know the structure)
function passesFreshness(job, now = new Date()) {
  const todayStr = now.toISOString().split('T')[0];
  
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  // GoogleJobs is "Others" (not LinkedIn or Naukri)
  const datePosted = job.date_posted;
  const expDate = job.expiration_date;
  const scrapedAt = job.scrapedAt ? new Date(job.scrapedAt) : null;

  if (datePosted && datePosted >= sevenDaysAgoStr) {
    return true;
  }
  if (expDate && expDate >= todayStr) {
    return true;
  }
  
  const hasNoDatePosted = !datePosted || datePosted === 'N/A' || datePosted === 'null' || datePosted === 'undefined';
  const hasNoExpDate = !expDate || expDate === 'N/A' || expDate === 'null' || expDate === 'undefined';
  
  if (hasNoDatePosted && hasNoExpDate && scrapedAt) {
    if (scrapedAt >= sevenDaysAgo) {
      return true;
    }
  }
  
  return false;
}

async function inspect() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.db.collection('jobs');

  const googleJobs = await collection.find({ source: 'GoogleJobs' }).toArray();
  console.log(`\n==================================================`);
  console.log(`STAGE-BY-STAGE PIPELINE RUN FOR GOOGLEJOBS (Total: ${googleJobs.length})`);
  console.log(`==================================================`);

  let countFresh = 0;
  let countCS = 0;
  let countEntryLevel = 0;
  let countSenior = 0;
  let countUnknown = 0;
  
  const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
  const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

  const freshJobs = [];
  const csJobs = [];
  const entryJobs = [];
  
  const allExclusions = [];

  for (const job of googleJobs) {
    const isFresh = passesFreshness(job);
    if (isFresh) {
      countFresh++;
      freshJobs.push(job);
      
      const isCs = csWhitelist.test(job.title) && !csBlacklist.test(job.title);
      if (isCs) {
        countCS++;
        csJobs.push(job);
        
        const entryCheck = isEntryLevel(job);
        if (entryCheck.status === 'entry_level') {
          countEntryLevel++;
          entryJobs.push(job);
        } else if (entryCheck.status === 'senior') {
          countSenior++;
          allExclusions.push({ job, stage: 'isEntryLevel', status: 'senior', reason: 'Explicitly senior' });
        } else {
          countUnknown++;
          allExclusions.push({ job, stage: 'isEntryLevel', status: 'unknown', reason: 'Fail-closed (unknown)' });
        }
      } else {
        allExclusions.push({ job, stage: 'csFilter', reason: 'Fails CS title filter' });
      }
    } else {
      allExclusions.push({ job, stage: 'freshnessFilter', reason: 'Fails freshness filter' });
    }
  }

  console.log(`Total GoogleJobs:                          ${googleJobs.length}`);
  console.log(`After freshness filter:                     ${countFresh}`);
  console.log(`After CS/IT title filter:                   ${countCS}`);
  console.log(`Experience Status of CS Fresh Jobs:`);
  console.log(`  - Genuinely "entry_level":                ${countEntryLevel}`);
  console.log(`  - Classified as "senior":                 ${countSenior}`);
  console.log(`  - Fail-closed "unknown":                  ${countUnknown}`);

  console.log(`\n==================================================`);
  console.log(`5 SAMPLE JOBS WITH CLEAR EXPERIENCE CLASSIFICATION`);
  console.log(`==================================================`);
  
  const whitelistedSignals = [
    /\bfresher\b/i,
    /\bfreshers?\s*welcome\b/i,
    /\binternship\b/i,
    /\bintern\b/i,
    /\bentry[\s-]*level\b/i,
    /\b[0-1]\s*(?:-|to)\s*[0-2]\s*(?:years?|yrs?)\b/i,
    /\b(?:experience|exp)\b\s*:\s*[0-1](?:\.\d+)?\s*(?:-|to)\s*[0-2](?:\.\d+)?\s*(?:years?|yrs?)\b/i,
    /\b0\+?\s*(?:years?|yrs?)\b/i,
  ];

  function getMatchingSnippet(text) {
    for (const re of whitelistedSignals) {
      const match = text.match(re);
      if (match) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        return `...${text.substring(start, end).replace(/\n/g, ' ')}... (Matched pattern: ${re})`;
      }
    }
    return 'N/A';
  }

  const entryLevelSamples = entryJobs.slice(0, 5);
  entryLevelSamples.forEach((j, index) => {
    const text = `${j.title}\n${j.description || ''}\n${j.experience_raw || ''}`;
    console.log(`\n[Sample ${index + 1}] Title: "${j.title}"`);
    console.log(`  Company:     ${j.company}`);
    console.log(`  Location:    ${j.location}`);
    console.log(`  Snippet:     ${getMatchingSnippet(text)}`);
  });

  console.log(`\n==================================================`);
  console.log(`SAMPLE JOBS LANDED IN "UNKNOWN"`);
  console.log(`==================================================`);
  
  const unknownJobs = allExclusions.filter(e => e.status === 'unknown').map(e => e.job);
  console.log(`Total unknown jobs: ${unknownJobs.length}`);
  
  unknownJobs.slice(0, 5).forEach((j, index) => {
    console.log(`\n[Unknown ${index + 1}] Title: "${j.title}"`);
    console.log(`  Company:     ${j.company}`);
    console.log(`  Description (first 250 chars):`);
    console.log(`    ${j.description.substring(0, 250).replace(/\n/g, ' ')}...`);
  });

  await mongoose.disconnect();
}

inspect().catch(console.error);
