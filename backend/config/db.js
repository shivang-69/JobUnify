const mongoose = require("mongoose");

const connectDB = async () => {
  let uri = process.env.MONGO_URI;

  if (!uri || uri.includes("your_connection_string")) {
    console.log("MONGO_URI placeholder detected. Falling back to local MongoDB...");
    uri = "mongodb://127.0.0.1:27017/jobunify";
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection to ${uri} failed: ${error.message}`);

    // Fall back to local MongoDB if we tried a different URI first
    if (uri !== "mongodb://127.0.0.1:27017/jobunify") {
      console.log("Attempting local MongoDB connection (mongodb://127.0.0.1:27017/jobunify)...");
      try {
        const conn = await mongoose.connect("mongodb://127.0.0.1:27017/jobunify");
        console.log(`MongoDB Connected (Local Fallback): ${conn.connection.host}`);
        return;
      } catch (err) {
        console.error(`Local MongoDB connection failed: ${err.message}`);
      }
    }

    console.log("WARNING: Server started without a successful database connection.");
  }
};

module.exports = connectDB;
