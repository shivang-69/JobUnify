# JobUnify

A job aggregator that pulls fresh entry-level listings from Internshala, Naukri, and Google Jobs in one place — filtered for freshers and recent graduates.

## 🔗 Live Demo

- **Frontend:** https://job-unify.vercel.app
- **Backend API:** https://jobunify.onrender.com

## Tech Stack

- **Frontend:** HTML + CSS + JavaScript (Vanilla)
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas
- **Auth:** JWT + Google OAuth
- **Scrapers:** Python (Playwright, Requests, SerpApi)
- **Deployment:** Vercel (frontend) + Render (backend) + GitHub Actions (daily scraping)

## Features

- 🔍 Aggregates fresh jobs from 3 platforms in one place
- 🎯 CS/IT-only title filter — no sales, marketing, or non-tech roles
- 🎓 Entry-level experience filter — excludes 3+ year senior roles (fail-closed)
- 📅 Relative date labels — "Posted today", "Posted 3 days ago"
- 🔃 Sort by newest first across all sources
- 🗂 Full-Time / Internship track tabs
- 📍 Filter by source (Internshala / Naukri / Google Jobs) and location
- 🔎 Search by role, skill, or company
- 📌 Save/bookmark jobs to your personal list
- 🔐 Google OAuth + JWT authentication
- 👤 User profile with completion tracking
- 🔄 Auto-refreshes daily via GitHub Actions (scraper cron)

## Active Sources

| Source | Type | Scraper | Frequency |
|---|---|---|---|
| Internshala | Internships + Full-time | Playwright (headless) | Daily |
| Naukri | Full-time | Requests + API | Daily |
| Google Jobs | Full-time + Internships | SerpApi (6 queries/day) | Daily (quota-guarded) |

> **Retired sources (data preserved, not served):** Unstop, LinkedIn, Indeed/JSearch

## Filtering Pipeline

Each scraped job passes through a multi-stage filter before appearing in the UI:

1. **Freshness filter** — Internshala/GoogleJobs ≤7 days, Naukri ≤4 days
2. **CS/IT whitelist** — title must match tech role keywords
3. **CS/IT blacklist** — excludes sales, HR, marketing, mechanical, etc.
4. **Entry-level filter** — parses `experience_raw`, `min_experience`, description for experience signals; fail-closed on unknown
5. **Stipend filter** — excludes explicitly unpaid internships; fail-open on missing data
6. **Source exclusion** — retired sources (Unstop, LinkedIn) excluded from all queries

## Project Structure

```
job/
├── frontend/                  # Static HTML/CSS/JS frontend
│   ├── index.html
│   ├── profile.html
│   ├── signin.html
│   ├── signup.html
│   ├── saved-jobs.html
│   ├── settings.html
│   ├── script.js
│   └── style.css
├── backend/                   # Node.js + Express API
│   ├── server.js
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── src/
│   │   ├── routes/jobs.js     # Main jobs API with all filters
│   │   └── utils/
│   │       ├── experienceFilter.js
│   │       ├── stipendFilter.js
│   │       ├── freshnessFilter.js
│   │       └── dateFormatter.js
│   └── scrapers/              # Python scrapers
│       ├── run_all.py         # Orchestrator (called by GitHub Actions)
│       ├── scrape_internshala.py
│       ├── scrape_naukri.py
│       ├── scrape_google_jobs.py   # SerpApi (6 req/day, quota-throttled)
│       ├── scrape_unstop.py        # RETIRED — file kept, not run
│       ├── scrape_indeed.py        # RETIRED — file kept, not run
│       └── deduplicator.py
└── .github/workflows/
    └── scrape-jobs.yml        # Daily GitHub Actions cron
```

## Getting Started

### Prerequisites

- Node.js v18+
- Python 3.9+
- MongoDB (local or Atlas)
- Playwright: `pip install playwright && playwright install chromium`

### Backend Setup

```bash
cd backend
npm install
cp env.example .env   # fill in your secrets
npm start
```

### Frontend

Open `frontend/index.html` in a browser, or serve it with:

```bash
npx serve ./frontend -l 3000
```

### Environment Variables (`backend/.env` and `backend/scrapers/.env`)

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/jobunify
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SERPAPI_KEY=your_serpapi_key
CLIENT_URL=https://job-unify.vercel.app
```

### Running Scrapers Locally

```bash
cd backend/scrapers
pip install -r ../requirements.txt
python run_all.py
```

> Note: `scrape_google_jobs.py` is quota-throttled — it skips execution if GoogleJobs were scraped within the last 23 hours.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs (source, location, track, sort, page filters) |
| GET | `/api/jobs/search?q=` | Search jobs by keyword |
| GET | `/api/jobs/count` | Total job count & active platforms |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/profile` | Get user profile |
| GET | `/api/saved` | Get saved jobs |
| POST | `/api/saved/:id` | Save a job |
| DELETE | `/api/saved/:id` | Remove saved job |

## Test Suite

```bash
cd backend
npm test
```

Covers: `experienceFilter`, `stipendFilter`, `freshnessFilter`, `dateFormatter` — **119 tests, 4 suites**.

## License

MIT
