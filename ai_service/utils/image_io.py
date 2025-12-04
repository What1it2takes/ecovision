"""
Image I/O utilities for base64 encoding/decoding and mask encoding
"""

import base64
import io
from PIL import Image
import numpy as np
from typing import Union
import logging

logger = logging.getLogger(__name__)


def decode_image(base64_string: str) -> bytes:
    """
    Decode base64 image string to bytes.
    
    Handles both:
    - Plain base64: "iVBORw0KGgo..."
    - Data URL: "data:image/jpeg;base64,iVBORw0KGgo..."
    
    Args:
        base64_string: Base64 encoded image
    
    Returns:
        Image bytes
    """
    # Remove data URL prefix if present
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    
    # Remove whitespace
    base64_string = base64_string.strip()
    
    try:
        image_bytes = base64.b64decode(base64_string)
        return image_bytes
    except Exception as e:
        raise ValueError(f"Failed to decode base64 image: {e}")


def encode_image_to_base64(image_bytes: bytes, format: str = "PNG") -> str:
    """
    Encode image bytes to base64 string.
    
    Args:
        image_bytes: Image bytes
        format: Image format (PNG, JPEG, etc.)
    
    Returns:
        Base64 encoded string with data URL prefix
    """
    base64_str = base64.b64encode(image_bytes).decode("utf-8")
    mime_type = f"image/{format.lower()}"
    return f"data:{mime_type};base64,{base64_str}"


def encode_mask_to_base64(mask: np.ndarray) -> str:
    """
    Encode binary mask (numpy array) to base64 PNG string.
    
    Args:
        mask: Binary mask array (H, W) with values 0-255
    
    Returns:
        Base64 encoded PNG string with data URL prefix
    """
    if mask is None:
        return ""
    
    # Ensure mask is uint8
    if mask.dtype != np.uint8:
        mask = mask.astype(np.uint8)
    
    # Ensure 2D array
    if len(mask.shape) == 3:
        mask = mask[:, :, 0]
    
    # Convert to PIL Image
    mask_image = Image.fromarray(mask, mode="L")
    
    # Save to bytes buffer
    buffer = io.BytesIO()
    mask_image.save(buffer, format="PNG")
    mask_bytes = buffer.getvalue()
    
    # Encode to base64
    return encode_image_to_base64(mask_bytes, "PNG")


def image_bytes_to_array(image_bytes: bytes) -> np.ndarray:
    """
    Convert image bytes to numpy array.
    
    Args:
        image_bytes: Image bytes
    
    Returns:
        RGB image array (H, W, 3)
    """
    image = Image.open(io.BytesIO(image_bytes))
    image_rgb = image.convert("RGB")
    return np.array(image_rgb)


def array_to_image_bytes(array: np.ndarray, format: str = "PNG") -> bytes:
    """
    Convert numpy array to image bytes.
    
    Args:
        array: Image array (H, W, 3) or (H, W) for grayscale
        format: Output format (PNG, JPEG, etc.)
    
    Returns:
        Image bytes
    """
    if len(array.shape) == 2:
        image = Image.fromarray(array, mode="L")
    elif len(array.shape) == 3:
        image = Image.fromarray(array, mode="RGB")
    else:
        raise ValueError(f"Invalid array shape: {array.shape}")
    
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return buffer.getvalue()

