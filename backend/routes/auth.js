const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { signup, signin } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// POST /api/auth/signup → Register a user
router.post("/signup", signup);
router.post("/register", signup);

// POST /api/auth/signin → Login a user
router.post("/signin", signin);
router.post("/login", signin);

// GET /api/auth/me → Get current user
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// GET /api/auth/google → Redirect to Google login
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// GET /api/auth/google/callback → Callback handler
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/signin.html", session: false }),
  (req, res) => {
    // Generate JWT token
    const token = generateToken(req.user._id);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    res.redirect(`${clientUrl}/auth/success?token=${token}`);
  }
);

module.exports = router;
