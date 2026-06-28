# JobUnify

A job aggregator that pulls listings from Internshala, Unstop, Naukri and Indeed in one place — filtered for freshers.

## 🔗 Live Demo

- **Frontend:** https://job-unify.vercel.app
- **Backend API:** https://jobunify.onrender.com

## Tech Stack

- **Frontend:** HTML + CSS + JavaScript (Vanilla)
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas
- **Auth:** JWT + Google OAuth
- **Scrapers:** Python (Playwright, Requests, Adzuna API, JSearch API)
- **Deployment:** Vercel (frontend) + Render (backend)

## Features

- 🔍 Aggregates jobs from 4 platforms in one place
- 🎯 Search by role, skill or company
- 📌 Save/bookmark jobs to your personal list
- 🔐 Google OAuth + JWT authentication
- 🔄 Auto-refreshes every 6 hours via Python scheduler
- 👤 User profile with completion tracking

## Project Structure

```
job/
├── frontend/          # Static HTML/CSS/JS frontend
│   ├── index.html
│   ├── profile.html
│   ├── signin.html
│   ├── signup.html
│   ├── saved-jobs.html
│   ├── settings.html
│   ├── script.js
│   └── style.css
└── backend/           # Node.js + Express API
    ├── server.js
    ├── config/
    ├── models/
    ├── routes/
    ├── controllers/
    ├── middleware/
    └── scrapers/      # Python scrapers
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

### Environment Variables (`backend/.env`)

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/jobunify
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
RAPIDAPI_KEY=your_rapidapi_key
CLIENT_URL=https://job-unify.vercel.app
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs (with filters) |
| GET | `/api/jobs/search?q=` | Search jobs by keyword |
| GET | `/api/jobs/count` | Total job count & platforms |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/profile` | Get user profile |
| GET | `/api/saved` | Get saved jobs |
| POST | `/api/saved/:id` | Save a job |
| DELETE | `/api/saved/:id` | Remove saved job |

## License

MIT
