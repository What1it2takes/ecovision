import { useEffect, useRef, useState, useCallback } from 'react';
import { classifyWaste } from '../services/api.js';
import { drawBoundingBoxes, createResizeObserver } from '../utils/drawBoundingBoxes.js';

const CAMERA_STATUS = {
  INIT: 'Initializing camera...',
  READY: 'Camera ready',
  ERROR: 'Camera unavailable',
};

export default function CameraCapture({ onDetection, detectionMode = 'standard' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const capturedImgRef = useRef(null);
  const streamRef = useRef(null);
  const resizeObserverRef = useRef(null);
  
  const [status, setStatus] = useState(CAMERA_STATUS.INIT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [detections, setDetections] = useState([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 640, height: 480 });

  // Draw bounding boxes function
  const drawBoxes = useCallback(() => {
    if (!overlayCanvasRef.current || !capturedImgRef.current || !detections.length) return;
    
    drawBoundingBoxes(
      overlayCanvasRef.current,
      capturedImgRef.current,
      detections,
      imageDimensions
    );
  }, [detections, imageDimensions]);

  // Set up resize observer when captured image is shown
  useEffect(() => {
    if (!capturedImage || !capturedImgRef.current) return;

    const img = capturedImgRef.current;

    const handleLoad = () => drawBoxes();
    
    if (img.complete) {
      drawBoxes();
    }

    img.addEventListener('load', handleLoad);
    
    resizeObserverRef.current = createResizeObserver(img, drawBoxes);
    window.addEventListener('resize', drawBoxes);

    return () => {
      img.removeEventListener('load', handleLoad);
      window.removeEventListener('resize', drawBoxes);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [capturedImage, drawBoxes]);

  // Redraw when detections change
  useEffect(() => {
    if (capturedImage) {
      drawBoxes();
    }
  }, [detections, drawBoxes, capturedImage]);

  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported in this browser.');
      }

      setError(null);
      setStatus(CAMERA_STATUS.INIT);
      try {
        streamRef.current = await requestStream('environment');
      } catch {
        try {
          streamRef.current = await requestStream('user');
        } catch {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (videoRef.current && mounted && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
        setStatus(CAMERA_STATUS.READY);
      }
    }

    initCamera().catch((err) => {
      console.error(err);
      setError('Unable to access camera. Check permissions and try again.');
      setStatus(CAMERA_STATUS.ERROR);
    });

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const requestStream = async (facingMode) =>
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: facingMode } },
      audio: false,
    });

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      throw new Error('Camera not ready');
    }

    // Optimize dimensions for better performance
    const maxDimension = 1920;
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Store original dimensions for bounding box scaling
    setImageDimensions({ width: video.videoWidth, height: video.videoHeight });
    
    const ctx = canvas.getContext('2d');
    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, width, height);
    
    // Use optimized quality (0.92 for good balance)
    return canvas.toDataURL('image/jpeg', 0.92);
  };

  const handleDetect = async () => {
    setLoading(true);
    setError(null);
    setDetections([]);
    
    try {
      const base64 = captureFrame();
      setCapturedImage(base64);
      
      const response = await classifyWaste(base64, detectionMode);
      
      // Extract detections with bounding boxes
      const boxes = (response.insights || []).map((insight) => ({
        bbox: insight.bbox || [],
        type: insight.type || insight.detected_item,
        confidence: insight.confidence,
        detected_item: insight.detected_item,
      }));
      
      setDetections(boxes);
      
      // Use backend's imageDimensions if provided, otherwise use video dimensions
      const dims = response.imageDimensions || {
        width: videoRef.current?.videoWidth || 640,
        height: videoRef.current?.videoHeight || 480,
      };
      
      setImageDimensions(dims);
      
      // Pass both response and image to parent
      onDetection?.({
        ...response,
        capturedImage: base64,
        imageDimensions: dims,
      });
      
      setStatus('Detection complete');
    } catch (err) {
      console.error(err);
      setError(err.message ?? 'Detection failed, please retry.');
      setCapturedImage(null);
      setDetections([]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setStatus(CAMERA_STATUS.READY);
      }, 1200);
    }
  };

  const clearCapture = () => {
    setCapturedImage(null);
    setDetections([]);
    // Clear overlay canvas
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  return (
    <div className="glass-card animate-fade-in">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex-1 space-y-4">
          <p className="text-sm uppercase tracking-[0.4em] text-eco-aqua">
            Live Scan
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Point your camera at waste items
          </h1>
          <p className="text-slate-400">
            EcoVision captures a still frame
            {detectionMode === 'high-accuracy' 
              ? ' and analyzes it with GPT-4 Vision for detailed reduce, reuse & recycle guidance.'
              : ', runs it through the YOLOv8 waste detector, and returns contextual disposal guidance.'}
          </p>
          {detectionMode === 'high-accuracy' && (
            <div className="flex items-center gap-2 text-xs text-violet-400 bg-violet-500/10 rounded-lg px-3 py-2 border border-violet-500/20">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              High Accuracy Mode - Powered by GPT-4 Vision
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDetect}
              disabled={loading || status === CAMERA_STATUS.ERROR}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                'Analyze Frame'
              )}
            </button>
            {capturedImage && (
              <button
                type="button"
                onClick={clearCapture}
                className="btn-secondary"
              >
                Clear
              </button>
            )}
            <span className="inline-flex items-center rounded-full border border-slate-800 px-4 py-2 text-xs tracking-wide text-slate-400">
              {status}
            </span>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Detection summary */}
          {detections.length > 0 && (
            <div className="rounded-lg border border-eco-lime/30 bg-eco-lime/10 p-4 text-sm text-eco-lime">
              <span className="font-semibold">{detections.length}</span> item{detections.length !== 1 ? 's' : ''} detected
            </div>
          )}
        </div>

        {/* Preview container with canvas overlay */}
        <div className="relative flex-1">
          {capturedImage ? (
            // Show captured image with bounding boxes
            <div className="relative overflow-hidden rounded-2xl border border-slate-800">
              <img
                ref={capturedImgRef}
                src={capturedImage}
                alt="Captured frame"
                className="video-feed"
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          ) : (
            // Show live video feed
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="video-feed animate-pulse-slow"
              />
              <div className="scan-overlay" />
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}
