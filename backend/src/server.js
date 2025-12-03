import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import healthRouter from './routes/health.js';
import detectRouter from './routes/detect.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

app.use('/api/health', healthRouter);
app.use('/api/detect', detectRouter);

app.get('/', (req, res) => {
  res.json({
    name: 'EcoVision API',
    status: 'online',
  });
});

app.listen(PORT, () => {
  console.log(`EcoVision backend listening on http://localhost:${PORT}`);
});

