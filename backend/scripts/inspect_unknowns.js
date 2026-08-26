const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

async function inspectUnknowns() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('jobs');

  const googleJobs = await collection.find({ source: 'GoogleJobs' }).toArray();
  const { isEntryLevel } = require('../src/utils/experienceFilter');

  const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
  const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

  const unknowns = googleJobs.filter(job => {
    const isCs = csWhitelist.test(job.title) && !csBlacklist.test(job.title);
    if (!isCs) return false;
    const entryCheck = isEntryLevel(job);
    return entryCheck.status === 'unknown';
  });

  console.log(`Found ${unknowns.length} unknown jobs.`);
  unknowns.forEach((j, index) => {
    console.log(`\n==================================================`);
    console.log(`UNKNOWN ${index + 1}: "${j.title}"`);
    console.log(`Company: "${j.company}"`);
    console.log(`Apply Link: "${j.job_url}"`);
    console.log(`Description (FULL):`);
    console.log(j.description);
    console.log(`==================================================`);
  });

  await mongoose.disconnect();
}

inspectUnknowns().catch(console.error);
