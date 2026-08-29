const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

const session = require("express-session");
const passport = require("passport");

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ─── Session & Passport Middleware ──────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || "jobunify_secret_123",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Load Passport config
require("./config/passport");

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());                          // Enable Cross-Origin Resource Sharing
app.use(express.json());                  // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/profile", require("./routes/profile"));
app.use('/api/jobs', require('./src/routes/jobs'));
app.use("/api/saved", require("./routes/savedJobs"));

// Root Health Check Route
app.get("/", (req, res) => {
  res.json({ message: "JobUnify API is running ✅" });
});

let cachedStats = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

app.get("/api/stats", async (req, res) => {
  try {
    const now = Date.now();
    if (cachedStats && now < cacheExpiry) {
      return res.json(cachedStats);
    }

    const mongoose = require("mongoose");
    const { buildFreshnessFilter } = require("./src/utils/freshnessFilter");
    const { isEntryLevel } = require("./src/utils/experienceFilter");
    const { isPaidInternship } = require("./src/utils/stipendFilter");

    const ACTIVE_SOURCES = ["Internshala", "Naukri", "GoogleJobs"];
    const platformCount = ACTIVE_SOURCES.length;

    // Apply the exact same serving filters
    const csWhitelist = /software|developer|programmer|engineer|frontend|backend|full\s*stack|data\s*scientist|data\s*analyst|data\s*science|devops|qa|sdet|ai|ml|machine\s*learning|cyber|security|cloud|sysadmin|system\s*admin|it\s*support|tech\s*support|android|ios|web|coder|react|node|python|java|javascript|c\+\+|golang|php|laravel|angular|vue|django|flask|spring\s*boot|flutter|swift|kotlin|aws|azure|infrastructure|network|systems\s*administrator|it\s*admin/i;
    const csBlacklist = /mechanical|civil|electrical|electronics|chemical|structural|sales|marketing|hr|human\s*resources|finance|accountant|content\s*writer|copywriter|social\s*media|graphic|telecaller|tele-caller|adviser|advisor|customer\s*care|relationship\s*manager|sales\s*exec|business\s*development|bde|recruiter/i;

    const filter = {
      $and: [
        { source: { $nin: ['Unstop', 'LinkedIn'] } },
        { is_broken: { $ne: true } },
        buildFreshnessFilter(),
        {
          title: { $regex: csWhitelist },
          $and: [
            { title: { $not: { $regex: csBlacklist } } }
          ]
        }
      ]
    };

    const candidateJobs = await mongoose.connection.db
      .collection("jobs")
      .find(filter)
      .toArray();

    const visibleJobs = candidateJobs.filter(job => {
      if (!isEntryLevel(job)) return false;
      if (job.track === 'internship' && !isPaidInternship(job)) return false;
      return true;
    });

    const jobsToday = visibleJobs.length;

    // Latest successful scrape run based on scrapedAt
    const latestJob = await mongoose.connection.db
      .collection("jobs")
      .find({ source: { $nin: ["Unstop", "LinkedIn"] } }, { projection: { scrapedAt: 1 } })
      .sort({ scrapedAt: -1 })
      .limit(1)
      .toArray();

    let lastUpdated = null;
    if (latestJob.length > 0 && latestJob[0].scrapedAt) {
      lastUpdated = latestJob[0].scrapedAt;
    }

    cachedStats = {
      jobsToday,
      platformCount,
      lastUpdated
    };
    cacheExpiry = now + CACHE_TTL;

    res.json(cachedStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Sitemap.xml endpoint for Google Jobs indexing
const mongoose = require("mongoose");
const { buildFreshnessFilter } = require("./src/utils/freshnessFilter");
const { isEntryLevel } = require("./src/utils/experienceFilter");
const { isPaidInternship } = require("./src/utils/stipendFilter");

app.get("/sitemap.xml", async (req, res) => {
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
      .toArray();

    // Filter to only visible (entry-level + paid internship)
    const visibleJobs = candidateJobs.filter(job => {
      const { include, track } = isEntryLevel(job);
      if (!include) return false;
      if (track === 'internship') return isPaidInternship(job).paid;
      return true;
    });

    // Build the XML sitemap
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    // Add main home page
    xml += `  <url>\n    <loc>https://jobunify.online/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    for (const job of visibleJobs) {
      xml += `  <url>\n    <loc>https://jobunify.online/api/jobs/detail/${job._id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// ─── Global Error Handler (must be last) ─────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
