#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const { generateSitemapXml } = require('../src/utils/sitemapService');
const mongoose = require('mongoose');
const fs = require('fs');

async function run() {
  console.log('Connecting to database...');
  await connectDB();

  console.log('Regenerating sitemap.xml...');
  const xml = await generateSitemapXml();

  // Optionally write to frontend/sitemap.xml if directory exists
  const frontendSitemapPath = path.join(__dirname, '..', '..', 'frontend', 'sitemap.xml');
  try {
    fs.writeFileSync(frontendSitemapPath, xml, 'utf8');
    console.log(`Saved static copy to ${frontendSitemapPath}`);
  } catch (e) {
    console.log('Skipped writing to frontend/sitemap.xml (optional)');
  }

  console.log('Sitemap regeneration complete!');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Failed to generate sitemap:', err);
  process.exit(1);
});
