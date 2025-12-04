"""
Example script showing how to use the AI service API
"""

import requests
import base64
import json
from pathlib import Path


def example_detection_with_file(image_path: str):
    """Example: Detection with file upload"""
    url = "http://localhost:8000/detect"
    
    with open(image_path, "rb") as f:
        files = {"image": f}
        response = requests.post(url, files=files)
    
    print("Detection Response:")
    print(json.dumps(response.json(), indent=2))
    return response.json()


def example_detection_with_base64(image_path: str):
    """Example: Detection with base64"""
    url = "http://localhost:8000/detect"
    
    with open(image_path, "rb") as f:
        image_bytes = f.read()
        image_b64 = base64.b64encode(image_bytes).decode()
        image_data_url = f"data:image/jpeg;base64,{image_b64}"
    
    data = {"image_base64": image_data_url}
    response = requests.post(url, data=data)
    
    print("Detection Response:")
    print(json.dumps(response.json(), indent=2))
    return response.json()


def example_detection_with_segmentation(image_path: str):
    """Example: Detection with SAM2 segmentation"""
    url = "http://localhost:8000/detect?segmentation=true"
    
    with open(image_path, "rb") as f:
        files = {"image": f}
        response = requests.post(url, files=files)
    
    result = response.json()
    
    print("Detection with Segmentation Response:")
    print(f"Found {result['count']} objects")
    
    for i, det in enumerate(result['detections']):
        print(f"\nObject {i+1}:")
        print(f"  Class: {det['class']}")
        print(f"  Confidence: {det['confidence']:.2%}")
        print(f"  BBox: {det['bbox']}")
        print(f"  Dustbin: {det['dustbin']}")
        print(f"  Disposal: {det['disposal']}")
        
        if result.get('masks') and result['masks'][i]:
            mask_b64 = result['masks'][i]
            print(f"  Mask: {len(mask_b64)} chars (base64 PNG)")
    
    return result


if __name__ == "__main__":
    # Replace with your test image path
    test_image = "test_image.jpg"
    
    if not Path(test_image).exists():
        print(f"⚠ Test image not found: {test_image}")
        print("Place a test image in the current directory to run examples")
        sys.exit(1)
    
    print("=" * 60)
    print("Example 1: Detection without segmentation")
    print("=" * 60)
    example_detection_with_file(test_image)
    
    print("\n" + "=" * 60)
    print("Example 2: Detection with base64")
    print("=" * 60)
    example_detection_with_base64(test_image)
    
    print("\n" + "=" * 60)
    print("Example 3: Detection with segmentation")
    print("=" * 60)
    example_detection_with_segmentation(test_image)

