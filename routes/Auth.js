import express from "express";
import { getUserProfile, updateUserProfile, Login, Logout, register } from "../controllers/Auth.js";
import { IsUser } from "../middleware/verifyToken.js";
import axios from "axios";
import multer from 'multer';  // Correct import for multer

const FLASK_API_URL = "http://127.0.0.1:5000/analyze";
const AuthRoutes = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // make sure this folder exists
  },
  filename: (req, file, cb) => {
    // Fix to handle possible errors in Windows environments
    cb(null, new Date().toISOString().replace(/:/g, '-') + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Authentication and user profile management routes
AuthRoutes.post("/signup", register);
AuthRoutes.post("/login", Login);
AuthRoutes.post("/logout", Logout);
AuthRoutes.get("/user/profile", IsUser, getUserProfile);
AuthRoutes.put("/update-profile",IsUser, upload.single('profileImage'), updateUserProfile);

// Route to check if user is authenticated
AuthRoutes.get("/check-user", IsUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user: req.user });
  } catch (error) {
    console.error("CheckUser Error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Route to send text for analysis to a Flask API
AuthRoutes.post("/analyze", async (req, res) => {
  try {
    const response = await axios.post(FLASK_API_URL, { text: req.body.text });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Error analyzing review" });
  }
});

export default AuthRoutes;
