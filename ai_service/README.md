# EcoVision AI Service - YOLOv10-E + SAM2

FastAPI service for waste detection using YOLOv10-E as the primary detector and SAM2 for optional segmentation.

## Features

- **YOLOv10-E Detection**: High-accuracy object detection with bounding boxes
- **SAM2 Segmentation**: Optional precise segmentation masks
- **CUDA/CPU Auto-detection**: Automatically uses GPU if available (RTX 4050 supported)
- **YOLOv8 Fallback**: Falls back to YOLOv8n if YOLOv10-E model not found
- **Backward Compatible**: Maintains compatibility with existing YOLOv8 API schema

## Installation

### 1. Create Virtual Environment

```bash
cd ai_service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Download Models

#### YOLOv10-E Model

Download `yolov10e.pt` from:
- Official YOLOv10 repository: https://github.com/THU-MIG/yolov10
- Or use pretrained weights (will auto-download if using ultralytics)

Place in `ai_service/models/yolov10e.pt`

#### SAM2 Model

Download SAM2 checkpoint from:
- Official SAM2 repository: https://github.com/facebookresearch/segment-anything-2
- Recommended: `sam2.1_hiera_large.pt` or `sam2.1_hiera_base.pt`

Place in `ai_service/models/sam2.pt`

**Note**: If SAM2 model is not available, the service will still work but segmentation will be disabled.

### 4. Directory Structure

```
ai_service/
├── main.py              # FastAPI app
├── models/
│   ├── yolov10e.pt      # YOLOv10-E model (optional)
│   └── sam2.pt          # SAM2 checkpoint (optional)
├── inference/
│   ├── detector.py      # YOLOv10 interface
│   ├── segmenter.py    # SAM2 interface
│   └── mapper.py        # Class mapping + disposal
├── utils/
│   └── image_io.py      # Image utilities
└── requirements.txt
```

## Running the Service

### Development Mode

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

The service will be available at: `http://localhost:8000`

## API Usage

### Health Check

```bash
curl http://localhost:8000/health
```

### Detection (without segmentation)

```bash
# Using file upload
curl -X POST "http://localhost:8000/detect" \
  -F "image=@path/to/image.jpg"

# Using base64
curl -X POST "http://localhost:8000/detect" \
  -F "image_base64=data:image/jpeg;base64,/9j/4AAQ..."
```

### Detection (with segmentation)

```bash
curl -X POST "http://localhost:8000/detect?segmentation=true" \
  -F "image=@path/to/image.jpg"
```

### Response Format

**Without segmentation:**
```json
{
  "success": true,
  "detections": [
    {
      "class": "plastic_bottle",
      "confidence": 0.95,
      "bbox": [100, 150, 200, 300],
      "disposal": "Rinse and place in recycling bin...",
      "ideas": ["Cut and use as plant containers", ...],
      "dustbin": "Blue Bin"
    }
  ],
  "count": 1
}
```

**With segmentation:**
```json
{
  "success": true,
  "detections": [...],
  "masks": ["data:image/png;base64,iVBORw0KGgo..."],
  "count": 1
}
```

## CUDA vs CPU

### Automatic Detection

The service automatically detects CUDA availability:
- **CUDA Available**: Uses GPU (RTX 4050 supported)
- **CUDA Not Available**: Falls back to CPU

### Manual Device Selection

To force CPU usage, modify `detector.py`:
```python
self.device = "cpu"  # Force CPU
```

## Performance

### Expected Response Times (RTX 4050)

- **Detection only**: ~50-100ms
- **Detection + Segmentation**: ~150-300ms (depends on number of detections)

### Optimization Tips

1. **Mixed Precision**: Enabled by default in YOLOv10
2. **Batch Processing**: Process multiple images in one request (future feature)
3. **Model Quantization**: Use INT8 quantized models for faster inference
4. **TensorRT**: Use NVIDIA TensorRT for optimized GPU inference

## Testing

### Run Tests

```bash
pytest tests/
```

### Manual Test Script

```python
import requests
import base64

# Read image
with open("test_image.jpg", "rb") as f:
    image_bytes = f.read()
    image_b64 = base64.b64encode(image_bytes).decode()

# Test detection
response = requests.post(
    "http://localhost:8000/detect",
    data={"image_base64": f"data:image/jpeg;base64,{image_b64}"}
)
print(response.json())

# Test with segmentation
response = requests.post(
    "http://localhost:8000/detect?segmentation=true",
    data={"image_base64": f"data:image/jpeg;base64,{image_b64}"}
)
print(response.json())
```

## Integration with Existing Backend

The FastAPI service can be integrated with your existing Node.js backend:

### Option 1: Replace Detection Service

Update `backend/src/services/detectionService.js` to call the FastAPI service:

```javascript
const API_BASE = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function runWasteDetection(inputImage) {
  const response = await fetch(`${API_BASE}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: inputImage }),
  });
  return response.json();
}
```

### Option 2: Run as Separate Service

Keep both services running:
- Node.js backend: Port 5000 (existing routes)
- FastAPI service: Port 8000 (new AI service)

## Troubleshooting

### YOLOv10-E Model Not Found

- Service will automatically fall back to YOLOv8n
- Check logs for warning message
- Download model and place in `models/yolov10e.pt`

### SAM2 Not Available

- Service will work without segmentation
- Segmentation requests will return `null` masks
- Install SAM2 dependencies: `pip install git+https://github.com/facebookresearch/segment-anything-2.git`

### CUDA Out of Memory

- Reduce batch size
- Use smaller model (yolov10n instead of yolov10e)
- Enable mixed precision (already enabled by default)

### Slow Performance on CPU

- Expected: CPU is 10-20x slower than GPU
- Consider using cloud GPU or local GPU
- Use smaller models for faster inference

## Class Mapping

YOLOv10 raw classes are mapped to 8 waste classes:

1. `plastic_bottle` - Plastic bottles
2. `plastic_wrapper` - Plastic wrappers/bags
3. `paper_cup` - Paper cups/containers
4. `food_waste` - Organic food waste
5. `glass_bottle` - Glass bottles
6. `metal_can` - Metal cans
7. `cardboard_box` - Cardboard boxes
8. `cloth` - Textiles/clothing

Each class includes:
- Disposal instructions
- 3 reuse ideas
- Dustbin recommendation

## License

Same as main project.

