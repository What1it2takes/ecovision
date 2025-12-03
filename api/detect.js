// dotenv not needed in Vercel - environment variables are automatically available
// import 'dotenv/config'; // Removed for Vercel deployment

import multer from 'multer';
import { runWasteDetection, isDetectionReady } from '../backend/src/services/detectionService.js';
import { runHighAccuracyDetection, isOpenAIConfigured } from '../backend/src/services/openaiService.js';
import { WASTE_CLASSES } from '../backend/src/loaders/wasteModelLoader.js';

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for Vercel
  },
  fileFilter: (req, file, cb) => {
    if (file && file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Helper to parse multipart form data
async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    upload.single('image')(req, {}, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(req);
      }
    });
  });
}

// Vercel serverless function handler
export default async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log(`[API] ${req.method} ${req.url}`);
    console.log(`[API] Content-Type: ${req.headers['content-type']}`);
    // Handle GET /status endpoint
    if (req.method === 'GET') {
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
      console.log('[Detect] Request received');
      
      let base64Payload;
      let uploadedFile;
      let mode = 'standard';

      // Check content type
      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('application/json')) {
        // JSON body with base64 image
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        base64Payload = body?.image?.trim?.();
        mode = body?.mode || 'standard';
        console.log('[Detect] Using JSON body with base64');
      } else if (contentType.includes('multipart/form-data')) {
        // Multipart form data
        try {
          await parseMultipart(req);
          uploadedFile = req.file?.buffer;
          mode = req.body?.mode || 'standard';
          console.log('[Detect] Using multipart form data');
        } catch (err) {
          console.error('[Detect] Multipart parse error:', err.message);
          return res.status(400).json({
            success: false,
            error: 'Failed to parse multipart form data',
            insights: [],
          });
        }
      } else {
        // Try to parse as JSON anyway
        try {
          const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
          base64Payload = body?.image?.trim?.();
          mode = body?.mode || 'standard';
        } catch (err) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request format. Send JSON with base64 image or multipart/form-data',
            insights: [],
          });
        }
      }

      // Validate input
      if (!base64Payload && !uploadedFile) {
        console.log('[Detect] No image payload provided');
        return res.status(400).json({
          success: false,
          error: 'Missing image payload. Provide a base64 string in `image` field or upload a file.',
          insights: [],
        });
      }

      console.log(`[Detect] Mode: ${mode}`);

      let inputImage;
      if (base64Payload) {
        inputImage = base64Payload;
      } else {
        inputImage = uploadedFile;
      }

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
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[API] Unexpected error:', error.message);
    console.error('[API] Error stack:', error.stack);
    console.error('[API] Error name:', error.name);
    
    // Return detailed error for debugging
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      errorType: error.name || 'UnknownError',
      insights: [{
        detected_item: 'Error',
        type: 'Error',
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
};
