import 'dotenv/config';
import express from 'express';
import healthRouter from '../src/routes/health.js';

const app = express();

// Routes
app.use('/', healthRouter);

// Vercel serverless function handler
export default app;

