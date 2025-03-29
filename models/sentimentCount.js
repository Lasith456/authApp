import mongoose from "mongoose";

const sentimentCountSchema = new mongoose.Schema({
    positive: Number,
    negative: Number,
    neutral: Number,
    lastUpdated: Date
});

const SentimentCount = mongoose.model('SentimentCount', sentimentCountSchema);
export default SentimentCount