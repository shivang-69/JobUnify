// ─────────────────────────────────────────────
// JobUnify — script.js
// ─────────────────────────────────────────────

let allJobs = [];
let currentPage = 1;
let isLoading = false;
let activeSource = 'all';
let activeTrack = '';
let savedJobIds = [];

async function fetchJobs(page = 1, append = false) {
  const grid = document.getElementById('jobGrid');
  if (!grid) return; // Skip fetching if not on job list page
  if (isLoading) return;
  isLoading = true;

  if (!append) {
    grid.innerHTML = '<div class="loader-container"><div class="spinner"></div><div>Fetching latest jobs...</div></div>';
  } else {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) loadMoreBtn.innerText = 'Loading...';
  }

  const searchInput = document.getElementById('searchInput');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const locFilter = document.getElementById('locationFilter');
  const location = locFilter ? locFilter.value : '';
  let type = '';
  const userStr = localStorage.getItem('jobunify_user');
  if (userStr) {
    const user = JSON.parse(userStr);
    if (user.preferredJobType) type = user.preferredJobType;
  }

  const sortFilter = document.getElementById('sortFilter');
  const sort = sortFilter ? sortFilter.value : '';

  let url = `${API_BASE_URL}/api/jobs?page=${page}&limit=50`;
  if (activeTrack) url += `&track=${activeTrack}`;
  if (activeSource !== 'all') url += `&source=${activeSource}`;
  if (location) url += `&location=${location}`;
  if (type) url += `&type=${type}`;
  if (search) url += `&search=${search}`;
  if (sort) url += `&sort=${sort}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    let fetchedJobs = data.jobs || [];

    // Verify links before rendering to hide expired/closed jobs
    if (fetchedJobs.length > 0) {
      try {
        const urlsToVerify = fetchedJobs.map(j => j.job_url || j.link).filter(Boolean);
        const checkRes = await fetch(`${API_BASE_URL}/api/jobs/check-links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: urlsToVerify })
        });
        const checkData = await checkRes.json();
        if (checkData.results) {
          fetchedJobs = fetchedJobs.filter(j => checkData.results[j.job_url || j.link] !== 'broken');
        }
      } catch (e) {
        console.error("Link verification failed:", e);
      }
    }

    if (append) {
      allJobs = [...allJobs, ...fetchedJobs];
    } else {
      allJobs = fetchedJobs;
    }

    renderJobs(allJobs);
    
    if (data.counts) {
      const bFT = document.getElementById('badgeFullTime');
      if (bFT) bFT.textContent = data.counts.fullTime;
      const bInt = document.getElementById('badgeInternship');
      if (bInt) bInt.textContent = data.counts.internship;
      const bAll = document.getElementById('badgeAll');
      if (bAll) bAll.textContent = data.counts.total;
    }

    const countEl = document.getElementById('jobCount');
    if (countEl) {
      countEl.textContent = `${data.total} jobs found`;
    }

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.innerText = 'Load More';
      loadMoreBtn.style.display = page < data.totalPages ? 'block' : 'none';
    }

  } catch (error) {
    console.error('Error fetching jobs:', error);
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Failed to load jobs. Make sure backend is running.</div>';
  }

  isLoading = false;
}

// Search functionality for logged‑in view
function performSearch() {
  const query = document.getElementById('searchBar')?.value.trim();
  if (!query) {
    // Empty query => reload default job list
    fetchJobs(1);
    return;
  }
  const sortFilter = document.getElementById('sortFilter');
  const sort = sortFilter ? sortFilter.value : '';
  let searchUrl = `${API_BASE_URL}/api/jobs/search?q=${encodeURIComponent(query)}`;
  if (activeTrack) searchUrl += `&track=${activeTrack}`;
  if (sort) searchUrl += `&sort=${sort}`;
  fetch(searchUrl)
    .then(res => res.json())
    .then(data => {
      const jobs = data.jobs || [];
      renderJobs(jobs);
      if (data.counts) {
        const bFT = document.getElementById('badgeFullTime');
        if (bFT) bFT.textContent = data.counts.fullTime;
        const bInt = document.getElementById('badgeInternship');
        if (bInt) bInt.textContent = data.counts.internship;
        const bAll = document.getElementById('badgeAll');
        if (bAll) bAll.textContent = data.counts.total;
      }
      const countEl = document.getElementById('jobCount');
      if (countEl) countEl.textContent = `${jobs.length} jobs found`;
    })
    .catch(err => console.error('Search error:', err));
}

// Search from hero (logged‑out view)
function heroSearch() {
  const token = localStorage.getItem('jobunify_token');
  if (!token) {
    // redirect to sign‑in page
    window.location.href = 'signin.html';
    return;
  }
  const query = document.getElementById('searchInput')?.value.trim();
  if (!query) return;
  fetch(`${API_BASE_URL}/api/jobs/search?q=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      const jobs = data.jobs || [];
      renderJobs(jobs);
      const countEl = document.getElementById('jobCount');
      if (countEl) countEl.textContent = `${jobs.length} jobs found`;
      // hide hero after search
      const hero = document.getElementById('heroSection');
      if (hero) hero.classList.add('hidden');
      // show logged‑in search bar
      const searchContainer = document.getElementById('searchContainer');
      if (searchContainer) searchContainer.classList.remove('hidden');
    })
    .catch(err => console.error('Search error:', err));
}

// Attach search events after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('jobunify_token');
  if (token) {
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) searchContainer.classList.remove('hidden');
    const hero = document.getElementById('heroSection');
    if (hero) hero.classList.add('hidden');
  }
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) searchBtn.addEventListener('click', performSearch);
  const searchBar = document.getElementById('searchBar');
  if (searchBar) searchBar.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });
});

function setTrack(track, btn) {
  activeTrack = track;
  document.querySelectorAll('.track-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  currentPage = 1;
  fetchJobs(1);
}

function setFilter(source, btn) {
  activeSource = source;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPage = 1;
  fetchJobs(1);
}

function filterJobs() {
  currentPage = 1;
  fetchJobs(1);
}

function loadMore() {
  currentPage++;
  fetchJobs(currentPage, true);
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
  const isSaved = savedJobIds.includes(job._id);

  return `
    <div class="job-card">
      <div class="card-top">
        <div class="company-logo" style="background:${logoBg};color:#fff">
          ${letter}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="source-badge source-${sourceClass}">
            ${source}
          </span>
          <button class="bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleSaveJob(event, '${job._id}')" title="Save Job">
            <svg class="bookmark-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="${isSaved ? 'currentColor' : 'none'}" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="job-title">
        ${job.title || 'N/A'}
      </div>
      <div class="company-name">
        ${job.company || 'N/A'} · ${job.location || 'N/A'}
        ${(job.posted_at || job.date_posted) ? ` · <span class="posted-date">${formatPostedDate(job.posted_at || job.date_posted)}</span>` : ''}
      </div>
        ${(() => {
          const tags = [];
          if (job.type) tags.push(job.type);
          if (job.duration) tags.push(job.duration);
          return tags.length ? `<div class="job-tags">${tags.map(t => `<div class="tag">💼 ${t}</div>`).join('')}</div>` : '';
        })()}
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

function renderJobs(jobs) {
  const grid = document.getElementById('jobGrid');
  if (!grid) return;
  if (!jobs || jobs.length === 0) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div>No jobs found</div></div>';
    return;
  }
  grid.innerHTML = jobs.map(buildJobCard).join('');
}

async function updateStats() {
  const jobsTodayEl = document.getElementById('stat-jobs-today');
  const platformsEl = document.getElementById('stat-platforms');
  if (!jobsTodayEl && !platformsEl) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/count`);
    const data = await res.json();

    if (jobsTodayEl) {
      const count = data.total;
      if (count >= 1000) {
        const formatted = (count / 1000).toFixed(1);
        const cleanFormatted = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
        jobsTodayEl.innerHTML = `${cleanFormatted}<span>K+</span>`;
      } else {
        jobsTodayEl.textContent = count;
      }
    }

    if (platformsEl) {
      platformsEl.textContent = data.platformsCount;
    }
  } catch (error) {
    console.error('Error fetching job count:', error);
  }
}

async function fetchSavedJobs() {
  const token = localStorage.getItem("jobunify_token");
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/saved`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (data.success) {
      savedJobIds = data.jobs.map(job => job._id);
    }
  } catch (error) {
    console.error("Error fetching saved jobs:", error);
  }
}

async function toggleSaveJob(event, jobId) {
  if (event) event.stopPropagation();

  const token = localStorage.getItem("jobunify_token");
  if (!token) {
    window.location.href = "signin.html";
    return;
  }

  const isSaved = savedJobIds.includes(jobId);
  const method = isSaved ? "DELETE" : "POST";
  const url = `${API_BASE_URL}/api/saved/${jobId}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await res.json();

    if (data.success) {
      if (isSaved) {
        savedJobIds = savedJobIds.filter(id => id !== jobId);
      } else {
        savedJobIds.push(jobId);
      }
      
      const btn = event.currentTarget || event.target.closest(".bookmark-btn");
      if (btn) {
        const svgPath = btn.querySelector("svg");
        if (isSaved) {
          btn.classList.remove("saved");
          if (svgPath) svgPath.setAttribute("fill", "none");
        } else {
          btn.classList.add("saved");
          if (svgPath) svgPath.setAttribute("fill", "currentColor");
        }
      }

    }
  } catch (error) {
    console.error("Error toggling saved job:", error);
  }
}

  document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('jobunify_token');
    const signUpBtn = document.querySelector('.nav-btn');
    const avatarWrap = document.querySelector('.avatar-wrap');
    const heroSection = document.getElementById('heroSection');
    const statsSection = document.getElementById('statsSection');

    if (token) {
      // Logged in: hide signup, show avatar, hide hero and stats
      if (signUpBtn) {
        const parentA = signUpBtn.closest('a');
        if (parentA) parentA.style.display = 'none';
        else signUpBtn.style.display = 'none';
      }
      if (avatarWrap) avatarWrap.style.display = 'block';
      if (heroSection) heroSection.classList.add('hidden');
      if (statsSection) statsSection.classList.add('hidden');
    } else {
      // Not logged in: show signup, hide avatar, show hero and stats
      if (signUpBtn) {
        const parentA = signUpBtn.closest('a');
        if (parentA) parentA.style.display = 'block';
        else signUpBtn.style.display = 'block';
      }
      if (avatarWrap) avatarWrap.style.display = 'none';
      if (heroSection) heroSection.classList.remove('hidden');
      if (statsSection) statsSection.classList.remove('hidden');
    }

    // Existing user info population
    const userStr = localStorage.getItem('jobunify_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : 'U';
        const avatarBtn = document.getElementById('avatarBtn');
        const dropdownAvatar = document.getElementById('sidebar-avatar') || document.querySelector('.dropdown-avatar-header') || document.querySelector('.dropdown-avatar');
        if (avatarBtn) avatarBtn.textContent = firstLetter;
        if (dropdownAvatar) dropdownAvatar.textContent = firstLetter;
        const sidebarName = document.getElementById('sidebar-name');
        if (sidebarName) sidebarName.textContent = user.name || 'User';
        const completionBar = document.getElementById('profile-completion-bar');
        if (completionBar) completionBar.textContent = `${user.profileCompletion || 0}%`;
      } catch (e) {
        console.error('Error parsing user data from localStorage', e);
      }
    }
    // Async sync with backend details
    await fetchSavedJobs();
    fetchJobs(1);
    updateStats();
    syncUserProfile();
  });


// ────────────────────────────
// PROFILE DROPDOWN
// ────────────────────────────

function toggleDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('profileDropdown');
  dropdown.classList.toggle('active');
}

function closeDropdown() {
  document.getElementById('profileDropdown').classList.remove('active');
}

// Keep/define openSidebar/closeSidebar as aliases
function openSidebar(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) dropdown.classList.add('active');
}

function closeSidebar() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) dropdown.classList.remove('active');
}

document.addEventListener('click', function (e) {
  const wrap = document.querySelector('.avatar-wrap');
  if (wrap && !wrap.contains(e.target)) {
    closeDropdown();
    closeSidebar();
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeDropdown();
    closeSidebar();
  }
});

// ── Authentication Check & Header Sync ──
async function syncUserProfile() {
  const token = localStorage.getItem("jobunify_token");
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.user) {
      const user = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        profileCompletion: data.user.profileCompletion || 0
      };
      localStorage.setItem("jobunify_user", JSON.stringify(user));
      
      const completionBar = document.getElementById("profile-completion-bar");
      if (completionBar) {
        completionBar.textContent = `${user.profileCompletion}%`;
      }
      const initial = (user.name || "U")[0].toUpperCase();
      const avatarBtn = document.getElementById("avatarBtn");
      if (avatarBtn) avatarBtn.textContent = initial;
      
      const dropdownAvatar = document.getElementById("sidebar-avatar") || document.querySelector(".dropdown-avatar-header") || document.querySelector(".dropdown-avatar");
      if (dropdownAvatar) dropdownAvatar.textContent = initial;
      
      const sidebarName = document.getElementById("sidebar-name");
      if (sidebarName) sidebarName.textContent = user.name || "User";
    }
  } catch (error) {
    console.error("Error syncing user profile:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jobunify_token");
  const signUpBtn = document.querySelector(".nav-btn");
  const avatarWrap = document.querySelector(".avatar-wrap");

  if (token) {
    // Logged in: Hide signup, show avatar
    if (signUpBtn) {
      const parentA = signUpBtn.closest("a");
      if (parentA) parentA.style.display = "none";
      else signUpBtn.style.display = "none";
    }
    if (avatarWrap) avatarWrap.style.display = "block";

    // Populate user profile info (local cache first)
    const userStr = localStorage.getItem("jobunify_user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : "U";
        const avatarBtn = document.getElementById("avatarBtn");
        const dropdownAvatar = document.getElementById("sidebar-avatar") || document.querySelector(".dropdown-avatar-header") || document.querySelector(".dropdown-avatar");
        if (avatarBtn) avatarBtn.textContent = firstLetter;
        if (dropdownAvatar) dropdownAvatar.textContent = firstLetter;

        const sidebarName = document.getElementById("sidebar-name");
        if (sidebarName) sidebarName.textContent = user.name;

        const completionBar = document.getElementById("profile-completion-bar");
        if (completionBar) {
          completionBar.textContent = `${user.profileCompletion || 0}%`;
        }
      } catch (e) {
        console.error("Error parsing user data from localStorage", e);
      }
    }
    // Async sync with backend details
    syncUserProfile();
  } else {
    // Not logged in: Show signup, hide avatar
    if (signUpBtn) {
      const parentA = signUpBtn.closest("a");
      if (parentA) parentA.style.display = "block";
      else signUpBtn.style.display = "block";
    }
    if (avatarWrap) avatarWrap.style.display = "none";
  }
});

// Logout function
function logout(event) {
  if (event) event.preventDefault();
  localStorage.removeItem("jobunify_token");
  localStorage.removeItem("jobunify_user");
  window.location.href = "signin.html";
}

// Gated Apply functionality: require user to be logged in
async function handleApply(event, url) {
  if (event) event.preventDefault();
  const token = localStorage.getItem("jobunify_token");
  console.log("[Apply Clicked] User detected as logged in:", !!token, "Token found:", token ? "Yes" : "No");
  if (token) {
    let btn = null;
    let originalText = "";
    if (event && event.currentTarget) {
      btn = event.currentTarget;
      originalText = btn.innerHTML;
      btn.innerHTML = "Checking...";
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.7";
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs/check-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (data.status === "broken") {
        console.log("[Apply Blocked] Link is broken (404).");
        if (btn) {
          btn.innerHTML = "This listing is no longer available";
          btn.style.opacity = "0.5";
          btn.style.cursor = "not-allowed";
          btn.classList.add("disabled");
        }
        return;
      }
    } catch (err) {
      console.error("Error checking link status:", err);
      // Fallback: proceed to open if check fails
    }

    if (btn) {
      btn.innerHTML = originalText;
      btn.style.pointerEvents = "auto";
      btn.style.opacity = "1";
    }
    console.log("[Apply Success] Opening job URL:", url);
    window.open(url, "_blank");
  } else {
    console.log("[Apply Blocked] No token found. Redirecting to signin.html");
    alert("Please login to apply");
    window.location.href = "signin.html";
  }
}

function formatPostedDate(dateString) {
  if (!dateString || dateString === 'N/A' || dateString === 'null' || dateString === 'undefined') {
    return '';
  }

  const postedDate = new Date(dateString);
  if (isNaN(postedDate.getTime())) {
    return '';
  }

  // Use local midnight for both to ensure day-level delta
  const postedMidnight = new Date(postedDate.getFullYear(), postedDate.getMonth(), postedDate.getDate());
  const now = new Date();
  const relativeMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = relativeMidnight.getTime() - postedMidnight.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Posted today';
  }
  if (diffDays === 0) {
    return 'Posted today';
  }
  if (diffDays === 1) {
    return 'Posted yesterday';
  }
  if (diffDays >= 2 && diffDays <= 6) {
    return `Posted ${diffDays} days ago`;
  }
  if (diffDays >= 7) {
    const weeks = Math.floor(diffDays / 7);
    if (weeks === 1) {
      return 'Posted 1 week ago';
    }
    return `Posted ${weeks} weeks ago`;
  }
  return '';
}

