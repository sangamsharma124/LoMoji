import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import './AnimationTool.css';
import AssetsPanel from './AssetsPanel';
import UnifiedPresetsPanel from './UnifiedPresetsPanel';
import TextAssetsPanel from './TextAssetsPanel';
import AnimationPresetsDialog from './AnimationPresetsDialog';
import AnimationAssetsPanel from './AnimationAssetsPanel';
import ProfessionalTimeline from './ProfessionalTimeline';
import ObjectsPanel from './ObjectsPanel';
import './ProfessionalTimeline.css';
import gifshot from 'gifshot';
import JSZip from 'jszip';
import { getActivityTracker } from '../../middleware/clientActivityTracker';

// Initialize tracker for dashboard logging
const tracker = getActivityTracker('http://localhost:3001/api');


// Easing functions for smooth animations
const easingFunctions = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
};

const AnimationTool = () => {
  const { dashboardId } = useParams();
  const canvasRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const requestRef = useRef();
  const previousTimeRef = useRef();

  // Canvas and Objects State
  const [objects, setObjects] = useState([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = useState(1); // Canvas zoom level

  // Timeline State
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(150); // 5 seconds at 30fps
  const [fps, setFps] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState(1);

  // Professional Timeline State
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);
  const [onionSkinRange, setOnionSkinRange] = useState(2);

  // Keyframes State
  const [keyframes, setKeyframes] = useState({});
  const [autoKeying, setAutoKeying] = useState(false);

  // UI State
  const [selectedTool, setSelectedTool] = useState('select');
  const [showLayersPanel, setShowLayersPanel] = useState(true);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true);
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState({});
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [selectedAssetCategory, setSelectedAssetCategory] = useState('all');
  const [leftPanelView, setLeftPanelView] = useState('objects'); // 'objects', 'layers', 'assets', 'text', or 'animation'
  const [showToolPopup, setShowToolPopup] = useState(false);
  const toolPopupRef = useRef(null);
  const [animationSearchQuery, setAnimationSearchQuery] = useState('');
  const [selectedAnimationCategory, setSelectedAnimationCategory] = useState('all');

  // File State
  const [fileId, setFileId] = useState(null);
  const [fileName, setFileName] = useState('Untitled Animation');
  const [isSaving, setIsSaving] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Interaction State
  const [interactionMode, setInteractionMode] = useState('idle');
  const [dragStart, setDragStart] = useState(null);
  const [transformStart, setTransformStart] = useState(null);

  // Image Cache to avoid decoding on every frame
  const imageCache = useRef({});

  // Flag to know if project was just loaded (prevents draft overwrite)
  const [hasLoadedProject, setHasLoadedProject] = useState(false);


  // Text Editing State
  const [editingTextId, setEditingTextId] = useState(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
  const textInputRef = useRef(null);

  // User info (from localStorage or session)
  const [userEmail, setUserEmail] = useState(null);
  const [userId, setUserId] = useState(null);

  // Animation Presets Dialog State
  const [showAnimationPresetsDialog, setShowAnimationPresetsDialog] = useState(false);

  // Properties Panel Tab State
  const [propertiesPanelTab, setPropertiesPanelTab] = useState('properties'); // 'properties' or 'animation'

  // Drawing Tools State
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [eraserSize, setEraserSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [showBrushProperties, setShowBrushProperties] = useState(false);
  const brushPropertiesRef = useRef(null);

  // File Upload & Drag-Drop State
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const fileInputRef = useRef(null);
  const [showBackgroundRemoval, setShowBackgroundRemoval] = useState(false);
  const [processingBgRemoval, setProcessingBgRemoval] = useState(false);

  const [borderRadius, setBorderRadius] = useState(0);
  const [showBorderPresets, setShowBorderPresets] = useState(false);
  const [borderStyle, setBorderStyle] = useState('solid');
  const [borderWidth, setBorderWidth] = useState(2);
  const [borderColor, setBorderColor] = useState('#000000');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    fileType: 'video',
    fileExtension: 'mp4',
    watermark: 'Include a watermark'
  });
  const [shareEmails, setShareEmails] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [exportProgress, setExportProgress] = useState(0); // 0 to 100
  const [isExporting, setIsExporting] = useState(false);

  // ===============================================
  // KEYFRAME INTERPOLATION ENGINE
  // ===============================================

  const getInterpolatedValue = useCallback((objectId, property, frame) => {
    const objectKeyframes = keyframes[objectId];
    if (!objectKeyframes || !objectKeyframes[property]) {
      const obj = objects.find(o => o.id === objectId);
      return obj ? obj[property] : null;
    }

    const propertyKeyframes = objectKeyframes[property].sort((a, b) => a.frame - b.frame);

    // Find surrounding keyframes
    let prevKf = null;
    let nextKf = null;

    for (let i = 0; i < propertyKeyframes.length; i++) {
      if (propertyKeyframes[i].frame <= frame) {
        prevKf = propertyKeyframes[i];
      }
      if (propertyKeyframes[i].frame >= frame && !nextKf) {
        nextKf = propertyKeyframes[i];
      }
    }

    // If exactly on a keyframe
    if (prevKf && prevKf.frame === frame) return prevKf.value;
    if (nextKf && nextKf.frame === frame) return nextKf.value;

    // If before first keyframe or after last
    if (!prevKf) return nextKf ? nextKf.value : null;
    if (!nextKf) return prevKf.value;

    // Interpolate between keyframes
    const totalFrames = nextKf.frame - prevKf.frame;
    const elapsedFrames = frame - prevKf.frame;
    const rawProgress = elapsedFrames / totalFrames;

    // Apply easing
    const easingFn = easingFunctions[prevKf.easing || 'linear'];
    const progress = easingFn(rawProgress);

    // Interpolate based on value type
    if (typeof prevKf.value === 'number') {
      return prevKf.value + (nextKf.value - prevKf.value) * progress;
    } else if (typeof prevKf.value === 'object') {
      const result = {};
      for (let key in prevKf.value) {
        result[key] = prevKf.value[key] + (nextKf.value[key] - prevKf.value[key]) * progress;
      }
      return result;
    }

    return prevKf.value;
  }, [keyframes, objects]);

  // ===============================================
  // KEYFRAME MANAGEMENT
  // ===============================================

  const addKeyframe = useCallback((objectId, property, frame, value, easing = 'linear') => {
    setKeyframes(prev => {
      const newKeyframes = { ...prev };
      if (!newKeyframes[objectId]) {
        newKeyframes[objectId] = {};
      }
      if (!newKeyframes[objectId][property]) {
        newKeyframes[objectId][property] = [];
      }

      // Remove existing keyframe at this frame
      newKeyframes[objectId][property] = newKeyframes[objectId][property].filter(
        kf => kf.frame !== frame
      );

      // Add new keyframe
      newKeyframes[objectId][property].push({ frame, value, easing });
      newKeyframes[objectId][property].sort((a, b) => a.frame - b.frame);

      return newKeyframes;
    });
  }, []);

  const removeKeyframe = useCallback((objectId, property, frame) => {
    setKeyframes(prev => {
      const newKeyframes = { ...prev };
      if (newKeyframes[objectId] && newKeyframes[objectId][property]) {
        newKeyframes[objectId][property] = newKeyframes[objectId][property].filter(
          kf => kf.frame !== frame
        );
        if (newKeyframes[objectId][property].length === 0) {
          delete newKeyframes[objectId][property];
        }
      }
      return newKeyframes;
    });
  }, []);

  const hasKeyframeAt = useCallback((objectId, property, frame) => {
    return keyframes[objectId]?.[property]?.some(kf => kf.frame === frame);
  }, [keyframes]);

  const getKeyframeValue = useCallback((objectId, property, frame) => {
    const kf = keyframes[objectId]?.[property]?.find(kf => kf.frame === frame);
    return kf ? kf.value : null;
  }, [keyframes]);

  // ===============================================
  // OBJECT MANAGEMENT
  // ===============================================

  const addObject = useCallback((type, options = {}) => {
    const canvas = canvasRef.current;
    const centerX = options.x || canvas.width / 2;
    const centerY = options.y || canvas.height / 2;

    const newObject = {
      id: Date.now() + Math.random(),
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${objects.length + 1}`,
      x: centerX,
      y: centerY,
      width: options.width || 100,
      height: options.height || 100,
      rotation: 0,
      opacity: 1,
      fill: options.fill || '#6366f1',
      stroke: options.stroke || '#000000',
      strokeWidth: options.strokeWidth || 2,
      visible: true,
      locked: false,
      ...options
    };

    setObjects(prev => [...prev, newObject]);
    setSelectedObjectIds([newObject.id]);

    // Create initial keyframe if auto-keying is on
    if (autoKeying) {
      addKeyframe(newObject.id, 'position', currentFrame, { x: centerX, y: centerY });
      addKeyframe(newObject.id, 'scale', currentFrame, { width: newObject.width, height: newObject.height });
      addKeyframe(newObject.id, 'rotation', currentFrame, 0);
      addKeyframe(newObject.id, 'opacity', currentFrame, 1);
    }

    saveHistory([...objects, newObject]);
    return newObject;
  }, [objects, currentFrame, autoKeying]);

  const updateObject = useCallback((objectId, updates) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === objectId) {
        const updated = { ...obj, ...updates };

        // Auto-keying: create keyframes when properties change
        if (autoKeying) {
          if (updates.x !== undefined || updates.y !== undefined) {
            addKeyframe(objectId, 'position', currentFrame, { x: updated.x, y: updated.y });
          }
          if (updates.width !== undefined || updates.height !== undefined) {
            addKeyframe(objectId, 'scale', currentFrame, { width: updated.width, height: updated.height });
          }
          if (updates.rotation !== undefined) {
            addKeyframe(objectId, 'rotation', currentFrame, updated.rotation);
          }
          if (updates.opacity !== undefined) {
            addKeyframe(objectId, 'opacity', currentFrame, updated.opacity);
          }
        }

        return updated;
      }
      return obj;
    }));
  }, [autoKeying, currentFrame, addKeyframe]);

  const deleteObject = useCallback((objectId) => {
    setObjects(prev => prev.filter(obj => obj.id !== objectId));
    setSelectedObjectIds(prev => prev.filter(id => id !== objectId));

    // Remove keyframes
    setKeyframes(prev => {
      const newKeyframes = { ...prev };
      delete newKeyframes[objectId];
      return newKeyframes;
    });
  }, []);

  const duplicateObject = useCallback((objectId) => {
    const obj = objects.find(o => o.id === objectId);
    if (obj) {
      const newObj = {
        ...obj,
        id: Date.now() + Math.random(),
        name: `${obj.name} Copy`,
        x: obj.x + 20,
        y: obj.y + 20
      };
      setObjects(prev => [...prev, newObj]);
      setSelectedObjectIds([newObj.id]);
    }
  }, [objects]);

  // Object rename handler for EnhancedTimeline
  const handleObjectRename = useCallback((objectId, newName) => {
    setObjects(prev =>
      prev.map(obj => obj.id === objectId ? { ...obj, name: newName } : obj)
    );
  }, []);

  // Keyframe update handler for Enhanced Timeline
  const updateKeyframeValue = useCallback((objectId, property, frame, newValue) => {
    setKeyframes(prev => {
      const newKeyframes = { ...prev };
      if (newKeyframes[objectId] && newKeyframes[objectId][property]) {
        newKeyframes[objectId][property] = newKeyframes[objectId][property].map(kf =>
          kf.frame === frame ? { ...kf, value: newValue } : kf
        );
      }
      return newKeyframes;
    });
  }, []);

  // ===============================================
  // PROFESSIONAL TIMELINE - LAYER CONVERSION
  // ===============================================

  // Convert objects to layers format for Professional Timeline
  const objectsToLayers = useCallback(() => {
    const LAYER_COLORS = [
      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];

    return objects.map((obj, index) => {
      // Get all keyframes for this object
      const objKeyframes = keyframes[obj.id] || {};
      const framesList = [];

      // Collect all unique frame numbers
      const allFrames = new Set();
      Object.values(objKeyframes).forEach(propertyKeyframes => {
        propertyKeyframes.forEach(kf => allFrames.add(kf.frame));
      });

      // Convert to Professional Timeline format
      const sortedFrames = Array.from(allFrames).sort((a, b) => a - b);
      sortedFrames.forEach(frameNum => {
        framesList.push({
          frame: frameNum,
          type: 'keyframe',
          tween: 'motion' // Default to motion tween
        });
      });

      // Add initial keyframe if none exists
      if (framesList.length === 0) {
        framesList.push({
          frame: 0,
          type: 'keyframe',
          tween: 'none'
        });
      }

      return {
        id: obj.id,
        name: obj.name || obj.type || `Layer ${index + 1}`,
        visible: obj.visible !== false,
        locked: obj.locked || false,
        color: LAYER_COLORS[index % LAYER_COLORS.length],
        frames: framesList
      };
    });
  }, [objects, keyframes]);

  // Layer management handlers
  const handleLayersChange = useCallback((newLayers) => {
    // Update objects based on layer changes
    const updatedObjects = objects.map(obj => {
      const layer = newLayers.find(l => l.id === obj.id);
      if (layer) {
        return {
          ...obj,
          name: layer.name,
          visible: layer.visible,
          locked: layer.locked
        };
      }
      return obj;
    });
    setObjects(updatedObjects);
  }, [objects]);

  const handleAddLayerPro = useCallback((newLayer) => {
    // Create a new object for the new layer
    const newObject = {
      id: newLayer.id,
      type: 'rectangle',
      x: 400 + objects.length * 20,
      y: 300 + objects.length * 20,
      width: 100,
      height: 100,
      rotation: 0,
      fill: newLayer.color,
      stroke: '#000000',
      strokeWidth: 2,
      opacity: 1,
      name: newLayer.name,
      visible: newLayer.visible,
      locked: newLayer.locked
    };
    setObjects(prev => [...prev, newObject]);
  }, [objects]);

  const handleDeleteLayerPro = useCallback((layerId) => {
    setObjects(prev => prev.filter(obj => obj.id !== layerId));
    setKeyframes(prev => {
      const newKeyframes = { ...prev };
      delete newKeyframes[layerId];
      return newKeyframes;
    });
    setSelectedObjectIds(prev => prev.filter(id => id !== layerId));
  }, []);

  const handleUpdateLayerPro = useCallback((layerId, updates) => {
    setObjects(prev =>
      prev.map(obj => obj.id === layerId ? { ...obj, ...updates } : obj)
    );
  }, []);

  // Professional Timeline keyframe handlers
  const handleAddKeyframePro = useCallback((layerId, frame, type) => {
    const obj = objects.find(o => o.id === layerId);
    if (!obj) return;

    // Add keyframes for all animatable properties
    const properties = ['x', 'y', 'width', 'height', 'rotation', 'opacity'];
    properties.forEach(prop => {
      addKeyframe(layerId, prop, frame, obj[prop]);
    });
  }, [objects, addKeyframe]);

  const handleRemoveKeyframePro = useCallback((layerId, frame) => {
    // Remove all keyframes at this frame
    const objKeyframes = keyframes[layerId] || {};
    Object.keys(objKeyframes).forEach(property => {
      removeKeyframe(layerId, property, frame);
    });
  }, [keyframes, removeKeyframe]);

  // ===============================================
  // FILE UPLOAD & IMAGE HANDLING
  // ===============================================

  const handleFileUpload = useCallback((files) => {
    Array.from(files).forEach(file => {
      const fileType = file.type;

      if (fileType.startsWith('image/')) {
        const reader = new FileReader();

        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            // Create image object on canvas
            const canvas = canvasRef.current;
            const maxWidth = canvas.width * 0.5;
            const maxHeight = canvas.height * 0.5;

            let width = img.width;
            let height = img.height;

            // Scale down if too large
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = width * ratio;
              height = height * ratio;
            }

            const imageObj = {
              id: Date.now() + Math.random(),
              type: 'image',
              name: file.name,
              x: canvas.width / 2,
              y: canvas.height / 2,
              width,
              height,
              rotation: 0,
              opacity: 1,
              visible: true,
              locked: false,
              imageSrc: e.target.result,
              originalFile: file.name,
              fill: 'transparent',
              stroke: 'transparent',
              strokeWidth: 0
            };

            setObjects(prev => [...prev, imageObj]);
            setUploadedImages(prev => [...prev, e.target.result]);
            setSelectedObjectIds([imageObj.id]);
          };
          img.src = e.target.result;
        };

        reader.readAsDataURL(file);
      } else if (fileType === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const reader = new FileReader();

        reader.onload = (e) => {
          const canvas = canvasRef.current;
          const svgObj = {
            id: Date.now() + Math.random(),
            type: 'svg',
            name: file.name,
            x: canvas.width / 2,
            y: canvas.height / 2,
            width: 200,
            height: 200,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
            svgContent: e.target.result,
            originalFile: file.name,
            fill: 'transparent',
            stroke: 'transparent',
            strokeWidth: 0
          };

          setObjects(prev => [...prev, svgObj]);
          setSelectedObjectIds([svgObj.id]);
        };

        reader.readAsText(file);
      }
    });
  }, [objects]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  // Background Removal using Remove.bg API (or client-side alternative)
  const handleBackgroundRemoval = useCallback(async () => {
    if (selectedObjectIds.length === 0) {
      alert('Please select an image to remove background');
      return;
    }

    const selectedObj = objects.find(o => o.id === selectedObjectIds[0]);
    if (!selectedObj || selectedObj.type !== 'image') {
      alert('Please select an image object');
      return;
    }

    setProcessingBgRemoval(true);

    try {
      // For demo purposes, we'll use a simple client-side approach
      // In production, you'd use Remove.bg API or similar service

      // Create a canvas to process the image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      const img = new Image();
      img.onload = () => {
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);

        // Get image data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        // Simple background removal: Remove white/light colored pixels
        // This is a basic implementation - for production use Remove.bg API
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // If pixel is close to white, make it transparent
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; // Set alpha to 0
          }
        }

        tempCtx.putImageData(imageData, 0, 0);
        const processedImage = tempCanvas.toDataURL('image/png');

        // Update the object with processed image
        updateObject(selectedObj.id, { imageSrc: processedImage });

        setProcessingBgRemoval(false);
        alert('Background removed! (Basic removal - for better results, integrate Remove.bg API)');
      };

      img.src = selectedObj.imageSrc;
    } catch (error) {
      console.error('Error removing background:', error);
      alert('Error removing background. Please try again.');
      setProcessingBgRemoval(false);
    }
  }, [selectedObjectIds, objects, updateObject]);

  // ===============================================
  // ANIMATION PRESETS HANDLING
  // ===============================================

  const handleApplyAnimationPreset = useCallback((keyframesData) => {
    if (selectedObjectIds.length === 0) return;

    const objectId = selectedObjectIds[0];

    // Apply all keyframes from the preset
    keyframesData.forEach(({ property, frame, value, easing }) => {
      addKeyframe(objectId, property, frame, value, easing || 'linear');
    });

    // Close dialog after applying
    setShowAnimationPresetsDialog(false);
  }, [selectedObjectIds, addKeyframe]);

  // ===============================================
  // SAVE / LOAD PROJECT FUNCTIONS
  // ===============================================

  // Get user info from localStorage and track activity
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserEmail(user.email);
        setUserId(user.id);

        // Track the page view/activity immediately
        tracker.trackPageView('Animation Editor');
        if (dashboardId) {
          tracker.trackProjectOpen(dashboardId);
        } else {
          tracker.track('DASHBOARD_ENTRY', { description: 'User opened blank animation page' });
        }
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }
  }, [dashboardId]);

  // High-frequency LocalStorage sync for refresh protection
  // This saves to local storage instantly on any change, even before DB save
  useEffect(() => {
    if (!hasLoadedProject && dashboardId) return; // Wait for initial load

    const draftId = dashboardId || 'new_project';
    const draftData = {
      objects,
      keyframes,
      totalFrames,
      fps,
      fileName,
      timestamp: Date.now()
    };

    localStorage.setItem(`lomoji_draft_${draftId}`, JSON.stringify(draftData));
  }, [objects, keyframes, totalFrames, fps, fileName, dashboardId, hasLoadedProject]);

  // Auto-save project instantly after changes (with 2 second debounce)
  // Also ensures NEW projects (blank pages) are registered in the DB
  useEffect(() => {
    if (!userEmail || !userId) return;

    // Log the "Project View" activity for brand new pages too
    if (!dashboardId) {
      const initialSaveTimeout = setTimeout(() => {
        saveProject(); // Force an initial save to create the entry in dashboard DB
      }, 3000); // Wait 3 seconds of being on a blank page to register it
      return () => clearTimeout(initialSaveTimeout);
    }

    // Debounce: Save to DB after 2 seconds of no changes
    const autoSaveTimeout = setTimeout(() => {
      saveProject();
    }, 2000);

    return () => clearTimeout(autoSaveTimeout);
  }, [userEmail, userId, dashboardId, objects, keyframes, currentFrame, totalFrames, fps, loopEnabled, autoKeying, fileName]);

  // Load project on mount if dashboardId exists, checking for localStorage drafts first
  useEffect(() => {
    if (dashboardId && userEmail && userId) {
      // Check if there's a more recent local draft (e.g., from a recent refresh)
      const localDraft = localStorage.getItem(`lomoji_draft_${dashboardId}`);
      if (localDraft) {
        try {
          const parsed = JSON.parse(localDraft);
          // If draft is newer than ~2 seconds old, it might be a refresh recovery
          const isRecentlyModified = (Date.now() - parsed.timestamp) < 60000; // within 1 min
          if (isRecentlyModified) {
            console.log("🚀 Recovered unsaved changes from a recent page refresh");
            setObjects(parsed.objects || []);
            setKeyframes(parsed.keyframes || {});
            setTotalFrames(parsed.totalFrames || 150);
            setFps(parsed.fps || 30);
            setFileName(parsed.fileName || 'Untitled Animation');
            setHasLoadedProject(true);
            return; // Use local draft instead of server load to preserve refresh state
          }
        } catch (e) { console.error("Draft recovery failed", e); }
      }

      loadProject(dashboardId);
    } else if (!dashboardId) {
      // For new projects, check if we were working on a "new" draft before refresh
      const newDraft = localStorage.getItem('lomoji_draft_new_project');
      if (newDraft) {
        try {
          const parsed = JSON.parse(newDraft);
          if ((Date.now() - parsed.timestamp) < 300000) { // Keep new drafts for 5 mins
            setObjects(parsed.objects);
            setKeyframes(parsed.keyframes);
            setFileName(parsed.fileName);
          }
        } catch (e) { }
      }
      setHasLoadedProject(true);
    }
  }, [dashboardId, userEmail, userId]);

  const saveProject = async () => {
    if (!userEmail || !userId) {
      alert('Please login to save your project');
      return;
    }

    setIsSaving(true);

    try {
      const canvas = canvasRef.current;
      let thumbnail = null;

      // Generate thumbnail from canvas
      if (canvas) {
        thumbnail = canvas.toDataURL('image/png');
      }

      // Prepare elements data
      const elements = objects.map(obj => ({
        id: obj.id,
        type: obj.type,
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        rotation: obj.rotation,
        opacity: obj.opacity,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        emoji: obj.emoji,
        visible: obj.visible,
        locked: obj.locked,
        name: obj.name,
        keyframes: keyframes[obj.id] ? Object.keys(keyframes[obj.id]).map(property =>
          keyframes[obj.id][property].map(kf => ({
            frame: kf.frame,
            property: property,
            value: kf.value
          }))
        ).flat() : []
      }));

      const projectData = {
        userId,
        email: userEmail,
        projectName: fileName,
        projectId: dashboardId || `project_${Date.now()}`,
        canvasWidth: canvas?.width || 800,
        canvasHeight: canvas?.height || 600,
        backgroundColor: '#ffffff',
        elements,
        duration: totalFrames / fps,
        fps,
        currentFrame,
        loop: loopEnabled,
        autoKey: autoKeying,
        thumbnail
      };

      const response = await fetch('http://localhost:3001/api/canvas/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Project saved successfully:', data.message);

        // Track the save activity in dashboard
        tracker.trackProjectSave(dashboardId || data.project?.projectId, {
          objectCount: objects.length,
          fileName
        });

        // Update URL if this is a new project
        if (!dashboardId && data.project) {
          window.history.pushState({}, '', `/editor/${data.project.projectId}`);
        }
      } else {
        console.error('❌ Error saving project:', data.error);
        alert(`Error saving project: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Error saving project:', error);
      alert(`Error saving project: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInvites = () => {
    if (!shareEmails) return;
    alert(`Invites sent to: ${shareEmails}`);
    setShareEmails('');
    setShowShareModal(false);
  };

  const exportProject = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setPreviewImage(canvas.toDataURL('image/png'));
    }
    setShowExportModal(true);
  };

  const exportAsSVG = () => {
    const canvas = canvasRef.current;
    let svg = `<svg viewBox="0 0 ${canvas?.width || 800} ${canvas?.height || 600}" xmlns="http://www.w3.org/2000/svg">`;

    // Add background if any
    svg += `<rect width="100%" height="100%" fill="white" />`;

    objects.forEach(obj => {
      if (!obj.visible) return;

      const centerX = obj.x + obj.width / 2;
      const centerY = obj.y + obj.height / 2;
      const transform = `rotate(${obj.rotation} ${centerX} ${centerY})`;

      if (obj.type === 'rectangle') {
        svg += `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="${obj.fill}" opacity="${obj.opacity}" stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}" transform="${transform}" />`;
      } else if (obj.type === 'circle') {
        const radius = Math.min(obj.width, obj.height) / 2;
        svg += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${obj.fill}" opacity="${obj.opacity}" stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}" transform="${transform}" />`;
      } else if (obj.type === 'text') {
        svg += `<text x="${obj.x}" y="${obj.y + 20}" font-family="${obj.fontFamily || 'Arial'}" font-size="${obj.fontSize || 20}" fill="${obj.fill}" opacity="${obj.opacity}" transform="${transform}">${obj.text || ''}</text>`;
      } else if (obj.type === 'emoji') {
        svg += `<text x="${obj.x}" y="${obj.y + 40}" font-size="${obj.width}" transform="${transform}">${obj.emoji || ''}</text>`;
      }
    });

    if (exportOptions.watermark === 'Include a watermark') {
      svg += `<text x="10" y="${(canvas?.height || 600) - 10}" font-size="12" fill="rgba(0,0,0,0.3)">Made with LoMoji</text>`;
    }

    svg += `</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName || 'animation'}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsEmoji = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary 128x128 canvas for emoji
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 128;
    tempCanvas.height = 128;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw current canvas scaled
    tempCtx.drawImage(canvas, 0, 0, 128, 128);

    const dataURL = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `${fileName || 'emoji'}.png`;
    link.click();
  };

  const exportAsLoMoji = () => {
    const exportData = {
      version: "1.0.0",
      metadata: {
        name: fileName,
        author: userEmail || "Anonymous",
        createdAt: new Date().toISOString(),
        application: "LoMoji Studio Pro"
      },
      canvas: {
        width: canvasRef.current?.width || 800,
        height: canvasRef.current?.height || 600,
        fps,
        totalFrames,
        loop: loopEnabled
      },
      objects: objects.map(obj => ({
        ...obj,
        keyframes: keyframes[obj.id] || {}
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(fileName || 'animation').replace(/\s+/g, '_')}.lomoji.json`;
    link.click();
    URL.revokeObjectURL(url);
    alert("Project exported in professional LoMoji format!");
  };

  const exportAsPNG = async () => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = mainCanvas.width;
    exportCanvas.height = mainCanvas.height;

    renderFrame(currentFrame, exportCanvas, true);

    const dataURL = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `${fileName || 'animation'}.png`;
    link.click();
    console.log('✅ Exported current frame as PNG');
    alert('PNG file downloaded successfully!');
  };

  const exportAsFramesZip = async () => {
    const zip = new JSZip();
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    setIsExporting(true);
    setExportProgress(0);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = mainCanvas.width;
    exportCanvas.height = mainCanvas.height;

    for (let i = 0; i < totalFrames; i++) {
      renderFrame(i, exportCanvas, true);
      const dataURL = exportCanvas.toDataURL('image/png').split(',')[1];
      zip.file(`frame_${String(i).padStart(4, '0')}.png`, dataURL, { base64: true });
      setExportProgress(Math.round((i / totalFrames) * 100));
      await new Promise(r => setTimeout(r, 10));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName || 'animation'}_frames.zip`;
    link.click();
    URL.revokeObjectURL(url);

    setIsExporting(false);
    setExportProgress(0);
    alert("Professional Frames ZIP Export Complete!");
  };

  const exportAsGIF = async () => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    setIsExporting(true);
    setExportProgress(0);

    const frames = [];
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = mainCanvas.width;
    exportCanvas.height = mainCanvas.height;

    // Capture frames for GIF using universal renderer
    for (let i = 0; i < totalFrames; i++) {
      renderFrame(i, exportCanvas, true);
      frames.push(exportCanvas.toDataURL('image/png'));
      setExportProgress(Math.round((i / totalFrames) * 50)); // First half for capture
      await new Promise(r => setTimeout(r, 5));
    }

    gifshot.createGIF({
      images: frames,
      interval: 1 / fps,
      gifWidth: mainCanvas.width,
      gifHeight: mainCanvas.height,
      progressCallback: (captureProgress) => {
        setExportProgress(50 + Math.round(captureProgress * 50));
      }
    }, (obj) => {
      if (!obj.error) {
        const link = document.createElement('a');
        link.href = obj.image;
        link.download = `${fileName || 'animation'}.gif`;
        link.click();
      } else {
        alert("GIF creation failed: " + obj.errorMsg);
      }
      setIsExporting(false);
      setExportProgress(0);
    });
  };

  const exportAsVideoPro = async () => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    const extension = 'mp4';
    const supportedMime = MediaRecorder.isTypeSupported('video/mp4;codecs=h264')
      ? 'video/mp4;codecs=h264'
      : (MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : 'video/webm;codecs=vp9');

    setIsExporting(true);
    setExportProgress(0);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = mainCanvas.width;
    exportCanvas.height = mainCanvas.height;

    // High quality context
    const ctx = exportCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Capture stream
    const stream = exportCanvas.captureStream(0);
    const recorder = new MediaRecorder(stream, {
      mimeType: supportedMime,
      videoBitsPerSecond: 15000000 // High quality 15Mbps
    });

    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: supportedMime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName || 'animation'}.${extension}`;
      link.click();
      URL.revokeObjectURL(url);

      setIsExporting(false);
      setExportProgress(0);
      alert(`Professional MP4 Export Complete!`);
    };

    recorder.start();
    await new Promise(r => setTimeout(r, 200));

    // Restore the smooth capture loop the user preferred
    for (let i = 0; i < totalFrames; i++) {
      renderFrame(i, exportCanvas, true);

      if (stream.getVideoTracks()[0].requestFrame) {
        stream.getVideoTracks()[0].requestFrame();
      }

      setExportProgress(Math.round((i / totalFrames) * 100));
      // Consistent interval works best for MediaRecorder encoding
      await new Promise(r => setTimeout(r, 1000 / fps));
    }

    await new Promise(r => setTimeout(r, 500));
    recorder.stop();
  };

  const loadProject = async (projectId) => {
    if (!projectId) return;

    try {
      const response = await fetch(`http://localhost:3001/api/canvas/project/${projectId}`);
      const data = await response.json();

      if (response.ok && data.project) {
        const project = data.project;

        // Restore project name
        setFileName(project.projectName);

        // Restore canvas settings
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = project.canvasWidth || 800;
          canvas.height = project.canvasHeight || 600;
        }

        // Restore objects
        const loadedObjects = project.elements.map(el => ({
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          opacity: el.opacity,
          fill: el.fill,
          stroke: el.stroke,
          strokeWidth: el.strokeWidth,
          text: el.text,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          emoji: el.emoji,
          visible: el.visible !== undefined ? el.visible : true,
          locked: el.locked !== undefined ? el.locked : false,
          name: el.name
        }));

        setObjects(loadedObjects);

        // Restore keyframes
        const loadedKeyframes = {};
        project.elements.forEach(el => {
          if (el.keyframes && el.keyframes.length > 0) {
            loadedKeyframes[el.id] = {};
            el.keyframes.forEach(kf => {
              if (!loadedKeyframes[el.id][kf.property]) {
                loadedKeyframes[el.id][kf.property] = [];
              }
              loadedKeyframes[el.id][kf.property].push({
                frame: kf.frame,
                value: kf.value
              });
            });
          }
        });

        setKeyframes(loadedKeyframes);

        // Restore animation settings
        setTotalFrames(Math.round((project.duration || 5) * (project.fps || 30)));
        setFps(project.fps || 30);
        setCurrentFrame(project.currentFrame || 0);
        setLoopEnabled(project.loop !== undefined ? project.loop : true);
        setAutoKeying(project.autoKey !== undefined ? project.autoKey : false);
        setHasLoadedProject(true);
        console.log('✅ Project loaded successfully:', project.projectName);
      } else {
        console.error('❌ Error loading project:', data.error);
        setHasLoadedProject(true); // Still mark as loaded to allow auto-saves
      }
    } catch (error) {
      console.error('❌ Error loading project:', error);
      setHasLoadedProject(true);
    }
  };

  // ===============================================
  // RENDERING ENGINE
  // ===============================================

  const renderFrame = useCallback((frame, customCanvas = null, isExport = false) => {
    const canvas = customCanvas || canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background (Transparent for SVG/PNG, white for video/gif)
    const bgType = (isExport && (exportOptions.fileType === 'svg' || exportOptions.fileType === 'png')) ? 'transparent' : 'white';
    if (bgType === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Apply canvas offset and zoom (only for editor, NOT for export)
    ctx.save();
    if (!isExport) {
      ctx.translate(canvasOffset.x, canvasOffset.y);
      ctx.scale(canvasZoom, canvasZoom);
    }

    // Draw each object
    objects.forEach(obj => {
      if (!obj.visible) return;

      // Get interpolated values
      const position = getInterpolatedValue(obj.id, 'position', frame) || { x: obj.x, y: obj.y };
      const scale = getInterpolatedValue(obj.id, 'scale', frame) || { width: obj.width, height: obj.height };
      const rotation = getInterpolatedValue(obj.id, 'rotation', frame) ?? obj.rotation;
      const opacity = getInterpolatedValue(obj.id, 'opacity', frame) ?? obj.opacity;

      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.globalAlpha = opacity;

      // Draw based on type
      if (obj.type === 'rectangle') {
        ctx.fillStyle = obj.fill;
        ctx.fillRect(-scale.width / 2, -scale.height / 2, scale.width, scale.height);
        if (obj.strokeWidth > 0) {
          ctx.strokeStyle = obj.stroke;
          ctx.lineWidth = obj.strokeWidth;
          ctx.strokeRect(-scale.width / 2, -scale.height / 2, scale.width, scale.height);
        }
      } else if (obj.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(0, 0, scale.width / 2, scale.height / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = obj.fill;
        ctx.fill();
        if (obj.strokeWidth > 0) {
          ctx.strokeStyle = obj.stroke;
          ctx.lineWidth = obj.strokeWidth;
          ctx.stroke();
        }
      } else if (obj.type === 'emoji') {
        ctx.font = `${scale.width}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.emoji, 0, 0);
      } else if (obj.type === 'text') {
        ctx.font = `${obj.fontSize || 24}px ${obj.fontFamily || 'Arial'}`;
        ctx.fillStyle = obj.fill;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.text || 'Text', 0, 0);
      } else if (obj.type === 'path' || obj.type === 'pencil' || obj.type === 'pen') {
        // Draw path for pencil/pen drawings
        if (obj.points && obj.points.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = obj.stroke || obj.fill || '#000000';
          ctx.lineWidth = obj.strokeWidth || 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Move to first point (offset by position)
          const firstPoint = obj.points[0];
          ctx.moveTo(firstPoint.x - position.x, firstPoint.y - position.y);

          // Draw lines to subsequent points
          for (let i = 1; i < obj.points.length; i++) {
            const point = obj.points[i];
            ctx.lineTo(point.x - position.x, point.y - position.y);
          }

          ctx.stroke();
        }
      } else if (obj.type === 'image') {
        // Draw uploaded image with high-performance caching
        if (obj.imageSrc) {
          let img = imageCache.current[obj.imageSrc];
          if (!img) {
            img = new Image();
            img.src = obj.imageSrc;
            // Only set onload once to avoid stacking listeners every frame
            img.onload = () => renderFrame(frame, customCanvas, isExport);
            imageCache.current[obj.imageSrc] = img;
          }

          if (img.complete) {
            ctx.drawImage(img, -scale.width / 2, -scale.height / 2, scale.width, scale.height);
          }
        }
      } else if (obj.type === 'svg') {
        // Draw SVG content with high-performance caching
        if (obj.svgContent) {
          let img = imageCache.current[obj.svgContent];
          if (!img) {
            const svgBlob = new Blob([obj.svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            img = new Image();
            img.src = url;
            // Only set onload once to avoid stacking listeners every frame
            img.onload = () => renderFrame(frame, customCanvas, isExport);
            imageCache.current[obj.svgContent] = img;
          }

          if (img.complete) {
            ctx.drawImage(img, -scale.width / 2, -scale.height / 2, scale.width, scale.height);
          }
        }
      }

      // Draw selection handles if selected (NEVER in export)
      if (selectedObjectIds.includes(obj.id) && !isPlaying && !isExport) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(-scale.width / 2, -scale.height / 2, scale.width, scale.height);
        ctx.setLineDash([]);

        // Draw handles
        const handleSize = 8;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#6366f1';

        const handles = [
          { x: -scale.width / 2, y: -scale.height / 2 }, // Top-left
          { x: scale.width / 2, y: -scale.height / 2 },  // Top-right
          { x: scale.width / 2, y: scale.height / 2 },   // Bottom-right
          { x: -scale.width / 2, y: scale.height / 2 },  // Bottom-left
        ];

        handles.forEach(handle => {
          ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        });
      }

      ctx.restore();
    });

    // Draw current drawing path (preview)
    if (isDrawing && currentPath.length > 0 && (selectedTool === 'pencil' || selectedTool === 'pen')) {
      ctx.beginPath();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.8;

      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Watermark (Export only)
    if (isExport && exportOptions.watermark === 'Include a watermark') {
      const logoText = "Made with LoMoji";
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset for watermark
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(logoText).width;
      ctx.fillText(logoText, canvas.width - textWidth - 30, canvas.height - 30);
      ctx.restore();
    }

    ctx.restore();
  }, [objects, selectedObjectIds, getInterpolatedValue, canvasOffset, canvasZoom, isPlaying, isDrawing, currentPath, selectedTool, brushColor, brushSize, exportOptions]);

  // Prevent default browser zoom behavior on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefaultZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('wheel', preventDefaultZoom, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', preventDefaultZoom);
    };
  }, []);

  // ===============================================
  // CANVAS INTERACTION
  // ===============================================

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - canvasOffset.x) / canvasZoom,
      y: (e.clientY - rect.top - canvasOffset.y) / canvasZoom
    };
  };

  const getObjectAtPoint = (x, y) => {
    // Check in reverse order (top to bottom)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (!obj.visible || obj.locked) continue;

      const position = { x: obj.x, y: obj.y };
      const scale = { width: obj.width, height: obj.height };

      const halfWidth = scale.width / 2;
      const halfHeight = scale.height / 2;

      if (x >= position.x - halfWidth && x <= position.x + halfWidth &&
        y >= position.y - halfHeight && y <= position.y + halfHeight) {
        return obj;
      }
    }
    return null;
  };

  const handleCanvasMouseDown = (e) => {
    const point = getCanvasPoint(e);

    if (selectedTool === 'hand') {
      setInteractionMode('panning');
      setDragStart({ x: e.clientX, y: e.clientY, offsetX: canvasOffset.x, offsetY: canvasOffset.y });
      return;
    }

    if (selectedTool === 'select') {
      const clickedObj = getObjectAtPoint(point.x, point.y);

      if (clickedObj) {
        if (!e.shiftKey) {
          setSelectedObjectIds([clickedObj.id]);
        } else {
          setSelectedObjectIds(prev =>
            prev.includes(clickedObj.id)
              ? prev.filter(id => id !== clickedObj.id)
              : [...prev, clickedObj.id]
          );
        }

        setInteractionMode('moving');
        setDragStart({ x: point.x, y: point.y });
        setTransformStart(
          selectedObjectIds.includes(clickedObj.id)
            ? objects.filter(obj => selectedObjectIds.includes(obj.id)).map(obj => ({
              id: obj.id,
              x: obj.x,
              y: obj.y
            }))
            : [{ id: clickedObj.id, x: clickedObj.x, y: clickedObj.y }]
        );
      } else {
        setSelectedObjectIds([]);
      }
    }

    if (selectedTool === 'scale') {
      const clickedObj = getObjectAtPoint(point.x, point.y);

      if (clickedObj) {
        if (!e.shiftKey) {
          setSelectedObjectIds([clickedObj.id]);
        } else {
          setSelectedObjectIds(prev =>
            prev.includes(clickedObj.id)
              ? prev.filter(id => id !== clickedObj.id)
              : [...prev, clickedObj.id]
          );
        }

        setInteractionMode('scaling');
        setDragStart({ x: point.x, y: point.y });
        setTransformStart(
          selectedObjectIds.includes(clickedObj.id)
            ? objects.filter(obj => selectedObjectIds.includes(obj.id)).map(obj => ({
              id: obj.id,
              x: obj.x,
              y: obj.y,
              width: obj.width,
              height: obj.height,
              fontSize: obj.fontSize,
              strokeWidth: obj.strokeWidth
            }))
            : [{
              id: clickedObj.id,
              x: clickedObj.x,
              y: clickedObj.y,
              width: clickedObj.width,
              height: clickedObj.height,
              fontSize: clickedObj.fontSize,
              strokeWidth: clickedObj.strokeWidth
            }]
        );
      } else {
        setSelectedObjectIds([]);
      }
    }

    // Drawing tools (pencil, pen, eraser)
    if (selectedTool === 'pencil' || selectedTool === 'pen') {
      setIsDrawing(true);
      setCurrentPath([point]);
      setInteractionMode('freeDrawing');
      return;
    }

    if (selectedTool === 'eraser') {
      setIsDrawing(true);
      setInteractionMode('erasing');
      return;
    }

    if (selectedTool === 'bucket') {
      // Bucket fill tool - fill clicked object
      const clickedObj = getObjectAtPoint(point.x, point.y);
      if (clickedObj) {
        updateObject(clickedObj.id, { fill: brushColor });
        saveHistory(objects);
      }
      return;
    }

    if (selectedTool === 'draw') {
      // Start drawing artboard
      setInteractionMode('drawing');
      setDragStart({ x: point.x, y: point.y });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (interactionMode === 'panning' && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setCanvasOffset({ x: dragStart.offsetX + dx, y: dragStart.offsetY + dy });
    } else if (interactionMode === 'moving' && dragStart && transformStart) {
      const point = getCanvasPoint(e);
      const dx = point.x - dragStart.x;
      const dy = point.y - dragStart.y;

      transformStart.forEach(({ id, x, y }) => {
        updateObject(id, { x: x + dx, y: y + dy });
      });
    } else if (interactionMode === 'scaling' && dragStart && transformStart) {
      const point = getCanvasPoint(e);
      const dx = point.x - dragStart.x;
      const dy = point.y - dragStart.y;

      // Calculate scale factor based on distance from center
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scaleFactor = 1 + (distance / 100);

      transformStart.forEach(({ id, width, height, fontSize, strokeWidth }) => {
        const updates = {
          width: width * scaleFactor,
          height: height * scaleFactor,
        };

        // Scale text fontSize proportionally
        if (fontSize) {
          updates.fontSize = fontSize * scaleFactor;
        }

        // Scale stroke width proportionally
        if (strokeWidth) {
          updates.strokeWidth = strokeWidth * scaleFactor;
        }

        updateObject(id, updates);
      });
    } else if (interactionMode === 'freeDrawing' && isDrawing) {
      // Add points to current path for pencil/pen tool
      const point = getCanvasPoint(e);
      setCurrentPath(prev => [...prev, point]);
    } else if (interactionMode === 'erasing' && isDrawing) {
      // Erase objects at current point
      const point = getCanvasPoint(e);
      const objToErase = getObjectAtPoint(point.x, point.y);
      if (objToErase) {
        deleteObject(objToErase.id);
      }
    } else if (interactionMode === 'drawing' && dragStart) {
      // Drawing artboard preview (will be handled in render)
    }
  };

  const handleCanvasMouseUp = (e) => {
    // Finish free drawing (pencil/pen)
    if (interactionMode === 'freeDrawing' && isDrawing && currentPath.length > 1) {
      // Calculate bounding box for the path
      let minX = currentPath[0].x;
      let minY = currentPath[0].y;
      let maxX = currentPath[0].x;
      let maxY = currentPath[0].y;

      currentPath.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Create path object
      addObject(selectedTool, {
        x: centerX,
        y: centerY,
        width: maxX - minX,
        height: maxY - minY,
        points: currentPath,
        stroke: brushColor,
        strokeWidth: brushSize,
        fill: 'transparent',
        name: `${selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1)} Drawing`
      });

      setIsDrawing(false);
      setCurrentPath([]);
      setInteractionMode('idle');
    }

    if (interactionMode === 'erasing') {
      setIsDrawing(false);
      setInteractionMode('idle');
      saveHistory(objects);
    }

    if (interactionMode === 'moving' && transformStart) {
      saveHistory(objects);
    }

    if (interactionMode === 'scaling' && transformStart) {
      saveHistory(objects);
    }

    if (interactionMode === 'drawing' && dragStart) {
      // Create artboard/frame
      const point = getCanvasPoint(e);
      const width = Math.abs(point.x - dragStart.x);
      const height = Math.abs(point.y - dragStart.y);
      const x = Math.min(dragStart.x, point.x) + width / 2;
      const y = Math.min(dragStart.y, point.y) + height / 2;

      if (width > 10 && height > 10) {
        addObject('rectangle', {
          x,
          y,
          width,
          height,
          fill: 'transparent',
          stroke: '#6366f1',
          strokeWidth: 2,
          name: 'Artboard'
        });
      }
    }

    setInteractionMode('idle');
    setDragStart(null);
    setTransformStart(null);
  };

  const handleCanvasDoubleClick = (e) => {
    const point = getCanvasPoint(e);
    const clickedObj = getObjectAtPoint(point.x, point.y);

    if (clickedObj && clickedObj.type === 'text') {
      // Start editing text
      setEditingTextId(clickedObj.id);
      setTextInputValue(clickedObj.text || 'Text');

      // Calculate input position relative to canvas
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      setTextInputPosition({
        x: rect.left + clickedObj.x + canvasOffset.x,
        y: rect.top + clickedObj.y + canvasOffset.y
      });

      // Focus input after a short delay
      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
          textInputRef.current.select();
        }
      }, 50);
    }
  };

  // Wheel event for zoom (Ctrl/Cmd + scroll or trackpad pinch)
  const handleCanvasWheel = useCallback((e) => {
    // Check for Ctrl key (Windows/Linux) or Cmd key (Mac) or trackpad pinch gesture
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      // Get mouse position relative to canvas (before zoom)
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate world position (point in canvas space before zoom)
      const worldX = (mouseX - canvasOffset.x) / canvasZoom;
      const worldY = (mouseY - canvasOffset.y) / canvasZoom;

      // Determine zoom direction and apply zoom
      const delta = -e.deltaY;
      const zoomSpeed = 0.001;
      const zoomFactor = 1 + delta * zoomSpeed;

      const newZoom = Math.max(0.1, Math.min(5, canvasZoom * zoomFactor));

      // Calculate new offset to keep world position under mouse
      const newOffsetX = mouseX - worldX * newZoom;
      const newOffsetY = mouseY - worldY * newZoom;

      setCanvasZoom(newZoom);
      setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    }
  }, [canvasZoom, canvasOffset]);

  // Touch handlers for pinch-to-zoom
  const touchDistance = useRef(0);
  const touchCenter = useRef({ x: 0, y: 0 });
  const initialTouchZoom = useRef(1);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      touchDistance.current = Math.sqrt(dx * dx + dy * dy);
      initialTouchZoom.current = canvasZoom;

      touchCenter.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    }
  }, [canvasZoom]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);

      if (touchDistance.current > 0) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();

        // Current pinch center
        const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
        const currentCenterY = (touch1.clientY + touch2.clientY) / 2;

        // Calculate center relative to canvas
        const centerX = currentCenterX - rect.left;
        const centerY = currentCenterY - rect.top;

        // Calculate world position (point in canvas space)
        const worldX = (centerX - canvasOffset.x) / canvasZoom;
        const worldY = (centerY - canvasOffset.y) / canvasZoom;

        // Calculate new zoom based on distance change
        const scale = newDistance / touchDistance.current;
        const newZoom = Math.max(0.1, Math.min(5, initialTouchZoom.current * scale));

        // Calculate new offset to keep world position under touch center
        const newOffsetX = centerX - worldX * newZoom;
        const newOffsetY = centerY - worldY * newZoom;

        setCanvasZoom(newZoom);
        setCanvasOffset({ x: newOffsetX, y: newOffsetY });
      }
    }
  }, [canvasZoom, canvasOffset]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      touchDistance.current = 0;
      initialTouchZoom.current = 1;
    }
  }, []);

  const handleTextInputChange = (e) => {
    setTextInputValue(e.target.value);
  };

  const handleTextInputBlur = () => {
    if (editingTextId) {
      updateObject(editingTextId, { text: textInputValue });
      setEditingTextId(null);
      setTextInputValue('');
    }
  };

  const handleTextInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextInputBlur();
    } else if (e.key === 'Escape') {
      setEditingTextId(null);
      setTextInputValue('');
    }
  };

  // ===============================================
  // PLAYBACK CONTROLS
  // ===============================================

  useEffect(() => {
    if (isPlaying) {
      const animate = (timestamp) => {
        if (previousTimeRef.current !== undefined) {
          const deltaTime = timestamp - previousTimeRef.current;
          const frameIncrement = (deltaTime / 1000) * fps;

          setCurrentFrame(prev => {
            const next = prev + frameIncrement;
            if (next >= totalFrames) {
              if (loopEnabled) {
                return 0;
              } else {
                setIsPlaying(false);
                return totalFrames;
              }
            }
            return next;
          });
        }

        previousTimeRef.current = timestamp;
        requestRef.current = requestAnimationFrame(animate);
      };

      requestRef.current = requestAnimationFrame(animate);

      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
        previousTimeRef.current = undefined;
      };
    } else {
      previousTimeRef.current = undefined;
    }
  }, [isPlaying, fps, totalFrames, loopEnabled]);

  // Render current frame
  useEffect(() => {
    renderFrame(currentFrame);
  }, [currentFrame, renderFrame]);

  // ===============================================
  // HISTORY MANAGEMENT
  // ===============================================

  const saveHistory = useCallback((newObjects) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(JSON.parse(JSON.stringify(newObjects)));
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [history, historyStep]);

  const undo = useCallback(() => {
    if (historyStep > 0) {
      setObjects(JSON.parse(JSON.stringify(history[historyStep - 1])));
      setHistoryStep(historyStep - 1);
    }
  }, [history, historyStep]);

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      setObjects(JSON.parse(JSON.stringify(history[historyStep + 1])));
      setHistoryStep(historyStep + 1);
    }
  }, [history, historyStep]);

  // ===============================================
  // KEYBOARD SHORTCUTS
  // ===============================================

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      // Playback
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }

      // Frame navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentFrame(prev => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentFrame(prev => Math.min(totalFrames, prev + 1));
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setCurrentFrame(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        setCurrentFrame(totalFrames);
      }

      // Tools
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setSelectedTool('select');
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setSelectedTool('hand');
      }
      if (e.key === 'k' || e.key === 'K') {
        // Check if no object is selected - if so, activate scale tool
        if (selectedObjectIds.length === 0) {
          e.preventDefault();
          setSelectedTool('scale');
          return;
        }
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setSelectedTool('draw');
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setSelectedTool('pencil');
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setSelectedTool('pen');
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setSelectedTool('bucket');
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setSelectedTool('eraser');
      }

      // Keyframes (only when objects are selected)
      if ((e.key === 'k' || e.key === 'K') && selectedObjectIds.length > 0) {
        e.preventDefault();
        selectedObjectIds.forEach(id => {
          const obj = objects.find(o => o.id === id);
          if (obj) {
            addKeyframe(id, 'position', Math.round(currentFrame), { x: obj.x, y: obj.y });
            addKeyframe(id, 'scale', Math.round(currentFrame), { width: obj.width, height: obj.height });
            addKeyframe(id, 'rotation', Math.round(currentFrame), obj.rotation);
            addKeyframe(id, 'opacity', Math.round(currentFrame), obj.opacity);
          }
        });
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        selectedObjectIds.forEach(id => deleteObject(id));
        saveHistory(objects);
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }

      // Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        selectedObjectIds.forEach(id => duplicateObject(id));
      }

      // Zoom shortcuts (Cmd/Ctrl + Plus/Minus)
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setCanvasZoom(prev => Math.min(5, prev * 1.2));
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setCanvasZoom(prev => Math.max(0.1, prev / 1.2));
      }
      // Reset zoom (Cmd/Ctrl + 0)
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setCanvasZoom(1);
        setCanvasOffset({ x: 0, y: 0 });
      }
      // Fit to screen (Cmd/Ctrl + 1)
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        setCanvasZoom(1);
        setCanvasOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIds, objects, currentFrame, totalFrames, isPlaying, addKeyframe, deleteObject, undo, redo, duplicateObject, saveHistory]);

  // ===============================================
  // TOOL POPUP CLICK OUTSIDE HANDLER
  // ===============================================

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showToolPopup && toolPopupRef.current && !toolPopupRef.current.contains(e.target)) {
        setShowToolPopup(false);
      }
      if (showBrushProperties && brushPropertiesRef.current && !brushPropertiesRef.current.contains(e.target)) {
        // Check if click is not on a tool button
        const isToolButton = e.target.closest('.tool-btn');
        if (!isToolButton) {
          setShowBrushProperties(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showToolPopup, showBrushProperties]);

  // ===============================================
  // UI HELPER FUNCTIONS
  // ===============================================

  const formatTime = (frame) => {
    const seconds = frame / fps;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  const selectedObject = selectedObjectIds.length === 1 ? objects.find(o => o.id === selectedObjectIds[0]) : null;

  const handleToolSelection = (tool) => {
    setSelectedTool(tool);
    setShowToolPopup(false);
  };

  // ===============================================
  // RENDER UI
  // ===============================================

  return (
    <div className="animation-tool">
      {/* Top Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <img
            src="/images/img_logo.svg"
            alt="LoMoji Logo"
            className="logo-img"
          />
          <input
            type="text"
            className="file-name-input"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
          {isSaving && <span className="saving-indicator">Saving...</span>}
        </div>

        <div className="toolbar-center">
          <div className="tool-group" style={{ position: 'relative' }}>
            <button
              className={`tool-btn ${['select', 'scale', 'draw'].includes(selectedTool) ? 'active' : ''}`}
              onClick={() => setShowToolPopup(!showToolPopup)}
              title={
                selectedTool === 'select' ? 'Select Tool (V)' :
                  selectedTool === 'scale' ? 'Scale Tool (K)' :
                    selectedTool === 'draw' ? 'Draw Artboard (F)' :
                      'Select Tool (V)'
              }
            >
              {selectedTool === 'select' && (
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path d="M3 3 L3 17 L8 12 L11 15 L17 3 Z" fill="currentColor" />
                </svg>
              )}
              {selectedTool === 'scale' && (
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="4" y="4" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="4" cy="4" r="2" fill="currentColor" />
                  <circle cx="16" cy="4" r="2" fill="currentColor" />
                  <circle cx="16" cy="16" r="2" fill="currentColor" />
                  <circle cx="4" cy="16" r="2" fill="currentColor" />
                </svg>
              )}
              {selectedTool === 'draw' && (
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3,2" />
                </svg>
              )}
              {!['select', 'scale', 'draw'].includes(selectedTool) && (
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path d="M3 3 L3 17 L8 12 L11 15 L17 3 Z" fill="currentColor" />
                </svg>
              )}
            </button>

            {/* Tool Selection Popup */}
            {showToolPopup && (
              <div ref={toolPopupRef} className="tool-popup">
                <button
                  className={`tool-popup-item ${selectedTool === 'select' ? 'active' : ''}`}
                  onClick={() => handleToolSelection('select')}
                >
                  <div className="tool-popup-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <path d="M3 3 L3 17 L8 12 L11 15 L17 3 Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="tool-popup-details">
                    <span className="tool-popup-name">Move / select</span>
                    <span className="tool-popup-shortcut">V</span>
                  </div>
                </button>

                <button
                  className={`tool-popup-item ${selectedTool === 'scale' ? 'active' : ''}`}
                  onClick={() => handleToolSelection('scale')}
                >
                  <div className="tool-popup-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <rect x="4" y="4" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
                      <circle cx="4" cy="4" r="2" fill="currentColor" />
                      <circle cx="16" cy="4" r="2" fill="currentColor" />
                      <circle cx="16" cy="16" r="2" fill="currentColor" />
                      <circle cx="4" cy="16" r="2" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="tool-popup-details">
                    <span className="tool-popup-name">Scale</span>
                    <span className="tool-popup-shortcut">K</span>
                  </div>
                </button>

                <button
                  className={`tool-popup-item ${selectedTool === 'hand' ? 'active' : ''}`}
                  onClick={() => handleToolSelection('hand')}
                >
                  <div className="tool-popup-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <path d="M9 2 V8 M13 6 V8 M11 4 V8 M7 6 V12 C7 12 6 15 9 16 C12 17 17 14 17 11 V8 L13 8" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                  <div className="tool-popup-details">
                    <span className="tool-popup-name">Hand</span>
                    <span className="tool-popup-shortcut">H</span>
                  </div>
                </button>

                <button
                  className={`tool-popup-item ${selectedTool === 'draw' ? 'active' : ''}`}
                  onClick={() => handleToolSelection('draw')}
                >
                  <div className="tool-popup-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3,2" />
                    </svg>
                  </div>
                  <div className="tool-popup-details">
                    <span className="tool-popup-name">Draw artboard</span>
                    <span className="tool-popup-shortcut">F</span>
                  </div>
                </button>
              </div>
            )}

            <button
              className={`tool-btn ${selectedTool === 'hand' ? 'active' : ''}`}
              onClick={() => setSelectedTool('hand')}
              title="Hand Tool (H)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M9 2 V8 M13 6 V8 M11 4 V8 M7 6 V12 C7 12 6 15 9 16 C12 17 17 14 17 11 V8 L13 8" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
          </div>

          <div className="tool-divider"></div>

          {/* Drawing Tools */}
          <div className="tool-group" style={{ position: 'relative' }}>
            <button
              className={`tool-btn ${selectedTool === 'pencil' ? 'active' : ''}`}
              onClick={() => {
                setSelectedTool('pencil');
                setShowBrushProperties(true);
              }}
              title="Pencil Tool (P)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M14 2 L18 6 L7 17 L3 18 L4 14 Z M11 5 L15 9" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>

            <button
              className={`tool-btn ${selectedTool === 'pen' ? 'active' : ''}`}
              onClick={() => {
                setSelectedTool('pen');
                setShowBrushProperties(true);
              }}
              title="Pen Tool (N)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M3 17 L3 13 L13 3 L17 7 L7 17 Z M10 6 L14 10" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>

            <button
              className={`tool-btn ${selectedTool === 'bucket' ? 'active' : ''}`}
              onClick={() => {
                setSelectedTool('bucket');
                setShowBrushProperties(true);
              }}
              title="Bucket Fill Tool (B)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M2 12 L8 6 L12 10 L6 16 Z M8 6 L12 2 L14 4 M14 12 Q16 12 16 14 Q16 16 14 16 Q12 16 12 14 Q12 12 14 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>

            <button
              className={`tool-btn ${selectedTool === 'eraser' ? 'active' : ''}`}
              onClick={() => {
                setSelectedTool('eraser');
                setShowBrushProperties(true);
              }}
              title="Eraser Tool (E)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M8 18 L18 18 M4 10 L10 4 L16 10 L10 16 Z" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>

            <button
              className={`tool-btn ${selectedTool === 'bgremove' ? 'active' : ''}`}
              onClick={() => {
                setSelectedTool('bgremove');
                handleBackgroundRemoval();
              }}
              disabled={!selectedObject || selectedObject.type !== 'image'}
              title="Remove Background (Select an image)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <rect x="2" y="2" width="16" height="16" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2,2" />
                <circle cx="10" cy="10" r="4" fill="currentColor" />
              </svg>
            </button>

            {/* Brush Properties Popup */}
            {showBrushProperties && (selectedTool === 'pencil' || selectedTool === 'pen' || selectedTool === 'bucket' || selectedTool === 'eraser') && (
              <div ref={brushPropertiesRef} className="brush-properties-popup">
                <div className="brush-properties-header">
                  <h4>Tool Properties</h4>
                  <button
                    className="brush-close-btn"
                    onClick={() => setShowBrushProperties(false)}
                  >×</button>
                </div>

                {(selectedTool === 'pencil' || selectedTool === 'pen' || selectedTool === 'bucket') && (
                  <div className="brush-property">
                    <label>Color</label>
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                    />
                  </div>
                )}

                {(selectedTool === 'pencil' || selectedTool === 'pen') && (
                  <div className="brush-property">
                    <label>Brush Size: {brushSize}px</label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    />
                  </div>
                )}

                {selectedTool === 'eraser' && (
                  <div className="brush-property">
                    <label>Eraser Size: {eraserSize}px</label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={eraserSize}
                      onChange={(e) => setEraserSize(parseInt(e.target.value))}
                    />
                  </div>
                )}

                {/* Border Preset Section */}
                <div className="brush-property" style={{ borderTop: '1px solid #3a3a3a', paddingTop: '12px', marginTop: '12px' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowBorderPresets(!showBorderPresets)}
                    style={{ width: '100%', padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20">
                      <rect x="3" y="3" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="2,2" />
                    </svg>
                    Border Presets
                  </button>
                </div>

                {/* Border Presets Popup */}
                {showBorderPresets && (
                  <div className="border-presets-section" style={{ marginTop: '12px', padding: '12px', background: '#1a1a1a', borderRadius: '6px' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Border Settings</h5>

                    <div className="brush-property">
                      <label>Border Style</label>
                      <select
                        value={borderStyle}
                        onChange={(e) => setBorderStyle(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: '#333',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          color: '#e0e0e0',
                          fontSize: '13px'
                        }}
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                        <option value="double">Double</option>
                      </select>
                    </div>

                    <div className="brush-property">
                      <label>Border Width: {borderWidth}px</label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={borderWidth}
                        onChange={(e) => setBorderWidth(parseInt(e.target.value))}
                      />
                    </div>

                    <div className="brush-property">
                      <label>Border Color</label>
                      <input
                        type="color"
                        value={borderColor}
                        onChange={(e) => setBorderColor(e.target.value)}
                      />
                    </div>

                    <div className="brush-property">
                      <label>Border Radius: {borderRadius}px</label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={borderRadius}
                        onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                      />
                    </div>

                    <button
                      className="btn-primary"
                      onClick={() => {
                        if (selectedObjectIds.length > 0) {
                          selectedObjectIds.forEach(id => {
                            updateObject(id, {
                              stroke: borderColor,
                              strokeWidth: borderWidth,
                              borderStyle: borderStyle,
                              borderRadius: borderRadius
                            });
                          });
                          alert('Border applied to selected object(s)!');
                        } else {
                          alert('Please select an object first');
                        }
                      }}
                      style={{ width: '100%', marginTop: '8px', padding: '8px', fontSize: '13px' }}
                    >
                      Apply Border
                    </button>

                    {/* Quick Border Presets */}
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '8px' }}>Quick Presets</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setBorderStyle('solid');
                            setBorderWidth(2);
                            setBorderColor('#000000');
                            setBorderRadius(0);
                          }}
                          style={{ padding: '6px', fontSize: '11px' }}
                        >
                          Classic
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setBorderStyle('dashed');
                            setBorderWidth(3);
                            setBorderColor('#6366f1');
                            setBorderRadius(8);
                          }}
                          style={{ padding: '6px', fontSize: '11px' }}
                        >
                          Modern
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setBorderStyle('dotted');
                            setBorderWidth(4);
                            setBorderColor('#ef4444');
                            setBorderRadius(50);
                          }}
                          style={{ padding: '6px', fontSize: '11px' }}
                        >
                          Rounded
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setBorderStyle('double');
                            setBorderWidth(6);
                            setBorderColor('#10b981');
                            setBorderRadius(0);
                          }}
                          style={{ padding: '6px', fontSize: '11px' }}
                        >
                          Bold
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="tool-divider"></div>

          <div className="tool-group">
            <button
              className="tool-btn"
              onClick={undo}
              disabled={historyStep <= 0}
              title="Undo (Ctrl+Z)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M6 8 L2 8 L2 4 M2 8 Q2 12 6 14 T14 14" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
            <button
              className="tool-btn"
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              title="Redo (Ctrl+Y)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M14 8 L18 8 L18 4 M18 8 Q18 12 14 14 T6 14" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          {/* Hidden File Input - Used by sidebar upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />

          <button
            className="btn-secondary"
            onClick={() => setShowShareModal(true)}
            style={{ marginRight: '10px' }}
          >
            Share
          </button>
          <button
            className="btn-primary"
            onClick={exportProject}
            title="Export animation"
          >
            Export
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="content">
        {/* Vertical Icon Sidebar */}
        <div className="icon-sidebar">
          {/* Objects Panel Button */}
          <button
            className={`icon-sidebar-btn ${leftPanelView === 'objects' ? 'active' : ''}`}
            onClick={() => setLeftPanelView(leftPanelView === 'objects' ? '' : 'objects')}
            data-tooltip="Objects"
            style={{
              background: leftPanelView === 'objects' ? '#6366f1' : 'transparent'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
          </button>

          {/* Layers Panel Button */}
          <button
            className={`icon-sidebar-btn ${leftPanelView === 'layers' ? 'active' : ''}`}
            onClick={() => setLeftPanelView(leftPanelView === 'layers' ? '' : 'layers')}
            data-tooltip="Layers"
            style={{
              background: leftPanelView === 'layers' ? '#6366f1' : 'transparent'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2 L22 8.5 L12 15 L2 8.5 Z" />
              <path d="M2 12 L12 18.5 L22 12" />
            </svg>
          </button>

          <div className="icon-sidebar-divider"></div>

          {/* Unified Presets Button (Shapes, Icons, Emojis, Arrows, Symbols, Logos) */}
          <button
            className={`icon-sidebar-btn ${leftPanelView === 'assets' ? 'active' : ''}`}
            onClick={() => setLeftPanelView('assets')}
            data-tooltip="All Presets"
            style={{
              background: leftPanelView === 'assets' ? '#6366f1' : 'transparent'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>

          <div className="icon-sidebar-divider"></div>

          <button
            className={`icon-sidebar-btn ${leftPanelView === 'text' ? 'active' : ''}`}
            onClick={() => setLeftPanelView('text')}
            data-tooltip="Text"
          >
            T
          </button>

          <button
            className={`icon-sidebar-btn ${leftPanelView === 'animation' ? 'active' : ''}`}
            onClick={() => setLeftPanelView('animation')}
            data-tooltip="Animations"
          >
            🎬
          </button>

          <div className="icon-sidebar-divider"></div>

          {/* Upload Button */}
          <button
            className="icon-sidebar-btn upload-btn"
            onClick={() => fileInputRef.current?.click()}
            data-tooltip="Upload Image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
        </div>

        {/* Conditional Panel: Layers, Assets, or Text */}
        {leftPanelView === 'layers' && (
          <div className="layers-panel panel">
            <div className="panel-header">
              <h3>Layers</h3>
              <button
                className="panel-close-btn"
                onClick={() => setShowLayersPanel(false)}
              >×</button>
            </div>

            <div className="layers-list">
              {objects.length === 0 ? (
                <div className="empty-state">No objects yet</div>
              ) : (
                objects.map((obj, index) => (
                  <div
                    key={obj.id}
                    className={`layer-item ${selectedObjectIds.includes(obj.id) ? 'selected' : ''}`}
                    onClick={() => setSelectedObjectIds([obj.id])}
                  >
                    <div className="layer-item-left">
                      <button
                        className="layer-expand-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedLayers(prev => ({ ...prev, [obj.id]: !prev[obj.id] }));
                        }}
                      >
                        {expandedLayers[obj.id] ? '▼' : '▶'}
                      </button>
                      <span className="layer-icon">
                        {obj.type === 'rectangle' && '▭'}
                        {obj.type === 'circle' && '●'}
                        {obj.type === 'emoji' && obj.emoji}
                        {obj.type === 'text' && 'T'}
                      </span>
                      <span className="layer-name">{obj.name}</span>
                    </div>

                    <div className="layer-item-right">
                      <button
                        className={`layer-visibility-btn ${obj.visible ? '' : 'hidden'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateObject(obj.id, { visible: !obj.visible });
                        }}
                      >
                        {obj.visible ? '👁' : '👁‍🗨'}
                      </button>
                      <button
                        className={`layer-lock-btn ${obj.locked ? 'locked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateObject(obj.id, { locked: !obj.locked });
                        }}
                      >
                        {obj.locked ? '🔒' : '🔓'}
                      </button>
                    </div>

                    {expandedLayers[obj.id] && (
                      <div className="layer-properties">
                        <div className="layer-property">
                          <span>Position</span>
                          <button
                            className={`keyframe-btn ${hasKeyframeAt(obj.id, 'position', Math.round(currentFrame)) ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasKeyframeAt(obj.id, 'position', Math.round(currentFrame))) {
                                removeKeyframe(obj.id, 'position', Math.round(currentFrame));
                              } else {
                                addKeyframe(obj.id, 'position', Math.round(currentFrame), { x: obj.x, y: obj.y });
                              }
                            }}
                          >
                            ◆
                          </button>
                        </div>
                        <div className="layer-property">
                          <span>Scale</span>
                          <button
                            className={`keyframe-btn ${hasKeyframeAt(obj.id, 'scale', Math.round(currentFrame)) ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasKeyframeAt(obj.id, 'scale', Math.round(currentFrame))) {
                                removeKeyframe(obj.id, 'scale', Math.round(currentFrame));
                              } else {
                                addKeyframe(obj.id, 'scale', Math.round(currentFrame), { width: obj.width, height: obj.height });
                              }
                            }}
                          >
                            ◆
                          </button>
                        </div>
                        <div className="layer-property">
                          <span>Rotation</span>
                          <button
                            className={`keyframe-btn ${hasKeyframeAt(obj.id, 'rotation', Math.round(currentFrame)) ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasKeyframeAt(obj.id, 'rotation', Math.round(currentFrame))) {
                                removeKeyframe(obj.id, 'rotation', Math.round(currentFrame));
                              } else {
                                addKeyframe(obj.id, 'rotation', Math.round(currentFrame), obj.rotation);
                              }
                            }}
                          >
                            ◆
                          </button>
                        </div>
                        <div className="layer-property">
                          <span>Opacity</span>
                          <button
                            className={`keyframe-btn ${hasKeyframeAt(obj.id, 'opacity', Math.round(currentFrame)) ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasKeyframeAt(obj.id, 'opacity', Math.round(currentFrame))) {
                                removeKeyframe(obj.id, 'opacity', Math.round(currentFrame));
                              } else {
                                addKeyframe(obj.id, 'opacity', Math.round(currentFrame), obj.opacity);
                              }
                            }}
                          >
                            ◆
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* Objects Panel */}
        {leftPanelView === 'objects' && (
          <ObjectsPanel
            objects={objects}
            selectedObjectIds={selectedObjectIds}
            onSelectObject={setSelectedObjectIds}
            onUpdateObject={updateObject}
            onDeleteObject={deleteObject}
            onDuplicateObject={duplicateObject}
            onReorderObjects={setObjects}
            currentFrame={currentFrame}
          />
        )}

        {/* Unified Presets Panel */}
        {leftPanelView === 'assets' && (
          <UnifiedPresetsPanel
            onAssetClick={(asset) => {
              // Add asset to canvas
              if (asset.type === 'emoji') {
                addObject('emoji', {
                  emoji: asset.emoji,
                  width: 60,
                  height: 60
                });
              } else if (asset.type === 'rectangle' || asset.type === 'circle') {
                addObject(asset.type, {
                  fill: asset.fill || '#6366f1',
                  name: asset.name
                });
              } else {
                // For other shapes (triangle, star, heart, diamond), use circle for now
                addObject('circle', {
                  fill: asset.fill || '#6366f1',
                  name: asset.name
                });
              }
            }}
            onClose={() => setLeftPanelView('layers')}
          />
        )}

        {/* Text Assets Panel */}
        {leftPanelView === 'text' && (
          <TextAssetsPanel
            onTextClick={(textOptions) => addObject('text', textOptions)}
            onClose={() => setLeftPanelView('layers')}
          />
        )}

        {/* Animation Assets Panel */}
        {leftPanelView === 'animation' && (
          <AnimationAssetsPanel
            selectedCategory={selectedAnimationCategory}
            setSelectedCategory={setSelectedAnimationCategory}
            searchQuery={animationSearchQuery}
            setSearchQuery={setAnimationSearchQuery}
            onAnimationClick={handleApplyAnimationPreset}
            onClose={() => setLeftPanelView('layers')}
            selectedObject={selectedObject}
            currentFrame={Math.round(currentFrame)}
          />
        )}

        {/* Canvas */}
        <div
          className="canvas-container"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <canvas
            ref={canvasRef}
            width={1200}
            height={600}
            className="main-canvas"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onDoubleClick={handleCanvasDoubleClick}
            onWheel={handleCanvasWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* Drag & Drop Overlay */}
          {isDraggingFile && (
            <div className="drag-drop-overlay">
              <div className="drag-drop-content">
                <div className="drag-drop-icon">📁</div>
                <div className="drag-drop-text">Drop your images/SVG here</div>
                <div className="drag-drop-hint">Supports: PNG, JPG, GIF, SVG</div>
              </div>
            </div>
          )}

          {/* Text Input Overlay */}
          {editingTextId && (
            <input
              ref={textInputRef}
              type="text"
              className="canvas-text-input"
              style={{
                position: 'fixed',
                left: `${textInputPosition.x}px`,
                top: `${textInputPosition.y}px`,
                transform: 'translate(-50%, -50%)',
                fontSize: '24px',
                fontFamily: 'Arial',
                textAlign: 'center',
                minWidth: '200px',
                padding: '8px',
                border: '2px solid #6366f1',
                borderRadius: '4px',
                background: '#ffffff',
                zIndex: 1000
              }}
              value={textInputValue}
              onChange={handleTextInputChange}
              onBlur={handleTextInputBlur}
              onKeyDown={handleTextInputKeyDown}
            />
          )}

          {/* Zoom Controls */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 12px',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
            zIndex: 10
          }}>
            <button
              onClick={() => setCanvasZoom(prev => Math.max(0.1, prev / 1.2))}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px 8px'
              }}
              title="Zoom Out (Ctrl/Cmd + -)"
            >
              −
            </button>
            <span style={{ minWidth: '50px', textAlign: 'center' }}>
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              onClick={() => setCanvasZoom(prev => Math.min(5, prev * 1.2))}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px 8px'
              }}
              title="Zoom In (Ctrl/Cmd + +)"
            >
              +
            </button>
            <button
              onClick={() => {
                setCanvasZoom(1);
                setCanvasOffset({ x: 0, y: 0 });
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '4px',
                marginLeft: '4px'
              }}
              title="Reset Zoom (Ctrl/Cmd + 0)"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Properties Panel */}
        {showPropertiesPanel && (
          <div className="properties-panel panel">
            <div className="panel-header">
              <h3>Properties</h3>
              <button
                className="panel-close-btn"
                onClick={() => setShowPropertiesPanel(false)}
              >×</button>
            </div>

            {/* Tab Navigation */}
            <div className="properties-tabs">
              <button
                className={`properties-tab ${propertiesPanelTab === 'properties' ? 'active' : ''}`}
                onClick={() => setPropertiesPanelTab('properties')}
              >
                Properties
              </button>
              <button
                className={`properties-tab ${propertiesPanelTab === 'animation' ? 'active' : ''}`}
                onClick={() => setPropertiesPanelTab('animation')}
              >
                Animation
              </button>
            </div>

            <div className="properties-content">
              {/* No Object Selected State */}
              {!selectedObject && (
                <div className="empty-state">
                  <div className="empty-state-icon">🎯</div>
                  <div className="empty-state-text">No object selected</div>
                  <div className="empty-state-hint">Select an object on the canvas to edit its properties</div>
                </div>
              )}

              {/* Properties Tab Content */}
              {selectedObject && propertiesPanelTab === 'properties' && (
                <>
                  <div className="property-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={selectedObject.name}
                      onChange={(e) => updateObject(selectedObject.id, { name: e.target.value })}
                    />
                  </div>

                  <div className="property-group">
                    <label>Position</label>
                    <div className="property-row">
                      <div className="property-input-group">
                        <span className="property-label">X</span>
                        <input
                          type="number"
                          value={Math.round(selectedObject.x)}
                          onChange={(e) => updateObject(selectedObject.id, { x: parseFloat(e.target.value) })}
                        />
                        <button
                          className={`keyframe-btn-inline ${hasKeyframeAt(selectedObject.id, 'position', Math.round(currentFrame)) ? 'active' : ''}`}
                          onClick={() => {
                            if (hasKeyframeAt(selectedObject.id, 'position', Math.round(currentFrame))) {
                              removeKeyframe(selectedObject.id, 'position', Math.round(currentFrame));
                            } else {
                              addKeyframe(selectedObject.id, 'position', Math.round(currentFrame), { x: selectedObject.x, y: selectedObject.y });
                            }
                          }}
                        >
                          ◆
                        </button>
                      </div>
                      <div className="property-input-group">
                        <span className="property-label">Y</span>
                        <input
                          type="number"
                          value={Math.round(selectedObject.y)}
                          onChange={(e) => updateObject(selectedObject.id, { y: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="property-group">
                    <label>Size</label>
                    <div className="property-row">
                      <div className="property-input-group">
                        <span className="property-label">W</span>
                        <input
                          type="number"
                          value={Math.round(selectedObject.width)}
                          onChange={(e) => updateObject(selectedObject.id, { width: parseFloat(e.target.value) })}
                        />
                        <button
                          className={`keyframe-btn-inline ${hasKeyframeAt(selectedObject.id, 'scale', Math.round(currentFrame)) ? 'active' : ''}`}
                          onClick={() => {
                            if (hasKeyframeAt(selectedObject.id, 'scale', Math.round(currentFrame))) {
                              removeKeyframe(selectedObject.id, 'scale', Math.round(currentFrame));
                            } else {
                              addKeyframe(selectedObject.id, 'scale', Math.round(currentFrame), { width: selectedObject.width, height: selectedObject.height });
                            }
                          }}
                        >
                          ◆
                        </button>
                      </div>
                      <div className="property-input-group">
                        <span className="property-label">H</span>
                        <input
                          type="number"
                          value={Math.round(selectedObject.height)}
                          onChange={(e) => updateObject(selectedObject.id, { height: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="property-group">
                    <label>Rotation</label>
                    <div className="property-input-group">
                      <input
                        type="number"
                        value={Math.round(selectedObject.rotation)}
                        onChange={(e) => updateObject(selectedObject.id, { rotation: parseFloat(e.target.value) })}
                      />
                      <span className="property-unit">°</span>
                      <button
                        className={`keyframe-btn-inline ${hasKeyframeAt(selectedObject.id, 'rotation', Math.round(currentFrame)) ? 'active' : ''}`}
                        onClick={() => {
                          if (hasKeyframeAt(selectedObject.id, 'rotation', Math.round(currentFrame))) {
                            removeKeyframe(selectedObject.id, 'rotation', Math.round(currentFrame));
                          } else {
                            addKeyframe(selectedObject.id, 'rotation', Math.round(currentFrame), selectedObject.rotation);
                          }
                        }}
                      >
                        ◆
                      </button>
                    </div>
                  </div>

                  <div className="property-group">
                    <label>Opacity</label>
                    <div className="property-input-group">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selectedObject.opacity}
                        onChange={(e) => updateObject(selectedObject.id, { opacity: parseFloat(e.target.value) })}
                      />
                      <span className="property-value">{Math.round(selectedObject.opacity * 100)}%</span>
                      <button
                        className={`keyframe-btn-inline ${hasKeyframeAt(selectedObject.id, 'opacity', Math.round(currentFrame)) ? 'active' : ''}`}
                        onClick={() => {
                          if (hasKeyframeAt(selectedObject.id, 'opacity', Math.round(currentFrame))) {
                            removeKeyframe(selectedObject.id, 'opacity', Math.round(currentFrame));
                          } else {
                            addKeyframe(selectedObject.id, 'opacity', Math.round(currentFrame), selectedObject.opacity);
                          }
                        }}
                      >
                        ◆
                      </button>
                    </div>
                  </div>

                  {selectedObject.type !== 'emoji' && selectedObject.type !== 'text' && (
                    <>
                      <div className="property-group">
                        <label>Fill Color</label>
                        <input
                          type="color"
                          value={selectedObject.fill}
                          onChange={(e) => updateObject(selectedObject.id, { fill: e.target.value })}
                        />
                      </div>

                      <div className="property-group">
                        <label>Stroke Color</label>
                        <input
                          type="color"
                          value={selectedObject.stroke}
                          onChange={(e) => updateObject(selectedObject.id, { stroke: e.target.value })}
                        />
                      </div>

                      <div className="property-group">
                        <label>Stroke Width</label>
                        <input
                          type="number"
                          value={selectedObject.strokeWidth}
                          onChange={(e) => updateObject(selectedObject.id, { strokeWidth: parseFloat(e.target.value) })}
                        />
                      </div>
                    </>
                  )}

                  <div className="property-group">
                    <button
                      className="btn-danger"
                      onClick={() => {
                        deleteObject(selectedObject.id);
                        saveHistory(objects);
                      }}
                    >
                      Delete Object
                    </button>
                  </div>
                </>
              )}

              {/* Animation Tab Content */}
              {selectedObject && propertiesPanelTab === 'animation' && (
                <>
                  <div className="property-group">
                    <label>Add Animation</label>
                    <button
                      className="btn-animation-preset"
                      onClick={() => setShowAnimationPresetsDialog(true)}
                    >
                      ✨ Add Animation Preset
                    </button>
                  </div>

                  {/* Show Existing Keyframes */}
                  {keyframes[selectedObject.id] && Object.keys(keyframes[selectedObject.id]).length > 0 && (
                    <div className="property-group">
                      <label>Existing Animations</label>
                      <div className="animation-list">
                        {Object.keys(keyframes[selectedObject.id]).map(property => (
                          <div key={property} className="animation-item">
                            <div className="animation-item-header">
                              <span className="animation-property-name">{property.charAt(0).toUpperCase() + property.slice(1)}</span>
                              <span className="animation-keyframe-count">
                                {keyframes[selectedObject.id][property].length} keyframe{keyframes[selectedObject.id][property].length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="animation-keyframes">
                              {keyframes[selectedObject.id][property].map((kf, idx) => (
                                <div key={idx} className="keyframe-chip">
                                  <span>Frame {kf.frame}</span>
                                  <button
                                    className="keyframe-chip-delete"
                                    onClick={() => removeKeyframe(selectedObject.id, property, kf.frame)}
                                    title="Remove keyframe"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No animations state */}
                  {(!keyframes[selectedObject.id] || Object.keys(keyframes[selectedObject.id]).length === 0) && (
                    <div className="empty-state-animation">
                      <div className="empty-state-icon">🎬</div>
                      <div className="empty-state-text">No animations yet</div>
                      <div className="empty-state-hint">Click "Add Animation Preset" to get started</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Animation Presets Dialog */}
        <AnimationPresetsDialog
          isOpen={showAnimationPresetsDialog}
          onClose={() => setShowAnimationPresetsDialog(false)}
          onApplyPreset={handleApplyAnimationPreset}
          selectedObject={selectedObject}
          currentFrame={Math.round(currentFrame)}
        />

        {/* Share Modal */}
        {showShareModal && (
          <div className="modal-overlay">
            <div className="modal-container share-modal">
              <div className="modal-header">
                <h3>Share and Invite</h3>
                <button className="modal-close" onClick={() => setShowShareModal(false)}>×</button>
              </div>
              <div className="modal-content">
                <div className="share-section">
                  <label>Share via link</label>
                  <div className="link-copy-group">
                    <input readOnly value={`${window.location.origin}/editor/${dashboardId || 'new'}`} />
                    <button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/editor/${dashboardId || 'new'}`);
                      alert('Link copied!');
                    }}>Copy</button>
                  </div>
                </div>
                <div className="share-section">
                  <label>Who can view?</label>
                  <select>
                    <option>Private (Only people in this team can view)</option>
                    <option>Public (Anyone can view)</option>
                  </select>
                </div>
                <div className="share-section">
                  <textarea
                    placeholder="Team member emails"
                    value={shareEmails}
                    onChange={(e) => setShareEmails(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-primary full-width" onClick={handleSendInvites}>Send invites</button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="modal-overlay">
            <div className="modal-container export-modal">
              <div className="modal-header">
                <h3>Export</h3>
                <button className="modal-close" onClick={() => setShowExportModal(false)}>×</button>
              </div>
              <div className="modal-content export-grid">
                <div className="export-preview">
                  <div className="preview-canvas-placeholder">
                    {previewImage ? (
                      <img src={previewImage} alt="Export preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div className="placeholder-text">Rendering preview...</div>
                    )}
                    {exportOptions.watermark === 'Include a watermark' && (
                      <div className="placeholder-watermark">Made with LoMoji</div>
                    )}
                  </div>
                </div>
                <div className="export-controls">
                  <div className="control-group">
                    <label>File type</label>
                    <select
                      value={exportOptions.fileType}
                      onChange={(e) => setExportOptions({ ...exportOptions, fileType: e.target.value })}
                    >
                      <option value="video">Video</option>
                      <option value="gif">GIF</option>
                      <option value="png">PNG</option>
                      <option value="svg">SVG</option>
                    </select>
                  </div>
                  <div className="control-group">
                    <label>File name</label>
                    <input
                      type="text"
                      className="export-name-input"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="e.g. My Animation"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        background: '#fff',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div className="control-group">
                    <label>Size</label>
                    <div className="info-text">47.7 KB</div>
                  </div>
                  <div className="control-group">
                    <label>Watermark</label>
                    <select
                      value={exportOptions.watermark}
                      onChange={(e) => setExportOptions({ ...exportOptions, watermark: e.target.value })}
                    >
                      <option>Include a watermark</option>
                      <option>No watermark</option>
                    </select>
                  </div>

                  {isExporting && (
                    <div className="export-progress-container">
                      <div className="progress-label">Preparing: {exportProgress}%</div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  <button
                    className="btn-primary full-width"
                    style={{ marginTop: '20px', position: 'relative' }}
                    disabled={isExporting}
                    onClick={() => {
                      const type = exportOptions.fileType;
                      if (type === 'video') {
                        exportAsVideoPro();
                      } else if (type === 'gif') {
                        exportAsGIF();
                      } else if (type === 'png') {
                        exportAsPNG();
                      } else if (type === 'svg') {
                        exportAsSVG();
                      } else if (type === 'emoji') {
                        exportAsEmoji();
                      } else if (type === 'frames_zip') {
                        exportAsFramesZip();
                      } else {
                        exportAsLoMoji();
                      }

                      if (type !== 'video' && type !== 'gif') setShowExportModal(false);
                    }}
                  >
                    {isExporting ? 'Encoding...' : 'Download'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Professional Timeline - Adobe Animate Style */}
      <ProfessionalTimeline
        layers={objectsToLayers()}
        currentFrame={Math.round(currentFrame)}
        totalFrames={totalFrames}
        fps={fps}
        isPlaying={isPlaying}
        loopEnabled={loopEnabled}
        onionSkinEnabled={onionSkinEnabled}
        onionSkinRange={onionSkinRange}
        timelineZoom={timelineZoom}
        selectedLayerIds={selectedObjectIds}
        onFrameChange={setCurrentFrame}
        onLayersChange={handleLayersChange}
        onSelectLayers={setSelectedObjectIds}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onFpsChange={setFps}
        onOnionSkinToggle={() => setOnionSkinEnabled(!onionSkinEnabled)}
        onTimelineZoomChange={setTimelineZoom}
        onAddKeyframe={handleAddKeyframePro}
        onRemoveKeyframe={handleRemoveKeyframePro}
        onAddLayer={handleAddLayerPro}
        onDeleteLayer={handleDeleteLayerPro}
        onUpdateLayer={handleUpdateLayerPro}
      />
    </div>
  );
};

export default AnimationTool;
