# Quick Start Guide

## 1. Install Dependencies

```bash
cd ai_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Download Models

### YOLOv10-E (Optional - will fallback to YOLOv8n if not found)

```bash
# Download from official YOLOv10 repository
# Place in: ai_service/models/yolov10e.pt
```

### SAM2 (Optional - segmentation disabled if not found)

```bash
# Download from: https://github.com/facebookresearch/segment-anything-2
# Place in: ai_service/models/sam2.pt
```

## 3. Run Service

```bash
# Linux/Mac
./run.sh

# Windows
run.bat

# Or directly
python main.py
```

## 4. Test

```bash
# Health check
curl http://localhost:8000/health

# Detection
curl -X POST "http://localhost:8000/detect" \
  -F "image=@test_image.jpg"

# Detection with segmentation
curl -X POST "http://localhost:8000/detect?segmentation=true" \
  -F "image=@test_image.jpg"
```

## 5. Integration

See `INTEGRATION.md` for connecting to your Node.js backend.

