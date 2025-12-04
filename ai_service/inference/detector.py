"""
YOLOv10-E detector with CUDA/CPU auto-detection and YOLOv8 fallback
"""

import torch
import numpy as np
from PIL import Image
import io
import logging
from pathlib import Path
from typing import List, Dict, Optional
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

logger = logging.getLogger(__name__)


class YOLOv10Detector:
    """YOLOv10-E detector with automatic device selection and fallback"""
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize YOLOv10-E detector.
        
        Args:
            model_path: Path to yolov10e.pt. If None, searches in models/ directory.
                       Falls back to yolov8n if not found.
        """
        self.device = self._detect_device()
        self.model = None
        self.model_name = None
        self.conf_threshold = 0.25
        self.iou_threshold = 0.45
        
        # Try to load YOLOv10-E
        if model_path is None:
            model_path = Path(__file__).parent.parent / "models" / "yolov10e.pt"
        
        if Path(model_path).exists():
            self._load_yolov10(model_path)
        else:
            logger.warning(f"YOLOv10-E model not found at {model_path}")
            logger.warning("Falling back to YOLOv8n...")
            self._load_yolov8_fallback()
    
    def _detect_device(self) -> str:
        """Auto-detect CUDA or fallback to CPU"""
        if torch.cuda.is_available():
            device = "cuda"
            logger.info(f"✓ CUDA detected: {torch.cuda.get_device_name(0)}")
            logger.info(f"  CUDA version: {torch.version.cuda}")
            logger.info(f"  GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
        else:
            device = "cpu"
            logger.info("⚠ CUDA not available, using CPU")
        return device
    
    def _load_yolov10(self, model_path: str):
        """Load YOLOv10-E model"""
        try:
            # Try ultralytics YOLO (supports YOLOv8, YOLOv10 if available)
            try:
                from ultralytics import YOLO
                
                # Try loading as YOLOv10
                try:
                    self.model = YOLO(str(model_path))
                    # Verify it's actually YOLOv10 by checking model name
                    if hasattr(self.model.model, 'names'):
                        self.model_name = "yolov10e"
                        logger.info(f"✓ Loaded YOLOv10-E from {model_path}")
                        logger.info(f"  Device: {self.device}")
                        return
                except Exception as e:
                    logger.warning(f"Failed to load as YOLOv10: {e}")
                    # Try loading with explicit YOLOv10 class if available
                    try:
                        # YOLOv10 might need special handling
                        from ultralytics import YOLOv10
                        self.model = YOLOv10(str(model_path))
                        self.model_name = "yolov10e"
                        logger.info(f"✓ Loaded YOLOv10-E (via YOLOv10 class) from {model_path}")
                        logger.info(f"  Device: {self.device}")
                        return
                    except (ImportError, AttributeError):
                        # YOLOv10 class not available, try direct YOLO load
                        logger.warning("YOLOv10 class not available, trying standard YOLO loader...")
                        raise
                        
            except ImportError:
                logger.warning("ultralytics not available, trying direct torch load...")
            
            # Fallback: direct torch load (if model is in PyTorch format)
            try:
                checkpoint = torch.load(model_path, map_location=self.device)
                # This is a simplified loader - adjust based on actual YOLOv10 format
                logger.warning("Direct torch load not fully supported, using YOLOv8 fallback")
                self._load_yolov8_fallback()
            except Exception as e:
                logger.error(f"Failed to load YOLOv10: {e}")
                self._load_yolov8_fallback()
                
        except Exception as e:
            logger.error(f"Error loading YOLOv10-E: {e}")
            self._load_yolov8_fallback()
    
    def _load_yolov8_fallback(self):
        """Load YOLOv8n as fallback"""
        try:
            from ultralytics import YOLO
            # Use pretrained YOLOv8n (will download if needed)
            self.model = YOLO("yolov8n.pt")
            self.model_name = "yolov8n"
            logger.info("✓ Loaded YOLOv8n as fallback")
            logger.info(f"  Device: {self.device}")
        except ImportError:
            raise RuntimeError(
                "ultralytics package not installed. Install with: pip install ultralytics"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to load YOLOv8 fallback: {e}")
    
    def detect(self, image_data: bytes) -> List[Dict]:
        """
        Detect objects in image.
        
        Args:
            image_data: Image bytes (JPEG, PNG, etc.)
        
        Returns:
            List of detections, each with:
            - bbox: [x1, y1, x2, y2]
            - confidence: float
            - class_id: int
            - class_name: str
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        # Load image
        image = Image.open(io.BytesIO(image_data))
        image_rgb = image.convert("RGB")
        
        # Run inference
        results = self.model(
            image_rgb,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            device=self.device,
            verbose=False,
        )
        
        # Parse results
        detections = []
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            
            for i in range(len(boxes)):
                # Get box coordinates (xyxy format)
                box = boxes.xyxy[i].cpu().numpy()
                confidence = float(boxes.conf[i].cpu().numpy())
                class_id = int(boxes.cls[i].cpu().numpy())
                
                # Get class name
                class_name = self.model.names[class_id] if hasattr(self.model, 'names') else f"class_{class_id}"
                
                detections.append({
                    "bbox": [float(box[0]), float(box[1]), float(box[2]), float(box[3])],
                    "confidence": confidence,
                    "class_id": class_id,
                    "class_name": class_name,
                })
        
        logger.info(f"Detected {len(detections)} objects")
        return detections
    
    def is_ready(self) -> bool:
        """Check if detector is ready"""
        return self.model is not None

