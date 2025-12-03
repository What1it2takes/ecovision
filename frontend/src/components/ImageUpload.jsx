import { useState, useRef, useCallback, useEffect } from 'react';
import { classifyWaste } from '../services/api.js';
import { drawBoundingBoxes, createResizeObserver } from '../utils/drawBoundingBoxes.js';
import { optimizeImageForUpload } from '../utils/imageOptimization.js';

export default function ImageUpload({ onDetection, detectionMode = 'standard' }) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detections, setDetections] = useState([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 640, height: 640 });
  
  const inputRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Draw bounding boxes function
  const drawBoxes = useCallback(() => {
    if (!canvasRef.current || !imgRef.current || !detections.length) return;
    
    drawBoundingBoxes(
      canvasRef.current,
      imgRef.current,
      detections,
      imageDimensions
    );
  }, [detections, imageDimensions]);

  // Set up resize observer when preview image is shown
  useEffect(() => {
    if (!preview || !imgRef.current) return;

    const img = imgRef.current;

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
  }, [preview, drawBoxes]);

  // Redraw when detections change
  useEffect(() => {
    if (preview) {
      drawBoxes();
    }
  }, [detections, drawBoxes, preview]);

  const processFile = useCallback((file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WebP, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be under 10MB');
      return;
    }

    setError(null);
    setDetections([]);
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setPreview(dataUrl);
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer?.files;
    if (files?.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleChange = useCallback((e) => {
    const files = e.target.files;
    if (files?.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (!preview) return;

    setLoading(true);
    setError(null);
    setDetections([]);
    
    try {
      // Optimize image before sending (compress if needed)
      let optimizedImage = preview;
      if (inputRef.current?.files?.[0]) {
        try {
          optimizedImage = await optimizeImageForUpload(inputRef.current.files[0], {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.9, // High quality for detection
          });
        } catch (optError) {
          console.warn('Image optimization failed, using original:', optError);
          // Fallback to original if optimization fails
        }
      }
      
      const response = await classifyWaste(optimizedImage, detectionMode);
      
      // Extract detections with bounding boxes
      const boxes = (response.insights || []).map((insight) => ({
        bbox: insight.bbox || [],
        type: insight.type || insight.detected_item,
        confidence: insight.confidence,
        detected_item: insight.detected_item,
      }));
      
      setDetections(boxes);
      
      // Use backend's imageDimensions if provided, otherwise use local dimensions
      const dims = response.imageDimensions || imageDimensions;
      setImageDimensions(dims);
      
      // Pass both response and image to parent
      onDetection?.({
        ...response,
        capturedImage: preview,
        imageDimensions: dims,
      });
    } catch (err) {
      console.error(err);
      setError(err.message ?? 'Detection failed, please retry.');
      setDetections([]);
    } finally {
      setLoading(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setError(null);
    setDetections([]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div className="glass-card animate-fade-in">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex-1 space-y-4">
          <p className="text-sm uppercase tracking-[0.4em] text-eco-aqua">
            Image Upload
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Upload a waste image for analysis
          </h1>
          <p className="text-slate-400">
            Drag and drop an image or click to browse. EcoVision will analyze it
            {detectionMode === 'high-accuracy' 
              ? ' using GPT-4 Vision for detailed reduce, reuse & recycle guidance.'
              : ' using YOLOv8 and provide disposal recommendations.'}
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
            {preview ? (
              <>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading}
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
                    'Analyze Image'
                  )}
                </button>
                <button
                  type="button"
                  onClick={clearPreview}
                  disabled={loading}
                  className="btn-secondary"
                >
                  Clear
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClick}
                className="btn-primary"
              >
                Browse Files
              </button>
            )}
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
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
          
          {preview ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-800">
              <img
                ref={imgRef}
                src={preview}
                alt="Preview"
                className="aspect-[3/4] w-full rounded-2xl object-cover shadow-xl shadow-emerald-500/10"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ width: '100%', height: '100%' }}
              />
              {/* Highlight border when detections exist */}
              <div className={`absolute inset-0 rounded-2xl border pointer-events-none transition-all duration-300 ${
                detections.length > 0 ? 'border-eco-lime/60' : 'border-transparent'
              }`} />
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={handleClick}
              onKeyDown={(e) => e.key === 'Enter' && handleClick()}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`
                flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed transition-all duration-300
                ${dragActive 
                  ? 'border-eco-lime bg-eco-lime/10 scale-[1.02]' 
                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/70'
                }
              `}
            >
              <div className={`rounded-full p-4 transition-colors ${dragActive ? 'bg-eco-lime/20' : 'bg-slate-800'}`}>
                <svg 
                  className={`h-10 w-10 transition-colors ${dragActive ? 'text-eco-lime' : 'text-slate-400'}`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" 
                  />
                </svg>
              </div>
              <div className="text-center px-6">
                <p className={`font-medium transition-colors ${dragActive ? 'text-eco-lime' : 'text-slate-300'}`}>
                  {dragActive ? 'Drop your image here' : 'Drag & drop an image'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  or click to browse • JPEG, PNG, WebP
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Max 10MB
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
