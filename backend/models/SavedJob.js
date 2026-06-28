const mongoose = require("mongoose");

const SavedJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  savedAt: {
    type: Date,
    default: Date.now,
  }
});

// Avoid duplicate saves for same user and job
SavedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model("SavedJob", SavedJobSchema);
