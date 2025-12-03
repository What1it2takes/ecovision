import 'dotenv/config';
import express from 'express';
import detectRouter from '../src/routes/detect.js';

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/', detectRouter);

// Vercel serverless function handler
export default app;

