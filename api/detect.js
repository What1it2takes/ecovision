import 'dotenv/config';
import { Router } from 'express';
import multer from 'multer';
import { runWasteDetection, isDetectionReady } from '../backend/src/services/detectionService.js';
import { runHighAccuracyDetection, isOpenAIConfigured } from '../backend/src/services/openaiService.js';
import { WASTE_CLASSES } from '../backend/src/loaders/wasteModelLoader.js';

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const router = Router();

// POST /api/detect
router.post('/', upload.single('image'), async (req, res) => {
  console.log('[Detect] Input received');

  const base64Payload = req.body?.image?.trim?.();
  const uploadedFile = req.file?.buffer;
  const mode = req.body?.mode || 'standard';

  console.log(`[Detect] Mode: ${mode}`);

  if (!base64Payload && !uploadedFile) {
    console.log('[Detect] No image payload provided');
    return res.status(400).json({
      success: false,
      error: 'Missing image payload. Provide a base64 string in `image` field or upload a file.',
      insights: [],
    });
  }

  let inputImage;
  if (base64Payload) {
    console.log('[Detect] Using base64 input');
    inputImage = base64Payload;
  } else {
    console.log('[Detect] Using uploaded file buffer');
    inputImage = uploadedFile;
  }

  try {
    let result;
    let modelUsed;

    if (mode === 'high-accuracy') {
      console.log('[Detect] Using GPT-4 Vision (high-accuracy mode)');
      let imageForGPT = inputImage;
      if (Buffer.isBuffer(inputImage)) {
        imageForGPT = `data:image/jpeg;base64,${inputImage.toString('base64')}`;
      }
      result = await runHighAccuracyDetection(imageForGPT);
      modelUsed = 'gpt-4o-vision';
    } else {
      console.log('[Detect] Using ONNX model (standard mode)');
      result = await runWasteDetection(inputImage);
      modelUsed = 'yolov8-waste-onnx';
    }

    const { success, insights } = result;

    console.log('[Detect] Returning response');

    return res.json({
      success,
      model: modelUsed,
      mode,
      insights,
      imageDimensions: result.imageDimensions,
      count: insights.length,
      status: insights[0]?.fallback ? 'fallback' : 'ok',
    });
  } catch (error) {
    console.error('[Detect] Unexpected error:', error.message);
    console.log('[Detect] Returning response');

    return res.status(200).json({
      success: false,
      model: mode === 'high-accuracy' ? 'gpt-4o-vision' : 'yolov8-waste-onnx',
      mode,
      insights: [{
        detected_item: 'Unknown',
        type: 'Unknown',
        confidence: 0,
        bbox: [],
        reduce: [],
        reuse: [],
        recycle: [],
        fallback: true,
        error: error.message,
      }],
      count: 1,
      status: 'error',
    });
  }
});

// GET /api/detect/status
router.get('/status', async (req, res) => {
  const yoloReady = isDetectionReady();
  const openaiReady = isOpenAIConfigured();

  return res.json({
    modes: {
      standard: {
        model: 'yolov8-waste-onnx',
        ready: yoloReady,
        description: 'Fast local detection using YOLOv8',
      },
      'high-accuracy': {
        model: 'gpt-4o-vision',
        ready: openaiReady,
        description: 'Detailed analysis with GPT-4 Vision + reduce/reuse/recycle tips',
      },
    },
    defaultMode: 'standard',
    ready: yoloReady,
    highAccuracyAvailable: openaiReady,
    classes: WASTE_CLASSES,
    inputSize: 640,
    confidenceThreshold: 0.25,
    iouThreshold: 0.45,
  });
});

// Vercel serverless function handler
export default async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle /status endpoint
  if (req.method === 'GET' && (req.url === '/status' || req.url === '/detect/status' || req.url.endsWith('/status'))) {
    const yoloReady = isDetectionReady();
    const openaiReady = isOpenAIConfigured();
    return res.json({
      modes: {
        standard: {
          model: 'yolov8-waste-onnx',
          ready: yoloReady,
          description: 'Fast local detection using YOLOv8',
        },
        'high-accuracy': {
          model: 'gpt-4o-vision',
          ready: openaiReady,
          description: 'Detailed analysis with GPT-4 Vision + reduce/reuse/recycle tips',
        },
      },
      defaultMode: 'standard',
      ready: yoloReady,
      highAccuracyAvailable: openaiReady,
      classes: WASTE_CLASSES,
      inputSize: 640,
      confidenceThreshold: 0.25,
      iouThreshold: 0.45,
    });
  }

  // Handle POST /detect
  if (req.method === 'POST') {
    return router.handle(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

