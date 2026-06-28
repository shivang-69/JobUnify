const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d", // Token valid for 30 days
  });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
const signup = async (req, res, next) => {
  try {
    const { name, email, password, mobile, workStatus } = req.body;

    // Validate required inputs
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      mobile,
      workStatus: workStatus || "fresher",
    });

    // Generate JWT
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        workStatus: user.workStatus,
        profileCompletion: user.getProfileCompletion(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/signin
// @desc    Authenticate user and get token
// @access  Public
const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and explicitly select password since it is hidden by default in schema
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate JWT
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Signed in successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        workStatus: user.workStatus,
        profileCompletion: user.getProfileCompletion(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  signin,
};
