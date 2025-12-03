import { useRef, useEffect, useCallback } from 'react';
import { drawBoundingBoxes, createResizeObserver, getClassColor } from '../utils/drawBoundingBoxes.js';
import { getDustbinForWaste, getDustbinSuggestions } from '../utils/dustbinMapping.js';

function InsightCard({ insight, colorClass }) {
  const color = getClassColor(insight.type || insight.detected_item);
  const dustbin = getDustbinForWaste(insight.type, insight.detected_item);
  
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-eco-aqua/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div>
            <p className="text-xs uppercase tracking-[0.4em]" style={{ color }}>
              {insight.type}
            </p>
            <h3 className="text-2xl font-semibold text-white">
              {insight.detected_item}
            </h3>
          </div>
        </div>
        <span 
          className="rounded-full px-4 py-2 text-xs font-semibold"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {(insight.confidence * 100).toFixed(1)}% confidence
        </span>
      </div>

      {/* Dustbin suggestion badge */}
      <div className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 ${dustbin.bgClass} border ${dustbin.borderClass}`}>
        <span className="text-lg">{dustbin.icon}</span>
        <div>
          <p className={`text-xs font-semibold ${dustbin.colorClass}`}>
            Use {dustbin.name}
          </p>
          <p className="text-xs text-slate-400">
            {dustbin.description}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-300">{insight.dispose}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SuggestionList title="Reduce" items={insight.reduce} color="text-amber-300" />
        <SuggestionList title="Reuse" items={insight.reuse} color="text-emerald-300" />
        <SuggestionList title="Recycle" items={insight.recycle} color="text-cyan-300" />
      </div>
    </div>
  );
}

function SuggestionList({ title, items, color }) {
  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold uppercase tracking-widest ${color}`}>
        {title}
      </p>
      <ul className="space-y-2 text-sm text-slate-300">
        {(items ?? []).map((tip) => (
          <li key={tip} className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-3">
            {tip}
          </li>
        ))}
        {!items?.length && (
          <li className="rounded-lg border border-dashed border-slate-800/60 bg-slate-900/40 p-3 text-slate-500">
            No suggestions provided yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function DustbinSuggestionCard({ dustbin, items }) {
  return (
    <div className={`rounded-2xl border-2 ${dustbin.borderClass} ${dustbin.bgClass} p-6 shadow-xl backdrop-blur-sm`}>
      <div className="flex items-start gap-4">
        {/* Dustbin Icon */}
        <div className={`flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-xl ${dustbin.bgClass} border-2 ${dustbin.borderClass}`}>
          <span className="text-3xl">{dustbin.icon}</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className={`text-xl font-bold ${dustbin.colorClass}`}>
              {dustbin.name}
            </h3>
            <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${dustbin.bgClass} ${dustbin.colorClass} border ${dustbin.borderClass}`}>
              {dustbin.description}
            </span>
          </div>
          
          <p className="text-sm text-slate-300 mb-4">
            {dustbin.reason}
          </p>
          
          {/* Items in this bin */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Items to dispose here:
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${dustbin.bgClass} border ${dustbin.borderClass}`}
                >
                  <span className={`text-sm font-medium ${dustbin.colorClass}`}>
                    {item.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({(item.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Results({ data, onBack }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Extract data
  const insights = data?.insights || [];
  const capturedImage = data?.capturedImage;
  const imageDimensions = data?.imageDimensions || { width: 640, height: 640 };
  const topInsight = insights[0];
  const mode = data?.mode || 'standard';
  const model = data?.model || 'yolov8-waste-onnx';
  
  // Get dustbin suggestions
  const dustbinSuggestions = insights.length > 0 && !insights[0]?.fallback 
    ? getDustbinSuggestions(insights)
    : [];

  // Build detections array for bounding boxes
  const detections = insights.map((insight) => ({
    bbox: insight.bbox || [],
    type: insight.type || insight.detected_item,
    confidence: insight.confidence,
    detected_item: insight.detected_item,
  }));

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

  // Set up resize observer and draw on image load
  useEffect(() => {
    const img = imgRef.current;
    
    if (!img) return;

    // Draw when image loads
    const handleLoad = () => {
      drawBoxes();
    };

    // If image is already loaded (cached), draw immediately
    if (img.complete) {
      drawBoxes();
    }

    img.addEventListener('load', handleLoad);

    // Set up resize observer
    resizeObserverRef.current = createResizeObserver(img, drawBoxes);

    // Also handle window resize
    window.addEventListener('resize', drawBoxes);

    return () => {
      img.removeEventListener('load', handleLoad);
      window.removeEventListener('resize', drawBoxes);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [drawBoxes, capturedImage]);

  // Redraw when detections change
  useEffect(() => {
    drawBoxes();
  }, [detections, drawBoxes]);

  if (!data) {
    return (
      <div className="glass-card text-center text-slate-400">
        <p>No detections yet. Head to the scanner to capture an image.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-eco-aqua">
            Results
          </p>
          <h2 className="text-3xl font-semibold text-white">Actionable guidance</h2>
          {/* Mode badge */}
          <div className="mt-2 flex items-center gap-2">
            {mode === 'high-accuracy' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600/20 to-purple-600/20 px-3 py-1 text-xs font-medium text-violet-400 border border-violet-500/30">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                High Accuracy • GPT-4 Vision
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/30">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Standard • YOLOv8
              </span>
            )}
          </div>
        </div>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back to scan
        </button>
      </div>

      {/* Image with Canvas Bounding Boxes */}
      {capturedImage && (
        <div className="glass-card">
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Image preview with canvas overlay */}
            <div className="lg:w-1/2">
              <p className="mb-3 text-xs uppercase tracking-[0.4em] text-slate-500">
                Analyzed Image
              </p>
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <img
                  ref={imgRef}
                  src={capturedImage}
                  alt="Analyzed waste"
                  className="w-full h-auto block"
                  crossOrigin="anonymous"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              
              {/* Legend */}
              {detections.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {detections.map((det, idx) => {
                    const color = getClassColor(det.type);
                    return (
                      <div 
                        key={`legend-${idx}`}
                        className="flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs"
                      >
                        <div 
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-slate-300">{det.type || det.detected_item}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detection summary */}
            <div className="lg:w-1/2 space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Detected Items
              </p>
              
              {detections.length > 0 ? (
                <div className="space-y-3">
                  {detections.map((detection, index) => {
                    const color = getClassColor(detection.type);
                    return (
                      <div 
                        key={`det-${detection.detected_item}-${index}`}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-300 hover:border-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <div>
                            <p className="font-medium text-white">
                              {detection.detected_item}
                            </p>
                            <p className="text-xs text-slate-500">
                              {detection.type}
                            </p>
                          </div>
                        </div>
                        <span 
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {(detection.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500">No items detected in this image.</p>
              )}

              {/* Detection count badge */}
              {detections.length > 0 && (
                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <svg className="h-5 w-5 text-eco-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      <span className="font-semibold text-white">{detections.length}</span> waste item{detections.length !== 1 ? 's' : ''} identified
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dustbin Suggestions */}
      {dustbinSuggestions.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">
              Disposal Instructions
            </p>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
          </div>
          
          <div className="space-y-4">
            {dustbinSuggestions.map((dustbin, index) => (
              <DustbinSuggestionCard
                key={`dustbin-${dustbin.name}-${index}`}
                dustbin={dustbin}
                items={dustbin.items}
              />
            ))}
          </div>
        </>
      )}

      {/* Detailed insight cards */}
      {topInsight && !topInsight.fallback ? (
        <>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600">
              Disposal Guidelines
            </p>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
          </div>
          
          {insights
            .filter((insight) => !insight.fallback)
            .map((insight, index) => (
              <InsightCard 
                key={`insight-${insight.detected_item}-${index}`}
                insight={insight} 
              />
            ))
          }
        </>
      ) : (
        !capturedImage && (
          <div className="glass-card text-slate-400">
            <p>No high-confidence waste detected.</p>
          </div>
        )
      )}
    </div>
  );
}
