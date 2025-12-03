import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ort from 'onnxruntime-node';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model configuration
const MODEL_FILENAME = 'yolov8-waste.onnx';

// YOLOv5 waste model classes (5 classes)
export const WASTE_CLASSES = [
  'glass',
  'metal',
  'paper',
  'plastic',
  'trash',
];

// YOLOv5 preprocessing constants
export const YOLO_CONFIG = {
  inputSize: 640,
  confidenceThreshold: 0.25,
  iouThreshold: 0.45,
};

// Singleton session state
let session = null;
let modelLoaded = false;
let modelLoadError = null;

/**
 * Resolve the model path using __dirname
 * Path: backend/src/loaders -> backend/models
 * Also handles Vercel serverless environment
 */
function getModelPath() {
  // Try multiple possible paths for different environments
  const possiblePaths = [
    // Standard path: backend/src/loaders -> backend/models
    path.join(__dirname, '..', '..', 'models', MODEL_FILENAME),
    // Vercel serverless: api/detect.js -> backend/models
    path.join(process.cwd(), 'backend', 'models', MODEL_FILENAME),
    // Alternative: root/models
    path.join(process.cwd(), 'models', MODEL_FILENAME),
    // Absolute path from root
    path.resolve(process.cwd(), 'backend', 'models', MODEL_FILENAME),
  ];

  // Try each path
  for (const modelPath of possiblePaths) {
    if (fs.existsSync(modelPath)) {
      console.log(`[WasteModel] Found model at: ${modelPath}`);
      return modelPath;
    }
  }

  // Return the first path as default (will fail gracefully)
  const defaultPath = path.join(__dirname, '..', '..', 'models', MODEL_FILENAME);
  console.log(`[WasteModel] Using default path: ${defaultPath}`);
  return defaultPath;
}

/**
 * Get the ONNX inference session (singleton pattern)
 * Returns null if model cannot be loaded - NEVER crashes
 */
export async function getModelSession() {
  // Return cached session if already loaded
  if (session) {
    return session;
  }

  // If we already tried and failed, don't retry
  if (modelLoadError) {
    console.warn('[WasteModel] Previous load attempt failed, returning null');
    return null;
  }

  try {
    const modelPath = getModelPath();
    console.log(`[WasteModel] Path: ${modelPath}`);

    // Validate path exists
    if (!fs.existsSync(modelPath)) {
      modelLoadError = `Model file not found at: ${modelPath}`;
      console.error(`[WasteModel] File does NOT exist at path`);
      console.error(`[WasteModel] Load failed: ${modelLoadError}`);
      return null;
    }

    console.log('[WasteModel] File exists');
    console.log('[WasteModel] Loading ONNX model...');

    // Load ONNX model with CPU execution provider
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
    });

    modelLoaded = true;
    console.log('[WasteModel] Model loaded successfully');
    console.log(`[WasteModel] Input names: ${session.inputNames.join(', ')}`);
    console.log(`[WasteModel] Output names: ${session.outputNames.join(', ')}`);

    return session;
  } catch (error) {
    modelLoadError = error.message;
    console.error(`[WasteModel] Load failed: ${error.message}`);
    return null;
  }
}

/**
 * Check if the model is currently loaded
 */
export function isModelLoaded() {
  return modelLoaded;
}

/**
 * Get any model loading error
 */
export function getModelLoadError() {
  return modelLoadError;
}

/**
 * Get the graceful fallback response when model cannot be loaded
 */
export function getModelFallbackResponse() {
  return {
    detected_item: 'Unknown',
    type: 'Unknown',
    confidence: 0,
    bbox: [],
    reduce: [],
    reuse: [],
    recycle: [],
    fallback: true,
  };
}

/**
 * Get class label from index
 */
export function getClassLabel(index) {
  return WASTE_CLASSES[index] ?? 'unknown';
}

/**
 * Apply softmax to convert logits to probabilities
 */
export function softmax(arr) {
  const maxVal = Math.max(...arr);
  const expArr = arr.map((x) => Math.exp(x - maxVal));
  const sumExp = expArr.reduce((a, b) => a + b, 0);
  return expArr.map((x) => x / sumExp);
}
