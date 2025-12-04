"""
FastAPI service for waste detection using YOLOv10-E + SAM2
Maintains backward compatibility with existing YOLOv8 API schema
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List
import uvicorn
import logging
from contextlib import asynccontextmanager

from inference.detector import YOLOv10Detector
from inference.segmenter import SAM2Segmenter
from inference.mapper import WasteMapper
from utils.image_io import decode_image, encode_mask_to_base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model instances (loaded at startup)
detector: Optional[YOLOv10Detector] = None
segmenter: Optional[SAM2Segmenter] = None
mapper = WasteMapper()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models at startup, unload at shutdown"""
    global detector, segmenter
    
    logger.info("Loading YOLOv10-E detector...")
    try:
        detector = YOLOv10Detector()
        logger.info("✓ YOLOv10-E loaded successfully")
    except Exception as e:
        logger.error(f"✗ Failed to load YOLOv10-E: {e}")
        detector = None
    
    logger.info("Loading SAM2 segmenter...")
    try:
        segmenter = SAM2Segmenter()
        logger.info("✓ SAM2 loaded successfully")
    except Exception as e:
        logger.warning(f"⚠ SAM2 not available: {e}")
        segmenter = None
    
    yield
    
    # Cleanup
    detector = None
    segmenter = None
    logger.info("Models unloaded")


app = FastAPI(
    title="EcoVision AI Service",
    description="Waste detection using YOLOv10-E + SAM2",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "EcoVision AI Service",
        "version": "2.0.0",
        "status": "online",
        "detector_ready": detector is not None,
        "segmenter_ready": segmenter is not None,
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "ok": True,
        "detector": {
            "loaded": detector is not None,
            "model": detector.model_name if detector else None,
            "device": detector.device if detector else None,
        },
        "segmenter": {
            "loaded": segmenter is not None,
        },
    }


@app.post("/detect")
async def detect_waste(
    image: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    segmentation: bool = Query(False, description="Enable SAM2 segmentation"),
):
    """
    Detect waste in image using YOLOv10-E, optionally with SAM2 segmentation.
    
    Accepts:
    - Multipart form with 'image' file
    - Form data with 'image_base64' string
    
    Query params:
    - segmentation: true/false (default: false)
    
    Returns:
    - detections: List of detections with bbox, class, confidence
    - masks: Base64-encoded PNG masks (if segmentation=true)
    """
    if not detector:
        raise HTTPException(
            status_code=503,
            detail="Detector not loaded. Check server logs."
        )
    
    # Get image data
    image_data = None
    
    if image:
        image_data = await image.read()
        logger.info(f"Received image file: {image.filename}, size: {len(image_data)} bytes")
    elif image_base64:
        try:
            image_data = decode_image(image_base64)
            logger.info(f"Received base64 image, decoded size: {len(image_data)} bytes")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")
    else:
        raise HTTPException(
            status_code=400,
            detail="No image provided. Send 'image' file or 'image_base64' string."
        )
    
    if not image_data:
        raise HTTPException(status_code=400, detail="Failed to decode image")
    
    try:
        # Run YOLOv10-E detection
        logger.info("Running YOLOv10-E detection...")
        detections = detector.detect(image_data)
        
        if not detections:
            return {
                "success": True,
                "detections": [],
                "count": 0,
            }
        
        # Map to waste classes and add disposal info
        mapped_detections = []
        for det in detections:
            mapped = mapper.map_detection(det)
            mapped_detections.append(mapped)
        
        # Run SAM2 segmentation if requested
        masks_base64 = []
        if segmentation and segmenter:
            logger.info(f"Running SAM2 segmentation for {len(detections)} detections...")
            for det in detections:
                try:
                    mask = segmenter.segment(image_data, det["bbox"])
                    mask_b64 = encode_mask_to_base64(mask)
                    masks_base64.append(mask_b64)
                except Exception as e:
                    logger.warning(f"Segmentation failed for detection: {e}")
                    masks_base64.append(None)
        elif segmentation and not segmenter:
            logger.warning("Segmentation requested but SAM2 not available")
            masks_base64 = [None] * len(detections)
        
        # Build response (backward compatible with YOLOv8 schema)
        response = {
            "success": True,
            "detections": mapped_detections,
            "count": len(mapped_detections),
        }
        
        # Add masks if segmentation was requested
        if segmentation:
            response["masks"] = masks_base64
        
        logger.info(f"Detection complete: {len(mapped_detections)} objects found")
        return response
        
    except Exception as e:
        logger.error(f"Detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


@app.get("/classes")
async def get_classes():
    """Get available waste classes"""
    return {
        "classes": mapper.get_all_classes(),
        "count": len(mapper.get_all_classes()),
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )

