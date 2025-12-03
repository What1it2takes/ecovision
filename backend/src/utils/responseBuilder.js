import { WASTENET_CONFIG } from '../loaders/wasteModelLoader.js';

const MODEL_NAME = 'wastenet-onnx';

export function buildDetectionResponse(result) {
  const { success, result: detection, allProbabilities } = result;
  
  if (!success || detection.fallback) {
    return {
      model: MODEL_NAME,
      success: false,
      result: detection,
      status: 'fallback',
    };
  }

  return {
    model: MODEL_NAME,
    success: true,
    result: detection,
    ...(allProbabilities && { probabilities: allProbabilities }),
    status: 'ok',
  };
}

export function buildErrorResponse(error) {
  return {
    model: MODEL_NAME,
    success: false,
    error: 'Detection failed',
    details: error?.message ?? 'Unexpected error occurred.',
    result: {
      detected_item: 'Unknown',
      type: 'Unknown',
      confidence: 0,
      dispose: 'An error occurred during detection.',
      reduce: [],
      reuse: [],
      recycle: [],
      fallback: true,
    },
  };
}

export function getConfidenceThreshold() {
  return WASTENET_CONFIG.confidenceThreshold;
}
