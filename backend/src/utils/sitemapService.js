const mongoose = require('mongoose');
const { buildFreshnessFilter } = require('./freshnessFilter');
const { isEntryLevel } = require('./experienceFilter');
const { isPaidInternship } = require('./stipendFilter');

const CATEGORIES = {
  'software-developer': {
    slug: 'software-developer',
    roleKey: 'software',
    roleRegex: /software|developer|programmer|engineer|frontend|backend|full\s*stack|web|react|node|python|java/i,
    canonical: 'https://www.jobunify.online/jobs/software-developer'
  },
  'software-testing': {
    slug: 'software-testing',
    roleKey: 'qa',
    roleRegex: /qa|testing|test|sdet|quality\s*assurance/i,
    canonical: 'https://www.jobunify.online/jobs/software-testing'
  },
  'data-analytics': {
    slug: 'data-analytics',
    roleKey: 'data',
    roleRegex: /data|analyst|analytics|science|database|\bbi\b/i,
    canonical: 'https://www.jobunify.online/jobs/data-analytics'
  },
  'design-ui-ux': {
    slug: 'design-ui-ux',
    roleKey: 'design',
    roleRegex: /ui\s*\/\s*ux|ui|ux|user\s*interface|user\s*experience|product\s*design|figma|web\s*design/i,
    canonical: 'https://www.jobunify.online/jobs/design-ui-ux'
  },
  'remote': {
    slug: 'remote',
    isRemote: true,
    canonical: 'https://www.jobunify.online/jobs/remote'
  }
};

let cachedSitemapXml = null;
let lastGeneratedAt = null;
let isGenerating = false;

function formatDateToIsoDay(dateVal) {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

async function generateSitemapXml() {
  if (isGenerating && cachedSitemapXml) {
    return cachedSitemapXml;
  }

  isGenerating = true;
  try {
    const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
    const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

    const csFilter = {
      title: { $regex: csWhitelist },
      $and: [
        { title: { $not: { $regex: csBlacklist } } }
      ]
    };

    const filter = {
      $and: [
        buildFreshnessFilter(),
        csFilter,
        { source: { $nin: ['Unstop', 'LinkedIn'] } },
        { is_broken: { $ne: true } }
      ]
    };

    const candidateJobs = await mongoose.connection.db
      .collection('jobs')
      .find(filter)
      .sort({ scrapedAt: -1, date_posted: -1 })
      .toArray();

    // Filter to only visible (entry-level + paid internship)
    const visibleJobs = candidateJobs.filter(job => {
      const { include, track } = isEntryLevel(job);
      if (!include) return false;
      if (track === 'internship') return isPaidInternship(job).paid;
      return true;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Build the XML sitemap
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Home Page
    xml += `  <url>\n    <loc>https://www.jobunify.online/</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // 2. Category Pages
    for (const cat of Object.values(CATEGORIES)) {
      // Find latest date for this category if possible
      const catJobs = visibleJobs.filter(job => {
        if (cat.isRemote) {
          return (job.location && /remote|work from home|wfh/i.test(job.location)) || (job.title && /\b(remote|wfh)\b/i.test(job.title));
        }
        if (cat.roleRegex) {
          return (job.title && cat.roleRegex.test(job.title)) || (job.company && cat.roleRegex.test(job.company));
        }
        const titleMatch = job.title && new RegExp(cat.roleKey, 'i').test(job.title);
        const compMatch = job.company && new RegExp(cat.roleKey, 'i').test(job.company);
        return titleMatch || compMatch;
      });
      const catDate = catJobs.length > 0 ? formatDateToIsoDay(catJobs[0].date_posted || catJobs[0].scrapedAt) : todayStr;

      xml += `  <url>\n    <loc>${cat.canonical}</loc>\n    <lastmod>${catDate}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    }

    // 3. Active Job Detail Pages (Pointing to /jobs/detail/<id> with clean lastmod)
    for (const job of visibleJobs) {
      const jobDate = formatDateToIsoDay(job.date_posted || job.scrapedAt);
      xml += `  <url>\n    <loc>https://www.jobunify.online/jobs/detail/${job._id}</loc>\n    <lastmod>${jobDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;

    cachedSitemapXml = xml;
    lastGeneratedAt = new Date();
    console.log(`[Sitemap] Successfully regenerated sitemap with ${visibleJobs.length} active jobs at ${lastGeneratedAt.toISOString()}`);
    return xml;
  } catch (err) {
    console.error('[Sitemap] Error generating sitemap:', err);
    if (cachedSitemapXml) return cachedSitemapXml;
    throw err;
  } finally {
    isGenerating = false;
  }
}

async function getSitemapXml() {
  if (cachedSitemapXml) {
    return cachedSitemapXml;
  }
  return await generateSitemapXml();
}

function getSitemapStats() {
  return {
    cached: !!cachedSitemapXml,
    lastGeneratedAt,
    length: cachedSitemapXml ? cachedSitemapXml.length : 0
  };
}

let schedulerTimer = null;

function startSitemapScheduler(intervalMs = 24 * 60 * 60 * 1000) {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  // Set up 24-hour recurring regeneration
  schedulerTimer = setInterval(async () => {
    try {
      console.log('[Sitemap] Running daily scheduled sitemap regeneration...');
      await generateSitemapXml();
    } catch (err) {
      console.error('[Sitemap] Daily scheduled regeneration failed:', err.message);
    }
  }, intervalMs);

  // Trigger initial generation in background if connected
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    generateSitemapXml().catch(err => console.error('[Sitemap] Initial generation error:', err.message));
  } else {
    mongoose.connection.once('open', () => {
      generateSitemapXml().catch(err => console.error('[Sitemap] Initial generation on connect error:', err.message));
    });
  }
}

module.exports = {
  generateSitemapXml,
  getSitemapXml,
  getSitemapStats,
  startSitemapScheduler
};
