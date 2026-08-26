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

  // Unstop is "Others" (not LinkedIn or Naukri)
  // Others condition:
  // date_posted >= sevenDaysAgoStr OR expiration_date >= todayStr OR
  // (date_posted does not exist/null/invalid AND scrapedAt >= sevenDaysAgo)
  
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

async function diagnose() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.db.collection('jobs');
  const allUnstop = await collection.find({ source: 'Unstop' }).toArray();
  console.log(`\n==================================================`);
  console.log(`STAGE-BY-STAGE COUNT FOR UNSTOP (Total: ${allUnstop.length})`);
  console.log(`==================================================`);

  let countFresh = 0;
  let countCS = 0;
  let countEntry = 0;
  let countPaidIntern = 0;
  
  const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
  const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

  const freshList = [];
  const csList = [];
  const entryList = [];
  const finalVisibleList = [];
  
  const exclusions = []; // To store excluded details

  for (const job of allUnstop) {
    const isFresh = passesFreshness(job);
    if (isFresh) {
      countFresh++;
      freshList.push(job);
      
      const isCs = csWhitelist.test(job.title) && !csBlacklist.test(job.title);
      if (isCs) {
        countCS++;
        csList.push(job);
        
        const entryCheck = isEntryLevel(job);
        if (entryCheck.include) {
          countEntry++;
          entryList.push(job);
          
          const track = entryCheck.track;
          if (track === 'internship') {
            const paidCheck = isPaidInternship(job);
            if (paidCheck.paid) {
              countPaidIntern++;
              finalVisibleList.push(job);
            } else {
              exclusions.push({ job, stage: 'isPaidInternship', reason: `Unpaid internship (${job.stipend || 'Unpaid'})` });
            }
          } else {
            countPaidIntern++; // For full-time
            finalVisibleList.push(job);
          }
        } else {
          exclusions.push({ job, stage: 'isEntryLevel', reason: `Experience filter status = "${entryCheck.status}"` });
        }
      } else {
        // CS Blacklist or Whitelist fail
        let reason = 'CS Title Filter: Whitelist fail (not a software/tech role)';
        if (csBlacklist.test(job.title)) {
          reason = 'CS Title Filter: Blacklisted keyword present in title';
        }
        exclusions.push({ job, stage: 'csFilter', reason });
      }
    } else {
      exclusions.push({ job, stage: 'freshnessFilter', reason: `Older than 7 days (posted: ${job.date_posted}, exp: ${job.expiration_date})` });
    }
  }

  console.log(`Total Unstop docs:                          ${allUnstop.length}`);
  console.log(`After freshness filter:                     ${countFresh}`);
  console.log(`After CS/IT title filter:                   ${countCS}`);
  console.log(`After isEntryLevel() (experience filter):   ${countEntry}`);
  console.log(`After isPaidInternship() (final visible):  ${countPaidIntern}`);

  // Track breakdown of the final visible jobs
  const tracks = { 'full-time': 0, 'internship': 0 };
  for (const j of finalVisibleList) {
    const track = getJobTrack(j);
    tracks[track] = (tracks[track] || 0) + 1;
  }
  console.log(`\nFinal Visible Track Breakdown:`);
  console.log(`  Full-Time:  ${tracks['full-time']}`);
  console.log(`  Internship: ${tracks['internship']}`);

  console.log(`\n==================================================`);
  console.log(`HACKATHON / COMPETITION DETECTION ANALYSIS`);
  console.log(`==================================================`);
  // Let's analyze what type of listings are in Unstop overall
  let competitions = 0;
  let quizzes = 0;
  let hackathons = 0;
  let jobPostings = 0;
  
  for (const job of allUnstop) {
    const text = `${job.title} ${job.description || ''}`.toLowerCase();
    if (text.includes('hackathon') || text.includes('coding challenge') || text.includes('hiring challenge')) {
      hackathons++;
    } else if (text.includes('quiz') || text.includes('treasure hunt')) {
      quizzes++;
    } else if (text.includes('competition') || text.includes('contest') || text.includes('case study') || text.includes('competitions')) {
      competitions++;
    } else {
      jobPostings++;
    }
  }
  console.log(`Unstop Content Classification (out of 150):`);
  console.log(`  Hackathons/Hiring Challenges: ${hackathons}`);
  console.log(`  Quizzes/Treasure Hunts:       ${quizzes}`);
  console.log(`  Other Competitions/Contests:  ${competitions}`);
  console.log(`  General Job/Internship posts: ${jobPostings}`);

  console.log(`\n==================================================`);
  console.log(`10 SAMPLE EXCLUDED UNSTOP DOCUMENTS`);
  console.log(`==================================================`);
  // Let's pull 10 sample excluded documents (mix of stages if possible)
  // Let's sort exclusions so we get some from each stage
  const sampleExclusions = [];
  const stages = ['csFilter', 'isEntryLevel', 'isPaidInternship', 'freshnessFilter'];
  for (const s of stages) {
    const stageExclusions = exclusions.filter(e => e.stage === s);
    // Take up to 3 from each stage to get a diverse sample
    sampleExclusions.push(...stageExclusions.slice(0, 3));
  }
  // Fill up to 10 if we have less
  if (sampleExclusions.length < 10) {
    const remaining = exclusions.filter(e => !sampleExclusions.includes(e));
    sampleExclusions.push(...remaining.slice(0, 10 - sampleExclusions.length));
  }

  sampleExclusions.slice(0, 10).forEach((exc, index) => {
    const { job, stage, reason } = exc;
    console.log(`\n[Sample ${index + 1}] Title: "${job.title}"`);
    console.log(`  Company:     ${job.company}`);
    console.log(`  Stage Lost:  ${stage}`);
    console.log(`  Reason:      ${reason}`);
    console.log(`  Description: ${job.description ? job.description.replace(/\n/g, ' ').substring(0, 250) + '...' : 'None'}`);
    console.log(`  stipend/exp: stipend="${job.stipend || 'None'}" min_exp="${job.min_experience}" raw_exp="${job.experience_raw}"`);
  });

  await mongoose.disconnect();
}

diagnose().catch(console.error);
