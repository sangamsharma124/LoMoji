import React, { useState, useEffect } from 'react';
import ProfessionalTimeline from './ProfessionalTimeline';
import './ProfessionalTimeline.css';

/**
 * Professional Timeline Demo
 *
 * This demonstrates how to integrate the Professional Timeline
 * into your animation tool with a complete working example.
 */

const TimelineDemo = () => {
  // Timeline state
  const [layers, setLayers] = useState([
    {
      id: 'layer_bg',
      name: 'Background',
      visible: true,
      locked: false,
      color: '#3b82f6',
      frames: [
        { frame: 0, type: 'keyframe', tween: 'none' }
      ]
    },
    {
      id: 'layer_character',
      name: 'Character',
      visible: true,
      locked: false,
      color: '#ef4444',
      frames: [
        { frame: 0, type: 'keyframe', tween: 'motion' },
        { frame: 24, type: 'keyframe', tween: 'classic' },
        { frame: 48, type: 'keyframe', tween: 'none' }
      ]
    },
    {
      id: 'layer_effects',
      name: 'Effects',
      visible: true,
      locked: false,
      color: '#10b981',
      frames: [
        { frame: 12, type: 'keyframe', tween: 'shape' },
        { frame: 30, type: 'blank' },
        { frame: 60, type: 'keyframe', tween: 'none' }
      ]
    }
  ]);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames] = useState(120);
  const [fps, setFps] = useState(24);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);
  const [onionSkinRange, setOnionSkinRange] = useState(2);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [selectedLayerIds, setSelectedLayerIds] = useState([]);

  // Animation playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        const next = prev + 1;
        if (next >= totalFrames) {
          if (loopEnabled) return 0;
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, fps, totalFrames, loopEnabled]);

  // Layer management
  const handleAddLayer = (newLayer) => {
    setLayers([...layers, newLayer]);
  };

  const handleDeleteLayer = (layerId) => {
    setLayers(layers.filter(l => l.id !== layerId));
    setSelectedLayerIds(selectedLayerIds.filter(id => id !== layerId));
  };

  const handleUpdateLayer = (layerId, updates) => {
    setLayers(layers.map(l =>
      l.id === layerId ? { ...l, ...updates } : l
    ));
  };

  // Frame/Keyframe management
  const handleAddKeyframe = (layerId, frame, type) => {
    setLayers(layers.map(layer => {
      if (layer.id === layerId) {
        const existingFrameIndex = layer.frames.findIndex(f => f.frame === frame);

        if (existingFrameIndex >= 0) {
          // Update existing frame
          const newFrames = [...layer.frames];
          newFrames[existingFrameIndex] = {
            ...newFrames[existingFrameIndex],
            type,
            tween: newFrames[existingFrameIndex].tween || 'none'
          };
          return { ...layer, frames: newFrames };
        } else {
          // Add new frame
          return {
            ...layer,
            frames: [...layer.frames, { frame, type, tween: 'none' }]
              .sort((a, b) => a.frame - b.frame)
          };
        }
      }
      return layer;
    }));
  };

  const handleRemoveKeyframe = (layerId, frame) => {
    setLayers(layers.map(layer => {
      if (layer.id === layerId) {
        return {
          ...layer,
          frames: layer.frames.filter(f => f.frame !== frame)
        };
      }
      return layer;
    }));
  };

  // Playback controls
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleOnionSkinToggle = () => {
    setOnionSkinEnabled(!onionSkinEnabled);
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f0f' }}>
      {/* Demo Header */}
      <div style={{
        height: '60px',
        background: '#1a1a1a',
        borderBottom: '1px solid #2d2d2d',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '16px'
      }}>
        <h1 style={{ margin: 0, color: '#e5e5e5', fontSize: '20px', fontWeight: 700 }}>
          🎬 Professional Timeline Demo
        </h1>
        <div style={{
          flex: 1,
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            style={{
              padding: '8px 16px',
              background: loopEnabled ? '#0078d4' : '#3d3d3d',
              border: '1px solid #4d4d4d',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Loop: {loopEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setCurrentFrame(0)}
            style={{
              padding: '8px 16px',
              background: '#3d3d3d',
              border: '1px solid #4d4d4d',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Canvas/Preview Area */}
      <div style={{
        flex: 1,
        background: '#0f0f0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        minHeight: 0
      }}>
        <div style={{
          width: '600px',
          height: '400px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Demo Animation Visualization */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            padding: '12px 16px',
            background: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '6px',
            color: '#fff',
            fontFamily: 'Monaco, monospace',
            fontSize: '14px'
          }}>
            <div>Frame: {currentFrame}</div>
            <div>FPS: {fps}</div>
            <div>Playing: {isPlaying ? '▶' : '⏸'}</div>
            <div>Layers: {layers.length}</div>
          </div>

          {/* Layer Visualization */}
          {layers.map((layer, index) => {
            if (!layer.visible) return null;

            // Find active keyframe for this frame
            const sortedFrames = [...layer.frames].sort((a, b) => a.frame - b.frame);
            const activeFrame = sortedFrames.reverse().find(f => f.frame <= currentFrame);

            if (!activeFrame) return null;

            // Calculate position based on tween
            const progress = activeFrame.frame === currentFrame ? 0 :
              Math.min(1, (currentFrame - activeFrame.frame) / 24);

            return (
              <div
                key={layer.id}
                style={{
                  position: 'absolute',
                  left: `${50 + progress * 200}px`,
                  top: `${100 + index * 80}px`,
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: layer.color,
                  border: `3px solid ${selectedLayerIds.includes(layer.id) ? '#0078d4' : 'transparent'}`,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  transition: activeFrame.tween === 'motion' ? 'all 0.3s ease-out' :
                             activeFrame.tween === 'classic' ? 'all 0.3s ease-in-out' :
                             'none'
                }}
              >
                {layer.name.charAt(0)}
              </div>
            );
          })}

          {/* Onion Skin Visualization */}
          {onionSkinEnabled && (
            <>
              {Array.from({ length: onionSkinRange }, (_, i) => i + 1).map(offset => (
                <div
                  key={`onion-prev-${offset}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.1 * (onionSkinRange - offset + 1),
                    pointerEvents: 'none',
                    border: '2px dashed rgba(216, 59, 1, 0.3)'
                  }}
                />
              ))}
            </>
          )}
        </div>

        {/* Info Panel */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(26, 26, 26, 0.95)',
          padding: '16px',
          borderRadius: '8px',
          color: '#e5e5e5',
          fontSize: '13px',
          maxWidth: '300px',
          border: '1px solid #3d3d3d'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0078d4' }}>
            ⌨️ Keyboard Shortcuts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><code style={{ background: '#3d3d3d', padding: '2px 6px', borderRadius: '3px' }}>Space</code> Play/Pause</div>
            <div><code style={{ background: '#3d3d3d', padding: '2px 6px', borderRadius: '3px' }}>F6</code> Insert Keyframe</div>
            <div><code style={{ background: '#3d3d3d', padding: '2px 6px', borderRadius: '3px' }}>F7</code> Insert Blank Keyframe</div>
            <div><code style={{ background: '#3d3d3d', padding: '2px 6px', borderRadius: '3px' }}>+/-</code> Zoom In/Out</div>
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #3d3d3d' }}>
              <strong>Right-click</strong> frame for more options
            </div>
          </div>
        </div>
      </div>

      {/* Professional Timeline */}
      <ProfessionalTimeline
        layers={layers}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        fps={fps}
        isPlaying={isPlaying}
        loopEnabled={loopEnabled}
        onionSkinEnabled={onionSkinEnabled}
        onionSkinRange={onionSkinRange}
        timelineZoom={timelineZoom}
        selectedLayerIds={selectedLayerIds}
        onFrameChange={setCurrentFrame}
        onLayersChange={setLayers}
        onSelectLayers={setSelectedLayerIds}
        onPlayPause={handlePlayPause}
        onFpsChange={setFps}
        onOnionSkinToggle={handleOnionSkinToggle}
        onTimelineZoomChange={setTimelineZoom}
        onAddKeyframe={handleAddKeyframe}
        onRemoveKeyframe={handleRemoveKeyframe}
        onAddLayer={handleAddLayer}
        onDeleteLayer={handleDeleteLayer}
        onUpdateLayer={handleUpdateLayer}
      />
    </div>
  );
};

export default TimelineDemo;
