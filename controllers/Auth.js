import UserModel from "../models/user.js"
import jwt from 'jsonwebtoken'
import bcryptjs from 'bcryptjs'
import path from 'path';
import multer from 'multer'; 
const register=async(req,res)=>{
    try {
        const {fullName,email,password}=req.body
        const existUser= await UserModel.findOne({email})
        if (existUser) {
            return res.status(401).json({success:false,message:"User already Exist"})
        }
            const hasepassword=await bcryptjs.hashSync(password,10)
        const newUser= new UserModel({
            fullName,email,password:hasepassword
        })
        
          await newUser.save()

          res.status(200).json({success:true,message:"user register successfully",newUser})
    } catch (error) {
        res.status(500).json({success:false,message:"interanl server ereo"})
        console.log(error)
    }
}

const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Invalid credentials" });
    }
    // Check password
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(404).json({ success: false, message: "Invalid credentials" });
    }

    // Generate JWT token (Fix: Correct JWT Secret Key)
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Set token as HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // Secure in production only
      sameSite: "strict", // Prevent CSRF attacks
      maxAge: 3600000, // 1 hour
    });

    res.status(200).json({ success: true, message: "Login successful", user, token });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
      const Logout=async(req, res) => {
        try {
          res.clearCookie("token", { httpOnly: true, path: "/" });
          res.status(200).json({ message: "User logged out successfully." });
        } catch (error) {
          res.status(500).json({ message: "Internal Server Error" });
        }
      };
     const CheckUser=async(req,res)=>{
        try {
            const cookie = req.headers.get("cookie") || "";
            const token = cookie.split("; ").find(row => row.startsWith("token="))?.split("=")[1];
        
            if (!token) {
              return new Response(JSON.stringify({ message: "User not authenticated" }), { status: 401 });
            }
        
            return new Response(JSON.stringify({ message: "User authenticated", user: { name: "John Doe" } }), { status: 200 });
          } catch (error) {
            return new Response(JSON.stringify({ message: "Internal Server Error" }), { status: 500 });
          }
     }
     const updateUserProfile = async (req, res) => {
      const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
        if (!token) {
          return res.status(401).json({ message: "Unauthorized: No token provided" });
        }
        // Verify JWT Token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Fetch user from database
        const user = await UserModel.findById(decoded.userId).select("-password");

      const { fullName, email } = req.body;
      const profileImageData = req.file ? { profileImageUrl: `/uploads/${req.file.filename}` } : {};
  
      try {
          const updatedUser = await UserModel.findByIdAndUpdate(
            decoded.userId,
              { fullName, email, ...profileImageData },
              { new: true, runValidators: true }
          );
  
          if (!updatedUser) {
              return res.status(404).json({ success: false, message: "User not found" });
          }
  
          res.status(200).json({ success: true, message: "Profile updated successfully", data: updatedUser });
      } catch (error) {
          console.error("Update Profile Error:", error);
          res.status(500).json({ success: false, message: "Internal server error" });
      }
  };
  
  
  const getUserProfile = async (req, res) => {
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
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            user: {
                fullName: user.fullName,
                email: user.email,
                profileImageUrl: user.profileImageUrl  // Make sure your user schema includes this field
            }
        });
    } catch (error) {
        console.error("Error getting user details:", error);
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid Token" });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

    
   
export {register,Login,Logout,CheckUser,updateUserProfile,getUserProfile}