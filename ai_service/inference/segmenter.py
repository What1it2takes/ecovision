"""
SAM2 (Segment Anything Model 2) integration for precise segmentation masks
"""

import torch
import numpy as np
from PIL import Image
import io
import logging
from pathlib import Path
from typing import Optional, Tuple
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

logger = logging.getLogger(__name__)


class SAM2Segmenter:
    """SAM2 segmenter for generating precise masks from bounding boxes"""
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize SAM2 segmenter.
        
        Args:
            model_path: Path to SAM2 checkpoint. If None, searches in models/ directory.
        """
        self.device = self._detect_device()
        self.model = None
        self.predictor = None
        
        if model_path is None:
            model_path = Path(__file__).parent.parent / "models" / "sam2.pt"
        
        if not Path(model_path).exists():
            raise FileNotFoundError(
                f"SAM2 model not found at {model_path}. "
                "Download from: https://github.com/facebookresearch/segment-anything-2"
            )
        
        self._load_sam2(model_path)
    
    def _detect_device(self) -> str:
        """Auto-detect CUDA or fallback to CPU"""
        if torch.cuda.is_available():
            device = "cuda"
            logger.info(f"✓ SAM2 using CUDA: {torch.cuda.get_device_name(0)}")
        else:
            device = "cpu"
            logger.info("⚠ SAM2 using CPU (slower)")
        return device
    
    def _load_sam2(self, model_path: str):
        """Load SAM2 model"""
        try:
            # Try official SAM2 from Meta
            try:
                from sam2.build_sam import build_sam2
                from sam2.sam2_image_predictor import SAM2ImagePredictor
                
                # Build SAM2 model
                sam2_checkpoint = str(model_path)
                cfg_file = Path(__file__).parent.parent / "sam2" / "configs" / "sam2.1_hiera_l.yaml"
                
                # If config doesn't exist, use default build
                if not cfg_file.exists():
                    logger.warning("SAM2 config not found, using default build")
                    # Build with default config
                    sam2_model = build_sam2(sam2_checkpoint, device=self.device)
                else:
                    sam2_model = build_sam2(sam2_checkpoint, device=self.device, config=str(cfg_file))
                
                self.model = sam2_model
                self.predictor = SAM2ImagePredictor(sam2_model)
                logger.info(f"✓ Loaded SAM2 from {model_path}")
                return
                
            except ImportError:
                logger.warning("Official SAM2 not available, trying alternative...")
            
            # Alternative: Use segment-anything (SAM v1) if SAM2 not available
            try:
                from segment_anything import sam_model_registry, SamPredictor
                
                # Try to load as SAM v1 (different format)
                sam = sam_model_registry["vit_h"](checkpoint=str(model_path))
                sam.to(device=self.device)
                self.predictor = SamPredictor(sam)
                self.model = sam
                logger.info(f"✓ Loaded SAM (v1) from {model_path} as fallback")
                return
                
            except ImportError:
                logger.error("Neither SAM2 nor SAM v1 available")
                raise ImportError(
                    "SAM2 dependencies not installed. Install with:\n"
                    "pip install git+https://github.com/facebookresearch/segment-anything-2.git"
                )
            except Exception as e:
                logger.error(f"Failed to load SAM: {e}")
                raise
        
        except Exception as e:
            raise RuntimeError(f"Failed to initialize SAM2: {e}")
    
    def segment(self, image_data: bytes, bbox: list) -> np.ndarray:
        """
        Generate segmentation mask for a bounding box.
        
        Args:
            image_data: Image bytes
            bbox: Bounding box [x1, y1, x2, y2]
        
        Returns:
            Binary mask as numpy array (H, W) with values 0 or 255
        """
        if self.predictor is None:
            raise RuntimeError("SAM2 predictor not loaded")
        
        # Load image
        image = Image.open(io.BytesIO(image_data))
        image_rgb = np.array(image.convert("RGB"))
        h, w = image_rgb.shape[:2]
        
        # Convert bbox to center point and box format for SAM2
        x1, y1, x2, y2 = bbox
        box_center = [(x1 + x2) / 2, (y1 + y2) / 2]
        box_coords = np.array([[x1, y1, x2, y2]])
        
        try:
            # Try SAM2 API
            if hasattr(self.predictor, 'set_image'):
                # SAM2/SAM v1 API
                self.predictor.set_image(image_rgb)
                
                # Use box prompt
                masks, scores, _ = self.predictor.predict(
                    point_coords=None,
                    point_labels=None,
                    box=box_coords,
                    multimask_output=False,
                )
                
                mask = masks[0]  # Get best mask
                
            else:
                # Alternative API (adjust based on actual SAM2 implementation)
                raise NotImplementedError("SAM2 API not recognized")
            
            # Convert to binary mask (0 or 255)
            mask_binary = (mask.astype(np.uint8) * 255)
            
            logger.debug(f"Generated mask: {mask_binary.shape}, {mask_binary.sum()} pixels")
            return mask_binary
            
        except Exception as e:
            logger.error(f"Segmentation failed: {e}")
            # Return empty mask on error
            return np.zeros((h, w), dtype=np.uint8)
    
    def is_ready(self) -> bool:
        """Check if segmenter is ready"""
        return self.predictor is not None

