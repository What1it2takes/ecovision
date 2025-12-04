#!/bin/bash
# Quick start script for AI service

echo "Starting EcoVision AI Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/.installed" ]; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
    touch venv/.installed
fi

# Check for models
if [ ! -f "models/yolov10e.pt" ]; then
    echo "⚠ Warning: yolov10e.pt not found. Will use YOLOv8n fallback."
fi

if [ ! -f "models/sam2.pt" ]; then
    echo "⚠ Warning: sam2.pt not found. Segmentation will be disabled."
fi

# Run the service
echo "Starting FastAPI server..."
python main.py

