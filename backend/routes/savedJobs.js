const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const SavedJob = require("../models/SavedJob");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// POST /api/saved/:jobId - save a job
router.post("/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid Job ID format" });
    }

    // Check if the job actually exists in the jobs database first
    const jobExists = await mongoose.connection.db
      .collection("jobs")
      .findOne({ _id: new mongoose.Types.ObjectId(jobId) });
      
    if (!jobExists) {
      return res.status(404).json({ success: false, message: "Job not found in database" });
    }

    // Check if already saved
    const existing = await SavedJob.findOne({ userId: req.user._id, jobId: new mongoose.Types.ObjectId(jobId) });
    if (existing) {
      return res.status(200).json({ success: true, message: "Job already saved" });
    }

    await SavedJob.create({
      userId: req.user._id,
      jobId: new mongoose.Types.ObjectId(jobId),
    });

    res.status(201).json({ success: true, message: "Job saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/saved/:jobId - unsave a job
router.delete("/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid Job ID format" });
    }

    const result = await SavedJob.deleteOne({
      userId: req.user._id,
      jobId: new mongoose.Types.ObjectId(jobId),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Saved job mapping not found" });
    }

    res.status(200).json({ success: true, message: "Job unsaved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/saved - get all saved jobs for user
router.get("/", async (req, res) => {
  try {
    const savedMappings = await SavedJob.find({ userId: req.user._id });
    const jobIds = savedMappings.map(mapping => mapping.jobId);

    const jobs = await mongoose.connection.db
      .collection("jobs")
      .find({ _id: { $in: jobIds } })
      .toArray();

    res.status(200).json({ success: true, jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
