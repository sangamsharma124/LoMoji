import React, { useState } from 'react';
import './AnimationTool.css';

/**
 * Objects Panel Component - Simple Layer List
 * Displays all objects/layers in the canvas for easy management
 * Clean, minimal design showing only object layers
 */
const ObjectsPanel = ({
  objects = [],
  selectedObjectIds = [],
  onSelectObject,
  onUpdateObject,
  onDeleteObject,
  onDuplicateObject,
  onReorderObjects,
  currentFrame
}) => {
  const [editingObjectId, setEditingObjectId] = useState(null);
  const [objectNameInput, setObjectNameInput] = useState('');
  const [draggedObject, setDraggedObject] = useState(null);
  const [dragOverObject, setDragOverObject] = useState(null);

  // Get icon for object type
  const getObjectIcon = (type) => {
    const icons = {
      rectangle: '▭',
      circle: '⬤',
      text: '𝑻',
      image: '🖼️',
      line: '╱',
      path: '✏️',
      emoji: '😊',
      polygon: '⬟'
    };
    return icons[type] || '📦';
  };

  // Handle object rename
  const handleRename = (objectId, newName) => {
    if (onUpdateObject && newName.trim()) {
      onUpdateObject(objectId, { name: newName.trim() });
    }
    setEditingObjectId(null);
  };

  // Handle visibility toggle
  const handleToggleVisibility = (objectId) => {
    const obj = objects.find(o => o.id === objectId);
    if (obj && onUpdateObject) {
      onUpdateObject(objectId, { visible: !obj.visible });
    }
  };

  // Handle lock toggle
  const handleToggleLock = (objectId) => {
    const obj = objects.find(o => o.id === objectId);
    if (obj && onUpdateObject) {
      onUpdateObject(objectId, { locked: !obj.locked });
    }
  };

  // Drag and drop handlers for reordering
  const handleDragStart = (e, object) => {
    setDraggedObject(object);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, object) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedObject && draggedObject.id !== object.id) {
      setDragOverObject(object);
    }
  };

  const handleDragLeave = () => {
    setDragOverObject(null);
  };

  const handleDrop = (e, targetObject) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedObject || draggedObject.id === targetObject.id) {
      setDraggedObject(null);
      setDragOverObject(null);
      return;
    }

    // Reorder objects
    const draggedIndex = objects.findIndex(o => o.id === draggedObject.id);
    const targetIndex = objects.findIndex(o => o.id === targetObject.id);

    if (draggedIndex !== -1 && targetIndex !== -1 && onReorderObjects) {
      const newObjects = [...objects];
      const [removed] = newObjects.splice(draggedIndex, 1);
      newObjects.splice(targetIndex, 0, removed);
      onReorderObjects(newObjects);
    }

    setDraggedObject(null);
    setDragOverObject(null);
  };

  const handleDragEnd = () => {
    setDraggedObject(null);
    setDragOverObject(null);
  };

  return (
    <div className="panel objects-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <h3>Objects</h3>
        <span className="object-count">{objects.length} {objects.length === 1 ? 'layer' : 'layers'}</span>
      </div>

      {/* Objects List */}
      <div className="objects-list-full">
        {objects.length === 0 ? (
          <div className="objects-empty-state">
            <div className="empty-state-icon">🎯</div>
            <h4 className="empty-state-title">No object selected</h4>
            <p className="empty-state-message">Select an object on the canvas to edit its properties</p>
          </div>
        ) : (
          objects.map((object, index) => (
            <div
              key={object.id}
              className={`object-item layer-item ${selectedObjectIds.includes(object.id) ? 'selected' : ''} ${draggedObject?.id === object.id ? 'dragging' : ''} ${dragOverObject?.id === object.id ? 'drag-over' : ''}`}
              onClick={() => onSelectObject && onSelectObject([object.id])}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, object)}
              onDragOver={(e) => handleDragOver(e, object)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, object)}
              onDragEnd={handleDragEnd}
            >
              {/* Left Section - Icon and Name */}
              <div className="layer-item-left">
                <span className="layer-icon object-type-icon">{getObjectIcon(object.type)}</span>

                {editingObjectId === object.id ? (
                  <input
                    type="text"
                    className="layer-name-input"
                    value={objectNameInput}
                    onChange={(e) => setObjectNameInput(e.target.value)}
                    onBlur={() => handleRename(object.id, objectNameInput)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(object.id, objectNameInput);
                      if (e.key === 'Escape') setEditingObjectId(null);
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="layer-name object-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingObjectId(object.id);
                      setObjectNameInput(object.name);
                    }}
                  >
                    {object.name}
                  </div>
                )}
              </div>

              {/* Right Section - Controls */}
              <div className="layer-item-right object-controls">
                <button
                  className={`layer-visibility-btn ${!object.visible ? 'hidden' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleVisibility(object.id);
                  }}
                  title={object.visible ? 'Hide Object' : 'Show Object'}
                >
                  {object.visible ? '👁' : '🚫'}
                </button>

                <button
                  className={`layer-lock-btn ${object.locked ? 'locked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLock(object.id);
                  }}
                  title={object.locked ? 'Unlock Object' : 'Lock Object'}
                >
                  {object.locked ? '🔒' : '🔓'}
                </button>

                <button
                  className="object-duplicate-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDuplicateObject) onDuplicateObject(object.id);
                  }}
                  title="Duplicate Object"
                >
                  📋
                </button>

                <button
                  className="object-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeleteObject && confirm(`Delete "${object.name}"?`)) {
                      onDeleteObject(object.id);
                    }
                  }}
                  title="Delete Object"
                >
                  🗑️
                </button>
              </div>

              {/* Object Properties Summary - Hidden */}
              {/* {selectedObjectIds.includes(object.id) && (
                <div className="object-properties-summary">
                  <div className="property-chip">
                    <span className="property-label">Pos:</span>
                    <span className="property-value">{Math.round(object.x)}, {Math.round(object.y)}</span>
                  </div>
                  <div className="property-chip">
                    <span className="property-label">Size:</span>
                    <span className="property-value">{Math.round(object.width)} × {Math.round(object.height)}</span>
                  </div>
                  <div className="property-chip">
                    <span className="property-label">Opacity:</span>
                    <span className="property-value">{Math.round(object.opacity * 100)}%</span>
                  </div>
                </div>
              )} */}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ObjectsPanel;
