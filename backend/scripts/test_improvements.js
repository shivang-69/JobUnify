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

// Updated test filter helper with the proposed improvements
function checkJobWithImprovements(job) {
  const title = job.title || '';
  const source = job.source || '';
  const type = job.type || '';
  const jobUrl = job.job_url || job.link || '';
  const track = getJobTrack(job);
  const text = `${title}\n${job.description || ''}\n${job.experience_raw || ''}\n${type}\n${jobUrl}`;

  // Title blacklist check
  const seniorityBlacklist = /\bsenior\b|\bsr\b|\blead\b|\bmanager\b|\barchitect\b|\bprincipal\b|\bdirector\b|\bhead\b|\bexpert\b|\bvp\b|\bavp\b|\bgm\b|\bdgm\b|\bem\b|\bchief\b|\bmid-level\b|\bmid\s+level\b|\bmid\b|\bintermediate\b|\b\w+\s+(III|IV|V)\b|\bSDE[- ]?[2-9]\b/i;
  if (seniorityBlacklist.test(title)) {
    return { include: false, status: 'senior' };
  }

  if (track === 'internship') {
    return { include: true, status: 'entry_level' };
  }

  if (typeof job.min_experience === 'number') {
    if (job.min_experience >= 2) {
      return { include: false, status: 'senior' };
    }
    return { include: true, status: 'entry_level' };
  }

  // Improved whitelists
  const improvedSignals = [
    /\bfresher\b/i,
    /\bfreshers?\s*welcome\b/i,
    /\binternship\b/i,
    /\bintern\b/i,
    /\bentry[\s-]*level\b/i,
    /\bjunior\b/i,           // NEW: Junior keyword
    /\btrainee\b/i,          // NEW: Trainee keyword
    /\bgraduate\b/i,         // NEW: Graduate keyword
    /\b[0-1]\s*(?:-|to)\s*[1-3]\s*(?:years?|yrs?)\b/i, // NEW: Support 1-3 and 0-3 ranges
    /\b(?:experience|exp)\b\s*:\s*[0-1](?:\.\d+)?\s*(?:-|to)\s*[2-3](?:\.\d+)?\s*(?:years?|yrs?)\b/i, // NEW: Support exp range variants
    /\b0\+?\s*(?:years?|yrs?)\b/i,
  ];

  for (const re of improvedSignals) {
    if (re.test(text)) {
      return { include: true, status: 'entry_level' };
    }
  }

  // Blacklist checks
  const expDescBlacklists = [
    /\b(?:[2-9]|\d{2,})\+?\s*(?:to|-)?\s*(?:\d+)?\s*years?(?:\s*of)?\s*experience\b/i,
    /\bexperience\b.{0,20}\b(?:[2-9]|\d{2,})\+?\s*years?\b/i,
    /\b(?:experience|exp)\b\s*:\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:-|to)\s*(?:\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i,
    /\b(?:experience|exp)\b\s*:\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*\+?\s*(?:years?|yrs?)\b/i,
    /\b(?:[2-9]|\d{2,})(?:\.\d+)?\s*-\s*(?:\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:exp|experience)\b/i,
    /\b(?:experience|exp)\b\s*(?:[2-9]|\d{2,})(?:\.\d+)?\s*\+?\s*(?:years?|yrs?)\b/i,
    /\b(?:[2-9]|\d{2,})\+\s*(?:years?|yrs?)\b/i,
    /\b(?:[2-9]|\d{2,})\s*(?:-|to)\s*\d+\s*(?:years?|yrs?)\b/i,
  ];

  for (const re of expDescBlacklists) {
    if (re.test(text)) {
      return { include: false, status: 'senior' };
    }
  }

  const experienceInfoDetector = /\b\d+\s*(?:[+-]|to)?\s*\d*\s*(?:years?|yrs?)\b/i;
  if (experienceInfoDetector.test(text)) {
    return { include: true, status: 'entry_level' };
  }

  return { include: false, status: 'unknown' };
}

async function testImprovements() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);

  const collection = mongoose.connection.db.collection('jobs');
  
  // Test Unstop
  const unstopJobs = await collection.find({ source: 'Unstop' }).toArray();
  const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
  const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

  const techUnstop = unstopJobs.filter(j => csWhitelist.test(j.title) && !csBlacklist.test(j.title));
  
  console.log(`\nUNSTOP IMPROVEMENT ANALYSIS:`);
  console.log(`Tech-related Unstop: ${techUnstop.length}`);
  
  let oldInclude = 0;
  let newInclude = 0;
  const newlyRecovered = [];

  for (const job of techUnstop) {
    const oldRes = isEntryLevel(job);
    const newRes = checkJobWithImprovements(job);

    if (oldRes.include) oldInclude++;
    if (newRes.include) {
      newInclude++;
      if (!oldRes.include) {
        newlyRecovered.push(job);
      }
    }
  }

  console.log(`  Old include count: ${oldInclude}`);
  console.log(`  New include count: ${newInclude}`);
  console.log(`  Newly recovered:   ${newlyRecovered.length}`);
  
  newlyRecovered.forEach(j => {
    console.log(`    - Title: "${j.title}" | Company: "${j.company}"`);
  });

  // Test Naukri too
  const naukriJobs = await collection.find({ source: 'Naukri' }).toArray();
  const techNaukri = naukriJobs.filter(j => csWhitelist.test(j.title) && !csBlacklist.test(j.title));
  
  let oldNaukriInclude = 0;
  let newNaukriInclude = 0;
  const newlyRecoveredNaukri = [];

  for (const job of techNaukri) {
    const oldRes = isEntryLevel(job);
    const newRes = checkJobWithImprovements(job);

    if (oldRes.include) oldNaukriInclude++;
    if (newRes.include) {
      newNaukriInclude++;
      if (!oldRes.include) {
        newlyRecoveredNaukri.push(job);
      }
    }
  }

  console.log(`\nNAUKRI IMPROVEMENT ANALYSIS:`);
  console.log(`Tech-related Naukri: ${techNaukri.length}`);
  console.log(`  Old include count: ${oldNaukriInclude}`);
  console.log(`  New include count: ${newNaukriInclude}`);
  console.log(`  Newly recovered:   ${newlyRecoveredNaukri.length}`);

  await mongoose.disconnect();
}

testImprovements().catch(console.error);
