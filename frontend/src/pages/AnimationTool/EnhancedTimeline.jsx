import React, { useState, useRef, useEffect, useCallback } from 'react';
import './EnhancedTimeline.css';

/**
 * Enhanced Timeline Component - Inspired by Lottielab
 *
 * Features:
 * - Cleaner, spread-out layer tracks
 * - Improved timeline ruler with precise measurements
 * - Enhanced zoom controls
 * - Resizable timeline height
 * - Direct layer renaming in timeline
 * - Better keyframe selection (multi-select, drag, duplicate)
 * - Easing function visualization
 * - Color-coded keyframes by property type
 */

const EnhancedTimeline = ({
  objects = [],
  selectedObjectIds = [],
  currentFrame = 0,
  totalFrames = 150,
  fps = 30,
  keyframes = {},
  isPlaying = false,
  loopEnabled = true,
  timelineZoom = 1,
  onFrameChange,
  onSelectObjects,
  onAddKeyframe,
  onRemoveKeyframe,
  onUpdateKeyframe,
  onObjectRename,
  onPlayPause,
  onTimelineZoomChange
}) => {
  const [timelineHeight, setTimelineHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedKeyframes, setSelectedKeyframes] = useState([]);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [editingLayerName, setEditingLayerName] = useState(null);
  const [layerNameInput, setLayerNameInput] = useState('');
  const [hoveredKeyframe, setHoveredKeyframe] = useState(null);

  const timelineRef = useRef(null);
  const scrollRef = useRef(null);
  const resizerRef = useRef(null);

  // Calculate derived values
  const duration = totalFrames / fps;
  const framesToPixels = (frames) => frames * timelineZoom;
  const pixelsToFrames = (pixels) => Math.round(pixels / timelineZoom);

  // Format time display
  const formatTime = (frame) => {
    const totalSeconds = frame / fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frames = Math.round((totalSeconds % 1) * fps);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
  };

  // Easing function names with visual indicators
  const easingFunctions = {
    linear: { name: 'Linear', icon: '━', color: '#9ca3af' },
    easeIn: { name: 'Ease In', icon: '⌒', color: '#3b82f6' },
    easeOut: { name: 'Ease Out', icon: '⌓', color: '#10b981' },
    easeInOut: { name: 'Ease In Out', icon: '∿', color: '#8b5cf6' },
    easeInCubic: { name: 'Cubic In', icon: '◠', color: '#f59e0b' },
    easeOutCubic: { name: 'Cubic Out', icon: '◡', color: '#ef4444' },
    easeInOutCubic: { name: 'Cubic In Out', icon: '◉', color: '#ec4899' }
  };

  // Property type colors
  const propertyColors = {
    x: '#3b82f6',
    y: '#10b981',
    width: '#f59e0b',
    height: '#ef4444',
    rotation: '#8b5cf6',
    opacity: '#6366f1',
    fill: '#ec4899',
    default: '#9ca3af'
  };

  // Get keyframes for an object
  const getObjectKeyframes = useCallback((objectId) => {
    const objectKfs = keyframes[objectId] || {};
    const allKeyframes = [];

    Object.entries(objectKfs).forEach(([property, kfArray]) => {
      kfArray.forEach(kf => {
        allKeyframes.push({
          objectId,
          property,
          frame: kf.frame,
          value: kf.value,
          easing: kf.easing || 'linear'
        });
      });
    });

    return allKeyframes.sort((a, b) => a.frame - b.frame);
  }, [keyframes]);

  // Handle playhead drag
  const handlePlayheadDrag = useCallback((e) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 200; // 200px for layer names column
    const frame = Math.max(0, Math.min(totalFrames, pixelsToFrames(x)));

    if (onFrameChange) {
      onFrameChange(frame);
    }
  }, [totalFrames, pixelsToFrames, onFrameChange]);

  // Handle timeline resize
  const handleResizeMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newHeight = Math.max(200, Math.min(800, timelineHeight + e.movementY));
      setTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, timelineHeight]);

  // Handle layer name edit
  const startEditingLayerName = (object) => {
    setEditingLayerName(object.id);
    setLayerNameInput(object.name || object.type);
  };

  const saveLayerName = (objectId) => {
    if (onObjectRename && layerNameInput.trim()) {
      onObjectRename(objectId, layerNameInput.trim());
    }
    setEditingLayerName(null);
  };

  // Handle keyframe click
  const handleKeyframeClick = (kf, e) => {
    e.stopPropagation();

    if (e.shiftKey) {
      // Multi-select
      setSelectedKeyframes(prev => {
        const exists = prev.find(k =>
          k.objectId === kf.objectId &&
          k.property === kf.property &&
          k.frame === kf.frame
        );
        if (exists) {
          return prev.filter(k => k !== exists);
        } else {
          return [...prev, kf];
        }
      });
    } else {
      setSelectedKeyframes([kf]);
    }
  };

  // Handle keyframe double-click (edit)
  const handleKeyframeDoubleClick = (kf) => {
    if (onUpdateKeyframe) {
      const newValue = prompt(`Edit ${kf.property} value at frame ${kf.frame}:`, kf.value);
      if (newValue !== null) {
        onUpdateKeyframe(kf.objectId, kf.property, kf.frame, parseFloat(newValue));
      }
    }
  };

  // Delete selected keyframes
  const deleteSelectedKeyframes = () => {
    selectedKeyframes.forEach(kf => {
      if (onRemoveKeyframe) {
        onRemoveKeyframe(kf.objectId, kf.property, kf.frame);
      }
    });
    setSelectedKeyframes([]);
  };

  // Duplicate selected keyframes
  const duplicateSelectedKeyframes = () => {
    selectedKeyframes.forEach(kf => {
      if (onAddKeyframe) {
        onAddKeyframe(kf.objectId, kf.property, kf.frame + 10, kf.value, kf.easing);
      }
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedKeyframes.length > 0) {
          deleteSelectedKeyframes();
        }
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        duplicateSelectedKeyframes();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeyframes]);

  return (
    <div className="enhanced-timeline" style={{ height: timelineHeight }}>
      {/* Timeline Header */}
      <div className="timeline-header">
        <div className="timeline-controls">
          <button
            className={`play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={onPlayPause}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <div className="time-display">
            <span className="current-time">{formatTime(currentFrame)}</span>
            <span className="separator">/</span>
            <span className="total-time">{formatTime(totalFrames)}</span>
          </div>

          <button
            className={`loop-btn ${loopEnabled ? 'active' : ''}`}
            title="Loop"
          >
            🔁
          </button>

          {selectedKeyframes.length > 0 && (
            <div className="keyframe-actions">
              <span className="selected-count">{selectedKeyframes.length} selected</span>
              <button onClick={duplicateSelectedKeyframes} title="Duplicate (Cmd+D)">📋</button>
              <button onClick={deleteSelectedKeyframes} title="Delete (Del)">🗑️</button>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="timeline-content" ref={scrollRef}>
        {/* Layers Column */}
        <div className="timeline-layers">
          <div className="layers-header">Layers</div>
          {objects.map(object => (
            <div
              key={object.id}
              className={`layer-item ${selectedObjectIds.includes(object.id) ? 'selected' : ''}`}
              onClick={() => onSelectObjects && onSelectObjects([object.id])}
            >
              <div className="layer-icon">{object.type === 'rectangle' ? '▭' : object.type === 'circle' ? '●' : object.emoji || '📄'}</div>
              {editingLayerName === object.id ? (
                <input
                  type="text"
                  className="layer-name-input"
                  value={layerNameInput}
                  onChange={(e) => setLayerNameInput(e.target.value)}
                  onBlur={() => saveLayerName(object.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveLayerName(object.id);
                    if (e.key === 'Escape') setEditingLayerName(null);
                  }}
                  autoFocus
                />
              ) : (
                <div
                  className="layer-name"
                  onDoubleClick={() => startEditingLayerName(object)}
                >
                  {object.name || object.type}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Timeline Tracks */}
        <div className="timeline-tracks-container">
          {/* Timeline Ruler */}
          <div className="timeline-ruler">
            {Array.from({ length: Math.ceil(totalFrames / 10) + 1 }, (_, i) => i * 10).map(frame => (
              <div
                key={frame}
                className="ruler-mark"
                style={{ left: framesToPixels(frame) }}
              >
                <div className="ruler-tick"></div>
                <div className="ruler-label">{formatTime(frame)}</div>
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div
            className="playhead"
            style={{ left: framesToPixels(currentFrame) }}
            onMouseDown={() => setIsDraggingPlayhead(true)}
          >
            <div className="playhead-handle"></div>
            <div className="playhead-line"></div>
          </div>

          {/* Layer Tracks */}
          <div className="timeline-tracks" ref={timelineRef}>
            {objects.map(object => {
              const objectKeyframes = getObjectKeyframes(object.id);

              return (
                <div
                  key={object.id}
                  className={`layer-track ${selectedObjectIds.includes(object.id) ? 'selected' : ''}`}
                >
                  {/* Keyframes */}
                  {objectKeyframes.map((kf, idx) => {
                    const isSelected = selectedKeyframes.some(k =>
                      k.objectId === kf.objectId &&
                      k.property === kf.property &&
                      k.frame === kf.frame
                    );
                    const color = propertyColors[kf.property] || propertyColors.default;
                    const easingInfo = easingFunctions[kf.easing] || easingFunctions.linear;

                    return (
                      <div
                        key={`${kf.objectId}-${kf.property}-${kf.frame}`}
                        className={`keyframe ${isSelected ? 'selected' : ''}`}
                        style={{
                          left: framesToPixels(kf.frame),
                          backgroundColor: color
                        }}
                        onClick={(e) => handleKeyframeClick(kf, e)}
                        onDoubleClick={() => handleKeyframeDoubleClick(kf)}
                        onMouseEnter={() => setHoveredKeyframe(kf)}
                        onMouseLeave={() => setHoveredKeyframe(null)}
                        title={`${kf.property}: ${kf.value} @ frame ${kf.frame}`}
                      >
                        {/* Easing curve indicator */}
                        {idx < objectKeyframes.length - 1 && (
                          <div
                            className="easing-curve"
                            style={{
                              width: framesToPixels(objectKeyframes[idx + 1].frame - kf.frame),
                              borderColor: color
                            }}
                          >
                            <span className="easing-icon" style={{ color: easingInfo.color }}>
                              {easingInfo.icon}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Click to add timeline background */}
          <div
            className="timeline-background"
            onClick={(e) => {
              if (!timelineRef.current) return;
              const rect = timelineRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const frame = pixelsToFrames(x);

              if (selectedObjectIds.length === 1 && onAddKeyframe) {
                const property = prompt('Add keyframe for property (x, y, width, height, rotation, opacity):');
                if (property) {
                  const object = objects.find(o => o.id === selectedObjectIds[0]);
                  const value = prompt(`Value for ${property}:`, object?.[property] || 0);
                  if (value !== null) {
                    onAddKeyframe(selectedObjectIds[0], property, frame, parseFloat(value));
                  }
                }
              }
            }}
          />
        </div>
      </div>

      {/* Keyframe tooltip */}
      {hoveredKeyframe && (
        <div className="keyframe-tooltip">
          <strong>{hoveredKeyframe.property}</strong>: {hoveredKeyframe.value}<br />
          Frame {hoveredKeyframe.frame} ({formatTime(hoveredKeyframe.frame)})<br />
          Easing: {easingFunctions[hoveredKeyframe.easing]?.name || 'Linear'}
        </div>
      )}

      {/* Timeline Resizer */}
      <div
        className={`timeline-resizer ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeMouseDown}
        ref={resizerRef}
      >
        <div className="resizer-handle">⋮⋮⋮</div>
      </div>
    </div>
  );
};

export default EnhancedTimeline;
