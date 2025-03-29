import mongoose from "mongoose";

const userSechmea= new mongoose.Schema({
    fullName:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique: true
    },
    password:{
        type:String,
        required:true
    },
    profileImageUrl: { type: String }

},{timestamps:true})


const UserModel= mongoose.model('users',userSechmea)


export default UserModel