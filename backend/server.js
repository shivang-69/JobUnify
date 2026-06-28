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

// ─── Global Error Handler (must be last) ─────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Start Python scheduler automatically
  const { spawn } = require("child_process");
  const path = require("path");
  const schedulerPath = path.join(__dirname, "scheduler.py");
  console.log(`Starting Python scheduler at: ${schedulerPath}`);
  
  const schedulerProcess = spawn("python", ["-u", schedulerPath], {
    cwd: __dirname,
    stdio: "inherit"
  });
  
  schedulerProcess.on("error", (err) => {
    console.error("Failed to start Python scheduler:", err);
  });
  
  schedulerProcess.on("close", (code) => {
    console.log(`Python scheduler process exited with code ${code}`);
  });
});
