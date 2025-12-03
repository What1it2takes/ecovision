// Auto-detect API base URL for Vercel deployment
const getApiBase = () => {
  // In production on Vercel, use relative path
  if (import.meta.env.PROD) {
    return '';
  }
  // In development, use localhost or custom URL
  return import.meta.env.VITE_API_BASE || 'http://localhost:5000';
};

const API_BASE = getApiBase();

/**
 * Classify waste in an image
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} mode - Detection mode: 'standard' (YOLO) or 'high-accuracy' (GPT-4 Vision)
 * @returns {Promise<Object>} Detection results
 */
export async function classifyWaste(imageBase64, mode = 'standard') {
  const response = await fetch(`${API_BASE}/api/detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: imageBase64, mode }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? 'Detection request failed');
  }

  return response.json();
}

/**
 * Get detection service status
 * @returns {Promise<Object>} Service status with available modes
 */
export async function getDetectionStatus() {
  const response = await fetch(`${API_BASE}/api/detect/status`);
  
  if (!response.ok) {
    throw new Error('Failed to get detection status');
  }
  
  return response.json();
}





