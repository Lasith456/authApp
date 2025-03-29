import jwt from "jsonwebtoken";
import UserModel from "../models/user.js";
import dotenv from "dotenv";

dotenv.config();

const IsUser = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    // Verify JWT Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Fetch user from database
    const user = await UserModel.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

export { IsUser };
