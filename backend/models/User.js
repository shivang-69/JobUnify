const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    mobile: {
      type: String,
      trim: true,
    },
    workStatus: {
      type: String,
      enum: ["fresher", "experienced"],
      default: "fresher",
    },
    college: {
      type: String,
      default: "",
    },
    degree: {
      type: String,
      default: "",
    },
    gradYear: {
      type: String,
      default: "",
    },
    experienceLevel: {
      type: String,
      default: "Fresher",
    },
    resumeLink: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      default: "",
    },
    dob: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    preferredJobType: {
      type: String,
      default: "",
    },
    availability: {
      type: String,
      default: "",
    },
    preferredLocations: {
      type: [String],
      default: [],
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    education: [
      {
        degree: String,
        institute: String,
        startYear: String,
        endYear: String,
        percentage: String,
        fieldOfStudy: String,
      },
    ],
    projects: [
      {
        title: String,
        description: String,
        techStack: [String],
        link: String,
      },
    ],
    internships: [
      {
        company: String,
        role: String,
        duration: String,
        description: String,
      },
    ],
    certifications: [
      {
        title: String,
        issuer: String,
        year: String,
      },
    ],
    savedJobs: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Hash password with bcryptjs before saving
UserSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password on login
UserSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Calculate profile completion percentage
UserSchema.methods.getProfileCompletion = function () {
  let score = 0;
  
  if (this.name && this.name.trim() !== "") score += 20;
  if (this.email && this.email.trim() !== "") score += 20;
  if (
    this.degree && this.degree.trim() !== "" &&
    this.college && this.college.trim() !== "" &&
    this.gradYear && this.gradYear.trim() !== ""
  ) {
    score += 20;
  }
  if (this.skills && this.skills.length > 0) score += 20;
  if (this.resumeLink && this.resumeLink.trim() !== "") score += 20;

  return score;
};

module.exports = mongoose.model("User", UserSchema);
