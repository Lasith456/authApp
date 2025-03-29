import mongoose from "mongoose";
const reviewSchema = new mongoose.Schema({
    name: String, 
    reviews: [{
        text: String,
        sentiment: String,
        category: String,
        insight: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
});

const Review = mongoose.model('Review', reviewSchema);
export default Review