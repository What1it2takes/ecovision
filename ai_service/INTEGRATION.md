# Integration Guide: FastAPI AI Service with Node.js Backend

This guide explains how to integrate the new FastAPI AI service with your existing Node.js/Express backend.

## Architecture Options

### Option 1: Replace Detection Service (Recommended)

Replace the ONNX-based detection in Node.js with calls to the FastAPI service.

### Option 2: Dual Service Architecture

Run both services:
- Node.js backend: Port 5000 (handles routes, auth, etc.)
- FastAPI service: Port 8000 (handles AI inference)

## Integration Steps

### 1. Start FastAPI Service

```bash
cd ai_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Service will run on `http://localhost:8000`

### 2. Update Node.js Detection Service

Modify `backend/src/services/detectionService.js`:

```javascript
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Run waste detection using FastAPI AI service
 * @param {string|Buffer} inputImage - Base64 string or image buffer
 * @param {boolean} segmentation - Enable SAM2 segmentation
 * @returns {Promise<Object>} Detection result
 */
export async function runWasteDetection(inputImage, segmentation = false) {
  try {
    // Convert buffer to base64 if needed
    let imageBase64 = inputImage;
    if (Buffer.isBuffer(inputImage)) {
      imageBase64 = `data:image/jpeg;base64,${inputImage.toString('base64')}`;
    }
    
    // Call FastAPI service
    const response = await fetch(`${AI_SERVICE_URL}/detect?segmentation=${segmentation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        image_base64: imageBase64,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Transform to match existing schema
    return {
      success: result.success,
      insights: result.detections.map(det => ({
        detected_item: det.class,
        type: det.class,
        confidence: det.confidence,
        bbox: det.bbox,
        dispose: det.disposal,
        reduce: [], // Add if needed
        reuse: det.ideas,
        recycle: [], // Add if needed
        dustbin: det.dustbin,
        mask_base64: result.masks?.[result.detections.indexOf(det)] || null,
      })),
      imageDimensions: { width: 640, height: 640 }, // Get from image if needed
    };
  } catch (error) {
    console.error('[Detection] FastAPI service error:', error);
    // Fallback to existing ONNX detection if available
    throw error;
  }
}
```

### 3. Update Environment Variables

Add to `backend/.env`:

```env
AI_SERVICE_URL=http://localhost:8000
ENABLE_AI_SERVICE=true
```

### 4. Update Route Handler

Modify `backend/src/routes/detect.js` to use the new service:

```javascript
import { runWasteDetection } from '../services/detectionService.js';

// In your POST handler:
const segmentation = req.query.segmentation === 'true';
const result = await runWasteDetection(inputImage, segmentation);
```

## Docker Compose (Optional)

Create `docker-compose.yml` to run both services:

```yaml
version: '3.8'

services:
  ai-service:
    build: ./ai_service
    ports:
      - "8000:8000"
    volumes:
      - ./ai_service/models:/app/models
    environment:
      - CUDA_VISIBLE_DEVICES=0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - AI_SERVICE_URL=http://ai-service:8000
    depends_on:
      - ai-service
```

## Performance Considerations

1. **Connection Pooling**: Use HTTP connection pooling for FastAPI calls
2. **Caching**: Cache model predictions for identical images
3. **Async**: Use async/await for non-blocking calls
4. **Timeout**: Set appropriate timeouts (5-10 seconds)

## Error Handling

The FastAPI service includes fallback mechanisms:
- YOLOv10-E not found → Falls back to YOLOv8n
- SAM2 not available → Segmentation disabled, detection still works
- CUDA unavailable → Uses CPU automatically

## Testing Integration

1. Start FastAPI service: `python ai_service/main.py`
2. Start Node.js backend: `npm start` in backend/
3. Test endpoint: `POST http://localhost:5000/api/detect`
4. Check logs for FastAPI service calls

## Migration Checklist

- [ ] Install Python dependencies in `ai_service/`
- [ ] Download YOLOv10-E model to `ai_service/models/`
- [ ] Download SAM2 checkpoint to `ai_service/models/`
- [ ] Start FastAPI service and verify health endpoint
- [ ] Update Node.js detection service to call FastAPI
- [ ] Test detection endpoint with sample images
- [ ] Test segmentation endpoint (`?segmentation=true`)
- [ ] Update environment variables
- [ ] Deploy both services (or integrate into one)

## Rollback Plan

If issues occur, you can:
1. Set `ENABLE_AI_SERVICE=false` to use original ONNX detection
2. Keep both detection methods and switch via config
3. Use feature flags to gradually roll out

