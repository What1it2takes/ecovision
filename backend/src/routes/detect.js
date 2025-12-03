import { Router } from 'express';
import multer from 'multer';
import { runWasteDetection, isDetectionReady } from '../services/detectionService.js';
import { runHighAccuracyDetection, isOpenAIConfigured } from '../services/openaiService.js';
import { WASTE_CLASSES } from '../loaders/wasteModelLoader.js';

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const router = Router();

/**
 * POST /detect
 * 
 * Accepts image input in two ways:
 * 1. Base64 string in JSON body: { "image": "data:image/jpeg;base64,...", "mode": "standard"|"high-accuracy" }
 * 2. File upload via multipart/form-data with field name "image"
 * 
 * Mode options:
 * - "standard" (default): Uses YOLOv8 ONNX model for fast local detection
 * - "high-accuracy": Uses GPT-4 Vision for detailed analysis with reduce/reuse/recycle tips
 * 
 * Returns waste detection results with disposal guidance.
 * ALWAYS returns 200 with structured JSON - never crashes.
 */
router.post('/', upload.single('image'), async (req, res) => {
  console.log('[Detect] Input received');

  // Determine input source
  const base64Payload = req.body?.image?.trim?.();
  const uploadedFile = req.file?.buffer;
  const mode = req.body?.mode || 'standard';

  console.log(`[Detect] Mode: ${mode}`);

  // Validate that we have at least one input
  if (!base64Payload && !uploadedFile) {
    console.log('[Detect] No image payload provided');
    return res.status(400).json({
      success: false,
      error: 'Missing image payload. Provide a base64 string in `image` field or upload a file.',
      insights: [],
    });
  }

  // Choose input source and log
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
      // Use GPT-4 Vision for high accuracy detection
      console.log('[Detect] Using GPT-4 Vision (high-accuracy mode)');
      
      // Convert buffer to base64 if needed
      let imageForGPT = inputImage;
      if (Buffer.isBuffer(inputImage)) {
        imageForGPT = `data:image/jpeg;base64,${inputImage.toString('base64')}`;
      }
      
      result = await runHighAccuracyDetection(imageForGPT);
      modelUsed = 'gpt-4o-vision';
    } else {
      // Use standard YOLO detection
      console.log('[Detect] Using ONNX model (standard mode)');
      result = await runWasteDetection(inputImage);
      modelUsed = 'yolov8-waste-onnx';
    }

    const { success, insights } = result;

    console.log('[Detect] Returning response');

    // Always return 200 with structured response
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
    // This should never happen due to try-catch in detection services
    // But just in case - never crash, never return 500
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

/**
 * GET /detect/status
 * Check if the detection models are loaded and ready
 */
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

export default router;
