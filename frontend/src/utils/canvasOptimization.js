/**
 * Canvas Performance Optimization Utilities
 * Production-ready canvas rendering with zero flicker
 */

/**
 * OffscreenCanvas Pool - Reuse canvases for better performance
 */
class CanvasPool {
  constructor(maxSize = 10) {
    this.pool = [];
    this.maxSize = maxSize;
  }

  acquire(width, height) {
    let canvas = this.pool.pop();

    if (!canvas) {
      canvas = document.createElement('canvas');
    }

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }

  release(canvas) {
    if (this.pool.length < this.maxSize) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.pool.push(canvas);
    }
  }

  clear() {
    this.pool = [];
  }
}

export const canvasPool = new CanvasPool();

/**
 * Double Buffering System - Prevents flickering
 */
export class DoubleBuffer {
  constructor(width, height) {
    this.frontBuffer = document.createElement('canvas');
    this.backBuffer = document.createElement('canvas');
    this.resize(width, height);
  }

  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;

    // Front buffer (display)
    this.frontBuffer.width = Math.floor(width * dpr);
    this.frontBuffer.height = Math.floor(height * dpr);
    this.frontBuffer.style.width = `${width}px`;
    this.frontBuffer.style.height = `${height}px`;

    // Back buffer (rendering)
    this.backBuffer.width = Math.floor(width * dpr);
    this.backBuffer.height = Math.floor(height * dpr);

    // Scale contexts for DPI
    const frontCtx = this.frontBuffer.getContext('2d');
    const backCtx = this.backBuffer.getContext('2d');

    frontCtx.scale(dpr, dpr);
    backCtx.scale(dpr, dpr);
  }

  getContext() {
    return this.backBuffer.getContext('2d');
  }

  swap() {
    const frontCtx = this.frontBuffer.getContext('2d');
    frontCtx.clearRect(
      0,
      0,
      this.frontBuffer.width,
      this.frontBuffer.height
    );
    frontCtx.drawImage(this.backBuffer, 0, 0);
  }

  clear() {
    const ctx = this.backBuffer.getContext('2d');
    ctx.clearRect(0, 0, this.backBuffer.width, this.backBuffer.height);
  }

  getCanvas() {
    return this.frontBuffer;
  }
}

/**
 * Dirty Rectangle Tracking - Only redraw changed areas
 */
export class DirtyRectTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this.dirty = false;
  }

  markDirty(x, y, width, height) {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x + width);
    this.maxY = Math.max(this.maxY, y + height);
    this.dirty = true;
  }

  getDirtyRect() {
    if (!this.dirty) return null;

    // Add padding for anti-aliasing
    const padding = 2;

    return {
      x: Math.max(0, Math.floor(this.minX) - padding),
      y: Math.max(0, Math.floor(this.minY) - padding),
      width: Math.ceil(this.maxX - this.minX) + padding * 2,
      height: Math.ceil(this.maxY - this.minY) + padding * 2,
    };
  }

  isDirty() {
    return this.dirty;
  }
}

/**
 * Render Queue - Batch rendering operations
 */
export class RenderQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  add(renderFn, priority = 0) {
    this.queue.push({ renderFn, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  async process(ctx) {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const { renderFn } = this.queue.shift();
      await renderFn(ctx);
    }

    this.processing = false;
  }

  clear() {
    this.queue = [];
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}

/**
 * Layer System - Separate static and dynamic content
 */
export class LayerManager {
  constructor() {
    this.layers = new Map();
  }

  createLayer(name, width, height) {
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    this.layers.set(name, {
      canvas,
      ctx,
      dirty: true,
      visible: true,
      opacity: 1,
    });

    return ctx;
  }

  getLayer(name) {
    return this.layers.get(name);
  }

  markDirty(name) {
    const layer = this.layers.get(name);
    if (layer) {
      layer.dirty = true;
    }
  }

  setVisible(name, visible) {
    const layer = this.layers.get(name);
    if (layer) {
      layer.visible = visible;
    }
  }

  setOpacity(name, opacity) {
    const layer = this.layers.get(name);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
    }
  }

  composite(targetCtx, width, height) {
    targetCtx.clearRect(0, 0, width, height);

    for (const [name, layer] of this.layers) {
      if (!layer.visible) continue;

      targetCtx.globalAlpha = layer.opacity;
      targetCtx.drawImage(layer.canvas, 0, 0, width, height);
    }

    targetCtx.globalAlpha = 1;
  }

  clear(name) {
    const layer = this.layers.get(name);
    if (layer) {
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.dirty = true;
    }
  }

  clearAll() {
    for (const [name] of this.layers) {
      this.clear(name);
    }
  }

  deleteLayer(name) {
    this.layers.delete(name);
  }

  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;

    for (const [name, layer] of this.layers) {
      layer.canvas.width = Math.floor(width * dpr);
      layer.canvas.height = Math.floor(height * dpr);
      layer.ctx.scale(dpr, dpr);
      layer.dirty = true;
    }
  }
}

/**
 * Object Culling - Don't render offscreen objects
 */
export function isInViewport(object, viewport) {
  const { x, y, width, height } = object;
  const { x: vx, y: vy, width: vw, height: vh } = viewport;

  return (
    x + width >= vx &&
    x <= vx + vw &&
    y + height >= vy &&
    y <= vy + vh
  );
}

/**
 * Spatial Hash - Fast collision detection and spatial queries
 */
export class SpatialHash {
  constructor(cellSize = 100) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  getKey(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  insert(object) {
    const { x, y, width, height } = object;

    const startX = Math.floor(x / this.cellSize);
    const startY = Math.floor(y / this.cellSize);
    const endX = Math.floor((x + width) / this.cellSize);
    const endY = Math.floor((y + height) / this.cellSize);

    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        const key = `${cx},${cy}`;
        if (!this.grid.has(key)) {
          this.grid.set(key, new Set());
        }
        this.grid.get(key).add(object);
      }
    }
  }

  remove(object) {
    for (const [key, objects] of this.grid) {
      objects.delete(object);
      if (objects.size === 0) {
        this.grid.delete(key);
      }
    }
  }

  query(x, y, width, height) {
    const results = new Set();

    const startX = Math.floor(x / this.cellSize);
    const startY = Math.floor(y / this.cellSize);
    const endX = Math.floor((x + width) / this.cellSize);
    const endY = Math.floor((y + height) / this.cellSize);

    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        const key = `${cx},${cy}`;
        const objects = this.grid.get(key);
        if (objects) {
          objects.forEach((obj) => results.add(obj));
        }
      }
    }

    return Array.from(results);
  }

  clear() {
    this.grid.clear();
  }
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 0,
      frameTime: 0,
      renderTime: 0,
      objectCount: 0,
    };

    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsUpdateTime = this.lastTime;
  }

  startFrame() {
    this.frameStart = performance.now();
  }

  endFrame(objectCount = 0) {
    const now = performance.now();
    this.frameCount++;

    // Update metrics
    this.metrics.renderTime = now - this.frameStart;
    this.metrics.objectCount = objectCount;

    // Update FPS every second
    if (now - this.fpsUpdateTime >= 1000) {
      this.metrics.fps = Math.round(
        (this.frameCount * 1000) / (now - this.fpsUpdateTime)
      );
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }

    this.metrics.frameTime = now - this.lastTime;
    this.lastTime = now;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsUpdateTime = this.lastTime;
  }
}

/**
 * Canvas Context Optimizer
 */
export function optimizeContext(ctx) {
  // Enable hardware acceleration hints
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Use faster composite operations when possible
  ctx.globalCompositeOperation = 'source-over';

  return ctx;
}

/**
 * Batch Draw Operations
 */
export function batchDrawOperations(ctx, operations) {
  ctx.save();

  for (const operation of operations) {
    operation(ctx);
  }

  ctx.restore();
}

/**
 * Memoized Path Creation
 */
const pathCache = new Map();

export function getCachedPath(key, createPathFn) {
  if (!pathCache.has(key)) {
    const path = new Path2D();
    createPathFn(path);
    pathCache.set(key, path);
  }
  return pathCache.get(key);
}

export function clearPathCache() {
  pathCache.clear();
}

/**
 * Throttled Render Function
 */
export function createThrottledRender(renderFn, fps = 60) {
  let lastRender = 0;
  const interval = 1000 / fps;

  return function (...args) {
    const now = performance.now();
    if (now - lastRender >= interval) {
      renderFn(...args);
      lastRender = now;
    }
  };
}

/**
 * Canvas to Blob with Worker (faster export)
 */
export async function canvasToBlobAsync(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      type,
      quality
    );
  });
}

export default {
  CanvasPool,
  canvasPool,
  DoubleBuffer,
  DirtyRectTracker,
  RenderQueue,
  LayerManager,
  isInViewport,
  SpatialHash,
  PerformanceMonitor,
  optimizeContext,
  batchDrawOperations,
  getCachedPath,
  clearPathCache,
  createThrottledRender,
  canvasToBlobAsync,
};
