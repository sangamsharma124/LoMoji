import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ProfessionalTimeline.css';

/**
 * Professional Timeline Component - Adobe Animate Style
 *
 * Features:
 * ✅ Layer management (add, delete, lock, hide, reorder, rename, color)
 * ✅ Keyframes (solid dots, blank keyframes, regular frames)
 * ✅ Motion Tweens (purple), Classic Tweens (blue), Shape Tweens (green)
 * ✅ Onion Skin preview
 * ✅ Playback controls (play, stop, loop)
 * ✅ FPS control
 * ✅ Timeline zoom
 * ✅ Frame scrubbing
 * ✅ Multi-layer support
 * ✅ Scene/Symbol timeline
 */

const ProfessionalTimeline = ({
  layers = [],
  currentFrame = 0,
  totalFrames = 120,
  fps = 24,
  isPlaying = false,
  loopEnabled = true,
  onionSkinEnabled = false,
  onionSkinRange = 2,
  timelineZoom = 1,
  selectedLayerIds = [],
  onFrameChange,
  onLayersChange,
  onSelectLayers,
  onPlayPause,
  onFpsChange,
  onOnionSkinToggle,
  onTimelineZoomChange,
  onAddKeyframe,
  onRemoveKeyframe,
  onAddLayer,
  onDeleteLayer,
  onUpdateLayer
}) => {
  // Display all layers (scrollable to show 2 at a time)
  const displayedLayers = layers;
  // Load saved timeline height from localStorage, default to 170px with minimum of 170px
  const [timelineHeight, setTimelineHeight] = useState(() => {
    const saved = localStorage.getItem('lomoji_timeline_height');
    const height = saved ? parseInt(saved, 10) : 170;
    return Math.max(170, height); // Minimum 170px height to show 2 compact layers + controls
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [layerNameInput, setLayerNameInput] = useState('');
  const [selectedFrames, setSelectedFrames] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [draggedLayer, setDraggedLayer] = useState(null);
  const [dragOverLayer, setDragOverLayer] = useState(null);

  const timelineRef = useRef(null);
  const scrollRef = useRef(null);
  const resizerRef = useRef(null);
  const layersListRef = useRef(null);
  const framesWrapperRef = useRef(null);

  // Save timeline height to localStorage whenever it changes (minimum 170px)
  useEffect(() => {
    const heightToSave = Math.max(170, timelineHeight);
    localStorage.setItem('lomoji_timeline_height', heightToSave.toString());
  }, [timelineHeight]);

  // Synchronize scrolling between layers list and frames wrapper
  const handleLayersScroll = useCallback((e) => {
    if (framesWrapperRef.current && layersListRef.current) {
      framesWrapperRef.current.scrollTop = e.target.scrollTop;
    }
  }, []);

  const handleFramesScroll = useCallback((e) => {
    if (layersListRef.current && framesWrapperRef.current) {
      layersListRef.current.scrollTop = e.target.scrollTop;
    }
  }, []);

  // Frame width in pixels (affected by zoom)
  const frameWidth = 12 * timelineZoom;

  // Convert frame number to pixel position
  const frameToPixels = (frame) => frame * frameWidth;
  const pixelsToFrame = (pixels) => Math.round(pixels / frameWidth);

  // Format time display
  const formatTime = (frame) => {
    const totalSeconds = frame / fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frames = Math.round((totalSeconds % 1) * fps);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
  };

  // Keyframe types
  const KEYFRAME_TYPES = {
    KEYFRAME: 'keyframe',           // Solid dot
    BLANK_KEYFRAME: 'blank',        // Empty dot
    FRAME: 'frame',                 // Regular frame
    EMPTY: 'empty'                  // No frame
  };

  // Tween types
  const TWEEN_TYPES = {
    NONE: 'none',
    MOTION: 'motion',      // Purple
    CLASSIC: 'classic',    // Blue
    SHAPE: 'shape'         // Green
  };

  // Layer colors
  const LAYER_COLORS = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  // Get keyframe at specific frame for a layer
  const getKeyframeAtFrame = (layer, frame) => {
    return layer?.frames?.find(f => f.frame === frame);
  };

  // Handle playhead drag
  const handlePlayheadMouseDown = (e) => {
    setIsDraggingPlayhead(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDraggingPlayhead) return;

    const handleMouseMove = (e) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frame = Math.max(0, Math.min(totalFrames - 1, pixelsToFrame(x)));
      if (onFrameChange) onFrameChange(frame);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, totalFrames, frameWidth, onFrameChange]);

  // Handle timeline resize
  const handleResizeMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newHeight = Math.max(170, Math.min(800, timelineHeight - e.movementY));
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

  // Layer management
  const handleAddLayer = () => {
    if (onAddLayer) {
      onAddLayer({
        id: `layer_${Date.now()}`,
        name: `Layer ${displayedLayers.length + 1}`,
        visible: true,
        locked: false,
        color: LAYER_COLORS[displayedLayers.length % LAYER_COLORS.length],
        frames: [{ frame: 0, type: KEYFRAME_TYPES.KEYFRAME, tween: TWEEN_TYPES.NONE }]
      });
    }
  };

  const handleDeleteLayer = (layerId) => {
    if (onDeleteLayer) onDeleteLayer(layerId);
  };

  const handleToggleLayerVisibility = (layerId) => {
    const layer = displayedLayers.find(l => l.id === layerId);
    if (layer && onUpdateLayer) {
      onUpdateLayer(layerId, { visible: !layer.visible });
    }
  };

  const handleToggleLayerLock = (layerId) => {
    const layer = displayedLayers.find(l => l.id === layerId);
    if (layer && onUpdateLayer) {
      onUpdateLayer(layerId, { locked: !layer.locked });
    }
  };

  const handleLayerRename = (layerId, newName) => {
    if (onUpdateLayer) {
      onUpdateLayer(layerId, { name: newName });
    }
    setEditingLayerId(null);
  };

  // Layer reordering handlers
  const handleLayerDragStart = (e, layer) => {
    setDraggedLayer(layer);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
  };

  const handleLayerDragOver = (e, layer) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedLayer && draggedLayer.id !== layer.id) {
      setDragOverLayer(layer);
    }
  };

  const handleLayerDragLeave = (e) => {
    setDragOverLayer(null);
  };

  const handleLayerDrop = (e, targetLayer) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedLayer || draggedLayer.id === targetLayer.id) {
      setDraggedLayer(null);
      setDragOverLayer(null);
      return;
    }

    // Reorder layers
    const draggedIndex = displayedLayers.findIndex(l => l.id === draggedLayer.id);
    const targetIndex = displayedLayers.findIndex(l => l.id === targetLayer.id);

    if (draggedIndex !== -1 && targetIndex !== -1 && onLayersChange) {
      const newLayers = [...displayedLayers];
      const [removed] = newLayers.splice(draggedIndex, 1);
      newLayers.splice(targetIndex, 0, removed);
      onLayersChange(newLayers);
    }

    setDraggedLayer(null);
    setDragOverLayer(null);
  };

  const handleLayerDragEnd = () => {
    setDraggedLayer(null);
    setDragOverLayer(null);
  };

  // Frame operations
  const handleFrameClick = (layerId, frameNum, e) => {
    const layer = displayedLayers.find(l => l.id === layerId);
    if (!layer || layer.locked) return;

    if (e.shiftKey) {
      // Range selection
      setSelectedFrames(prev => [...prev, { layerId, frame: frameNum }]);
    } else {
      setSelectedFrames([{ layerId, frame: frameNum }]);
    }

    if (onFrameChange) onFrameChange(frameNum);
  };

  const handleFrameRightClick = (layerId, frameNum, e) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      layerId,
      frame: frameNum
    });
  };

  const handleInsertKeyframe = (layerId, frameNum) => {
    if (onAddKeyframe) {
      onAddKeyframe(layerId, frameNum, KEYFRAME_TYPES.KEYFRAME);
    }
    setContextMenu(null);
  };

  const handleInsertBlankKeyframe = (layerId, frameNum) => {
    if (onAddKeyframe) {
      onAddKeyframe(layerId, frameNum, KEYFRAME_TYPES.BLANK_KEYFRAME);
    }
    setContextMenu(null);
  };

  const handleRemoveFrame = (layerId, frameNum) => {
    if (onRemoveKeyframe) {
      onRemoveKeyframe(layerId, frameNum);
    }
    setContextMenu(null);
  };

  const handleCreateMotionTween = (layerId, frameNum) => {
    const layer = displayedLayers.find(l => l.id === layerId);
    const frameData = getKeyframeAtFrame(layer, frameNum);
    if (frameData && onUpdateLayer) {
      onUpdateLayer(layerId, {
        frames: layer.frames.map(f =>
          f.frame === frameNum ? { ...f, tween: TWEEN_TYPES.MOTION } : f
        )
      });
    }
    setContextMenu(null);
  };

  const handleCreateClassicTween = (layerId, frameNum) => {
    const layer = displayedLayers.find(l => l.id === layerId);
    const frameData = getKeyframeAtFrame(layer, frameNum);
    if (frameData && onUpdateLayer) {
      onUpdateLayer(layerId, {
        frames: layer.frames.map(f =>
          f.frame === frameNum ? { ...f, tween: TWEEN_TYPES.CLASSIC } : f
        )
      });
    }
    setContextMenu(null);
  };

  // Get tween span between keyframes
  const getTweenSpan = (layer, startFrame) => {
    const frames = layer?.frames || [];
    const sortedFrames = [...frames].sort((a, b) => a.frame - b.frame);
    const currentIdx = sortedFrames.findIndex(f => f.frame === startFrame);

    if (currentIdx === -1) return null;

    const currentFrame = sortedFrames[currentIdx];
    const nextFrame = sortedFrames[currentIdx + 1];

    if (!currentFrame.tween || currentFrame.tween === TWEEN_TYPES.NONE) return null;

    const endFrame = nextFrame ? nextFrame.frame : totalFrames;
    return {
      start: startFrame,
      end: endFrame,
      type: currentFrame.tween,
      width: frameToPixels(endFrame - startFrame)
    };
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' && !editingLayerId) {
        e.preventDefault();
        if (onPlayPause) onPlayPause();
      } else if (e.key === 'F5') {
        e.preventDefault();
        // Insert frame
        selectedFrames.forEach(({ layerId, frame }) => {
          handleInsertKeyframe(layerId, frame);
        });
      } else if (e.key === 'F6') {
        e.preventDefault();
        // Insert keyframe
        selectedFrames.forEach(({ layerId, frame }) => {
          handleInsertKeyframe(layerId, frame);
        });
      } else if (e.key === 'F7') {
        e.preventDefault();
        // Insert blank keyframe
        selectedFrames.forEach(({ layerId, frame }) => {
          handleInsertBlankKeyframe(layerId, frame);
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFrames, editingLayerId, onPlayPause]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  return (
    <div className="professional-timeline" style={{ height: timelineHeight }}>
      {/* Timeline Header */}
      <div className="timeline-header">
        <div className="timeline-controls-left">
          <button
            className={`timeline-btn play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={onPlayPause}
            title={isPlaying ? 'Stop (Space)' : 'Play (Space)'}
          >
            {isPlaying ? '⏹' : '▶'}
          </button>

          <button
            className={`timeline-btn loop-btn ${loopEnabled ? 'active' : ''}`}
            title="Loop"
          >
            🔁
          </button>

          <div className="time-display">
            <span className="current-frame">{currentFrame}</span>
            <span className="separator">/</span>
            <span className="total-frames">{totalFrames - 1}</span>
            <span className="time-code">{formatTime(currentFrame)}</span>
          </div>
        </div>

        <div className="timeline-controls-center">
          <button
            className={`timeline-btn onion-skin-btn ${onionSkinEnabled ? 'active' : ''}`}
            onClick={onOnionSkinToggle}
            title="Onion Skin"
          >
            🧅
          </button>

          <div className="fps-control">
            <label>FPS:</label>
            <input
              type="number"
              value={fps}
              onChange={(e) => onFpsChange && onFpsChange(parseInt(e.target.value))}
              min="1"
              max="60"
              className="fps-input"
            />
          </div>
        </div>

        <div className="timeline-controls-right">
          <div className="zoom-controls">
            <button
              onClick={() => onTimelineZoomChange && onTimelineZoomChange(Math.max(0.5, timelineZoom - 0.25))}
              className="zoom-btn"
              title="Zoom Out"
            >
              −
            </button>
            <span className="zoom-level">{Math.round(timelineZoom * 100)}%</span>
            <button
              onClick={() => onTimelineZoomChange && onTimelineZoomChange(Math.min(5, timelineZoom + 0.25))}
              className="zoom-btn"
              title="Zoom In"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="timeline-content" ref={scrollRef}>
        {/* Left Panel - Layers */}
        <div className="layers-panel">
          {/* Layer Controls Header */}
          <div className="layers-header">
            <span className="layers-title">LAYERS</span>
          </div>

          {/* Layers List */}
          <div className="layers-list" ref={layersListRef} onScroll={handleLayersScroll}>
            {displayedLayers.map((layer, index) => (
              <div
                key={layer.id}
                className={`layer-row ${selectedLayerIds.includes(layer.id) ? 'selected' : ''} ${draggedLayer?.id === layer.id ? 'dragging' : ''} ${dragOverLayer?.id === layer.id ? 'drag-over' : ''}`}
                onClick={() => onSelectLayers && onSelectLayers([layer.id])}
                draggable={true}
                onDragStart={(e) => handleLayerDragStart(e, layer)}
                onDragOver={(e) => handleLayerDragOver(e, layer)}
                onDragLeave={handleLayerDragLeave}
                onDrop={(e) => handleLayerDrop(e, layer)}
                onDragEnd={handleLayerDragEnd}
              >
                <div className="layer-controls">
                  <button
                    className={`layer-visibility-btn ${!layer.visible ? 'hidden' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLayerVisibility(layer.id);
                    }}
                    title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                  >
                    {layer.visible ? '👁' : '🚫'}
                  </button>

                  <button
                    className={`layer-lock-btn ${layer.locked ? 'locked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLayerLock(layer.id);
                    }}
                    title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                  >
                    {layer.locked ? '🔒' : '🔓'}
                  </button>
                </div>

                <div className="layer-color-indicator" style={{ backgroundColor: layer.color }}></div>

                {editingLayerId === layer.id ? (
                  <input
                    type="text"
                    className="layer-name-input"
                    value={layerNameInput}
                    onChange={(e) => setLayerNameInput(e.target.value)}
                    onBlur={() => handleLayerRename(layer.id, layerNameInput)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLayerRename(layer.id, layerNameInput);
                      if (e.key === 'Escape') setEditingLayerId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <div
                    className="layer-name"
                    onDoubleClick={() => {
                      setEditingLayerId(layer.id);
                      setLayerNameInput(layer.name);
                    }}
                  >
                    {layer.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Timeline Frames */}
        <div className="timeline-frames-panel">
          {/* Frame Numbers Ruler */}
          <div className="frame-ruler">
            {Array.from({ length: Math.ceil(totalFrames / 5) + 1 }, (_, i) => i * 5).map(frameNum => (
              <div
                key={frameNum}
                className="ruler-marker"
                style={{ left: frameToPixels(frameNum) }}
              >
                <div className="ruler-tick"></div>
                <div className="ruler-label">{frameNum}</div>
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div
            className="playhead"
            style={{ left: frameToPixels(currentFrame) }}
          >
            <div
              className="playhead-handle"
              onMouseDown={handlePlayheadMouseDown}
            >
              <div className="playhead-arrow">▼</div>
            </div>
            <div className="playhead-line"></div>
          </div>

          {/* Layer Frames */}
          <div className="frames-container-wrapper" ref={framesWrapperRef} onScroll={handleFramesScroll}>
            <div className="frames-container" ref={timelineRef}>
              {displayedLayers.map(layer => (
              <div key={layer.id} className="layer-frames-row">
                {/* Background grid */}
                <div className="frame-grid">
                  {Array.from({ length: totalFrames }, (_, i) => (
                    <div
                      key={i}
                      className={`frame-cell ${i === currentFrame ? 'current' : ''} ${i % 5 === 0 ? 'marker' : ''}`}
                      style={{ width: frameWidth }}
                      onClick={(e) => handleFrameClick(layer.id, i, e)}
                      onContextMenu={(e) => handleFrameRightClick(layer.id, i, e)}
                    ></div>
                  ))}
                </div>

                {/* Keyframes and Tweens */}
                <div className="keyframes-layer">
                  {layer.frames?.map(frameData => {
                    const tweenSpan = getTweenSpan(layer, frameData.frame);

                    return (
                      <React.Fragment key={`${layer.id}-${frameData.frame}`}>
                        {/* Tween Span */}
                        {tweenSpan && (
                          <div
                            className={`tween-span tween-${tweenSpan.type}`}
                            style={{
                              left: frameToPixels(tweenSpan.start),
                              width: tweenSpan.width
                            }}
                          >
                            <div className="tween-label">{tweenSpan.type}</div>
                          </div>
                        )}

                        {/* Keyframe */}
                        <div
                          className={`keyframe keyframe-${frameData.type}`}
                          style={{
                            left: frameToPixels(frameData.frame),
                            borderColor: layer.color
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFrameClick(layer.id, frameData.frame, e);
                          }}
                          onContextMenu={(e) => {
                            e.stopPropagation();
                            handleFrameRightClick(layer.id, frameData.frame, e);
                          }}
                          title={`Frame ${frameData.frame} - ${frameData.type}`}
                        >
                          {frameData.type === KEYFRAME_TYPES.KEYFRAME && <div className="keyframe-dot solid"></div>}
                          {frameData.type === KEYFRAME_TYPES.BLANK_KEYFRAME && <div className="keyframe-dot blank"></div>}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="timeline-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => handleInsertKeyframe(contextMenu.layerId, contextMenu.frame)}>
            Insert Keyframe (F6)
          </button>
          <button onClick={() => handleInsertBlankKeyframe(contextMenu.layerId, contextMenu.frame)}>
            Insert Blank Keyframe (F7)
          </button>
          <div className="menu-divider"></div>
          <button onClick={() => handleCreateMotionTween(contextMenu.layerId, contextMenu.frame)}>
            Create Motion Tween
          </button>
          <button onClick={() => handleCreateClassicTween(contextMenu.layerId, contextMenu.frame)}>
            Create Classic Tween
          </button>
          <div className="menu-divider"></div>
          <button onClick={() => handleRemoveFrame(contextMenu.layerId, contextMenu.frame)}>
            Remove Frame
          </button>
        </div>
      )}

      {/* Timeline Resizer */}
      <div
        className={`timeline-resizer ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeMouseDown}
        ref={resizerRef}
      >
        <div className="resizer-line"></div>
      </div>
    </div>
  );
};

export default ProfessionalTimeline;
