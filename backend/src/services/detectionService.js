import ort from 'onnxruntime-node';
import {
  decodeBase64Image,
  prepareYoloTensor,
  scaleBoxToOriginal,
  isValidBox,
  boxArea,
} from '../utils/imageProcessing.js';
import {
  getModelSession,
  YOLO_CONFIG,
  WASTE_CLASSES,
  getClassLabel,
  getModelFallbackResponse,
  isModelLoaded,
} from '../loaders/wasteModelLoader.js';
import { getWasteGuide } from '../utils/guide.js';

/**
 * Optimized Postprocessing Configuration
 */
const POSTPROCESS_CONFIG = {
  // NMS settings - optimized for better accuracy
  useClassAwareNMS: true,     // Only suppress boxes of the same class
  useSoftNMS: true,           // Use Soft-NMS for better recall
  softNMSSigma: 0.5,          // Optimized sigma for Soft-NMS (increased for better recall)
  
  // Box validation - optimized for better quality
  minBoxArea: 400,            // Optimized minimum (20x20) for better recall
  maxBoxArea: 0.95,           // Maximum box area as fraction of image
  minAspectRatio: 0.1,       // More lenient for various object shapes
  maxAspectRatio: 10,        // Allow more varied aspect ratios
  
  // Confidence calibration - improved scoring
  calibrateConfidence: true,
  confidenceMultiplier: 1.08, // Optimized boost for calibrated scores
  minConfidence: 0.18,        // Lower minimum for better recall
  
  // Result limits
  maxDetections: 20,          // Increased for better coverage
  
  // Deduplication - improved merging
  mergeSimilarDetections: true,
  mergeIoUThreshold: 0.75,    // Optimized for better merging
  
  // Quality filtering
  filterByQuality: true,
  minQualityScore: 0.25,       // Lower threshold for better recall
  
  // Performance optimizations
  useFastNMS: false,          // Use optimized NMS algorithm
  parallelProcessing: false,  // Single-threaded for serverless
};

/**
 * Calculate Intersection over Union (IoU) for two bounding boxes
 * @param {number[]} box1 - [x1, y1, x2, y2]
 * @param {number[]} box2 - [x1, y1, x2, y2]
 * @returns {number} IoU value between 0 and 1
 */
function calculateIoU(box1, box2) {
  const x1 = Math.max(box1[0], box2[0]);
  const y1 = Math.max(box1[1], box2[1]);
  const x2 = Math.min(box1[2], box2[2]);
  const y2 = Math.min(box1[3], box2[3]);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);

  const area1 = (box1[2] - box1[0]) * (box1[3] - box1[1]);
  const area2 = (box2[2] - box2[0]) * (box2[3] - box2[1]);
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * Gaussian weight for Soft-NMS
 */
function gaussianWeight(iou, sigma) {
  return Math.exp(-(iou * iou) / sigma);
}

/**
 * Class-Aware Non-Maximum Suppression with optional Soft-NMS
 * Only suppresses overlapping boxes of the SAME class
 * 
 * @param {Array} detections - Array of {bbox, score, classIndex}
 * @param {number} iouThreshold - IoU threshold for suppression
 * @param {boolean} useSoftNMS - Use Soft-NMS instead of hard NMS
 * @param {number} sigma - Sigma for Gaussian Soft-NMS
 * @param {boolean} classAware - Only suppress same-class boxes
 * @returns {Array} Filtered detections
 */
function advancedNMS(detections, iouThreshold, useSoftNMS = false, sigma = 0.5, classAware = true) {
  if (detections.length === 0) return [];

  // Create a copy with mutable scores
  const dets = detections.map(d => ({ ...d, score: d.score }));
  
  // Sort by score descending
  dets.sort((a, b) => b.score - a.score);
  
  const keep = [];
  const minScore = YOLO_CONFIG.confidenceThreshold * 0.5; // Soft-NMS can reduce scores

  while (dets.length > 0) {
    const current = dets.shift();
    
    // Skip if score dropped too low (for Soft-NMS)
    if (current.score < minScore) continue;
    
    keep.push(current);

    // Update/remove overlapping boxes
    for (let i = dets.length - 1; i >= 0; i--) {
      // If class-aware, only compare same class
      if (classAware && dets[i].classIndex !== current.classIndex) {
        continue;
      }
      
      const iou = calculateIoU(current.bbox, dets[i].bbox);
      
      if (useSoftNMS) {
        // Soft-NMS: reduce confidence based on IoU
        dets[i].score *= gaussianWeight(iou, sigma);
        if (dets[i].score < minScore) {
          dets.splice(i, 1);
        }
      } else {
        // Hard NMS: remove if IoU exceeds threshold
        if (iou > iouThreshold) {
          dets.splice(i, 1);
        }
      }
    }
    
    // Re-sort after Soft-NMS score updates
    if (useSoftNMS) {
      dets.sort((a, b) => b.score - a.score);
    }
  }

  return keep;
}

/**
 * Legacy NMS for backwards compatibility
 */
function nonMaxSuppression(detections, iouThreshold) {
  return advancedNMS(detections, iouThreshold, false, 0.5, false);
}

/**
 * Validate and filter detections based on box properties
 * @param {Array} detections - Array of detections
 * @param {number} imageWidth - Original image width
 * @param {number} imageHeight - Original image height
 * @returns {Array} Valid detections
 */
function validateDetections(detections, imageWidth, imageHeight) {
  const imageArea = imageWidth * imageHeight;
  const maxArea = imageArea * POSTPROCESS_CONFIG.maxBoxArea;
  
  return detections.filter(det => {
    const area = boxArea(det.bbox);
    
    // Check minimum area
    if (area < POSTPROCESS_CONFIG.minBoxArea) {
      return false;
    }
    
    // Check maximum area (reject if box covers almost entire image)
    if (area > maxArea) {
      return false;
    }
    
    // Check aspect ratio
    const [x1, y1, x2, y2] = det.bbox;
    const width = x2 - x1;
    const height = y2 - y1;
    const aspectRatio = width / Math.max(height, 1);
    
    if (aspectRatio < POSTPROCESS_CONFIG.minAspectRatio || 
        aspectRatio > POSTPROCESS_CONFIG.maxAspectRatio) {
      return false;
    }
    
    return true;
  });
}

/**
 * Merge similar detections (same class, high IoU)
 * @param {Array} detections - Array of detections
 * @returns {Array} Merged detections
 */
function mergeSimilarDetections(detections) {
  if (!POSTPROCESS_CONFIG.mergeSimilarDetections || detections.length <= 1) {
    return detections;
  }
  
  const merged = [];
  const used = new Set();
  
  for (let i = 0; i < detections.length; i++) {
    if (used.has(i)) continue;
    
    const current = { ...detections[i] };
    let count = 1;
    
    for (let j = i + 1; j < detections.length; j++) {
      if (used.has(j)) continue;
      
      // Only merge same class
      if (detections[j].classIndex !== current.classIndex) continue;
      
      const iou = calculateIoU(current.bbox, detections[j].bbox);
      
      if (iou >= POSTPROCESS_CONFIG.mergeIoUThreshold) {
        // Average the bounding boxes
        current.bbox = [
          (current.bbox[0] * count + detections[j].bbox[0]) / (count + 1),
          (current.bbox[1] * count + detections[j].bbox[1]) / (count + 1),
          (current.bbox[2] * count + detections[j].bbox[2]) / (count + 1),
          (current.bbox[3] * count + detections[j].bbox[3]) / (count + 1),
        ];
        // Take max confidence
        current.score = Math.max(current.score, detections[j].score);
        used.add(j);
        count++;
      }
    }
    
    merged.push(current);
    used.add(i);
  }
  
  return merged;
}

/**
 * Calculate detection quality score based on box properties
 * @param {Object} det - Detection object
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @returns {number} Quality score (0-1)
 */
function calculateDetectionQuality(det, imageWidth, imageHeight) {
  let quality = 1.0;
  
  // Penalize very small boxes
  const area = boxArea(det.bbox);
  const imageArea = imageWidth * imageHeight;
  const areaRatio = area / imageArea;
  
  if (areaRatio < 0.01) {
    quality *= 0.7; // Very small boxes
  } else if (areaRatio < 0.05) {
    quality *= 0.85; // Small boxes
  }
  
  // Penalize boxes at image edges (often false positives)
  const [x1, y1, x2, y2] = det.bbox;
  const edgeThreshold = 0.05; // 5% of image dimension
  if (x1 < imageWidth * edgeThreshold || 
      x2 > imageWidth * (1 - edgeThreshold) ||
      y1 < imageHeight * edgeThreshold || 
      y2 > imageHeight * (1 - edgeThreshold)) {
    quality *= 0.9; // Slight penalty for edge boxes
  }
  
  // Boost high confidence detections
  if (det.score > 0.7) {
    quality *= 1.1;
  }
  
  return Math.min(1.0, quality);
}

/**
 * Improved confidence calibration with quality-based adjustment
 * @param {Array} detections - Array of detections
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @returns {Array} Calibrated detections
 */
function calibrateConfidence(detections, imageWidth = null, imageHeight = null) {
  if (!POSTPROCESS_CONFIG.calibrateConfidence) {
    return detections;
  }
  
  return detections.map(det => {
    let calibratedScore = det.score * POSTPROCESS_CONFIG.confidenceMultiplier;
    
    // Apply quality-based adjustment if image dimensions available
    if (imageWidth && imageHeight) {
      const quality = calculateDetectionQuality(det, imageWidth, imageHeight);
      calibratedScore *= quality;
    }
    
    // Apply minimum confidence threshold
    calibratedScore = Math.max(calibratedScore, POSTPROCESS_CONFIG.minConfidence || 0);
    
    return {
      ...det,
      score: Math.min(1.0, calibratedScore),
    };
  });
}

/**
 * Parse YOLOv8 output tensor
 * YOLOv8 output format: [batch, 4 + num_classes, num_boxes]
 * Each detection column: [x_center, y_center, width, height, class1_conf, class2_conf, ...]
 * NOTE: YOLOv8 does NOT have objectness score - class scores are direct confidences
 * 
 * @param {Float32Array} outputData - Raw output tensor data
 * @param {number[]} outputShape - Shape of output tensor [1, 4+classes, num_boxes]
 * @param {number} confThreshold - Confidence threshold
 * @returns {Array} Array of {bbox, score, classIndex}
 */
function parseYolov8Output(outputData, outputShape, confThreshold) {
  const detections = [];
  const numClasses = WASTE_CLASSES.length;

  if (outputShape.length !== 3) {
    console.error('[Detection] Expected 3D output, got:', outputShape);
    return [];
  }

  const numChannels = outputShape[1];
  const numBoxes = outputShape[2];

  console.log(`[Detection] Parsing YOLOv8: ${numChannels} channels, ${numBoxes} boxes, ${numClasses} classes`);

  if (numChannels !== 4 + numClasses) {
    console.warn(`[Detection] Channel mismatch: expected ${4 + numClasses}, got ${numChannels}`);
  }

  // Use optimized initial threshold for better recall
  const initialThreshold = confThreshold * 0.75;

  for (let i = 0; i < numBoxes; i++) {
    const xCenter = outputData[0 * numBoxes + i];
    const yCenter = outputData[1 * numBoxes + i];
    const width = outputData[2 * numBoxes + i];
    const height = outputData[3 * numBoxes + i];

    // Get class scores (channels 4 onwards)
    let maxClassScore = 0;
    let maxClassIndex = 0;
    
    for (let c = 0; c < numClasses; c++) {
      const classScore = outputData[(4 + c) * numBoxes + i];
      if (classScore > maxClassScore) {
        maxClassScore = classScore;
        maxClassIndex = c;
      }
    }

    const confidence = maxClassScore;

    if (confidence >= initialThreshold) {
      const x1 = xCenter - width / 2;
      const y1 = yCenter - height / 2;
      const x2 = xCenter + width / 2;
      const y2 = yCenter + height / 2;

      // Basic validation
      if (width > 5 && height > 5 && x2 > x1 && y2 > y1) {
        detections.push({
          bbox: [x1, y1, x2, y2],
          score: confidence,
          classIndex: maxClassIndex,
        });
      }
    }
  }

  return detections;
}

/**
 * Full postprocessing pipeline
 * @param {Array} detections - Raw detections
 * @param {number} scale - Scale factor from preprocessing
 * @param {number} padX - X padding
 * @param {number} padY - Y padding
 * @param {number} origWidth - Original image width
 * @param {number} origHeight - Original image height
 * @returns {Array} Processed detections with scaled bboxes
 */
function postprocessDetections(detections, scale, padX, padY, origWidth, origHeight) {
  if (detections.length === 0) return [];
  
  console.log(`[Postprocess] Input: ${detections.length} detections`);
  
  // 1. Apply advanced NMS
  let processed = advancedNMS(
    detections,
    YOLO_CONFIG.iouThreshold,
    POSTPROCESS_CONFIG.useSoftNMS,
    POSTPROCESS_CONFIG.softNMSSigma,
    POSTPROCESS_CONFIG.useClassAwareNMS
  );
  console.log(`[Postprocess] After NMS: ${processed.length}`);
  
  // 2. Scale bounding boxes to original image coordinates
  processed = processed.map(det => ({
    ...det,
    bbox: scaleBoxToOriginal(det.bbox, scale, padX, padY, origWidth, origHeight),
  }));
  
  // 3. Validate detections
  processed = validateDetections(processed, origWidth, origHeight);
  console.log(`[Postprocess] After validation: ${processed.length}`);
  
  // 4. Merge similar detections
  processed = mergeSimilarDetections(processed);
  console.log(`[Postprocess] After merge: ${processed.length}`);
  
  // 5. Calibrate confidence with quality adjustment
  processed = calibrateConfidence(processed, origWidth, origHeight);
  
  // 6. Filter by minimum confidence threshold
  const minConf = Math.max(
    YOLO_CONFIG.confidenceThreshold,
    POSTPROCESS_CONFIG.minConfidence || 0
  );
  processed = processed.filter(det => det.score >= minConf);
  console.log(`[Postprocess] After confidence filter: ${processed.length}`);
  
  // 7. Quality-based filtering (if enabled)
  if (POSTPROCESS_CONFIG.filterByQuality) {
    processed = processed.filter(det => {
      const quality = calculateDetectionQuality(det, origWidth, origHeight);
      return quality >= (POSTPROCESS_CONFIG.minQualityScore || 0.3);
    });
    console.log(`[Postprocess] After quality filter: ${processed.length}`);
  }
  
  // 8. Sort by confidence and limit
  processed.sort((a, b) => b.score - a.score);
  processed = processed.slice(0, POSTPROCESS_CONFIG.maxDetections);
  
  console.log(`[Postprocess] Final: ${processed.length} detections`);
  
  return processed;
}

/**
 * Run waste detection on an image
 * Accepts base64 string OR Buffer
 * 
 * @param {string|Buffer} inputImage - Base64 string or image buffer
 * @returns {Promise<Object>} Detection result with insights array
 */
export async function runWasteDetection(inputImage) {
  const startTime = Date.now();
  
  try {
    // Get ONNX session (singleton)
    const session = await getModelSession();

    if (!session) {
      console.warn('[Detection] Model not available, returning fallback response');
      return {
        success: false,
        insights: [getModelFallbackResponse()],
      };
    }

    // Preprocess image with enhanced pipeline
    const preprocessStart = Date.now();
    const { tensor, scale, padX, padY, origWidth, origHeight, quality } = await prepareYoloTensor(
      inputImage,
      YOLO_CONFIG.inputSize
    );
    const preprocessTime = Date.now() - preprocessStart;

    // Create ONNX tensor
    const inputTensor = new ort.Tensor('float32', tensor, [
      1,
      3,
      YOLO_CONFIG.inputSize,
      YOLO_CONFIG.inputSize,
    ]);

    // Run inference
    const inputName = session.inputNames[0];
    const feeds = { [inputName]: inputTensor };
    
    console.log('[Detection] Running inference...');
    const inferenceStart = Date.now();
    const results = await session.run(feeds);
    const inferenceTime = Date.now() - inferenceStart;

    // Get output tensor
    const outputName = session.outputNames[0];
    const output = results[outputName];
    const outputData = output.data;
    const outputShape = output.dims;

    console.log(`[Detection] Output shape: ${outputShape.join('x')}`);

    // Parse YOLOv8 output
    const postprocessStart = Date.now();
    let detections = parseYolov8Output(
      outputData,
      outputShape,
      YOLO_CONFIG.confidenceThreshold
    );

    console.log(`[Detection] Raw detections: ${detections.length}`);

    // Apply full postprocessing pipeline
    detections = postprocessDetections(
      detections,
      scale,
      padX,
      padY,
      origWidth,
      origHeight
    );
    const postprocessTime = Date.now() - postprocessStart;

    const totalTime = Date.now() - startTime;
    console.log(`[Detection] Timing: preprocess=${preprocessTime}ms, inference=${inferenceTime}ms, postprocess=${postprocessTime}ms, total=${totalTime}ms`);

    // If no detections, return fallback
    if (detections.length === 0) {
      console.log('[Detection] No objects detected above threshold');
      return {
        success: true,
        insights: [getModelFallbackResponse()],
        imageDimensions: { width: origWidth, height: origHeight },
        timing: { preprocess: preprocessTime, inference: inferenceTime, postprocess: postprocessTime, total: totalTime },
      };
    }

    // Build response for each detection
    const insights = detections.map((det) => {
      const className = getClassLabel(det.classIndex);
      const guide = getWasteGuide(className);

      console.log(`[Detection] ${className}: bbox=[${det.bbox.map(v => v.toFixed(0)).join(',')}], conf=${det.score.toFixed(3)}`);

      return {
        detected_item: capitalize(className),
        type: guide.type ?? capitalize(className),
        confidence: Number(det.score.toFixed(4)),
        bbox: det.bbox,
        dispose: guide.dispose,
        reduce: guide.reduce ?? [],
        reuse: guide.reuse ?? [],
        recycle: guide.recycle ?? [],
        dustbin: guide.dustbin ?? 'Blue Bin',
        dustbinColor: guide.dustbinColor ?? 'blue',
      };
    });

    console.log(`[Detection] Returning ${insights.length} detection(s)`);

    return {
      success: true,
      insights,
      imageDimensions: { width: origWidth, height: origHeight },
      timing: { preprocess: preprocessTime, inference: inferenceTime, postprocess: postprocessTime, total: totalTime },
      quality,
    };
  } catch (error) {
    console.error('[Detection] Pipeline error:', error);
    return {
      success: false,
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
    };
  }
}

/**
 * Legacy function for compatibility with existing code
 */
export async function runDetectionPipeline(base64Image) {
  const result = await runWasteDetection(base64Image);
  
  return {
    success: result.success,
    result: result.insights[0] ?? getModelFallbackResponse(),
    allDetections: result.insights,
  };
}

/**
 * Check if detection service is ready (model loaded)
 */
export function isDetectionReady() {
  return isModelLoaded();
}

/**
 * Capitalize first letter of each word
 */
function capitalize(text = '') {
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}
