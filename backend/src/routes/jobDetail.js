const mongoose = require('mongoose');
const { buildFreshnessFilter } = require('../utils/freshnessFilter');
const { isEntryLevel } = require('../utils/experienceFilter');
const { isPaidInternship } = require('../utils/stipendFilter');
const { formatPostedDate } = require('../utils/dateFormatter');

const CATEGORIES = {
  'software-developer': {
    slug: 'software-developer',
    roleKey: 'software',
    heading: 'Software Developer Jobs',
    canonical: 'https://www.jobunify.online/jobs/software-developer'
  },
  'qa-testing': {
    slug: 'qa-testing',
    roleKey: 'qa',
    heading: 'QA & Testing Jobs',
    canonical: 'https://www.jobunify.online/jobs/qa-testing'
  },
  'data-analytics': {
    slug: 'data-analytics',
    roleKey: 'data',
    heading: 'Data & Analytics Jobs',
    canonical: 'https://www.jobunify.online/jobs/data-analytics'
  },
  'ui-ux-design': {
    slug: 'ui-ux-design',
    roleKey: 'design',
    heading: 'Design & UI/UX Jobs',
    canonical: 'https://www.jobunify.online/jobs/ui-ux-design'
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseSalary(salaryStr) {
  if (!salaryStr || typeof salaryStr !== 'string') return null;
  const s = salaryStr.toLowerCase();
  if (s.includes('not disclosed') || s.includes('unpaid') || s.includes('competitive') || s.includes('best in industry')) {
    return null;
  }

  const cleanStr = s.replace(/,/g, '');
  const matches = cleanStr.match(/\d+(\.\d+)?/g);
  if (!matches || matches.length === 0) return null;

  let numbers = matches.map(Number);
  const isLpa = s.includes('lpa') || s.includes('lakh') || s.includes('lac') || s.includes('annum') || s.includes('annual');

  if (isLpa) {
    numbers = numbers.map(n => n < 100 ? n * 100000 : n);
  }

  const validNumbers = numbers.filter(n => n >= 500);
  if (validNumbers.length === 0) return null;

  let minVal, maxVal;
  if (validNumbers.length === 1) {
    minVal = validNumbers[0];
    maxVal = validNumbers[0];
  } else {
    minVal = Math.min(...validNumbers);
    maxVal = Math.max(...validNumbers);
  }

  const unitText = isLpa ? 'YEAR' : 'MONTH';

  return {
    '@type': 'MonetaryAmount',
    'currency': 'INR',
    'value': {
      '@type': 'QuantitativeValue',
      'minValue': minVal,
      'maxValue': maxVal,
      'unitText': unitText
    }
  };
}

function detectCategory(job) {
  const text = `${job?.title || ''} ${job?.roleKey || ''} ${job?.description || ''}`.toLowerCase();
  if (text.includes('qa') || text.includes('testing') || text.includes('test') || text.includes('sdet') || text.includes('quality')) {
    return 'qa-testing';
  }
  if (text.includes('data') || text.includes('analyst') || text.includes('analytics') || text.includes('science') || text.includes('bi')) {
    return 'data-analytics';
  }
  if (text.includes('design') || text.includes('ui') || text.includes('ux') || text.includes('product design') || text.includes('figma')) {
    return 'ui-ux-design';
  }
  return 'software-developer';
}

function buildJobCard(job) {
  const source = job.source || 'Unknown';
  const sourceClass = source.toLowerCase();
  const letter = (job.company || 'J')[0].toUpperCase();
  const colors = {
    'Internshala': '#22c55e',
    'Naukri': '#38bdf8',
    'GoogleJobs': '#6c63ff'
  };
  const logoBg = colors[source] || '#6c63ff';
  const dateStr = formatPostedDate(job.posted_at || job.date_posted || job.scrapedAt);

  const tags = [];
  if (job.type) tags.push(job.type);
  if (job.duration) tags.push(job.duration);
  const tagsHtml = tags.length ? `<div class="job-tags">${tags.map(t => `<div class="tag">💼 ${escapeHtml(t)}</div>`).join('')}</div>` : '';

  return `
    <div class="job-card">
      <div class="card-top">
        <div class="company-logo" style="background:${logoBg};color:#fff">
          ${letter}
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="source-badge source-${sourceClass}">
            ${escapeHtml(source)}
          </span>
          <span class="fresher-badge" style="background:rgba(108, 99, 255, 0.12); border:1px solid rgba(108, 99, 255, 0.3); color:var(--accent2, #a5b4fc); font-size:11px; font-weight:600; padding:4px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; letter-spacing:0.2px;">
            <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            0 exp
          </span>
        </div>
      </div>
      <div class="job-title">
        ${escapeHtml(job.title || 'N/A')}
      </div>
      <div class="company-name">
        ${escapeHtml(job.company || 'N/A')} · ${escapeHtml(job.location || 'N/A')}
        ${dateStr ? ` · <span class="posted-date">${escapeHtml(dateStr)}</span>` : ''}
      </div>
      ${tagsHtml}
      <div class="card-footer">
        <div class="stipend">
          ${escapeHtml(job.stipend || job.salary || 'Not disclosed')}
        </div>
        <div style="display:flex; gap:8px;">
          ${job.job_url ? `<a href="${escapeHtml(job.job_url)}" target="_blank" rel="noopener" class="apply-btn">Apply →</a>` : `<button class="apply-btn" disabled>Not Available</button>`}
          <a href="/jobs/detail/${job._id}" class="details-btn" style="text-decoration:none; padding:8px 12px; border-radius:6px; background:#475569; color:#fff; font-size:0.875rem; font-weight:500; display:inline-flex; align-items:center; transition:background 0.2s;">Details</a>
        </div>
      </div>
    </div>
  `;
}

async function getLiveFallbackJobs(categorySlug, excludeId = null, limit = 6) {
  try {
    if (!mongoose.connection || !mongoose.connection.db) {
      return [];
    }
    const cat = CATEGORIES[categorySlug] || CATEGORIES['software-developer'];
    const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
    const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

    const filter = {
      $and: [
        buildFreshnessFilter(),
        { title: { $regex: csWhitelist } },
        { title: { $not: { $regex: csBlacklist } } },
        { source: { $nin: ['Unstop', 'LinkedIn'] } },
        { is_broken: { $ne: true } },
        {
          $or: [
            { title: new RegExp(cat.roleKey, 'i') },
            { company: new RegExp(cat.roleKey, 'i') }
          ]
        }
      ]
    };

    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      filter.$and.push({ _id: { $ne: new mongoose.Types.ObjectId(excludeId) } });
    }

    const candidateJobs = await mongoose.connection.db
      .collection('jobs')
      .find(filter)
      .sort({ scrapedAt: -1, date_posted: -1 })
      .limit(30)
      .toArray();

    const visibleJobs = candidateJobs.filter(job => {
      const { include, track } = isEntryLevel(job);
      if (!include) return false;
      if (track === 'internship') return isPaidInternship(job).paid;
      return true;
    });

    return visibleJobs.slice(0, limit);
  } catch (err) {
    console.error('Error fetching live fallback jobs:', err);
    return [];
  }
}

function renderFallbackPage(res, { job, categorySlug, fallbackJobs }) {
  const cat = CATEGORIES[categorySlug] || CATEGORIES['software-developer'];
  const jobTitle = job?.title ? escapeHtml(job.title) : 'This position';
  const companyName = job?.company ? escapeHtml(job.company) : '';

  const fallbackCardsHtml = fallbackJobs.length > 0
    ? fallbackJobs.map(buildJobCard).join('\n')
    : '<div class="empty" style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">No current listings in this category right now. Check back soon!</div>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Job Expired — JobUnify</title>
  <meta name="description" content="This job posting has expired or is no longer accepting applications. Browse verified entry-level tech jobs on JobUnify." />
  <meta name="robots" content="noindex, follow" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/jobunify-logo.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/jobunify-logo-192.png" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/style.css" />
  <style>
    .expired-banner {
      max-width: 800px;
      margin: 40px auto 32px;
      padding: 32px 24px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 16px;
      text-align: center;
    }
    .expired-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(239, 68, 68, 0.18);
      color: #f87171;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 16px;
      letter-spacing: 0.3px;
    }
    .expired-banner h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 2rem;
      margin: 0 0 12px;
      color: #fff;
    }
    .expired-banner p {
      color: #cbd5e1;
      font-size: 1rem;
      line-height: 1.6;
      max-width: 600px;
      margin: 0 auto 24px;
    }
    .expired-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .browse-all-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #6c63ff;
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      padding: 12px 24px;
      border-radius: 8px;
      transition: background 0.2s, transform 0.1s;
    }
    .browse-all-btn:hover {
      background: #5b52e0;
      transform: translateY(-1px);
    }
    .browse-category-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      text-decoration: none;
      font-weight: 500;
      padding: 12px 20px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      transition: background 0.2s;
    }
    .browse-category-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    .fallback-section {
      max-width: 1200px;
      margin: 0 auto 60px;
      padding: 0 20px;
    }
    .fallback-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.3rem;
      color: #f8fafc;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
  </style>
</head>
<body>

  <!-- NAVBAR -->
  <nav>
    <div class="logo">
      <a href="/" style="display:flex; align-items:center; text-decoration:none; color:inherit;">
        <img src="/jobunify-logo.svg" alt="JobUnify logo" width="24" height="24" style="vertical-align:middle; margin-right:6px;" />
        Job<span>Unify</span>
      </a>
    </div>
    <div class="nav-links">
      <a href="/" style="color:#cbd5e1; text-decoration:none; font-size:0.95rem; margin-right:16px;">All Jobs</a>
      <a href="/signup.html"><button class="nav-btn">Sign Up Free</button></a>
    </div>
  </nav>

  <main>
    <div class="expired-banner">
      <div class="expired-badge">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        Status: Expired / Closed
      </div>
      <h1>This job has expired</h1>
      <p>
        ${companyName ? `The listing for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> is no longer accepting applications.` : 'The job listing you are looking for has expired or is no longer accepting applications.'}
        Check out fresh, verified 0-experience opportunities below!
      </p>
      <div class="expired-actions">
        <a href="/" class="browse-all-btn">← Browse All Active Jobs</a>
        <a href="${cat.canonical}" class="browse-category-btn">View ${escapeHtml(cat.heading)}</a>
      </div>
    </div>

    <section class="fallback-section">
      <div class="fallback-title">
        <span>✨</span> Fresh Openings in ${escapeHtml(cat.heading)}
      </div>
      <div class="job-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:20px;">
        ${fallbackCardsHtml}
      </div>
    </section>
  </main>

</body>
</html>`;

  res.status(410);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

function renderActiveJobPage(res, { job, categorySlug }) {
  const cat = CATEGORIES[categorySlug] || CATEGORIES['software-developer'];
  const title = escapeHtml(job.title || 'Job Opening');
  const company = escapeHtml(job.company || 'Company');
  const location = escapeHtml(job.location || 'India');
  const source = escapeHtml(job.source || 'JobUnify');
  const sourceClass = (job.source || 'googlejobs').toLowerCase();
  const dateStr = formatPostedDate(job.posted_at || job.date_posted || job.scrapedAt);
  const letter = (job.company || 'J')[0].toUpperCase();
  const colors = {
    'Internshala': '#22c55e',
    'Naukri': '#38bdf8',
    'GoogleJobs': '#6c63ff'
  };
  const logoBg = colors[job.source] || '#6c63ff';

  const canonicalUrl = `https://www.jobunify.online/jobs/detail/${job._id}`;
  const pageTitle = `${title} at ${company} — 0 Exp Jobs | JobUnify`;
  const metaDesc = `Apply for ${title} at ${company}. Verified entry-level position with 0-2 years experience required. Aggregated and verified on JobUnify.`;

  // Build JSON-LD schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    'title': job.title || 'Job Opening',
    'description': job.description || `${job.title} at ${job.company}`,
    'datePosted': job.date_posted || (job.scrapedAt instanceof Date ? job.scrapedAt.toISOString() : job.scrapedAt),
    'hiringOrganization': {
      '@type': 'Organization',
      'name': job.company || 'Company'
    },
    'jobLocation': {
      '@type': 'Place',
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': job.location || 'India',
        'addressCountry': 'IN'
      }
    },
    'employmentType': job.type || (job.track === 'internship' ? 'INTERNSHIP' : 'FULL_TIME'),
    'directApply': true,
    'url': canonicalUrl
  };

  const salaryData = parseSalary(job.stipend || job.salary);
  if (salaryData) {
    jsonLd.baseSalary = salaryData;
  }

  const tags = [];
  if (job.type) tags.push(job.type);
  if (job.duration) tags.push(job.duration);
  const tagsHtml = tags.length ? `<div class="job-tags" style="display:flex; gap:8px; margin:16px 0;">${tags.map(t => `<div class="tag" style="background:rgba(255,255,255,0.06); padding:4px 10px; border-radius:6px; font-size:12px; color:#cbd5e1;">💼 ${escapeHtml(t)}</div>`).join('')}</div>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/jobunify-logo.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/jobunify-logo-192.png" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/style.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    .detail-container {
      max-width: 840px;
      margin: 40px auto 60px;
      padding: 0 20px;
    }
    .back-nav {
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .back-link {
      color: #a5b4fc;
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: color 0.2s;
    }
    .back-link:hover {
      color: #c7d2fe;
    }
    .detail-card {
      background: #131b2e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 36px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .detail-header {
      display: flex;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .detail-logo {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .detail-heading-wrap {
      flex: 1;
    }
    .detail-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.8rem;
      color: #fff;
      margin: 0 0 8px;
      line-height: 1.3;
    }
    .detail-company {
      font-size: 1.15rem;
      color: #94a3b8;
      font-weight: 500;
    }
    .detail-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      padding: 20px 0;
      margin: 20px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .meta-box {
      font-size: 0.85rem;
      color: #94a3b8;
    }
    .meta-box strong {
      display: block;
      color: #f8fafc;
      font-size: 1rem;
      margin-top: 4px;
      font-weight: 600;
    }
    .detail-desc-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.25rem;
      color: #f8fafc;
      margin: 28px 0 16px;
    }
    .detail-desc-content {
      line-height: 1.7;
      color: #cbd5e1;
      font-size: 1rem;
      white-space: pre-line;
      word-break: break-word;
    }
    .detail-cta {
      margin-top: 36px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .detail-apply-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #6c63ff;
      color: #fff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 1rem;
      transition: background 0.2s, transform 0.1s;
    }
    .detail-apply-btn:hover {
      background: #5b52e0;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>

  <!-- NAVBAR -->
  <nav>
    <div class="logo">
      <a href="/" style="display:flex; align-items:center; text-decoration:none; color:inherit;">
        <img src="/jobunify-logo.svg" alt="JobUnify logo" width="24" height="24" style="vertical-align:middle; margin-right:6px;" />
        Job<span>Unify</span>
      </a>
    </div>
    <div class="nav-links">
      <a href="/" style="color:#cbd5e1; text-decoration:none; font-size:0.95rem; margin-right:16px;">All Jobs</a>
      <a href="${cat.canonical}" style="color:#cbd5e1; text-decoration:none; font-size:0.95rem; margin-right:16px;">${escapeHtml(cat.heading)}</a>
      <a href="/signup.html"><button class="nav-btn">Sign Up Free</button></a>
    </div>
  </nav>

  <main class="detail-container">
    <div class="back-nav">
      <a href="${cat.canonical}" class="back-link">
        ← Back to ${escapeHtml(cat.heading)}
      </a>
    </div>

    <article class="detail-card">
      <div class="detail-header">
        <div class="detail-logo" style="background:${logoBg}; color:#fff">
          ${letter}
        </div>
        <div class="detail-heading-wrap">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
            <span class="source-badge source-${sourceClass}">${source}</span>
            <span class="fresher-badge" style="background:rgba(108, 99, 255, 0.12); border:1px solid rgba(108, 99, 255, 0.3); color:#a5b4fc; font-size:11px; font-weight:600; padding:4px 8px; border-radius:6px;">0 exp verified</span>
          </div>
          <h1 class="detail-title">${title}</h1>
          <div class="detail-company">${company}</div>
        </div>
      </div>

      <div class="detail-meta-grid">
        <div class="meta-box">
          Location
          <strong>${location}</strong>
        </div>
        <div class="meta-box">
          Stipend / Salary
          <strong>${escapeHtml(job.stipend || job.salary || 'Not disclosed')}</strong>
        </div>
        <div class="meta-box">
          Posted
          <strong>${dateStr ? escapeHtml(dateStr) : 'Recently'}</strong>
        </div>
        <div class="meta-box">
          Source Platform
          <strong>${source}</strong>
        </div>
      </div>

      ${tagsHtml}

      <div class="detail-desc-title">About the Role</div>
      <div class="detail-desc-content">
        ${escapeHtml(job.description || 'No detailed job description provided.')}
      </div>

      <div class="detail-cta">
        <div>
          <span style="color:#94a3b8; font-size:0.9rem;">Ready to apply?</span>
          <div style="color:#fff; font-weight:600;">Takes you directly to ${source}</div>
        </div>
        ${job.job_url ? `<a href="${escapeHtml(job.job_url)}" target="_blank" rel="noopener" class="detail-apply-btn">Apply on ${source} →</a>` : `<button class="detail-apply-btn" disabled style="opacity:0.5; cursor:not-allowed;">Apply Not Available</button>`}
      </div>
    </article>
  </main>

</body>
</html>`;

  res.status(200);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

async function renderJobDetailPage(req, res) {
  const { id } = req.params;

  // Validate ObjectId
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const fallbackJobs = await getLiveFallbackJobs('software-developer', null, 6);
    return renderFallbackPage(res, { job: null, categorySlug: 'software-developer', fallbackJobs });
  }

  const objectId = new mongoose.Types.ObjectId(id);

  try {
    const activeFilter = {
      _id: objectId,
      is_broken: { $ne: true },
      source: { $nin: ['Unstop', 'LinkedIn'] },
      ...buildFreshnessFilter()
    };

    const activeJob = await mongoose.connection.db
      .collection('jobs')
      .findOne(activeFilter);

    if (activeJob) {
      const { include } = isEntryLevel(activeJob);
      if (include) {
        const categorySlug = detectCategory(activeJob);
        return renderActiveJobPage(res, { job: activeJob, categorySlug });
      }
    }

    // Job is expired, broken, or not found in active listings
    // Try to find the document to see if it ever existed (to extract category/title/company)
    const rawJob = await mongoose.connection.db
      .collection('jobs')
      .findOne({ _id: objectId });

    const categorySlug = rawJob ? detectCategory(rawJob) : 'software-developer';
    const fallbackJobs = await getLiveFallbackJobs(categorySlug, id, 6);

    return renderFallbackPage(res, { job: rawJob, categorySlug, fallbackJobs });
  } catch (err) {
    console.error('Error rendering job detail page:', err);
    try {
      const fallbackJobs = await getLiveFallbackJobs('software-developer', null, 6);
      return renderFallbackPage(res, { job: null, categorySlug: 'software-developer', fallbackJobs });
    } catch (fallbackErr) {
      return res.status(500).send('Internal Server Error');
    }
  }
}

module.exports = {
  renderJobDetailPage,
  parseSalary,
  detectCategory,
  getLiveFallbackJobs
};
