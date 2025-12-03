/**
 * Image optimization utilities for better performance
 */

/**
 * Compress and optimize image before sending to API
 * @param {File|Blob} file - Image file
 * @param {Object} options - Compression options
 * @returns {Promise<string>} Base64 encoded optimized image
 */
export async function optimizeImageForUpload(file, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    format = 'jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate optimal dimensions
        let width = img.width;
        let height = img.height;
        
        // Resize if too large
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        
        // Create canvas for compression
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Apply image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            // Convert blob to base64
            const reader2 = new FileReader();
            reader2.onload = () => {
              const base64 = reader2.result;
              resolve(base64);
            };
            reader2.onerror = reject;
            reader2.readAsDataURL(blob);
          },
          `image/${format}`,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get optimal image dimensions for detection
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @param {number} maxDimension - Maximum dimension
 * @returns {{width: number, height: number}} Optimized dimensions
 */
export function getOptimalDimensions(width, height, maxDimension = 1920) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  
  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Estimate file size after optimization
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {number} Estimated size in bytes
 */
export function estimateOptimizedSize(width, height, quality = 0.85) {
  // Rough estimate: width * height * 3 bytes * quality factor
  const baseSize = width * height * 3;
  const qualityFactor = 0.1 + (quality * 0.4); // 0.1-0.5 range
  return Math.round(baseSize * qualityFactor);
}

