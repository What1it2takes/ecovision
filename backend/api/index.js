import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import healthRouter from '../src/routes/health.js';
import detectRouter from '../src/routes/detect.js';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/health', healthRouter);
app.use('/detect', detectRouter);

app.get('/', (req, res) => {
  res.json({
    name: 'EcoVision API',
    status: 'online',
    version: '1.0.0',
  });
});

// Vercel serverless function handler
export default app;

