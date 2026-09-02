const mongoose = require('mongoose');
const { buildFreshnessFilter } = require('../utils/freshnessFilter');
const { isEntryLevel } = require('../utils/experienceFilter');
const { isPaidInternship } = require('../utils/stipendFilter');
const { formatPostedDate } = require('../utils/dateFormatter');

const CATEGORIES = {
  'software-developer': {
    slug: 'software-developer',
    roleKey: 'software',
    buttonText: 'Software Dev',
    title: '0 Experience Software Developer Jobs — JobUnify',
    heading: 'Software Developer Jobs',
    description: 'Find fresh entry-level Software Developer jobs and paid internships with 0-2 years experience. Filtered for freshers from Internshala, Naukri, and Google Jobs with no senior roles.',
    canonical: 'https://www.jobunify.online/jobs/software-developer'
  },
  'qa-testing': {
    slug: 'qa-testing',
    roleKey: 'qa',
    buttonText: 'QA & Testing',
    title: '0 Experience QA & Software Testing Jobs — JobUnify',
    heading: 'QA & Testing Jobs',
    description: 'Browse entry-level QA engineer, SDET, and software testing jobs and internships for freshers. Verified 0-2 years experience listings with zero spam.',
    canonical: 'https://www.jobunify.online/jobs/qa-testing'
  },
  'data-analytics': {
    slug: 'data-analytics',
    roleKey: 'data',
    buttonText: 'Data & Analytics',
    title: '0 Experience Data Analyst & Science Jobs — JobUnify',
    heading: 'Data & Analytics Jobs',
    description: 'Discover fresh entry-level Data Analyst, Data Science, and BI jobs and internships. Curated for graduates with 0-2 years experience across top platforms.',
    canonical: 'https://www.jobunify.online/jobs/data-analytics'
  },
  'ui-ux-design': {
    slug: 'ui-ux-design',
    roleKey: 'design',
    buttonText: 'Design / UI-UX',
    title: '0 Experience UI/UX & Product Design Jobs — JobUnify',
    heading: 'Design & UI/UX Jobs',
    description: 'Explore entry-level UI/UX designer and product design jobs and internships for freshers and early career talent. No senior roles, no duplicates.',
    canonical: 'https://www.jobunify.online/jobs/ui-ux-design'
  }
};

function buildServerJobCard(job) {
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
  const tagsHtml = tags.length ? `<div class="job-tags">${tags.map(t => `<div class="tag">💼 ${t}</div>`).join('')}</div>` : '';

  return `
    <div class="job-card">
      <div class="card-top">
        <div class="company-logo" style="background:${logoBg};color:#fff">
          ${letter}
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="source-badge source-${sourceClass}">
            ${source}
          </span>
          <span class="fresher-badge" style="background:rgba(108, 99, 255, 0.12); border:1px solid rgba(108, 99, 255, 0.3); color:var(--accent2); font-size:11px; font-weight:600; padding:4px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; letter-spacing:0.2px;">
            <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            0 exp
          </span>
        </div>
        <button class="bookmark-btn" data-job-id="${job._id}" onclick="toggleSaveJob(event, '${job._id}')" title="Save Job">
          <svg class="bookmark-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      </div>
      <div class="job-title">
        ${job.title || 'N/A'}
      </div>
      <div class="company-name">
        ${job.company || 'N/A'} · ${job.location || 'N/A'}
        ${dateStr ? ` · <span class="posted-date">${dateStr}</span>` : ''}
      </div>
      ${tagsHtml}
      <div class="card-footer">
        <div class="stipend">
          ${job.stipend || job.salary || 'Not disclosed'}
        </div>
        <div style="display:flex; gap:8px;">
          ${job.job_url ? `<a href="#" onclick="handleApply(event, '${job.job_url}')" class="apply-btn">Apply →</a>` : `<button class="apply-btn" disabled>Not Available</button>`}
          <a href="/api/jobs/detail/${job._id}" target="_blank" class="details-btn" style="text-decoration:none; padding:8px 12px; border-radius:6px; background:#475569; color:#fff; font-size:0.875rem; font-weight:500; display:inline-flex; align-items:center; transition:background 0.2s;" onmouseover="this.style.background='#334155'" onmouseout="this.style.background='#475569'">Details</a>
        </div>
      </div>
    </div>
  `;
}

async function renderCategoryPage(req, res) {
  const { role } = req.params;
  const cat = CATEGORIES[role];

  if (!cat) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Category Not Found — JobUnify</title>
        <link rel="stylesheet" href="/style.css"/>
      </head>
      <body style="background:#0b0f19; color:#fff; text-align:center; padding:100px 20px; font-family:sans-serif;">
        <h1>Category Not Found</h1>
        <p>The requested job category does not exist.</p>
        <a href="/" style="color:#6c63ff; text-decoration:none; font-weight:600;">← Back to Home</a>
      </body>
      </html>
    `);
  }

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
        { is_broken: { $ne: true } },
        {
          $or: [
            { title: new RegExp(cat.roleKey, 'i') },
            { company: new RegExp(cat.roleKey, 'i') }
          ]
        }
      ]
    };

    const candidateJobs = await mongoose.connection.db
      .collection('jobs')
      .aggregate([
        { $match: filter },
        {
          $addFields: {
            isLinkedIn: { $cond: { if: { $eq: ["$source", "LinkedIn"] }, then: 1, else: 0 } },
            sortDate: { $ifNull: ["$date_posted", "$scrapedAt"] }
          }
        },
        { $sort: { isLinkedIn: 1, sortDate: -1 } },
        { $limit: 50 }
      ])
      .toArray();

    const visibleJobs = candidateJobs.filter(job => {
      const { include, track } = isEntryLevel(job);
      if (!include) return false;
      if (track === 'internship') return isPaidInternship(job).paid;
      return true;
    });

    const jobsHtml = visibleJobs.length > 0
      ? visibleJobs.map(buildServerJobCard).join('\n')
      : '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div>No jobs found in this category right now. Check back soon!</div></div>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${cat.title}</title>
  <meta name="description" content="${cat.description}" />
  <link rel="canonical" href="${cat.canonical}" />
  <meta property="og:title" content="${cat.title}" />
  <meta property="og:description" content="${cat.description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${cat.canonical}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${cat.title}" />
  <meta name="twitter:description" content="${cat.description}" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/jobunify-logo.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/jobunify-logo-192.png" />
  <meta name="google-site-verification" content="IMZ4GejbI-8GCc5BQ5-m-gE4GJG-8KCEqS_wFHvxYfI" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/style.css"/>
</head>
<body>

  <!-- NAVBAR -->
  <nav>
    <div class="logo">
      <img src="/jobunify-logo.svg" alt="JobUnify logo" width="24" height="24" style="vertical-align:middle; margin-right:6px;" />
      Job<span>Unify</span>
    </div>
    <div class="nav-links">
      <a href="/signup.html"><button class="nav-btn">Sign Up Free</button></a>
      <div class="avatar-wrap">
        <div class="avatar" id="avatarBtn" onclick="toggleDropdown(event)" title="Open menu">S</div>

        <!-- PROFILE DROPDOWN -->
        <div class="profile-dropdown" id="profileDropdown">

          <div class="dropdown-header">
            <div class="dropdown-avatar-header" id="sidebar-avatar">S</div>
            <div class="user-text-details">
              <div class="dropdown-username-header" id="sidebar-name">User</div>
              <div class="dropdown-completion-header">
                Profile <span id="profile-completion-bar">0%</span> complete
              </div>
            </div>
          </div>

          <div class="dropdown-divider"></div>

          <nav class="dropdown-menu">
            <a href="/profile.html" class="dropdown-item">
              <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>Profile</span>
            </a>
            <a href="/saved-jobs.html" class="dropdown-item">
              <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              <span>Saved Jobs</span>
            </a>
            <a href="/settings.html" class="dropdown-item">
              <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              <span>Settings</span>
            </a>
          </nav>

          <div class="dropdown-divider"></div>

          <a href="#" onclick="logout(event)" class="dropdown-item dropdown-signout">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Sign out</span>
          </a>

        </div>
      </div>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero" id="heroSection">
    <div class="hero-badge">✦ 0 experience. Guaranteed.</div>
    <h1>Fresher jobs.<br/><span>Nothing else.</span></h1>
    <p>We only list roles that need zero experience — verified, not just filtered. Search once, apply with confidence.</p>

    <div class="trust-pills" style="display:flex; justify-content:center; gap:12px; margin-bottom:32px;">
      <div class="trust-pill" style="display:flex; align-items:center; gap:6px; background:rgba(34, 197, 94, 0.08); border:1px solid rgba(34, 197, 94, 0.2); padding:6px 14px; border-radius:999px; font-size:13px; color:#22c55e; font-weight:500;">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>
        0 exp only
      </div>
      <div class="trust-pill" style="display:flex; align-items:center; gap:6px; background:rgba(34, 197, 94, 0.08); border:1px solid rgba(34, 197, 94, 0.2); padding:6px 14px; border-radius:999px; font-size:13px; color:#22c55e; font-weight:500;">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>
        updated daily
      </div>
    </div>

    <div class="search-wrapper">
      <input type="text" id="searchInput" placeholder="Search by role, skill, or company..." />
      <button class="search-btn" onclick="heroSearch()">Search</button>
    </div>

    <div class="platforms" style="margin-top:24px; margin-bottom:0;">
      <div class="platform-pill" onclick="handlePlatformClick('Internshala')"><div class="dot" style="background:#22c55e"></div>Internshala</div>
      <div class="platform-pill" onclick="handlePlatformClick('Naukri')"><div class="dot" style="background:#38bdf8"></div>Naukri</div>
      <div class="platform-pill" onclick="handlePlatformClick('GoogleJobs')"><div class="dot" style="background:#6c63ff"></div>Google Jobs</div>
    </div>
  </section>

  <!-- STATS -->
   <div class="stats" id="statsSection">
    <div class="stat">
      <div class="stat-num" id="stat-jobs-today">...</div>
      <div class="stat-label">Jobs Today</div>
    </div>
    <div class="stat">
      <div class="stat-num" id="stat-platforms">...</div>
      <div class="stat-label">Platforms</div>
    </div>
    <div class="stat" style="padding-top: 6px;">
      <div class="stat-num" style="font-size: 20px; color: var(--green); display: flex; align-items: center; justify-content: center; gap: 6px;">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Fresher-only
      </div>
      <div class="stat-label">listings</div>
    </div>
    <div class="stat">
      <div class="stat-num" id="stat-updated">...</div>
      <div class="stat-label">Last updated</div>
    </div>
  </div>

  <!-- MAIN CONTENT -->
  <main class="main">

    <!-- TRACK SWITCHER TABS -->
    <div class="track-tabs" id="trackTabs">
      <button class="track-tab active" id="tabAll" onclick="setTrack('', this)">
        <span class="tab-label">All Jobs</span>
        <span class="tab-badge" id="badgeAll">...</span>
      </button>
      <button class="track-tab" id="tabInternship" onclick="setTrack('internship', this)">
        <span class="tab-label">Internships</span>
        <span class="tab-badge" id="badgeInternship">...</span>
      </button>
      <button class="track-tab" id="tabFullTime" onclick="setTrack('full-time', this)">
        <span class="tab-label">Full-Time</span>
        <span class="tab-badge" id="badgeFullTime">...</span>
      </button>
    </div>

    <div class="filters">
      <span class="filter-label">Roles:</span>
      <button class="filter-btn" onclick="setRoleFilter('', this)">All Roles</button>
      <button class="filter-btn ${role === 'software-developer' ? 'active' : ''}" onclick="setRoleFilter('software', this)">Software Dev</button>
      <button class="filter-btn ${role === 'qa-testing' ? 'active' : ''}" onclick="setRoleFilter('qa', this)">QA & Testing</button>
      <button class="filter-btn ${role === 'data-analytics' ? 'active' : ''}" onclick="setRoleFilter('data', this)">Data & Analytics</button>
      <button class="filter-btn ${role === 'ui-ux-design' ? 'active' : ''}" onclick="setRoleFilter('design', this)">Design / UI-UX</button>

      <select class="filter-select" id="locationFilter" onchange="filterJobs()">
        <option value="">All Locations</option>
        <option>Remote</option>
        <option>Delhi</option>
        <option>Bangalore</option>
        <option>Mumbai</option>
        <option>Hyderabad</option>
        <option>Pune</option>
      </select>

      <select class="filter-select" id="sourceFilter" onchange="filterJobsBySource()">
        <option value="all">All Sources</option>
        <option value="Internshala">Internshala</option>
        <option value="Naukri">Naukri</option>
        <option value="GoogleJobs">Google Jobs</option>
      </select>

      <select class="filter-select" id="sortFilter" onchange="filterJobs()">
        <option value="">Default Sort</option>
        <option value="newest">Newest First</option>
      </select>
      
    </div>
    <div id="searchContainer" class="search-wrapper hidden">
      <input type="text" id="searchBar" placeholder="Search jobs by title, company, location, skills..." />
      <button class="search-btn" id="searchBtn">Search</button>
    </div>

    <div class="section-header">
      <div class="section-title">${cat.heading}</div>
      <div class="job-count" id="jobCount">${visibleJobs.length} opportunities available</div>
    </div>

    <div class="job-grid" id="jobGrid" data-prerendered="true">
      ${jobsHtml}
    </div>

    <div style="text-align:center; margin-top:32px">
      <button id="loadMoreBtn" 
        onclick="loadMore()" 
        class="filter-btn" 
        style="padding:12px 32px; display:none">
        Load more jobs
      </button>
    </div>

  </main>

  <script src="/config.js"></script>
  <script src="/script.js"></script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error rendering category page:', err);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = {
  CATEGORIES,
  renderCategoryPage
};
