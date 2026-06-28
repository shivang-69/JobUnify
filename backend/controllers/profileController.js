const User = require("../models/User");

// @route   GET /api/profile
// @desc    Get logged in user's profile data
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        workStatus: user.workStatus,
        college: user.college,
        degree: user.degree,
        gradYear: user.gradYear,
        experienceLevel: user.experienceLevel,
        resumeLink: user.resumeLink,
        location: user.location,
        gender: user.gender,
        dob: user.dob,
        bio: user.bio,
        preferredJobType: user.preferredJobType,
        availability: user.availability,
        preferredLocations: user.preferredLocations,
        emailNotifications: user.emailNotifications,
        skills: user.skills,
        education: user.education,
        projects: user.projects,
        internships: user.internships,
        certifications: user.certifications,
        savedJobs: user.savedJobs,
        profileCompletion: user.getProfileCompletion(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/profile
// @desc    Update profile basic details and arrays
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { 
      name, 
      email,
      currentPassword,
      newPassword,
      college, 
      degree, 
      location, 
      gender, 
      dob, 
      bio, 
      preferredJobType, 
      availability, 
      preferredLocations,
      internships,
      certifications,
      mobile,
      workStatus,
      emailNotifications,
      gradYear,
      experienceLevel,
      resumeLink,
      skills
    } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: "Email is already in use" });
      }
      user.email = email;
    }

    if (newPassword) {
      if (user.password) {
        if (!currentPassword) {
          return res.status(400).json({ success: false, message: "Current password is required to change password" });
        }
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
          return res.status(400).json({ success: false, message: "Current password does not match" });
        }
      }
      user.password = newPassword;
    }

    if (name !== undefined) user.name = name;
    if (college !== undefined) user.college = college;
    if (degree !== undefined) user.degree = degree;
    if (location !== undefined) user.location = location;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (bio !== undefined) user.bio = bio;
    if (preferredJobType !== undefined) user.preferredJobType = preferredJobType;
    if (availability !== undefined) user.availability = availability;
    if (preferredLocations !== undefined) user.preferredLocations = preferredLocations;
    if (internships !== undefined) user.internships = internships;
    if (certifications !== undefined) user.certifications = certifications;
    if (mobile !== undefined) user.mobile = mobile;
    if (workStatus !== undefined) user.workStatus = workStatus;
    if (emailNotifications !== undefined) user.emailNotifications = emailNotifications;
    if (gradYear !== undefined) user.gradYear = gradYear;
    if (experienceLevel !== undefined) user.experienceLevel = experienceLevel;
    if (resumeLink !== undefined) user.resumeLink = resumeLink;
    if (skills !== undefined) user.skills = skills;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        workStatus: user.workStatus,
        college: user.college,
        degree: user.degree,
        gradYear: user.gradYear,
        experienceLevel: user.experienceLevel,
        resumeLink: user.resumeLink,
        location: user.location,
        gender: user.gender,
        dob: user.dob,
        bio: user.bio,
        preferredJobType: user.preferredJobType,
        availability: user.availability,
        preferredLocations: user.preferredLocations,
        emailNotifications: user.emailNotifications,
        skills: user.skills,
        education: user.education,
        projects: user.projects,
        internships: user.internships,
        certifications: user.certifications,
        savedJobs: user.savedJobs,
        profileCompletion: user.getProfileCompletion(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/profile/skills
// @desc    Update user skills array
// @access  Private
const updateSkills = async (req, res, next) => {
  try {
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: "skills must be an array of strings",
      });
    }

    const user = await User.findById(req.user._id);
    user.skills = skills;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Skills updated successfully",
      skills: user.skills,
      profileCompletion: user.getProfileCompletion(),
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/profile/education
// @desc    Update user education array
// @access  Private
const updateEducation = async (req, res, next) => {
  try {
    const { education } = req.body;

    if (!Array.isArray(education)) {
      return res.status(400).json({
        success: false,
        message: "education must be an array of objects",
      });
    }

    const user = await User.findById(req.user._id);
    user.education = education;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Education updated successfully",
      education: user.education,
      profileCompletion: user.getProfileCompletion(),
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/profile/projects
// @desc    Update user projects array
// @access  Private
const updateProjects = async (req, res, next) => {
  try {
    const { projects } = req.body;

    if (!Array.isArray(projects)) {
      return res.status(400).json({
        success: false,
        message: "projects must be an array of objects",
      });
    }

    const user = await User.findById(req.user._id);
    user.projects = projects;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Projects updated successfully",
      projects: user.projects,
      profileCompletion: user.getProfileCompletion(),
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/profile/savedjobs
// @desc    Add job to saved jobs array
// @access  Private
const saveJob = async (req, res, next) => {
  try {
    const job = req.body;

    if (!job || Object.keys(job).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Job details are required",
      });
    }

    const user = await User.findById(req.user._id);

    // Prevent duplicate entries if job has a verifiable id or string value
    const jobIdToCheck = job.jobId || job.id || (typeof job === "string" ? job : null);
    if (jobIdToCheck) {
      const alreadySaved = user.savedJobs.some((item) => {
        if (typeof item === "string") return item === jobIdToCheck;
        return item.jobId === jobIdToCheck || item.id === jobIdToCheck;
      });

      if (alreadySaved) {
        return res.status(400).json({
          success: false,
          message: "Job already saved",
        });
      }
    }

    user.savedJobs.push(job);
    user.markModified("savedJobs");
    await user.save();

    res.status(200).json({
      success: true,
      message: "Job saved successfully",
      savedJobs: user.savedJobs,
    });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/profile/savedjobs/:id
// @desc    Remove job from saved jobs array
// @access  Private
const removeSavedJob = async (req, res, next) => {
  try {
    const jobIdToRemove = req.params.id;

    const user = await User.findById(req.user._id);
    const originalLength = user.savedJobs.length;

    user.savedJobs = user.savedJobs.filter((item) => {
      if (typeof item === "string") return item !== jobIdToRemove;
      return (
        item.jobId !== jobIdToRemove &&
        item.id !== jobIdToRemove &&
        item._id?.toString() !== jobIdToRemove
      );
    });

    if (user.savedJobs.length === originalLength) {
      return res.status(404).json({
        success: false,
        message: "Job not found in saved list",
      });
    }

    user.markModified("savedJobs");
    await user.save();

    res.status(200).json({
      success: true,
      message: "Job removed from saved list successfully",
      savedJobs: user.savedJobs,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Account handler
const deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.status(200).json({ success: true, message: "Account deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateSkills,
  updateEducation,
  updateProjects,
  saveJob,
  removeSavedJob,
  deleteAccount,
};

