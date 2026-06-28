const express = require("express");
const router = express.Router();
const {
  getProfile,
  updateProfile,
  updateSkills,
  updateEducation,
  updateProjects,
  saveJob,
  removeSavedJob,
  deleteAccount,
} = require("../controllers/profileController");
const { protect } = require("../middleware/auth");

// All profile routes are protected by JWT authentication middleware
router.use(protect);

// GET /api/profile → getProfile
router.get("/", getProfile);

// PUT /api/profile → updateProfile
router.put("/", updateProfile);

// PUT /api/profile/skills → updateSkills
router.put("/skills", updateSkills);

// PUT /api/profile/education → updateEducation
router.put("/education", updateEducation);

// PUT /api/profile/projects → updateProjects
router.put("/projects", updateProjects);

// POST /api/profile/savedjobs → saveJob
router.post("/savedjobs", saveJob);

// DELETE /api/profile/savedjobs/:id → removeSavedJob
router.delete("/savedjobs/:id", removeSavedJob);

// DELETE /api/profile → deleteAccount
router.delete("/", deleteAccount);

module.exports = router;
