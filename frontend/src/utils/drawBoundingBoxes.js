/**
 * Enhanced Bounding Box Drawing Utility
 * Optimized for performance and visual quality
 */

/**
 * Color map for different waste classes
 */
export const CLASS_COLORS = {
  glass: '#00BFFF',
  plastic: '#32CD32',
  metal: '#FFD700',
  paper: '#FF8C00',
  trash: '#FF3333',
  cardboard: '#FF8C00',
  organic: '#8B4513',
  ewaste: '#9932CC',
  textile: '#FF69B4',
  hazardous: '#DC143C',
  // High accuracy mode types
  'e-waste': '#9932CC',
  electronic: '#9932CC',
  battery: '#DC143C',
  chemical: '#DC143C',
  food: '#8B4513',
  compost: '#8B4513',
  // Default fallback
  default: '#00BFFF',
};

/**
 * Get color for a given class type
 * @param {string} type - The waste class type
 * @returns {string} Hex color code
 */
export function getClassColor(type) {
  const normalizedType = (type || '').toLowerCase().trim().replace(/[_-]/g, '');
  
  // Try exact match first
  if (CLASS_COLORS[normalizedType]) {
    return CLASS_COLORS[normalizedType];
  }
  
  // Try partial match
  for (const [key, color] of Object.entries(CLASS_COLORS)) {
    if (normalizedType.includes(key) || key.includes(normalizedType)) {
      return color;
    }
  }
  
  return CLASS_COLORS.default;
}

/**
 * Debounce function to prevent excessive redraws
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Draw a rounded rectangle path
 */
function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex, alpha = 1) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 191, 255, ${alpha})`;
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Draw bounding boxes on a canvas overlay with enhanced visuals
 * 
 * @param {HTMLCanvasElement} canvas - The canvas element to draw on
 * @param {HTMLImageElement} image - The image element for size reference
 * @param {Array} detections - Array of detection objects with bbox, type, confidence
 * @param {Object} originalDimensions - Original image dimensions {width, height}
 */
export function drawBoundingBoxes(canvas, image, detections, originalDimensions) {
  if (!canvas || !image) {
    return;
  }
  
  if (!detections || detections.length === 0) {
    // Clear canvas if no detections
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  // Get displayed image dimensions
  const displayedWidth = image.clientWidth || image.offsetWidth || image.width;
  const displayedHeight = image.clientHeight || image.offsetHeight || image.height;

  if (displayedWidth === 0 || displayedHeight === 0) {
    // Retry after image loads
    requestAnimationFrame(() => drawBoundingBoxes(canvas, image, detections, originalDimensions));
    return;
  }

  // Set canvas size with device pixel ratio for sharp rendering
  const dpr = window.devicePixelRatio || 1;
  
  // Only resize if dimensions changed
  if (canvas.width !== displayedWidth * dpr || canvas.height !== displayedHeight * dpr) {
    canvas.width = displayedWidth * dpr;
    canvas.height = displayedHeight * dpr;
    canvas.style.width = `${displayedWidth}px`;
    canvas.style.height = `${displayedHeight}px`;
  }
  
  // Reset transform and apply DPR scaling
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Calculate scale factors
  const origWidth = originalDimensions?.width || 640;
  const origHeight = originalDimensions?.height || 640;
  const scaleX = displayedWidth / origWidth;
  const scaleY = displayedHeight / origHeight;

  // Clear previous drawings
  ctx.clearRect(0, 0, displayedWidth, displayedHeight);

  // Enable anti-aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw each detection
  detections.forEach((detection, index) => {
    const { bbox, type, confidence, detected_item } = detection;
    
    // Parse bbox
    let x1, y1, x2, y2;
    if (Array.isArray(bbox) && bbox.length >= 4) {
      [x1, y1, x2, y2] = bbox;
    } else if (bbox && typeof bbox === 'object') {
      x1 = bbox.x1 || 0;
      y1 = bbox.y1 || 0;
      x2 = bbox.x2 || 0;
      y2 = bbox.y2 || 0;
    } else {
      return;
    }

    // Skip invalid boxes
    if ((x1 === 0 && y1 === 0 && x2 === 0 && y2 === 0) || 
        !isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
      return;
    }

    // Scale coordinates
    const scaledX1 = x1 * scaleX;
    const scaledY1 = y1 * scaleY;
    const scaledX2 = x2 * scaleX;
    const scaledY2 = y2 * scaleY;

    const boxWidth = scaledX2 - scaledX1;
    const boxHeight = scaledY2 - scaledY1;

    // Skip tiny boxes
    if (boxWidth < 5 || boxHeight < 5) {
      return;
    }

    // Get color for this class
    const label = type || detected_item || 'Unknown';
    const color = getClassColor(label);

    // Draw glow effect (subtle shadow)
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw main bounding box with rounded corners
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    const cornerRadius = Math.min(8, boxWidth / 6, boxHeight / 6);
    roundedRect(ctx, scaledX1, scaledY1, boxWidth, boxHeight, cornerRadius);
    ctx.stroke();

    // Reset shadow for corner accents
    ctx.shadowBlur = 0;

    // Draw corner accents with thicker lines
    const cornerLength = Math.min(25, boxWidth / 3, boxHeight / 3);
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    
    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(scaledX1, scaledY1 + cornerLength);
    ctx.lineTo(scaledX1, scaledY1 + cornerRadius);
    ctx.quadraticCurveTo(scaledX1, scaledY1, scaledX1 + cornerRadius, scaledY1);
    ctx.lineTo(scaledX1 + cornerLength, scaledY1);
    ctx.stroke();

    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(scaledX2 - cornerLength, scaledY1);
    ctx.lineTo(scaledX2 - cornerRadius, scaledY1);
    ctx.quadraticCurveTo(scaledX2, scaledY1, scaledX2, scaledY1 + cornerRadius);
    ctx.lineTo(scaledX2, scaledY1 + cornerLength);
    ctx.stroke();

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(scaledX1, scaledY2 - cornerLength);
    ctx.lineTo(scaledX1, scaledY2 - cornerRadius);
    ctx.quadraticCurveTo(scaledX1, scaledY2, scaledX1 + cornerRadius, scaledY2);
    ctx.lineTo(scaledX1 + cornerLength, scaledY2);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(scaledX2 - cornerLength, scaledY2);
    ctx.lineTo(scaledX2 - cornerRadius, scaledY2);
    ctx.quadraticCurveTo(scaledX2, scaledY2, scaledX2, scaledY2 - cornerRadius);
    ctx.lineTo(scaledX2, scaledY2 - cornerLength);
    ctx.stroke();

    // Prepare label text
    const confidencePercent = typeof confidence === 'number' 
      ? `${(confidence * 100).toFixed(0)}%`
      : '';
    const labelText = `${label} ${confidencePercent}`.trim();

    // Measure text
    ctx.font = 'bold 13px "Inter", "SF Pro Display", system-ui, sans-serif';
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = 16;
    const padding = 8;
    const labelWidth = textWidth + padding * 2;
    const labelHeight = textHeight + 8;
    const labelRadius = 6;

    // Position label
    let labelX = scaledX1;
    let labelY = scaledY1 - labelHeight - 6;
    
    // Adjust if label would go above canvas
    if (labelY < 0) {
      labelY = scaledY1 + 6;
    }

    // Ensure label doesn't go beyond right edge
    if (labelX + labelWidth > displayedWidth) {
      labelX = displayedWidth - labelWidth - 4;
    }
    
    // Ensure label doesn't go beyond left edge
    if (labelX < 4) {
      labelX = 4;
    }

    // Draw label background with gradient
    const gradient = ctx.createLinearGradient(labelX, labelY, labelX, labelY + labelHeight);
    gradient.addColorStop(0, hexToRgba(color, 0.95));
    gradient.addColorStop(1, hexToRgba(color, 0.85));
    
    ctx.fillStyle = gradient;
    roundedRect(ctx, labelX, labelY, labelWidth, labelHeight, labelRadius);
    ctx.fill();

    // Draw subtle border on label
    ctx.strokeStyle = hexToRgba('#ffffff', 0.3);
    ctx.lineWidth = 1;
    roundedRect(ctx, labelX, labelY, labelWidth, labelHeight, labelRadius);
    ctx.stroke();

    // Draw label text with shadow for readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, labelX + padding, labelY + labelHeight / 2 + 1);
    
    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  });
}

/**
 * Create a debounced resize observer that redraws boxes when image size changes
 * 
 * @param {HTMLImageElement} image - The image element to observe
 * @param {Function} redrawCallback - Function to call on resize
 * @returns {ResizeObserver} The observer instance
 */
export function createResizeObserver(image, redrawCallback) {
  // Debounce the redraw to prevent excessive calls during resize
  const debouncedRedraw = debounce(redrawCallback, 16); // ~60fps
  
  const observer = new ResizeObserver((entries) => {
    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
      debouncedRedraw();
    });
  });
  
  if (image) {
    observer.observe(image);
  }
  
  return observer;
}

/**
 * Preload font for consistent text rendering
 */
export async function preloadFonts() {
  try {
    await document.fonts.load('bold 13px Inter');
  } catch (e) {
    // Font loading failed, will use fallback
  }
}
