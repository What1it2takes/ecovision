/**
 * Client-side image optimization before sending to API
 * Reduces file size while maintaining quality for detection
 */

/**
 * Optimize image before sending to API
 * @param {string} dataUrl - Base64 data URL
 * @param {Object} options - Optimization options
 * @returns {Promise<string>} Optimized base64 data URL
 */
export async function optimizeImageForDetection(dataUrl, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    format = 'jpeg',
    targetSizeKB = 500, // Target size in KB
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate optimal dimensions
      let { width, height } = calculateOptimalDimensions(
        img.naturalWidth,
        img.naturalHeight,
        maxWidth,
        maxHeight
      );
      
      canvas.width = width;
      canvas.height = height;
      
      // Use high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob for size checking
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to optimize image'));
            return;
          }
          
          // If still too large, reduce quality further
          const sizeKB = blob.size / 1024;
          if (sizeKB > targetSizeKB && quality > 0.5) {
            // Recursively reduce quality
            const newQuality = Math.max(0.5, quality * 0.9);
            canvas.toBlob(
              (optimizedBlob) => {
                if (!optimizedBlob) {
                  resolve(dataUrl); // Fallback to original
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(dataUrl);
                reader.readAsDataURL(optimizedBlob);
              },
              `image/${format}`,
              newQuality
            );
          } else {
            // Size is acceptable
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(dataUrl);
            reader.readAsDataURL(blob);
          }
        },
        `image/${format}`,
        quality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Calculate optimal dimensions maintaining aspect ratio
 */
function calculateOptimalDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;
  
  // Scale down if exceeds max dimensions
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  // Round to even numbers (better for compression)
  width = Math.round(width / 2) * 2;
  height = Math.round(height / 2) * 2;
  
  return { width, height };
}

/**
 * Get image metadata
 */
export function getImageMetadata(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight,
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Compress image with progressive quality reduction
 */
export async function compressImage(dataUrl, maxSizeKB = 500) {
  let quality = 0.9;
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    const optimized = await optimizeImageForDetection(dataUrl, {
      quality,
      targetSizeKB: maxSizeKB,
    });
    
    // Check size
    const sizeKB = getBase64SizeKB(optimized);
    if (sizeKB <= maxSizeKB || quality <= 0.5) {
      return optimized;
    }
    
    quality -= 0.1;
    attempts++;
  }
  
  return dataUrl; // Fallback
}

/**
 * Get base64 string size in KB
 */
function getBase64SizeKB(base64) {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  // Approximate size: base64 is ~33% larger than binary
  return (base64Data.length * 3) / 4 / 1024;
}

