import sharp from 'sharp';

/**
 * Image Enhancement Configuration
 */
const ENHANCEMENT_CONFIG = {
  // Auto-contrast enhancement
  normalizeContrast: true,
  contrastStrength: 1.1,
  
  // Sharpening for better edge detection
  sharpen: true,
  sharpenSigma: 1.0,
  
  // Noise reduction for cleaner input
  denoise: true,
  denoiseStrength: 3,
  
  // Brightness/gamma correction
  autoGamma: true,
  
  // Minimum quality thresholds
  minWidth: 32,
  minHeight: 32,
  maxWidth: 4096,
  maxHeight: 4096,
};

/**
 * Takes a base64 string (with or without data URI prefix) and returns a Buffer.
 */
export function decodeBase64Image(base64) {
  if (!base64) {
    throw new Error('Empty base64 payload supplied.');
  }

  const sanitized = base64.includes(',')
    ? base64.split(',').pop()
    : base64.replace(/\s/g, '');

  return Buffer.from(sanitized, 'base64');
}

/**
 * Validate image quality and dimensions
 * @param {Object} metadata - Sharp metadata object
 * @returns {{valid: boolean, reason?: string}}
 */
function validateImage(metadata) {
  const { width, height, format } = metadata;
  
  if (!width || !height) {
    return { valid: false, reason: 'Could not determine image dimensions' };
  }
  
  if (width < ENHANCEMENT_CONFIG.minWidth || height < ENHANCEMENT_CONFIG.minHeight) {
    return { valid: false, reason: `Image too small: ${width}x${height}. Minimum is ${ENHANCEMENT_CONFIG.minWidth}x${ENHANCEMENT_CONFIG.minHeight}` };
  }
  
  if (width > ENHANCEMENT_CONFIG.maxWidth || height > ENHANCEMENT_CONFIG.maxHeight) {
    return { valid: false, reason: `Image too large: ${width}x${height}. Maximum is ${ENHANCEMENT_CONFIG.maxWidth}x${ENHANCEMENT_CONFIG.maxHeight}` };
  }
  
  const supportedFormats = ['jpeg', 'png', 'webp', 'gif', 'tiff', 'heif', 'avif'];
  if (format && !supportedFormats.includes(format)) {
    return { valid: false, reason: `Unsupported image format: ${format}` };
  }
  
  return { valid: true };
}

/**
 * Apply image enhancement pipeline for better detection
 * @param {sharp.Sharp} image - Sharp image instance
 * @param {Object} options - Enhancement options
 * @returns {sharp.Sharp} Enhanced image
 */
function applyEnhancements(image, options = {}) {
  let enhanced = image;
  
  // Auto-rotate based on EXIF orientation
  enhanced = enhanced.rotate();
  
  // Normalize contrast (auto-level)
  if (options.normalizeContrast ?? ENHANCEMENT_CONFIG.normalizeContrast) {
    enhanced = enhanced.normalize();
  }
  
  // Apply subtle sharpening for edge detection
  if (options.sharpen ?? ENHANCEMENT_CONFIG.sharpen) {
    enhanced = enhanced.sharpen({
      sigma: options.sharpenSigma ?? ENHANCEMENT_CONFIG.sharpenSigma,
      m1: 1.0,  // Flat areas
      m2: 2.0,  // Jagged areas
    });
  }
  
  // Denoise for cleaner input (reduces false positives)
  if (options.denoise ?? ENHANCEMENT_CONFIG.denoise) {
    enhanced = enhanced.median(options.denoiseStrength ?? ENHANCEMENT_CONFIG.denoiseStrength);
  }
  
  // Auto gamma correction for better color representation
  if (options.autoGamma ?? ENHANCEMENT_CONFIG.autoGamma) {
    enhanced = enhanced.gamma();
  }
  
  // Ensure consistent color space
  enhanced = enhanced.toColorspace('srgb');
  
  return enhanced;
}

/**
 * Enhanced YOLOv8 letterbox preprocessing pipeline:
 * - Validates image quality
 * - Auto-rotates based on EXIF
 * - Applies enhancement (contrast, sharpening, denoising)
 * - Resizes with letterbox padding (maintains aspect ratio)
 * - Normalizes by dividing by 255
 * - Converts to Float32Array in CHW format
 * - Final shape: [1, 3, 640, 640]
 * 
 * @param {Buffer|string} input - Image buffer or base64 string
 * @param {number} targetSize - Target dimension (default 640)
 * @param {Object} options - Preprocessing options
 * @returns {Promise<{tensor: Float32Array, scale: number, padX: number, padY: number, origWidth: number, origHeight: number, quality: Object}>}
 */
export async function prepareYoloTensor(input, targetSize = 640, options = {}) {
  try {
    // Handle base64 input
    let buffer = input;
    if (typeof input === 'string') {
      buffer = decodeBase64Image(input);
    }

    // Get original image info and validate
    const sharpInstance = sharp(buffer);
    const metadata = await sharpInstance.metadata();
    
    // Validate image
    const validation = validateImage(metadata);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
    
    console.log(`[Preprocess] Image loaded: ${metadata.width}x${metadata.height} ${metadata.format}`);
    
    const origWidth = metadata.width;
    const origHeight = metadata.height;

    // Apply enhancement pipeline
    const enhanced = applyEnhancements(sharp(buffer), options);
    
    // Get enhanced image metadata (may change after rotation)
    const enhancedMeta = await enhanced.clone().metadata();
    const enhancedWidth = enhancedMeta.width || origWidth;
    const enhancedHeight = enhancedMeta.height || origHeight;

    // Calculate letterbox dimensions (maintain aspect ratio)
    const scale = Math.min(targetSize / enhancedWidth, targetSize / enhancedHeight);
    const newWidth = Math.round(enhancedWidth * scale);
    const newHeight = Math.round(enhancedHeight * scale);

    // Calculate padding (center the image)
    const padX = Math.floor((targetSize - newWidth) / 2);
    const padY = Math.floor((targetSize - newHeight) / 2);

    // Resize with high-quality resampling
    const { data } = await enhanced
      .resize(newWidth, newHeight, {
        fit: 'fill',
        kernel: 'lanczos3',  // High-quality resampling
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create padded image buffer (640x640x3) filled with gray (114 for YOLO)
    const paddedSize = targetSize * targetSize * 3;
    const paddedData = new Uint8Array(paddedSize).fill(114);

    // Copy resized image to center of padded buffer
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcIdx = (y * newWidth + x) * 3;
        const dstX = x + padX;
        const dstY = y + padY;
        const dstIdx = (dstY * targetSize + dstX) * 3;

        paddedData[dstIdx] = data[srcIdx];         // R
        paddedData[dstIdx + 1] = data[srcIdx + 1]; // G
        paddedData[dstIdx + 2] = data[srcIdx + 2]; // B
      }
    }

    // Convert to Float32Array in CHW format with normalization (divide by 255)
    const pixels = targetSize * targetSize;
    const channels = 3;
    const floatData = new Float32Array(channels * pixels);

    for (let i = 0; i < pixels; i++) {
      const r = paddedData[i * channels] / 255.0;
      const g = paddedData[i * channels + 1] / 255.0;
      const b = paddedData[i * channels + 2] / 255.0;

      // CHW layout: all R values, then all G values, then all B values
      floatData[i] = r;
      floatData[i + pixels] = g;
      floatData[i + pixels * 2] = b;
    }

    console.log(`[Preprocess] Tensor shape: 1x3x${targetSize}x${targetSize}`);
    console.log(`[Preprocess] Enhancement: contrast=${ENHANCEMENT_CONFIG.normalizeContrast}, sharpen=${ENHANCEMENT_CONFIG.sharpen}, denoise=${ENHANCEMENT_CONFIG.denoise}`);

    return {
      tensor: floatData,
      scale,
      padX,
      padY,
      origWidth: enhancedWidth,
      origHeight: enhancedHeight,
      quality: {
        originalSize: { width: origWidth, height: origHeight },
        format: metadata.format,
        enhanced: true,
      },
    };
  } catch (error) {
    console.error('[Preprocess] Error:', error.message);
    throw new Error(`Image preprocessing failed: ${error.message}`);
  }
}

/**
 * Scale bounding box coordinates back to original image dimensions
 * with boundary clipping and validation
 * 
 * @param {number[]} bbox - [x1, y1, x2, y2] in model coordinates
 * @param {number} scale - Scale factor used during preprocessing
 * @param {number} padX - X padding added during letterboxing
 * @param {number} padY - Y padding added during letterboxing
 * @param {number} origWidth - Original image width (for clipping)
 * @param {number} origHeight - Original image height (for clipping)
 * @returns {number[]} - Scaled and clipped [x1, y1, x2, y2]
 */
export function scaleBoxToOriginal(bbox, scale, padX, padY, origWidth = null, origHeight = null) {
  const [x1, y1, x2, y2] = bbox;
  
  // Scale back to original coordinates
  let scaledX1 = (x1 - padX) / scale;
  let scaledY1 = (y1 - padY) / scale;
  let scaledX2 = (x2 - padX) / scale;
  let scaledY2 = (y2 - padY) / scale;
  
  // Clip to image boundaries if dimensions provided
  if (origWidth !== null && origHeight !== null) {
    scaledX1 = Math.max(0, Math.min(scaledX1, origWidth));
    scaledY1 = Math.max(0, Math.min(scaledY1, origHeight));
    scaledX2 = Math.max(0, Math.min(scaledX2, origWidth));
    scaledY2 = Math.max(0, Math.min(scaledY2, origHeight));
  }
  
  return [
    Math.round(scaledX1),
    Math.round(scaledY1),
    Math.round(scaledX2),
    Math.round(scaledY2),
  ];
}

/**
 * Calculate box area
 */
export function boxArea(bbox) {
  const [x1, y1, x2, y2] = bbox;
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

/**
 * Calculate aspect ratio of a box
 */
export function boxAspectRatio(bbox) {
  const [x1, y1, x2, y2] = bbox;
  const width = x2 - x1;
  const height = y2 - y1;
  if (height === 0) return 0;
  return width / height;
}

/**
 * Validate a bounding box
 * @param {number[]} bbox - [x1, y1, x2, y2]
 * @param {number} minArea - Minimum box area
 * @param {number} maxAspectRatio - Maximum aspect ratio
 * @returns {boolean}
 */
export function isValidBox(bbox, minArea = 100, maxAspectRatio = 20) {
  if (!bbox || bbox.length !== 4) return false;
  
  const [x1, y1, x2, y2] = bbox;
  
  // Check for valid coordinates
  if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
    return false;
  }
  
  // Check for positive dimensions
  if (x2 <= x1 || y2 <= y1) return false;
  
  // Check minimum area
  const area = boxArea(bbox);
  if (area < minArea) return false;
  
  // Check aspect ratio (reject extremely thin boxes)
  const ar = boxAspectRatio(bbox);
  if (ar > maxAspectRatio || ar < 1 / maxAspectRatio) return false;
  
  return true;
}

// ============================================
// Legacy functions for WasteNet compatibility
// ============================================

// ImageNet normalization constants for WasteNet
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

/**
 * Preprocess image for WasteNet ONNX model (legacy):
 * - Resize to 224x224
 * - Convert to RGB
 * - Normalize using ImageNet mean/std
 * - Convert to float32
 * - Reorder to CHW layout
 * - Final shape: [1, 3, 224, 224]
 */
export async function prepareWasteNetTensor(buffer, targetSize = 224) {
  try {
    // Resize to target size and get raw RGB data
    const { data } = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(targetSize, targetSize, {
        fit: 'cover',
        position: 'center',
      })
      .removeAlpha()
      .toColorspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = targetSize * targetSize;
    const channels = 3;
    const floatData = new Float32Array(channels * pixels);

    // Convert to CHW format with ImageNet normalization
    for (let i = 0; i < pixels; i++) {
      const r = data[i * channels] / 255.0;
      const g = data[i * channels + 1] / 255.0;
      const b = data[i * channels + 2] / 255.0;

      // Apply ImageNet normalization: (value - mean) / std
      floatData[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      floatData[i + pixels] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      floatData[i + pixels * 2] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    }

    return floatData;
  } catch (error) {
    console.error('[ImageProcessing] Error preprocessing image:', error.message);
    throw new Error(`Image preprocessing failed: ${error.message}`);
  }
}

/**
 * Legacy YOLO preprocessing (kept for compatibility)
 */
export async function prepareImageTensorData(buffer, targetSize) {
  const { data } = await sharp(buffer)
    .rotate()
    .resize(targetSize, targetSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = targetSize * targetSize;
  const channels = 3;
  const floatData = new Float32Array(channels * pixels);

  for (let i = 0; i < pixels; i += 1) {
    const r = data[i * channels] / 255;
    const g = data[i * channels + 1] / 255;
    const b = data[i * channels + 2] / 255;

    floatData[i] = r;
    floatData[i + pixels] = g;
    floatData[i + pixels * 2] = b;
  }

  return floatData;
}
