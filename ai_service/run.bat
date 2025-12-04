@echo off
REM Quick start script for AI service (Windows)

echo Starting EcoVision AI Service...

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies if needed
if not exist "venv\.installed" (
    echo Installing dependencies...
    pip install -r requirements.txt
    type nul > venv\.installed
)

REM Check for models
if not exist "models\yolov10e.pt" (
    echo Warning: yolov10e.pt not found. Will use YOLOv8n fallback.
)

if not exist "models\sam2.pt" (
    echo Warning: sam2.pt not found. Segmentation will be disabled.
)

REM Run the service
echo Starting FastAPI server...
python main.py

