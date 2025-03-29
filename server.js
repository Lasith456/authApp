import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import DbCon from './utlis/db.js';
import AuthRoutes from './routes/Auth.js';

import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import SentimentCount from './models/sentimentCount.js';
import Review from './models/review.js';
dotenv.config();
const PORT = process.env.PORT || 3001;
const app = express();

// Fix __dirname issue in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MongoDB Connection
DbCon();

app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        origin: 'https://nextjs-wh67.onrender.com', // Replace with frontend URL
        credentials: true, // Allow cookies
    })
);
app.use('/uploads', express.static('uploads'));

const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Function to introduce a delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// AI Feedback Functions
const generateFeedback = async (input) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        const prompt = `Give ideas for improvement in three sentences for this review: ${input}`;
        const result = await model.generateContent([prompt]);
        return result.response.text() || 'No insight available.';
    } catch (error) {
        if (error.code === 429) {
            console.log('Rate limit exceeded. Retrying in 5 seconds...');
            await delay(5000);
            return generateFeedback(input);
        }
        console.error('Error generating feedback:', error.message);
        return 'No feedback available due to system limitations.';
    }
};
function generateName() {
    const prefix = "Review";
    const date = new Date();
    const dateString = date.toISOString().replace(/T/, '-').replace(/\..+/, '').replace(/:/g, '').replace(/-/g, '');
    return `${prefix}-${dateString}`;
}

const generateFeedbackPositive = async (input) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        const prompt = `Give ideas in one sentence for this review: ${input}`;
        const result = await model.generateContent([prompt]);
        return result.response.text() || 'No insight available.';
    } catch (error) {
        if (error.code === 429) {
            console.log('Rate limit exceeded. Retrying in 5 seconds...');
            await delay(5000);
            return generateFeedbackPositive(input);
        }
        console.error('Error generating feedback:', error.message);
        return 'No feedback available due to system limitations.';
    }
};

// Upload Route
app.post('/api/upload', upload.single('file'), async (req, res) => {
    const zipFilePath = req.file.path;

    try {
        // Unzip the uploaded file
        const extractPath = path.join(__dirname, 'uploads', `${Date.now()}-unzipped`);
        await fs.createReadStream(zipFilePath)
            .pipe(unzipper.Extract({ path: extractPath }))
            .promise();

        const files = fs.readdirSync(extractPath);
        const csvFile = files.find((file) => file.endsWith('.csv'));

        if (!csvFile) {
            return res.status(400).send('No CSV file found in the uploaded ZIP.');
        }

        const csvFilePath = path.join(extractPath, csvFile);
        // Validate CSV columns (Example check for `review` column)
        const csvData = fs.readFileSync(csvFilePath, 'utf8');
        if (!csvData.includes('review')) {
            return res.status(400).send("CSV file must include 'review' column.");
        }

        // Run Python script
        const pythonProcess = spawn('python', ['python/new.py', csvFilePath]);
        let dataToSend = '';

        pythonProcess.stdout.on('data', (data) => {
            dataToSend += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error from Python script: ${data.toString()}`);
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}`);
                return res.status(500).send('Python script error.');
            }

            try {
                // Parse the output from the Python script
                const reviews = JSON.parse(dataToSend);
                let sentimentCounts = await SentimentCount.findOne().sort({ lastUpdated: -1 });
                if (!sentimentCounts) {
                    sentimentCounts = new SentimentCount({ positive: 0, negative: 0, neutral: 0, lastUpdated: new Date() });
                }

                // Process the reviews to add feedback for sentiments and store reviews
                const enhancedReviews = await Promise.all(
                    reviews.map(async (review) => {
                        let feedback;
                        switch (review.sentiment) {
                            case 'negative':
                                sentimentCounts.negative++;
                                feedback = await generateFeedback(review.review);
                                break;
                            case 'positive':
                                sentimentCounts.positive++;
                                feedback = await generateFeedbackPositive(review.review);
                                break;
                            default:
                                sentimentCounts.neutral++;
                                feedback = await generateFeedbackPositive(review.review);
                                break;
                        }

                        return { ...review, insight: feedback};
                    })
                );

                sentimentCounts.lastUpdated = new Date();
                await sentimentCounts.save();
            const reviewDocument = new Review({
                name: generateName(),
                reviews: enhancedReviews.map(review => ({
                    text: review.review,
                    sentiment: review.sentiment,
                    category: review.category,
                    insight: review.insight, 
                    createdAt: new Date()
                }))
            });

            await reviewDocument.save();    
                res.json(enhancedReviews);
            }  catch (error) {
                console.error('Error processing reviews:', error.message);
                res.status(500).send('Error processing reviews.');
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing the file.');
    } finally {
        // Clean up the uploaded files
        fs.unlinkSync(zipFilePath);
    }
});
app.get('/api/reviews/counts', async (req, res) => {
    try {
        const counts = await SentimentCount.findOne().sort({ lastUpdated: -1 });
        res.json(counts);
    } catch (error) {
        res.status(500).send('Error fetching review counts.');
    }
});

app.get('/api/reviews', async (req, res) => {
    try {
        const reviewDocuments = await Review.find();  // Retrieve all documents
        res.json(reviewDocuments);
    } catch (error) {
        console.error('Failed to fetch reviews:', error);
        res.status(500).send('Error fetching reviews.');
    }
});

// Authentication Routes
app.use('/api', AuthRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
