"""
Test script for waste detection API
"""

import requests
import base64
import json
from pathlib import Path


def test_detection_with_file(image_path: str, segmentation: bool = False):
    """Test detection with image file"""
    url = f"http://localhost:8000/detect?segmentation={str(segmentation).lower()}"
    
    with open(image_path, "rb") as f:
        files = {"image": f}
        response = requests.post(url, files=files)
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


def test_detection_with_base64(image_path: str, segmentation: bool = False):
    """Test detection with base64 image"""
    url = f"http://localhost:8000/detect?segmentation={str(segmentation).lower()}"
    
    with open(image_path, "rb") as f:
        image_bytes = f.read()
        image_b64 = base64.b64encode(image_bytes).decode()
        image_data_url = f"data:image/jpeg;base64,{image_b64}"
    
    data = {"image_base64": image_data_url}
    response = requests.post(url, data=data)
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


def test_health():
    """Test health endpoint"""
    response = requests.get("http://localhost:8000/health")
    print(f"Health Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


def test_classes():
    """Test classes endpoint"""
    response = requests.get("http://localhost:8000/classes")
    print(f"Classes Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


if __name__ == "__main__":
    # Test health
    print("=" * 50)
    print("Testing Health Endpoint")
    print("=" * 50)
    test_health()
    
    # Test classes
    print("\n" + "=" * 50)
    print("Testing Classes Endpoint")
    print("=" * 50)
    test_classes()
    
    # Test detection (replace with your test image)
    test_image = Path(__file__).parent.parent / "test_image.jpg"
    
    if test_image.exists():
        print("\n" + "=" * 50)
        print("Testing Detection (without segmentation)")
        print("=" * 50)
        result = test_detection_with_base64(str(test_image), segmentation=False)
        
        if result.get("success") and result.get("count", 0) > 0:
            print(f"\n✓ Detection successful: {result['count']} objects found")
            
            # Test with segmentation
            print("\n" + "=" * 50)
            print("Testing Detection (with segmentation)")
            print("=" * 50)
            result_seg = test_detection_with_base64(str(test_image), segmentation=True)
            
            if result_seg.get("masks"):
                print(f"\n✓ Segmentation successful: {len(result_seg['masks'])} masks generated")
            else:
                print("\n⚠ Segmentation not available or no masks generated")
        else:
            print("\n⚠ No detections found")
    else:
        print(f"\n⚠ Test image not found at {test_image}")
        print("Place a test image at that location to run detection tests")

