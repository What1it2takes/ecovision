"""
Helper script to download and setup models
"""

import os
import sys
from pathlib import Path
import urllib.request
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def download_file(url: str, dest: Path, description: str):
    """Download a file with progress"""
    if dest.exists():
        logger.info(f"✓ {description} already exists at {dest}")
        return
    
    logger.info(f"Downloading {description}...")
    logger.info(f"  URL: {url}")
    logger.info(f"  Destination: {dest}")
    
    try:
        urllib.request.urlretrieve(url, dest)
        logger.info(f"✓ Downloaded {description}")
    except Exception as e:
        logger.error(f"✗ Failed to download {description}: {e}")
        logger.info(f"  Please download manually from: {url}")


def setup_yolov10():
    """Setup YOLOv10-E model"""
    model_path = MODELS_DIR / "yolov10e.pt"
    
    if model_path.exists():
        logger.info(f"✓ YOLOv10-E found at {model_path}")
        return
    
    logger.info("YOLOv10-E model not found.")
    logger.info("Options:")
    logger.info("1. Download from: https://github.com/THU-MIG/yolov10")
    logger.info("2. Use YOLOv8n fallback (will auto-download)")
    logger.info(f"   Place model at: {model_path}")


def setup_sam2():
    """Setup SAM2 model"""
    model_path = MODELS_DIR / "sam2.pt"
    
    if model_path.exists():
        logger.info(f"✓ SAM2 found at {model_path}")
        return
    
    logger.info("SAM2 model not found.")
    logger.info("Download from: https://github.com/facebookresearch/segment-anything-2")
    logger.info(f"Place model at: {model_path}")
    logger.info("Note: Service will work without SAM2, but segmentation will be disabled.")


def main():
    """Main setup function"""
    logger.info("=" * 60)
    logger.info("EcoVision AI Service - Model Setup")
    logger.info("=" * 60)
    logger.info("")
    
    setup_yolov10()
    logger.info("")
    setup_sam2()
    logger.info("")
    
    logger.info("=" * 60)
    logger.info("Setup complete!")
    logger.info("=" * 60)
    logger.info("")
    logger.info("Next steps:")
    logger.info("1. Download models to: ai_service/models/")
    logger.info("2. Run: python main.py")
    logger.info("3. Test: curl http://localhost:8000/health")


if __name__ == "__main__":
    main()

